"use client";

/**
 * Staff Edward Lab — developer trace dashboard for the read-only staff
 * assistant.
 *
 * Left: a plain developer chat against POST /v1/staff/assistant/messages
 * (durable conversation, created lazily on the first send and pinned in
 * sessionStorage for this tab). Right: the same AssistantTurnTrace inspector
 * the student lab uses; staff turns carry assistantKind: "staff" plus
 * per-tool arguments/validation and the referent round. Traces come through
 * the same same-origin /api/edward-lab proxy — the browser never sees a
 * worker token. No persona switcher: the lab works against whichever staff
 * state the configured backend serves.
 */

import type {
  AskStaffEdwardResponse,
  AssistantResponseBlock,
  StaffAssistantDraftBlock,
  StaffAssistantResponseBlock,
} from "@vv/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiClientError,
  askStaffEdward,
  createStaffAssistantConversation,
} from "../lib/api-client";
import {
  type EdwardTurnTrace,
  fetchTraceWithRetry,
  formatMs,
  summarizeTrace,
  type TraceListEntry,
} from "../lib/edward-lab";
import { AssistantBlocks } from "./assistant-blocks";
import { EdwardTraceInspector } from "./edward-trace-inspector";
import styles from "./edward-lab.module.css";

interface LabTurn {
  index: number;
  question: string;
  answer: string;
  requestId: string | null;
  latencyMs: number;
  status: "ok" | "error" | "no_trace";
}

interface StaffChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: StaffAssistantResponseBlock[];
  resolvedStudent?: { id: string; name: string } | null;
  provider?: string;
  model?: string | null;
}

async function labFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, headers: { accept: "application/json" } });
}

