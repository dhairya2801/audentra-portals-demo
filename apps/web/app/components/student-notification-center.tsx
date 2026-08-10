"use client";

import type { StudentMessage } from "@vv/contracts";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApiResource } from "../hooks/use-api-resource";
import {
  getStudentMessages,
  markStudentMessageRead,
} from "../lib/api-client";
import { safePortalDestination } from "../lib/safe-destination";
import { TenantLink as Link } from "./tenant-link";
import styles from "./student-notification-center.module.css";

function sentLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function messageDestination(message: StudentMessage) {
  return safePortalDestination(message.href, "/messages");
}

function MessageDestinationLink({
  message,
  children,
  onClick,
}: {
  message: StudentMessage;
  children: ReactNode;
  onClick: () => void;
}) {
  const destination = messageDestination(message);
  if (destination.external) {
    return (
      <a
        href={destination.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={destination.href} onClick={onClick}>
      {children}
    </Link>
  );
}

export function StudentNotificationCenter({
  fallbackUnreadCount,
  suppressTransient = false,
}: {
  fallbackUnreadCount: number;
  suppressTransient?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const knownUnreadIds = useRef<Set<string> | null>(null);
  const loadMessages = useCallback(
    (signal: AbortSignal) => getStudentMessages(signal),
    [],
  );
  const messages = useApiResource(loadMessages);
  const refreshMessages = messages.refresh;
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<StudentMessage | null>(null);
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") refreshMessages();
    };
    const interval = window.setInterval(poll, 8_000);
    const refreshAfterRealtimeEvent = () => refreshMessages();
    window.addEventListener("vv:student-realtime", refreshAfterRealtimeEvent);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(
        "vv:student-realtime",
        refreshAfterRealtimeEvent,
      );
    };
  }, [refreshMessages]);

  useEffect(() => {
    if (!messages.data) return;
    const unread = messages.data.items.filter((message) => !message.readAt);
    const nextIds = new Set(unread.map((message) => message.id));
    if (knownUnreadIds.current === null) {
      knownUnreadIds.current = nextIds;
      return;
    }
    const newlyArrived = unread.find(
      (message) => !knownUnreadIds.current?.has(message.id),
    );
    knownUnreadIds.current = nextIds;
    if (newlyArrived && !suppressTransient) setToast(newlyArrived);
  }, [messages.data, suppressTransient]);

  useEffect(() => {
    if (!suppressTransient) return;
    const frame = window.requestAnimationFrame(() => {
      setOpen(false);
      setToast(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [suppressTransient]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 7_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => trigger.current?.focus());
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const markRead = async (message: StudentMessage) => {
    if (message.readAt || optimisticReadIds.has(message.id)) return;
    setBusyId(message.id);
    setActionError(null);
    setOptimisticReadIds((current) => new Set(current).add(message.id));
    try {
      await markStudentMessageRead(message.id);
      refreshMessages();
    } catch (error) {
      setOptimisticReadIds((current) => {
        const next = new Set(current);
        next.delete(message.id);
        return next;
      });
      setActionError(
        error instanceof Error
          ? error.message
          : "The notification could not be marked as read.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const unreadCount = messages.data
    ? messages.data.items.filter(
        (message) => !message.readAt && !optimisticReadIds.has(message.id),
      ).length
    : fallbackUnreadCount;
  const latestMessages = messages.data?.items.slice(0, 5) ?? [];

  return (
    <div className={styles.root} ref={root}>
      <button
        ref={trigger}
        className={`aster-notification-link ${styles.trigger}`}
        type="button"
        aria-label={`${unreadCount} unread notifications`}
        aria-expanded={open && !suppressTransient}
        aria-controls="student-notification-panel"
        onClick={() => {
          setOpen((current) => !current);
          setToast(null);
        }}
      >
        <span aria-hidden="true">●</span>
        Notifications
        {unreadCount > 0 ? <strong>{unreadCount}</strong> : null}
      </button>

      {open && !suppressTransient ? (
        <section
          id="student-notification-panel"
          className={styles.panel}
          role="region"
          aria-label="Notifications"
        >
          <header>
            <div>
              <p>Student inbox</p>
              <h2>Notifications</h2>
            </div>
            <span>{unreadCount} unread</span>
          </header>
          {messages.status === "loading" ? (
            <p className={styles.state} role="status">
              Checking for updates…
            </p>
          ) : messages.status === "error" ? (
            <div className={styles.state} role="alert">
              <p>{messages.error}</p>
              <button type="button" onClick={messages.reload}>
                Try again
              </button>
            </div>
          ) : latestMessages.length ? (
            <ul>
              {latestMessages.map((message) => {
                const unread =
                  !message.readAt && !optimisticReadIds.has(message.id);
                return (
                  <li className={unread ? styles.unread : undefined} key={message.id}>
                    <span className={styles.dot} aria-hidden="true" />
                    <div>
                      <MessageDestinationLink
                        message={message}
                        onClick={() => void markRead(message)}
                      >
                        {message.subject}
                      </MessageDestinationLink>
                      <p>{message.senderName}</p>
                      <time dateTime={message.sentAt}>
                        {sentLabel(message.sentAt)}
                      </time>
                    </div>
                    {unread ? (
                      <button
                        className={styles.readButton}
                        type="button"
                        disabled={busyId === message.id}
                        onClick={() => void markRead(message)}
                      >
                        {busyId === message.id ? "Saving…" : "Mark read"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.state}>You are all caught up.</p>
          )}
          {actionError ? (
            <p className={styles.error} role="alert">
              {actionError}
            </p>
          ) : null}
          <footer>
            <Link href="/messages" onClick={() => setOpen(false)}>
              Open full inbox <span aria-hidden="true">→</span>
            </Link>
          </footer>
        </section>
      ) : null}

      {toast && !suppressTransient ? (
        <aside className={styles.toast} role="status" aria-live="polite">
          <span className={styles.toastIcon} aria-hidden="true">●</span>
          <div>
            <small>New notification</small>
            <strong>{toast.subject}</strong>
            <p>{toast.senderName}</p>
            <MessageDestinationLink
              message={toast}
              onClick={() => {
                setToast(null);
                void markRead(toast);
              }}
            >
              View message
            </MessageDestinationLink>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </aside>
      ) : null}
    </div>
  );
}
