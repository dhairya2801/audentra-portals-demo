"use client";

import type { StudentMessage } from "@vv/contracts";
import { Fragment } from "react";
import Icon from "../design-system/Icon.jsx";
import { CardFoot, CardHead, CardRows } from "../design-system/primitives/Card.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import { safePortalDestination } from "../lib/safe-destination";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";

const DAY = 24 * 60 * 60 * 1000;

export function relativeWhen(when: string, now = Date.now()) {
  const days = Math.round((now - Date.parse(when)) / DAY);
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  const weeks = Math.floor(days / 7);
  return weeks < 5 ? `${weeks} weeks ago` : "Over a month ago";
}

/** A message that points somewhere still needs her; one with no destination is news. */
export function needsAction(message: StudentMessage) {
  return Boolean(message.href) && !message.readAt;
}

function iconFor(message: StudentMessage) {
  const kind = (message.kind ?? "").toLowerCase();
  if (kind.includes("document")) return "file";
  if (kind.includes("payment") || kind.includes("financ")) return "wallet";
  if (kind.includes("appointment") || kind.includes("event")) return "calendar";
  if (kind.includes("housing")) return "home";
  if (kind.includes("reward") || kind.includes("point")) return "spark";
  return "mail";
}

function Row({
  message,
  read,
  onOpen,
}: {
  message: StudentMessage;
  read: boolean;
  onOpen: (message: StudentMessage) => void;
}) {
  const destination = safePortalDestination(message.href, "/messages");
  const needs = needsAction(message);
  const tile = (
    <span className={`task-type-icon${needs ? " needs-you" : ""}`} aria-hidden="true">
      <Icon name={iconFor(message)} size={21} weight="duotone" />
    </span>
  );
  const copy = (
    <>
      {tile}
      <span className="pop-copy">
        <strong>{message.subject}</strong>
        <small>
          {message.senderName} · {relativeWhen(message.sentAt)}
        </small>
      </span>
      <span className="pop-trail">
        {!read && <i className="pop-dot" aria-hidden="true" />}
        {!read && <span className="sr-only">Unread</span>}
        <Icon name="arrow" size={15} />
      </span>
    </>
  );
  const className = `pop-row note-row${read ? "" : " unread"}`;
  if (destination.external) {
    return (
      <a
        className={className}
        href={destination.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onOpen(message)}
      >
        {copy}
      </a>
    );
  }
  return (
    <Link className={className} href={destination.href} onClick={() => onOpen(message)}>
      {copy}
    </Link>
  );
}

function standing(state: "loading" | "error" | "ready", unread: StudentMessage[]) {
  if (state === "loading") return "Checking what changed…";
  if (state === "error") return "Couldn’t be loaded just now";
  if (unread.length === 0) return "Nothing unread";
  const needs = unread.filter(needsAction).length;
  const count = `${unread.length} unread`;
  if (needs === 0) return count;
  return `${count} · ${needs} ${needs === 1 ? "needs" : "need"} you`;
}

export function NotificationPanel({
  feed,
  state,
  isRead,
  onOpen,
  onMarkAll,
  onRetry,
  onClose,
}: {
  feed: StudentMessage[];
  state: "loading" | "error" | "ready";
  isRead: (message: StudentMessage) => boolean;
  onOpen: (message: StudentMessage) => void;
  onMarkAll: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { tenant } = useTenant();
  const unread = feed.filter((message) => !isRead(message));
  const groups = [
    { id: "needs-you", label: "Needs you", items: feed.filter((m) => !isRead(m) && needsAction(m)) },
    { id: "also-new", label: "Also new", items: feed.filter((m) => !isRead(m) && !needsAction(m)) },
    { id: "earlier", label: "Earlier", items: feed.filter((m) => isRead(m)) },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      <CardHead
        kind="status"
        icon="bell"
        title="What changed"
        note={standing(state, unread)}
        aside={
          state === "ready" && unread.length > 0 ? (
            <button className="link-button" type="button" onClick={onMarkAll}>
              Mark all read
            </button>
          ) : null
        }
      />

      {state === "loading" && (
        <CardRows aria-busy="true" aria-label="Loading what changed">
          {[0, 1, 2].map((row) => (
            <div className="pop-row skeleton" key={row}>
              <span className="skeleton-line tile" />
              <span className="pop-skeleton-copy">
                <i className="skeleton-line" />
                <i className="skeleton-line short" />
              </span>
            </div>
          ))}
        </CardRows>
      )}

      {state === "error" && (
        <StateCard
          variant="error"
          size="compact"
          className="pop-state"
          title="What changed couldn’t be loaded"
          action={{ label: "Try again", onClick: onRetry }}
        >
          Nothing you did is lost.
        </StateCard>
      )}

      {state === "ready" && feed.length === 0 && (
        <StateCard variant="empty" size="compact" icon="bell" className="pop-state" title="Nothing new">
          Nothing has changed since you were last here.
        </StateCard>
      )}

      {state === "ready" && feed.length > 0 && (
        <CardRows>
          {groups.map((group) => (
            <Fragment key={group.id}>
              <p className={`rows-label ${group.id}`}>{group.label}</p>
              {group.items.map((message) => (
                <Row
                  key={message.id}
                  message={message}
                  read={isRead(message)}
                  onOpen={(chosen) => {
                    onOpen(chosen);
                    onClose();
                  }}
                />
              ))}
            </Fragment>
          ))}
        </CardRows>
      )}

      <CardFoot>
        <Notice
          tone="quiet"
          action={{ label: "Help", href: tenant ? "/help" : "/help", onClick: onClose }}
        >
          Need a person? Nothing here takes a reply.
        </Notice>
      </CardFoot>
    </>
  );
}
