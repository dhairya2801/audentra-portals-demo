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
  AssistantResponseBlock,
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
} from "../lib/api-client";
import { AssistantBlocks } from "./assistant-blocks";
import labStyles from "./edward-lab.module.css";

const quickPrompts = [
  "What needs my attention today?",
  "Summarize my action center",
  "Which documents are waiting on review?",
];

interface StaffDisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: StaffAssistantResponseBlock[];
  resolvedStudent?: { id: string; name: string } | null;
  provider?: string;
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
    content: `Hi ${firstName} — I’m Edward. I can read student records, your action center, and the staff workspace, and draft replies for you. I never change a record.`,
    provider: "guided",
  };
}

function DraftBlockPanel({ block }: { block: StaffAssistantDraftBlock }) {
  return (
    <section
      className={labStyles.draftPanel}
      aria-label={`${block.channel} draft`}
    >
      <div className={labStyles.draftPanelHead}>
        <span className={labStyles.draftChannel}>{block.channel} draft</span>
        {block.subject ? (
          <span className={labStyles.draftSubject}>
            Subject: {block.subject}
          </span>
        ) : null}
      </div>
      <pre className={labStyles.draftBody}>{block.body}</pre>
      <p className={labStyles.draftDisclaimer}>{block.disclaimer}</p>
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

export function StaffEdwardAssistant({ staffName }: { staffName: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<StaffDisplayMessage[]>([
    welcomeMessage(staffName),
  ]);
  const conversationRef = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    transcript.current?.scrollTo({
      top: transcript.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

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
    const clientMessageId = crypto.randomUUID();
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
        response = await askStaffEdward({
          message: normalized,
          ...(serverConversationId
            ? { conversationId: serverConversationId }
            : {}),
          clientMessageId,
        });
      } catch (caught) {
        // A stored conversation may be gone on the server (restart, TTL).
        // Drop it and retry once on a fresh conversation.
        if (
          !reusedConversation ||
          !(caught instanceof ApiClientError) ||
          caught.status !== 404
        ) {
          throw caught;
        }
        dropConversation();
        serverConversationId = await ensureConversation();
        response = await askStaffEdward({
          message: normalized,
          ...(serverConversationId
            ? { conversationId: serverConversationId }
            : {}),
          clientMessageId,
        });
      }
      if (response.conversationId) {
        conversationRef.current = response.conversationId;
        writeStoredConversationId(
          conversationStorageKey(),
          response.conversationId,
        );
      }
      setMessages((current) => [
        ...current,
        {
          id: response.assistantMessageId ?? crypto.randomUUID(),
          role: "assistant",
          content: response.message,
          ...(response.blocks?.length ? { blocks: response.blocks } : {}),
          resolvedStudent: response.resolvedStudent,
          provider: response.provider,
        },
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Edward could not answer just now. Please try again.",
      );
    } finally {
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
      className="edward-panel"
      role="dialog"
      aria-label="Edward AI staff assistant"
    >
      <header className="edward-panel__header">
        <span className="edward-avatar" aria-hidden="true">
          E
        </span>
        <div>
          <strong>Edward</strong>
          <span>
            <i aria-hidden="true" /> Connected to the staff workspace ·
            read-only
          </span>
        </div>
        <button
          type="button"
          aria-label="Close Edward"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </header>

      <div ref={transcript} className="edward-transcript" aria-live="polite">
        {messages.map((message) => (
          <article
            className={`edward-message edward-message--${message.role}`}
            key={message.id}
          >
            {message.role === "assistant" && message.blocks?.length ? (
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
            {message.role === "assistant" && message.provider ? (
              <small>
                {message.provider === "openrouter" ||
                message.provider === "openai"
                  ? "AI-generated — verify before acting on a student record"
                  : "Built-in workspace guidance"}
              </small>
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
          <p className="edward-error" role="alert">
            {error}
          </p>
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
          <input
            ref={input}
            id="staff-edward-message"
            value={draft}
            maxLength={2_000}
            autoComplete="off"
            placeholder="Ask about a student, your queue, or a draft…"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            className="edward-send-button"
            type="submit"
            disabled={sending || draft.trim().length === 0}
            aria-label="Send message"
          >
            ↑
          </button>
        </div>
        <small>
          Edward is read-only and can make mistakes. Confirm details in the
          official record before acting.
        </small>
      </form>
    </section>
  );

  return (
    <>
      <button
        className={`edward-launcher${open ? " edward-launcher--open" : ""}`}
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
