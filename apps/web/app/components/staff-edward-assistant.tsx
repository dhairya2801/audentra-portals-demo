"use client";

/**
 * Staff Edward — the floating assistant launcher for the staff portal,
 * mirroring the student portal's "Ask Edward" button.
 *
 * Talks to the real read-only staff assistant
 * (POST /v1/staff/assistant/messages) with a durable conversation created
 * lazily on the first send and pinned in sessionStorage for this tab — the
 * same mechanics the Staff Edward Lab uses, without the trace inspector.
 * Renders the staff block family (student blocks plus `draft`) and names the
 * student a turn was grounded in, so the answer's provenance stays visible.
 */

import type {
  AskStaffEdwardResponse,
  StaffTaskBoardContext,
  AssistantResponseBlock,
  EdwardActionIntent,
  EdwardActionReceipt,
  StaffAssistantConversationMessage,
  StaffAssistantDraftBlock,
  StaffAssistantResponseBlock,
} from "@vv/contracts";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ApiClientError,
  askStaffEdward,
  createStaffAssistantConversation,
  getStaffAssistantConversationMessages,
} from "../lib/api-client";
import { AssistantBlocks } from "./assistant-blocks";
import { EdwardResponseFeedback } from "./edward-response-feedback";
import { EdwardActionCard } from "./edward-action-card";
import experience from "./edward-experience.module.css";
import { useIsSheet, useOverlay } from "../design-lib/overlay.js";

const quickPrompts = [
  "What needs my attention today?",
  "What are my urgent Task Board items?",
  "Which documents are waiting on review?",
];

interface StaffDisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: StaffAssistantResponseBlock[];
  resolvedStudent?: { id: string; name: string } | null;
  provider?: string;
  traceId?: string;
  actionIntents?: EdwardActionIntent[];
  /** Receipts the server issued for this turn's committed actions. */
  actionReceipts?: EdwardActionReceipt[];
  /** Why an action on this turn could not be prepared or applied. */
  actionError?: { code: string; message: string };
}

/** A persisted message, in the shape the transcript draws. */
function persistedMessageToDisplay(
  message: StaffAssistantConversationMessage,
): StaffDisplayMessage {
  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    content: message.content,
    ...(message.blocks?.length ? { blocks: message.blocks } : {}),
    ...(message.provider ? { provider: message.provider } : {}),
    ...(message.requestId ? { traceId: message.requestId } : {}),
    ...(message.actionIntents?.length
      ? { actionIntents: message.actionIntents }
      : {}),
    ...(message.actionReceipts?.length
      ? { actionReceipts: message.actionReceipts }
      : {}),
  };
}

function receiptSummary(receipt: EdwardActionReceipt) {
  const outcome =
    receipt.status === "succeeded"
      ? "Applied"
      : receipt.status === "partial"
        ? "Partly applied"
        : "Failed";
  const records = `${receipt.affectedCount} ${receipt.affectedCount === 1 ? "record" : "records"}`;
  return `${outcome} · ${receipt.action.replaceAll(".", " › ").replaceAll("_", " ")} · ${records}`;
}

function conversationStorageKey(): string {
  return "audentra.staff-edward.portal-conversation.v1";
}

function readStoredConversationId(key: string): string | null {
  try {
    const value = window.sessionStorage.getItem(key);
    return value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value
      : null;
  } catch {
    return null;
  }
}

function writeStoredConversationId(key: string, conversationId: string | null) {
  try {
    if (conversationId === null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, conversationId);
    }
  } catch {
    // Storage may be unavailable; the in-memory id still covers this mount.
  }
}

function welcomeMessage(staffName: string): StaffDisplayMessage {
  const firstName = staffName.split(" ")[0] || staffName;
  return {
    id: "welcome",
    role: "assistant",
    content: `Understand a case, find the right next step, or prepare an action for review. Start with your work, ${firstName}.`,
    provider: "guided",
  };
}

