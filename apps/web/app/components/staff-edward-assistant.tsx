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
  StaffAssistantWebSourcesBlock,
} from "@vv/contracts";
import {
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
import Icon from "../design-system/Icon.jsx";
import { IconButton } from "../design-system/primitives/Button.jsx";
import { AssistantBlocks } from "./assistant-blocks";
import { EdwardComposer } from "./edward-composer";
import { EDWARD } from "./edward-thread";
import { EdwardResponseFeedback } from "./edward-response-feedback";
import { StaffWebSourceList } from "./staff-web-sources";
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
  traceId?: string;
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

function WebSourcesBlockPanel({
  block,
  idPrefix,
}: {
  block: StaffAssistantWebSourcesBlock;
  idPrefix: string;
}) {
  return (
    <section className="edward-web-sources" aria-label={`Web sources for ${block.query}`}>
      <header>
        <span>From the web</span>
        <strong>{block.query}</strong>
      </header>
      {block.fallbackText.trim() ? <p>{block.fallbackText}</p> : null}
      {block.results.length ? (
        <StaffWebSourceList results={block.results} idPrefix={idPrefix} />
      ) : (
        <p>No public sources matched this search.</p>
      )}
      <small>
        External sources are not student records. Open and verify a source before acting.
      </small>
    </section>
  );
}

/** Staff blocks are the student block family plus drafts and cited web sources. */
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
        block.type === "web_sources" ? (
          <WebSourcesBlockPanel
            block={block}
            idPrefix={`${idPrefix}-web-${index}`}
            key={`${idPrefix}-web-${index}`}
          />
        ) : block.type === "draft" ? (
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
}: {
  staffName: string;
  variant?: "floating" | "embedded";
}) {
  const [open, setOpen] = useState(variant === "embedded");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<StaffDisplayMessage[]>([
    welcomeMessage(staffName),
  ]);
  const conversationRef = useRef<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
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
          traceId: response.requestId,
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

  const greeting = messages[0];
  const turns = messages.slice(1);
  const firstName = staffName.split(" ")[0] || staffName;

  /*
   * The staff panel is the student panel's twin: the same shell, head, mark,
   * greeting, turn bubbles, suggestion rows and reference composer, drawn from
   * the same stylesheet. Only what Edward reads differs — the staff workspace
   * rather than one student's record — so the two assistants stop looking like
   * two products.
   */
  const panel = (
    <aside
      id="staff-edward-panel"
      className={`edward-panel${variant === "embedded" ? " edward-panel--embedded" : ""}`}
      role={variant === "embedded" ? "region" : "dialog"}
      aria-label="Edward, your AI staff assistant"
    >
      <header className="edward-head">
        <span className="edward-mark small" aria-hidden="true">
          {EDWARD.mark}
        </span>
        <div className="edward-title">
          <strong>{EDWARD.name}</strong>
          <span>Staff workspace assistant</span>
        </div>
        <IconButton
          name="pen"
          size={18}
          label="New conversation"
          disabled={sending}
          onClick={() => {
            dropConversation();
            setMessages([welcomeMessage(staffName)]);
            setError(null);
            setDraft("");
          }}
        />
        {variant === "floating" ? (
          <IconButton
            name="close"
            size={18}
            label="Close Edward"
            tip="Close"
            onClick={() => setOpen(false)}
          />
        ) : null}
      </header>

      <div className="edward-body">
        <div className="edward-main">
          <div
            ref={transcript}
            className="edward-thread"
            role="log"
            aria-live="polite"
            aria-label="Conversation with Edward"
          >
            {turns.length === 0 ? (
              <div className="edward-greeting">
                <span className="edward-mark" aria-hidden="true">
                  {EDWARD.mark}
                </span>
                <h3>Hi {firstName}. Ask me about your workspace.</h3>
                {greeting ? <p>{greeting.content}</p> : null}
                <p className="edward-boundary">
                  <Icon name="shield" size={13} /> Edward is read-only. It never changes a record.
                </p>
              </div>
            ) : null}

            {turns.map((message) =>
              message.role === "user" ? (
                <article className="edward-turn student" key={message.id}>
                  <p className="edward-bubble">{message.content}</p>
                </article>
              ) : (
                <article className="edward-turn edward" key={message.id}>
                  <div className="edward-answer">
                    {message.blocks?.length ? (
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
                    {message.provider ? (
                      <small>
                        {message.provider === "openrouter" || message.provider === "openai"
                          ? "AI-generated — verify before acting on a student record"
                          : "Built-in workspace guidance"}
                      </small>
                    ) : null}
                  </div>
                  {message.traceId ? (
                    <EdwardResponseFeedback
                      target={{
                        assistantKind: "staff",
                        assistantMessageId: message.id,
                        traceId: message.traceId,
                      }}
                    />
                  ) : null}
                </article>
              ),
            )}

            {sending ? (
              <article className="edward-turn edward">
                <p className="edward-thinking" role="status">
                  <span className="edward-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  Reading the workspace…
                </p>
              </article>
            ) : null}

            {error ? (
              <article className="edward-turn edward">
                <div className="edward-answer error" role="alert">
                  {error}
                </div>
              </article>
            ) : null}

            {turns.length === 0 ? (
              <div className="edward-suggestions">
                <section>
                  <p className="panel-label">To get started</p>
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="edward-suggestion"
                      onClick={() => void send(prompt)}
                    >
                      <span>{prompt}</span>
                      <Icon name="arrow" size={15} />
                    </button>
                  ))}
                </section>
              </div>
            ) : null}
          </div>

          <EdwardComposer
            draft={draft}
            onDraft={setDraft}
            onSend={(value) => void send(value)}
            context="Staff workspace"
            onDropContext={() => {}}
            listening={false}
            micLabel="Dictation is not available for staff Edward"
            micDisabled
            onMic={() => {}}
            disabled={sending}
            inputRef={input}
            placeholder="Ask about a student, your queue, or a draft…"
            caution="Edward is read-only and can make mistakes. Confirm details in the official record before acting."
          />
        </div>
      </div>
    </aside>
  );

  if (variant === "embedded") return panel;

  return (
    <>
      <button
        className="edward-launcher"
        type="button"
        aria-expanded={open}
        aria-controls="staff-edward-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="edward-mark small" aria-hidden="true">
          {EDWARD.mark}
        </span>
        Ask {EDWARD.name}
      </button>
      {open ? panel : null}
    </>
  );
}