function conversationStorageKey(): string {
  return "audentra.edward-lab.staff-conversation.v1";
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

function DraftBlockPanel({ block }: { block: StaffAssistantDraftBlock }) {
  return (
    <section className={styles.draftPanel} aria-label={`${block.channel} draft`}>
      <div className={styles.draftPanelHead}>
        <span className={styles.draftChannel}>{block.channel} draft</span>
        {block.subject ? (
          <span className={styles.draftSubject}>Subject: {block.subject}</span>
        ) : null}
      </div>
      <pre className={styles.draftBody}>{block.body}</pre>
      <p className={styles.draftDisclaimer}>{block.disclaimer}</p>
    </section>
  );
}

/**
 * Staff blocks are the student block family plus `draft`. Drafts get their
 * own panel; everything else reuses the exact student block renderer.
 */
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

export function StaffEdwardLab() {
  const [messages, setMessages] = useState<StaffChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<LabTurn[]>([]);
  const [traces, setTraces] = useState<Record<string, EdwardTurnTrace>>({});
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [recent, setRecent] = useState<TraceListEntry[]>([]);
  const turnCounter = useRef(0);
  const conversationRef = useRef<string | null>(null);
  const transcript = useRef<HTMLDivElement>(null);

  const refreshRecent = useCallback(() => {
    labFetch("/api/edward-lab/traces?limit=50")
      .then(async (response) => {
        if (response.ok) {
          const body = (await response.json()) as { traces?: TraceListEntry[] };
          setRecent(
            (body.traces ?? []).filter((entry) => entry.assistantKind === "staff"),
          );
        }
      })
      .catch(() => {
        // recent list is best-effort
      });
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    transcript.current?.scrollTo({
      top: transcript.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  const selectTrace = useCallback(
    async (traceId: string) => {
      setSelectedTraceId(traceId);
      if (traces[traceId]) return;
      const trace = await fetchTraceWithRetry(traceId, labFetch, { attempts: 2 });
      if (trace) setTraces((current) => ({ ...current, [traceId]: trace }));
    },
    [traces],
  );

  /**
   * The durable conversation for this tab: resumed from sessionStorage when
   * one was pinned earlier, otherwise created lazily on the first send.
   */
  const ensureConversation = async (): Promise<string | null> => {
    if (conversationRef.current) return conversationRef.current;
    const stored = readStoredConversationId(conversationStorageKey());
    if (stored) {
      conversationRef.current = stored;
      setConversationId(stored);
      return stored;
    }
    try {
      const conversation = await createStaffAssistantConversation();
      conversationRef.current = conversation.id;
      setConversationId(conversation.id);
      writeStoredConversationId(conversationStorageKey(), conversation.id);
      return conversation.id;
    } catch {
      // A stateless turn still answers; the next send tries again.
      return null;
    }
  };

  const dropConversation = useCallback(() => {
    conversationRef.current = null;
    setConversationId(null);
    writeStoredConversationId(conversationStorageKey(), null);
  }, []);

  const resetConversation = () => {
    if (sending) return;
    dropConversation();
    setMessages([]);
    setChatError(null);
  };

  const recordTurn = (
    question: string,
    response: AskStaffEdwardResponse | null,
    error: string | null,
    latencyMs: number,
  ) => {
    const index = ++turnCounter.current;
    const requestId = response?.requestId ?? null;
    setTurns((current) => [
      ...current,
      {
        index,
        question,
        answer: response?.message ?? (error ?? ""),
        requestId,
        latencyMs,
        status: error ? "error" : requestId ? "ok" : "no_trace",
      },
    ]);
    if (requestId) {
      setSelectedTraceId(requestId);
      void fetchTraceWithRetry(requestId, labFetch).then((trace) => {
        if (trace) {
          setTraces((current) => ({ ...current, [requestId]: trace }));
        } else {
          setTurns((current) =>
            current.map((item) =>
              item.requestId === requestId ? { ...item, status: "no_trace" } : item,
            ),
          );
        }
        refreshRecent();
      });
    } else {
      refreshRecent();
    }
  };

  const send = async (message: string) => {
    const normalized = message.trim();
    if (!normalized || sending) return;
    const clientMessageId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: normalized },
    ]);
    setDraft("");
    setChatError(null);
    setSending(true);
    const startedAt = performance.now();
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
        setConversationId(response.conversationId);
        writeStoredConversationId(conversationStorageKey(), response.conversationId);
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
          model: response.model,
        },
      ]);
      recordTurn(normalized, response, null, performance.now() - startedAt);
    } catch (caught) {
      const messageText =
        caught instanceof Error
          ? caught.message
          : "Staff Edward could not answer just now.";
      setChatError(messageText);
      recordTurn(normalized, null, messageText, performance.now() - startedAt);
    } finally {
      setSending(false);
    }
  };

  const selectedTrace = selectedTraceId ? (traces[selectedTraceId] ?? null) : null;

  return (
    <>
      <header className={styles.topBar}>
        <h1>Staff Edward Lab</h1>
        <span className={styles.devBadge}>Developer tool</span>
        <div className={styles.personaControls}>
          <span className={styles.personaMeta}>
            Read-only staff assistant · dev staff actor ·{" "}
            {conversationId ? (
              <>
                conversation <span className={styles.mono}>{conversationId.slice(0, 8)}…</span>
              </>
            ) : (
              "no conversation yet"
            )}
          </span>
        </div>
      </header>
      <div className={styles.shell}>
        <div className={styles.chatColumn}>
          <section className={`card ${styles.chatCard}`}>
            <div className={styles.staffChat}>
              <div className={styles.staffChatHead}>
                <span className="eyebrow">Staff Edward</span>
                <button
                  type="button"
                  className={styles.copyButton}
                  disabled={sending}
                  onClick={resetConversation}
                >
                  New conversation
                </button>
              </div>
              <div ref={transcript} className={styles.staffTranscript} aria-live="polite">
                {messages.length === 0 ? (
                  <p className={styles.emptyState}>
                    Ask Staff Edward about a student, the work queue, or for a draft
                    message. Turns share one durable conversation per tab.
                  </p>
                ) : (
                  messages.map((message) => (
                    <article
                      key={message.id}
                      className={`${styles.staffMessage} ${
                        message.role === "user"
                          ? styles.staffMessageUser
                          : styles.staffMessageAssistant
                      }`}
                    >
                      {message.role === "assistant" && message.resolvedStudent ? (
                        <span className={styles.resolvedStudentBadge}>
                          Student: {message.resolvedStudent.name}
                          <span className={styles.mono}>
                            {message.resolvedStudent.id.slice(0, 8)}…
                          </span>
                        </span>
                      ) : null}
                      {message.role === "assistant" && message.blocks?.length ? (
                        <StaffBlocks blocks={message.blocks} idPrefix={message.id} />
                      ) : (
                        <p>{message.content}</p>
                      )}
                      {message.role === "assistant" && message.provider ? (
                        <span className={styles.staffMessageMeta}>
                          {message.provider}
                          {message.model ? ` · ${message.model}` : ""}
                        </span>
                      ) : null}
                    </article>
                  ))
                )}
                {sending ? (
                  <p className={styles.emptyState} role="status">
                    Staff Edward is reading the record…
                  </p>
                ) : null}
                {chatError ? (
                  <p
                    className={`${styles.failureBanner} ${styles.failureBannerError}`}
                    role="alert"
                  >
                    {chatError}
                  </p>
                ) : null}
              </div>
              <form
                className={styles.staffComposer}
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(draft);
                }}
              >
                <textarea
                  value={draft}
                  rows={2}
                  maxLength={2_000}
                  placeholder="Message Staff Edward"
                  aria-label="Message Staff Edward"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void send(draft);
                    }
                  }}
                />
                <button type="submit" disabled={sending || draft.trim().length === 0}>
                  Send
                </button>
              </form>
              <p className={styles.staffChatNote}>
                Read-only: Staff Edward reads records and writes drafts; it never sends
                messages or changes data.
              </p>
            </div>
          </section>
          <section className="card">
            <div className={styles.timelineTitle}>
              <span className="eyebrow">Conversation timeline</span>
              <span className={styles.turnMeta}>{turns.length} turns</span>
            </div>
            <div className={styles.timeline}>
              {turns.length === 0 ? (
                <p className={styles.emptyState}>Turns you send appear here.</p>
              ) : (
                [...turns].reverse().map((turn) => {
                  const trace = turn.requestId ? traces[turn.requestId] : null;
                  const summary = trace ? summarizeTrace(trace) : null;
                  return (
                    <button
                      key={turn.index}
                      type="button"
                      className={`${styles.turnRow} ${
                        turn.requestId && turn.requestId === selectedTraceId
                          ? styles.turnRowActive
                          : ""
                      }`}
                      onClick={() => {
                        if (turn.requestId) void selectTrace(turn.requestId);
                      }}
                    >
                      <span className={styles.turnIndex}>#{turn.index}</span>
                      <span className={styles.turnQuestion}>{turn.question}</span>
                      <span className={styles.turnMeta}>
                        {turn.status === "error"
                          ? "✗ error"
                          : summary
                            ? `${formatMs(summary.durationMs)} · ${summary.toolCount} tools · ${summary.statusLabel}`
                            : turn.status === "no_trace"
                              ? "trace unavailable"
                              : `${formatMs(turn.latencyMs)} · trace…`}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
        <div className={styles.inspector}>
          <EdwardTraceInspector trace={selectedTrace} />
          <section className={`card ${styles.section}`}>
            <div className={styles.sectionHead}>
              <span className="eyebrow">Recent staff traces</span>
              <button
                type="button"
                className={styles.copyButton}
                onClick={() => refreshRecent()}
              >
                Refresh
              </button>
            </div>
            <div className={styles.recentList}>
              {recent.length === 0 ? (
                <p className={styles.emptyState}>
                  No staff traces recorded on this backend yet.
                </p>
              ) : (
                recent.map((entry) => (
                  <button
                    key={entry.traceId}
                    type="button"
                    className={`${styles.recentRow} ${
                      entry.traceId === selectedTraceId ? styles.recentRowActive : ""
                    }`}
                    onClick={() => void selectTrace(entry.traceId)}
                  >
                    <span className={styles.recentQuestion}>
                      {entry.userMessage || "(no message)"}
                    </span>
                    <span className={styles.turnMeta}>
                      {entry.failureCodes?.length ? "⚠" : "✓"}
                    </span>
                    <span className={styles.recentMeta}>
                      <span>{entry.startedAt?.slice(11, 19) ?? ""}</span>
                      <span className={styles.mono}>{entry.requestType ?? entry.path}</span>
                      <span>{formatMs(entry.durationMs)}</span>
                      <span>{entry.executedTools?.length ?? 0} tools</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
