"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError } from "../lib/api-client";

export type ResourceState<T> =
  | { status: "loading"; data: T | null; error: null }
  | { status: "ready"; data: T; error: null }
  | {
      status: "error";
      data: T | null;
      error: string;
      errorStatus: number | null;
      errorCode: string | null;
    };

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
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    loader(controller.signal)
      .then((data) => {
        setState({ status: "ready", data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          data: null,
          error: messageFor(error),
          errorStatus: error instanceof ApiClientError ? error.status : null,
          errorCode: error instanceof ApiClientError ? error.code : null,
        });
      });

    return () => controller.abort();
  }, [loader, requestVersion]);

  const reload = useCallback(() => {
    setState({ status: "loading", data: null, error: null });
    setRequestVersion((current) => current + 1);
  }, []);

  const refresh = useCallback(() => {
    setRequestVersion((current) => current + 1);
  }, []);

  return { ...state, reload, refresh };
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
