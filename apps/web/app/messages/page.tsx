"use client";

import type { StudentMessageList } from "@vv/contracts";
import { useCallback, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import {
  ActionFeedback,
  EmptyState,
  ErrorState,
  LoadingState,
  PageCard,
} from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  getStudentMessages,
  markStudentMessageRead,
} from "../lib/api-client";

function MessageCenter({
  list,
  reload,
}: {
  list: StudentMessageList;
  reload: () => void;
}) {
  const [selectedId, setSelectedId] = useState(list.items[0]?.id || null);
  const markReadAction = useCallback(
    (id: string) => markStudentMessageRead(id),
    [],
  );
  const markRead = useApiAction(markReadAction);
  const selected =
    list.items.find((message) => message.id === selectedId) || list.items[0];

  const openMessage = async (id: string, isUnread: boolean) => {
    setSelectedId(id);
    markRead.reset();
    if (!isUnread) return;

    try {
      await markRead.run(id);
      reload();
    } catch {
      // The inline action state provides a retry without hiding the message.
    }
  };

  return (
    <div className="message-center">
      <PageCard
        className="message-list-card"
        eyebrow="Inbox"
        title={`${list.unreadCount} unread`}
      >
        <ul className="message-list">
          {list.items.map((message) => (
            <li key={message.id}>
              <button
                className={`${selected?.id === message.id ? "message-list__selected " : ""}${message.readAt ? "" : "message-list__unread"}`}
                type="button"
                onClick={() => void openMessage(message.id, !message.readAt)}
              >
                <span className="message-list__dot" aria-hidden="true" />
                <span>
                  <strong>{message.subject}</strong>
                  <small>{message.senderName}</small>
                </span>
                <time dateTime={message.sentAt}>
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                  }).format(new Date(message.sentAt))}
                </time>
              </button>
            </li>
          ))}
        </ul>
      </PageCard>
      <article className="card message-reader" aria-live="polite">
        <p className="eyebrow">From {selected.senderName}</p>
        <h2>{selected.subject}</h2>
        <time dateTime={selected.sentAt}>
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(selected.sentAt))}
        </time>
        <div className="message-reader__body">{selected.body}</div>
        <ActionFeedback
          status={markRead.status}
          error={markRead.message}
          success="Message marked as read."
        />
        {markRead.status === "error" && selected ? (
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void openMessage(selected.id, true)}
          >
            Retry read receipt
          </button>
        ) : null}
      </article>
    </div>
  );
}

export default function MessagesPage() {
  const loadMessages = useCallback(
    (signal: AbortSignal) => getStudentMessages(signal),
    [],
  );
  const messages = useApiResource(loadMessages);

  return (
    <PortalShell
      active="messages"
      eyebrow="Student inbox"
      title="Messages"
      description="Official updates and guidance from your Aster enrollment team."
    >
      {messages.status === "loading" ? (
        <LoadingState label="Loading your messages" />
      ) : messages.status === "error" ? (
        <ErrorState message={messages.error} onRetry={messages.reload} />
      ) : messages.data.items.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Messages from admissions and enrollment services will appear here."
        />
      ) : (
        <MessageCenter list={messages.data} reload={messages.refresh} />
      )}
    </PortalShell>
  );
}