function DraftBlockPanel({ block }: { block: StaffAssistantDraftBlock }) {
  const [copied, setCopied] = useState(false);
  return (
    <section
      className={experience.draftPanel}
      aria-label={`${block.channel} draft`}
    >
      <div className={experience.draftPanelHead}>
        <span className={experience.draftChannel}>{block.channel} draft</span>
        {block.subject ? (
          <span className={experience.draftSubject}>
            Subject: {block.subject}
          </span>
        ) : null}
      </div>
      <pre className={experience.draftBody}>{block.body}</pre>
      <button
        type="button"
        className={experience.copyDraft}
        onClick={() => {
          void navigator.clipboard
            .writeText([block.subject, block.body].filter(Boolean).join("\n\n"))
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied ? "Copied" : "Copy draft"}
      </button>
      <p className={experience.draftDisclaimer}>{block.disclaimer}</p>
    </section>
  );
}

/** Staff blocks are the student block family plus `draft`. */
function StaffBlocks({
  blocks,
  idPrefix,
}: {
  blocks: readonly StaffAssistantResponseBlock[];
  idPrefix: string;
}) {
  return (
    <div>
      {blocks.map((block, index) =>
        block.type === "draft" ? (
          <DraftBlockPanel block={block} key={`${idPrefix}-draft-${index}`} />
        ) : (
          <AssistantBlocks
            blocks={[block as AssistantResponseBlock]}
            idPrefix={`${idPrefix}-block-${index}`}
            key={`${idPrefix}-block-${index}`}
          />
        ),
      )}
    </div>
  );
}

export function StaffEdwardAssistant({
  staffName,
  variant = "floating",
  pageContext,
}: {
  staffName: string;
  variant?: "floating" | "embedded";
  pageContext?: StaffTaskBoardContext;
}) {
  const [open, setOpen] = useState(variant === "embedded");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRequest = useRef<AbortController | null>(null);
  const failedRequest = useRef<{ message: string; id: string; pageContext?: StaffTaskBoardContext } | null>(null);
  const [messages, setMessages] = useState<StaffDisplayMessage[]>([
    welcomeMessage(staffName),
  ]);
  const conversationRef = useRef<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  const isSheet = useIsSheet();
  useOverlay(panelRef, {
    onClose: () => {
      if (variant === "floating") setOpen(false);
    },
    modal: isSheet && variant === "floating",
    suspended: !open,
  });

  useEffect(() => {
    if (wasOpen.current && !open && variant === "floating")
      launcher.current?.focus();
    wasOpen.current = open;
  }, [open, variant]);

  useEffect(() => {
    const ask = (event: Event) => {
      const question = (event as CustomEvent<{question?:string}>).detail?.question;
      if (typeof question !== "string" || !question.trim()) return;
      setOpen(true);
      setDraft(question.slice(0,2000));
    };
    window.addEventListener("audentra:staff-edward:ask",ask);
    return () => window.removeEventListener("audentra:staff-edward:ask",ask);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    const container = transcript.current;
    const answer = container?.querySelector<HTMLElement>(
      ".edward-message--assistant:last-of-type",
    );
    if (container)
      container.scrollTo({
        top:
          !sending && answer
            ? Math.max(0, answer.offsetTop - container.offsetTop - 20)
            : container.scrollHeight,
      });
  }, [messages, sending]);

  // Mirror the persisted transcript for this tab's conversation, so a remount
  // shows what the server holds — receipts included — rather than an empty
  // panel that only remembers the conversation id.
  useEffect(() => {
    const storedId = readStoredConversationId(conversationStorageKey());
    if (!storedId) return;
    const abort = new AbortController();
    void getStaffAssistantConversationMessages(storedId, abort.signal)
      .then((result) => {
        if (abort.signal.aborted) return;
        conversationRef.current = result.conversationId;
        setMessages([
          welcomeMessage(staffName),
          ...result.messages.map(persistedMessageToDisplay),
        ]);
      })
      .catch((caught) => {
        if (abort.signal.aborted) return;
        if (
          caught instanceof ApiClientError &&
          (caught.status === 404 || caught.status === 403)
        ) {
          // Gone on the server, or not this person's: the next send starts fresh.
          conversationRef.current = null;
          writeStoredConversationId(conversationStorageKey(), null);
        }
      });
    return () => abort.abort();
  }, [staffName]);

  /**
   * The durable conversation for this tab: resumed from sessionStorage when
   * one was pinned earlier, otherwise created lazily on the first send.
   */
  const ensureConversation = async (): Promise<string | null> => {
    if (conversationRef.current) return conversationRef.current;
    const stored = readStoredConversationId(conversationStorageKey());
    if (stored) {
      conversationRef.current = stored;
      return stored;
    }
    try {
      const conversation = await createStaffAssistantConversation();
      conversationRef.current = conversation.id;
      writeStoredConversationId(conversationStorageKey(), conversation.id);
      return conversation.id;
    } catch {
      // A stateless turn still answers; the next send tries again.
      return null;
    }
  };

  const dropConversation = useCallback(() => {
    conversationRef.current = null;
    writeStoredConversationId(conversationStorageKey(), null);
  }, []);

  const send = async (message: string) => {
    const normalized = message.trim();
    if (!normalized || sending) return;
    const retrying = failedRequest.current?.message === normalized;
    const clientMessageId = retrying
      ? failedRequest.current!.id
      : crypto.randomUUID();
    const requestContext = retrying ? failedRequest.current!.pageContext : pageContext;
    failedRequest.current = { message: normalized, id: clientMessageId, pageContext: requestContext };
    const controller = new AbortController();
    pendingRequest.current = controller;
    if (!retrying)
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", content: normalized },
      ]);
    setDraft("");
    setError(null);
    setSending(true);
    try {
      const reusedConversation =
        conversationRef.current !== null ||
        readStoredConversationId(conversationStorageKey()) !== null;
      let serverConversationId = await ensureConversation();
      let response: AskStaffEdwardResponse;
      try {
        response = await askStaffEdward(
          {
            message: normalized,
            ...(serverConversationId
              ? { conversationId: serverConversationId }
              : {}),
            clientMessageId,
            ...(requestContext ? {pageContext: requestContext} : {}),
          },
          controller.signal,
        );
      } catch (caught) {
        // A stored conversation may be gone on the server (restart, TTL).
        // Drop it and retry once on a fresh conversation.
        if (
          !reusedConversation ||
          !(caught instanceof ApiClientError) ||
          caught.status !== 404 ||
          caught.code !== "STAFF_ASSISTANT_CONVERSATION_NOT_FOUND"
        ) {
          throw caught;
        }
        dropConversation();
        serverConversationId = await ensureConversation();
        response = await askStaffEdward(
          {
            message: normalized,
            ...(serverConversationId
              ? { conversationId: serverConversationId }
              : {}),
            clientMessageId,
            ...(requestContext ? {pageContext: requestContext} : {}),
          },
          controller.signal,
        );
      }
      if (response.conversationId) {
        conversationRef.current = response.conversationId;
        writeStoredConversationId(
          conversationStorageKey(),
          response.conversationId,
        );
      }
      failedRequest.current = null;
      setMessages((current) => [
        ...current,
        {
          id: response.assistantMessageId ?? crypto.randomUUID(),
          role: "assistant",
          content: response.message,
          ...(response.blocks?.length ? { blocks: response.blocks } : {}),
          resolvedStudent: response.resolvedStudent,
          provider: response.provider,
          traceId: response.requestId,
          actionIntents: response.actionIntents ?? [],
          ...(response.actionReceipts?.length
            ? { actionReceipts: response.actionReceipts }
            : {}),
          ...(response.actionError
            ? { actionError: response.actionError }
            : {}),
        },
      ]);
    } catch (caught) {
      setError(
        controller.signal.aborted
          ? "Stopped waiting. Your request may still finish; retry checks the same request."
          : caught instanceof Error
            ? caught.message
            : "Edward could not answer just now. Please try again.",
      );
      setDraft((current) => (current.trim() ? current : normalized));
    } finally {
      pendingRequest.current = null;
      setSending(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(draft);
  };

  const panel = (
    <section
      id="staff-edward-panel"
      style={pageContext ? {zIndex: 110} : undefined}
      ref={panelRef}
      className={`edward-panel ${experience.surface} ${variant === "embedded" ? `edward-panel--embedded ${experience.embedded}` : experience.floating}`}
      role={variant === "embedded" ? "region" : "dialog"}
      aria-modal={isSheet && variant === "floating" ? true : undefined}
      aria-label="Edward AI staff assistant"
    >
      <header className="edward-panel__header">
        <span className="edward-avatar" aria-hidden="true">
          E
        </span>
        <div className={experience.staffHeaderText}>
          <strong>Edward</strong>
          <span>Your staff workspace</span>
        </div>
        <button
          type="button"
          className={experience.newConversation}
          aria-label="New conversation"
          disabled={sending}
          onClick={() => {
            dropConversation();
            setMessages([welcomeMessage(staffName)]);
            setError(null);
            setDraft("");
            failedRequest.current = null;
            input.current?.focus();
          }}
        >
          ＋
        </button>
        {variant === "floating" ? (
          <button
            type="button"
            aria-label="Close Edward"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        ) : (
          <span className="edward-secure">Private</span>
        )}
      </header>

      <div ref={transcript} className="edward-transcript" aria-live="polite">
        {messages.map((message) => (
          <article
            className={`edward-message edward-message--${message.role}`}
            key={message.id}
          >
            {message.id === "welcome" ? (
              <div className="edward-greeting">
                <span className="edward-mark" aria-hidden="true">
                  E
                </span>
                <h3>Make room for the work that matters.</h3>
                <p>{message.content}</p>
              </div>
            ) : message.role === "assistant" && message.blocks?.length ? (
              <StaffBlocks blocks={message.blocks} idPrefix={message.id} />
            ) : (
              <p>{message.content}</p>
            )}
            {message.resolvedStudent ? (
              <div
                className="edward-context-receipts"
                aria-label="Student record this response was grounded in"
              >
                <span className="edward-context-receipts__label">
                  Student record
                </span>
                <span>{message.resolvedStudent.name}</span>
              </div>
            ) : null}
            {message.actionIntents?.map((intent) => (
              <EdwardActionCard intent={intent} actor="staff" key={intent.id}
                onApplied={pageContext ? () => window.dispatchEvent(new Event("vv:student-record-changed")) : undefined} />
            ))}
            {message.actionReceipts?.length ? (
              <ul
                className="edward-context-receipts"
                aria-label="Action receipts"
              >
                {message.actionReceipts.map((receipt) => (
                  <li key={receipt.id}>
                    <span className="edward-context-receipts__label">
                      Server receipt
                    </span>
                    <span>
                      {receiptSummary(receipt)} ·{" "}
                      {new Date(receipt.committedAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {message.actionError && message.actionError.message !== message.content ? (
              <p className="edward-error" role="alert">
                {message.actionError.message}
              </p>
            ) : null}
            {message.role === "assistant" && message.traceId ? (
              <EdwardResponseFeedback
                target={{
                  assistantKind: "staff",
                  assistantMessageId: message.id,
                  traceId: message.traceId,
                }}
              />
            ) : null}
          </article>
        ))}
        {sending ? (
          <div className="edward-typing" role="status">
            <span />
            <span />
            <span />
            Edward is checking the workspace
          </div>
        ) : null}
        {error ? (
          <div className="edward-error" role="alert">
            <p>{error}</p>
            {!sending ? (
              <button
                type="button"
                onClick={() => void send(failedRequest.current!.message)}
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {messages.length === 1 ? (
        <div className="edward-prompts" aria-label="Suggested questions">
          {quickPrompts.map((prompt) => (
            <button
              type="button"
              onClick={() => void send(prompt)}
              key={prompt}
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <form className="edward-composer" onSubmit={submit}>
        <label htmlFor="staff-edward-message">
          Ask about students, tasks, or the workspace
        </label>
        <div>
          <textarea
            ref={input}
            id="staff-edward-message"
            value={draft}
            maxLength={2_000}
            autoComplete="off"
            rows={2}
            placeholder="Ask about a student, your queue, or a draft…"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (!sending) void send(draft);
              }
            }}
          />
          <button
            className="edward-send-button"
            type={sending ? "button" : "submit"}
            disabled={!sending && draft.trim().length === 0}
            aria-label={sending ? "Stop waiting" : "Send message"}
            onClick={
              sending ? () => pendingRequest.current?.abort() : undefined
            }
          >
            {sending ? "■" : "↑"}
          </button>
        </div>
        <small>
          AI guidance, grounded in your workspace. You review changes before
          they happen.
        </small>
      </form>
    </section>
  );

  if (variant === "embedded") return panel;

  return (
    <>
      <button
        ref={launcher}
        className={`edward-launcher${open ? " edward-launcher--open" : ""}`}
        style={pageContext ? {zIndex: 110} : undefined}
        type="button"
        aria-expanded={open}
        aria-controls="staff-edward-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="edward-avatar" aria-hidden="true">
          E
        </span>
        <span>
          <strong>Ask Edward</strong>
          <small>AI staff assistant</small>
        </span>
      </button>
      {open ? panel : null}
    </>
  );
}
