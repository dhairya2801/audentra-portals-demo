"use client";

import type { StudentMessage, StudentMessageList } from "@vv/contracts";
import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { relativeWhen } from "../components/notification-panel";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  getStudentMessages,
  markStudentMessageRead,
} from "../lib/api-client";
import Icon from "../design-system/Icon.jsx";
import Card, { CardHead, CardRows } from "../design-system/primitives/Card.jsx";
import Drawer from "../design-system/primitives/Drawer.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import { useTenant } from "../components/tenant-provider";
import { formatTenantDate, type TenantConfig } from "../lib/tenant";

function sentLabel(value: string, tenant: TenantConfig) {
  return formatTenantDate(value, tenant, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function MessageCenter({
  list,
  reload,
}: {
  list: StudentMessageList;
  reload: () => void;
}) {
  const { tenant } = useTenant();
  const [openId, setOpenId] = useState<string | null>(null);
  const markReadAction = useCallback(
    (id: string) => markStudentMessageRead(id),
    [],
  );
  const markRead = useApiAction(markReadAction);
  const open = list.items.find((message) => message.id === openId) ?? null;

  const openMessage = async (message: StudentMessage) => {
    setOpenId(message.id);
    markRead.reset();
    if (message.readAt) return;
    try {
      await markRead.run(message.id);
      reload();
    } catch {
      // The drawer keeps a retry; the message stays readable either way.
    }
  };

  return (
    <>
      <Card>
        <CardHead
          kind="status"
          icon="mail"
          title="Messages"
          note={
            list.unreadCount === 0
              ? "Nothing unread"
              : `${list.unreadCount} unread`
          }
        />
        <CardRows>
          {list.items.map((message) => {
            const read = Boolean(message.readAt);
            return (
              <button
                type="button"
                className={`pop-row note-row${read ? "" : " unread"}`}
                key={message.id}
                onClick={() => void openMessage(message)}
              >
                <span className="task-type-icon" aria-hidden="true">
                  <Icon name="mail" size={21} weight="duotone" />
                </span>
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
              </button>
            );
          })}
        </CardRows>
      </Card>

      {open ? (
        <Drawer
          label={[open.senderName, sentLabel(open.sentAt, tenant)]}
          titleId="message-title"
          closeLabel="Close message"
          onClose={() => setOpenId(null)}
        >
          <div className="drawer-icon review">
            <Icon name="mail" size={25} weight="duotone" />
          </div>
          <h2 id="message-title">{open.subject}</h2>
          <p className="drawer-description">{open.body}</p>
          {markRead.status === "error" ? (
            <Notice
              tone="error"
              icon="alert"
              action={{ label: "Try again", onClick: () => void openMessage(open) }}
            >
              {markRead.message ?? "The message could not be marked as read."}
            </Notice>
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}

export default function MessagesPage() {
  const { tenant } = useTenant();
  const loadMessages = useCallback(
    (signal: AbortSignal) => getStudentMessages(signal),
    [],
  );
  const messages = useApiResource(loadMessages);
  const refreshMessages = messages.refresh;

  useEffect(() => {
    const refreshAfterRealtimeEvent = () => refreshMessages();
    window.addEventListener("vv:student-realtime", refreshAfterRealtimeEvent);
    return () =>
      window.removeEventListener(
        "vv:student-realtime",
        refreshAfterRealtimeEvent,
      );
  }, [refreshMessages]);

  return (
    <PortalShell
      active="messages"
      hero={{
        kicker: `Messages · From ${tenant.shortName}`,
        title: `What ${tenant.shortName} has sent you.`,
        lede: "Official updates and guidance from your enrollment team. Nothing here takes a reply.",
        motif: "mail",
      }}
    >
      {messages.status === "loading" ? (
        <PageSkeleton label="Messages" />
      ) : messages.status === "error" ? (
        <PageError label="Messages" onRetry={messages.reload} />
      ) : messages.data.items.length === 0 ? (
        <StateCard variant="empty" icon="mail" title="Nothing yet">
          Messages from admissions and enrollment services appear here.
        </StateCard>
      ) : (
        <MessageCenter list={messages.data} reload={messages.refresh} />
      )}
    </PortalShell>
  );
}
