"use client";

import type { StaffNotification, StaffNotificationList } from "@vv/contracts";
import { useCallback, useEffect, useState } from "react";
import {
  getStaffNotifications,
  markStaffNotificationRead,
} from "../lib/api-client";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationCenter({
  onOpenWorkItem,
  subscribeToRealtimeInvalidation,
}: {
  onOpenWorkItem: (workItemId: string) => void;
  subscribeToRealtimeInvalidation?: (invalidate: () => void) => () => void;
}) {
  const [notifications, setNotifications] = useState<StaffNotificationList | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getStaffNotifications(signal);
      setNotifications(result);
      setError(null);
    } catch (cause) {
      if (!signal?.aborted) {
        setError(cause instanceof Error ? cause.message : "Notifications are unavailable.");
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getStaffNotifications(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setNotifications(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Notifications are unavailable.");
        }
      });
    const interval = window.setInterval(() => void refresh(), 10_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!subscribeToRealtimeInvalidation) return;
    return subscribeToRealtimeInvalidation(() => void refresh());
  }, [refresh, subscribeToRealtimeInvalidation]);

  const markRead = async (notification: StaffNotification) => {
    if (notification.isRead) return;
    setBusyId(notification.id);
    try {
      const result = await markStaffNotificationRead(notification.id);
      setNotifications((current) =>
        current
          ? {
              ...current,
              unreadCount: Math.max(0, current.unreadCount - 1),
              items: current.items.map((item) =>
                item.id === notification.id
                  ? { ...item, isRead: true, readAt: result.readAt }
                  : item,
              ),
            }
          : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The notification could not be updated.");
    } finally {
      setBusyId(null);
    }
  };

  const choose = (notification: StaffNotification) => {
    void markRead(notification);
    if (notification.resourceType === "staff_work_item" && notification.resourceId) {
      setOpen(false);
      onOpenWorkItem(notification.resourceId);
    }
  };

  const unread = notifications?.unreadCount ?? 0;
  return (
    <div className="staff-notification-center">
      <button
        className="staff-notification-trigger"
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">N</span>
        {unread > 0 ? <i>{unread > 99 ? "99+" : unread}</i> : null}
      </button>
      {open ? (
        <section className="staff-notification-popover" aria-label="Staff notifications">
          <header>
            <div>
              <p className="eyebrow">Action Center</p>
              <h2>Notifications</h2>
            </div>
            <button type="button" onClick={() => void refresh()}>Refresh</button>
          </header>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          {!notifications ? (
            <p>Loading notifications...</p>
          ) : notifications.items.length === 0 ? (
            <p>You have no staff notifications yet.</p>
          ) : (
            <ol>
              {notifications.items.map((notification) => (
                <li className={notification.isRead ? "is-read" : undefined} key={notification.id}>
                  <button
                    type="button"
                    disabled={busyId === notification.id}
                    onClick={() => choose(notification)}
                  >
                    <span className="staff-notification-kind" aria-hidden="true">
                      {notification.kind.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{notification.title}</strong>
                      <small>
                        {notification.workItemKey ? `${notification.workItemKey} - ` : ""}
                        {dateTime(notification.createdAt)}
                      </small>
                      <p>{notification.body}</p>
                    </span>
                    {!notification.isRead ? <i>New</i> : null}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );
}
