"use client";

import type {
  AskEdwardResponse,
  EdwardChatMessage,
} from "@vv/contracts";
import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { askEdward } from "../lib/api-client";

const quickPrompts = [
  "What should I do next?",
  "How do document uploads work?",
  "When is my deposit due?",
];

type DisplayMessage = EdwardChatMessage & {
  id: string;
  actions?: AskEdwardResponse["suggestedActions"];
  provider?: AskEdwardResponse["provider"];
};

export function EdwardAssistant({ studentName }: { studentName: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${studentName}. I’m Edward, your Aster portal guide. I can help you find the right enrollment step without changing your records.`,
      provider: "guided",
      actions: [
        { label: "View enrollment", href: "/enrollment" },
        { label: "Upload a document", href: "/documents" },
      ],
    },
  ]);
  const input = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
  }, [open]);

  useEffect(() => {
    transcript.current?.scrollTo({
      top: transcript.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  const send = async (message: string) => {
    const normalized = message.trim();
    if (!normalized || sending) return;
    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: normalized,
    };
    const history = messages
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setError(null);
    setSending(true);
    try {
      const response = await askEdward({
        message: normalized,
        pageContext: window.location.pathname,
        history,
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.message,
          actions: response.suggestedActions,
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

  return (
    <>
      <button
        className={`edward-launcher${open ? " edward-launcher--open" : ""}`}
        type="button"
        aria-expanded={open}
        aria-controls="edward-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="edward-avatar" aria-hidden="true">
          E
        </span>
        <span>
          <strong>Ask Edward</strong>
          <small>AI student guide</small>
        </span>
      </button>

      {open ? (
        <aside
          id="edward-panel"
          className="edward-panel"
          role="dialog"
          aria-label="Edward AI student guide"
        >
          <header className="edward-panel__header">
            <span className="edward-avatar" aria-hidden="true">
              E
            </span>
            <div>
              <strong>Edward</strong>
              <span>
                <i aria-hidden="true" /> Aster AI guide
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

          <div
            ref={transcript}
            className="edward-transcript"
            aria-live="polite"
          >
            {messages.map((message) => (
              <article
                className={`edward-message edward-message--${message.role}`}
                key={message.id}
              >
                <p>{message.content}</p>
                {message.actions?.length ? (
                  <div className="edward-actions">
                    {message.actions.map((action) => (
                      <Link href={action.href} key={`${message.id}-${action.href}`}>
                        {action.label} <span aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
                {message.role === "assistant" && message.provider ? (
                  <small>
                    {message.provider === "openrouter"
                      ? "AI-generated guidance"
                      : "Built-in portal guidance"}
                  </small>
                ) : null}
              </article>
            ))}
            {sending ? (
              <div className="edward-typing" role="status">
                <span />
                <span />
                <span />
                Edward is thinking
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
            <label htmlFor="edward-message">Ask about your student journey</label>
            <div>
              <input
                ref={input}
                id="edward-message"
                value={draft}
                maxLength={2_000}
                autoComplete="off"
                placeholder="Ask Edward a question…"
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="submit"
                disabled={sending || draft.trim().length === 0}
                aria-label="Send message"
              >
                ↑
              </button>
            </div>
            <small>
              Don’t share passwords, government IDs, health details, or payment
              information.
            </small>
          </form>
        </aside>
      ) : null}
    </>
  );
}
