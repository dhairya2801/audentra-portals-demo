"use client";

import { useCallback, useEffect, useState } from "react";
import { useServerStateCoordinator } from "../components/server-state-provider";
import { ApiClientError } from "../lib/api-client";

type ResourceMetadata = {
  isRefreshing: boolean;
  refreshError: string | null;
  lastUpdatedAt: number | null;
};

export type ResourceState<T> = (
  | { status: "loading"; data: T | null; error: null }
  | { status: "ready"; data: T; error: null }
  | {
      status: "error";
      data: T | null;
      error: string;
      errorStatus: number | null;
      errorCode: string | null;
    }) &
  ResourceMetadata;

function messageFor(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.status === 403) {
      return "Your session has expired. Sign in again to continue.";
    }
    return error.message;
  }
  return "We couldn’t load this information. Check your connection and try again.";
}

export function useApiResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
) {
  const coordinator = useServerStateCoordinator();
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({
    status: "loading",
    data: null,
    error: null,
    isRefreshing: false,
    refreshError: null,
    lastUpdatedAt: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setState((current) =>
        current.data === null
          ? {
              status: "loading",
              data: null,
              error: null,
              isRefreshing: false,
              refreshError: null,
              lastUpdatedAt: current.lastUpdatedAt,
            }
          : {
              status: "ready",
              data: current.data,
              error: null,
              isRefreshing: true,
              refreshError: null,
              lastUpdatedAt: current.lastUpdatedAt,
            },
      );
    });

    loader(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({
          status: "ready",
          data,
          error: null,
          isRefreshing: false,
          refreshError: null,
          lastUpdatedAt: Date.now(),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = messageFor(error);
        const authenticationFailure =
          error instanceof ApiClientError && [401, 403].includes(error.status);
        setState((current) =>
          current.data === null || authenticationFailure
            ? {
                status: "error",
                data: null,
                error: message,
                errorStatus: error instanceof ApiClientError ? error.status : null,
                errorCode: error instanceof ApiClientError ? error.code : null,
                isRefreshing: false,
                refreshError: null,
                lastUpdatedAt: current.lastUpdatedAt,
              }
            : {
                status: "ready",
                data: current.data,
                error: null,
                isRefreshing: false,
                refreshError: message,
                lastUpdatedAt: current.lastUpdatedAt,
              },
        );
      });

    return () => controller.abort();
  }, [coordinator.revision, loader, requestVersion]);

  const reload = useCallback(() => {
    setState((current) => ({
      status: "loading",
      data: null,
      error: null,
      isRefreshing: false,
      refreshError: null,
      lastUpdatedAt: current.lastUpdatedAt,
    }));
    setRequestVersion((current) => current + 1);
  }, []);

  const refresh = useCallback(() => {
    setRequestVersion((current) => current + 1);
  }, []);

  return {
    ...state,
    reload,
    refresh,
    isOnline: coordinator.isOnline,
    lastRefreshReason: coordinator.lastReason,
  };
}

export type ActionState = {
  status: "idle" | "loading" | "success" | "error";
  message: string | null;
};

export function useApiAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
  errorMessage: (error: unknown) => string = messageFor,
) {
  const [state, setState] = useState<ActionState>({
    status: "idle",
    message: null,
  });

  const run = useCallback(
    async (...args: Args) => {
      setState({ status: "loading", message: null });
      try {
        const result = await action(...args);
        setState({ status: "success", message: null });
        return result;
      } catch (error) {
        setState({ status: "error", message: errorMessage(error) });
        throw error;
      }
    },
    [action, errorMessage],
  );

  const reset = useCallback(() => {
    setState({ status: "idle", message: null });
  }, []);

  return { ...state, run, reset };
}

export { messageFor as getApiErrorMessage };
