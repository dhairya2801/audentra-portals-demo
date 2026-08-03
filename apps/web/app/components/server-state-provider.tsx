"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ServerRefreshReason =
  | "record_changed"
  | "window_focus"
  | "connection_restored"
  | "tab_visible"
  | "manual";

interface ServerStateCoordinator {
  revision: number;
  isOnline: boolean;
  lastReason: ServerRefreshReason | null;
  requestRefresh: (reason?: ServerRefreshReason) => void;
}

const ServerStateContext = createContext<ServerStateCoordinator>({
  revision: 0,
  isOnline: true,
  lastReason: null,
  requestRefresh: () => undefined,
});

export function ServerStateProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [lastReason, setLastReason] = useState<ServerRefreshReason | null>(null);
  const lastAmbientRefreshAt = useRef(0);

  const requestRefresh = useCallback((reason: ServerRefreshReason = "manual") => {
    const now = Date.now();
    if (
      ["window_focus", "tab_visible"].includes(reason) &&
      now - lastAmbientRefreshAt.current < 400
    ) {
      return;
    }
    if (["window_focus", "tab_visible"].includes(reason)) {
      lastAmbientRefreshAt.current = now;
    }
    setLastReason(reason);
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    const initialStatusTimer = window.setTimeout(
      () => setIsOnline(navigator.onLine),
      0,
    );
    const onRecordChanged = () => requestRefresh("record_changed");
    const onFocus = () => requestRefresh("window_focus");
    const onOnline = () => {
      setIsOnline(true);
      requestRefresh("connection_restored");
    };
    const onOffline = () => setIsOnline(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") requestRefresh("tab_visible");
    };

    window.addEventListener("vv:student-record-changed", onRecordChanged);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(initialStatusTimer);
      window.removeEventListener("vv:student-record-changed", onRecordChanged);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [requestRefresh]);

  const value = useMemo(
    () => ({ revision, isOnline, lastReason, requestRefresh }),
    [isOnline, lastReason, requestRefresh, revision],
  );

  return (
    <ServerStateContext.Provider value={value}>
      {children}
    </ServerStateContext.Provider>
  );
}

export function useServerStateCoordinator() {
  return useContext(ServerStateContext);
}
