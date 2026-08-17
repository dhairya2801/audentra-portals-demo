"use client";

import type { AskStaffEdwardResponse } from "@vv/contracts";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { askStaffEdward } from "../../lib/api-client";
import { edwardOpeningQuestion, EDWARD_SUGGESTIONS } from "./data";
import type { BrewBriefing, EdwardRequest } from "./types";

const MODE_LABELS: Record<EdwardRequest["mode"], string> = {
  ask: "Briefing context attached",
  summarize: "Summarizing",
  insights: "Reading the attention list",
  cohort: "Expanding a cohort",
};

interface Turn {
  id: string;
  question: string;
  answer: string | null;
  receipts: string[];
  error: string | null;
}

/**
 * Edward in Morning Brew is the real staff assistant, not a local answerer.
 *
 * The previous panel composed its own replies from a hard-coded script, which
 * meant the briefing could quote figures no query ever produced. Every question
 * now goes to `/v1/staff/assistant/messages`, which reads the same canonical
 * cohorts the briefing counted and is bounded by the platform's own safety
 * guard. If that call fails, the panel says so — it never falls back to
 * inventing an answer.
 */
export function EdwardPanel({
  request,
  briefing,
  onClose,
}: {
  request: EdwardRequest | null;
  briefing: BrewBriefing;
  onClose: () => void;
}) {
  const [thread, setThread] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [seededRequest, setSeededRequest] = useState(request);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(null);

  const send = async (text: string) => {
    const normalized = text.trim();
    if (!normalized || sending) return;
    const id = crypto.randomUUID();
    setThread((current) => [
      ...current,
      { id, question: normalized, answer: null, receipts: [], error: null },
    ]);
    setQuestion("");
    setSending(true);
    try {
      const response: AskStaffEdwardResponse = await askStaffEdward({
        message: normalized,
        ...(conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
        clientMessageId: id,
      });
      if (response.conversationId) conversationIdRef.current = response.conversationId;
      setThread((current) =>
        current.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                answer: response.message,
                receipts: response.contextReceipts.map((receipt) => receipt.source),
              }
            : turn,
        ),
      );
    } catch (caught) {
      setThread((current) =>
        current.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                error:
                  caught instanceof Error
                    ? caught.message
                    : "Edward could not answer just now. Please try again.",
              }
            : turn,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  // Each launch seeds a fresh conversation from the card that opened it.
  if (request !== seededRequest) {
    setSeededRequest(request);
    setThread([]);
    setQuestion("");
    conversationIdRef.current = null;
    if (request) {
      const opening = edwardOpeningQuestion(
        request.mode,
        request.context,
        briefing,
        request.question,
      );
      queueMicrotask(() => void send(opening));
    }
  }

  useEffect(() => {
    if (!request) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 140);
    return () => window.clearTimeout(focusTimer);
  }, [request]);

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [thread]);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, onClose]);

  if (!request) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(question);
  };

  return (
    <div
      className="brew-edward-layer"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside className="brew-edward" role="dialog" aria-modal="true" aria-labelledby="brew-edward-title">
        <header>
          <span className="brew-edward__mark" aria-hidden="true">
            E<i />
          </span>
          <div>
            <p>Staff assistant</p>
            <h2 id="brew-edward-title">Edward</h2>
          </div>
          <button type="button" aria-label="Close Edward" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="brew-edward__context">
          <span>{MODE_LABELS[request.mode]}</span>
          <p>
            {request.context ? `On: ${request.context}. ` : ""}Edward reads the same canonical
            records this briefing counted. It cannot change anything, and it answers only from what
            it can read.
          </p>
        </div>

        <div className="brew-edward__conversation" aria-live="polite" ref={conversationRef}>
          {thread.map((turn) => (
            <div key={turn.id}>
              <div className="brew-edward__question">{turn.question}</div>
              <article className="brew-edward__answer">
                <span className="brew-edward__mini-mark" aria-hidden="true">
                  E
                </span>
                <div>
                  {turn.error ? (
                    <p className="brew-edward__error">{turn.error}</p>
                  ) : turn.answer === null ? (
                    <p className="brew-edward__pending">Reading canonical records…</p>
                  ) : (
                    <>
                      {turn.answer.split("\n").map((paragraph, index) =>
                        paragraph.trim() ? (
                          <p key={`${turn.id}-${index}`}>{paragraph}</p>
                        ) : null,
                      )}
                      {turn.receipts.length ? (
                        <aside>Read from: {turn.receipts.join(", ")}</aside>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            </div>
          ))}
        </div>

        <div className="brew-edward__suggestions">
          <span>Try asking</span>
          {EDWARD_SUGGESTIONS.map((item) => (
            <button type="button" onClick={() => void send(item)} key={item} disabled={sending}>
              {item}
            </button>
          ))}
        </div>

        <form className="brew-edward__composer" onSubmit={submit}>
          <input
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about today's briefing…"
            aria-label="Ask Edward"
          />
          <button type="submit" disabled={!question.trim() || sending} aria-label="Send question">
            ↑
          </button>
        </form>
      </aside>
    </div>
  );
}
