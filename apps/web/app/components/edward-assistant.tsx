"use client";

import type {
  AskEdwardResponse,
  EdwardActionWidget,
  EdwardChatMessage,
} from "@vv/contracts";
import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import {
  askEdward,
  createDepositPayment,
} from "../lib/api-client";

const quickPrompts = [
  "What should I do next?",
  "Which classes can I be exempted from?",
  "I want to pay my deposit",
  "What financial-aid item needs attention?",
];

type DisplayMessage = EdwardChatMessage & {
  id: string;
  actions?: AskEdwardResponse["suggestedActions"];
  provider?: AskEdwardResponse["provider"];
  toolsUsed?: string[];
  widgets?: EdwardActionWidget[];
};

function ActionWidget({
  widget,
  onCompleted,
}: {
  widget: EdwardActionWidget;
  onCompleted: (message: string) => void;
}) {
  const { track } = useActivityTracking();
  const [status, setStatus] = useState<
    "idle" | "submitting" | "complete" | "error"
  >(widget.type === "deposit_payment" && widget.status === "completed"
    ? "complete"
    : "idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("ui.edward_action_widget_viewed.v1", {
      widget_type: widget.type,
      page_context: window.location.pathname,
    });
  }, [track, widget.type]);

  if (widget.type === "deposit_payment") {
    const pay = async () => {
      if (!["idle", "error"].includes(status)) return;
      setStatus("submitting");
      setError(null);
      try {
        await createDepositPayment(
          { offerId: widget.offerId },
          crypto.randomUUID(),
        );
        setStatus("complete");
        track("ui.edward_action_completed.v1", {
          widget_type: widget.type,
          outcome: "succeeded",
        });
        onCompleted(
          "Your enrollment deposit is recorded. Enrollment and financial balances have been refreshed.",
        );
      } catch (caught) {
        setStatus("error");
        setError(
          caught instanceof Error
            ? caught.message
            : "The deposit could not be recorded.",
        );
        track("ui.edward_action_completed.v1", {
          widget_type: widget.type,
          outcome: "failed",
        });
      }
    };

    return (
      <section className="edward-widget" aria-label={widget.title}>
        <div className="edward-widget__heading">
          <span aria-hidden="true">$</span>
          <div>
            <strong>{widget.title}</strong>
            <small>Secure action</small>
          </div>
          <b>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(widget.amountCents / 100)}
          </b>
        </div>
        <p>{widget.description}</p>
        {error ? <p className="edward-widget__error">{error}</p> : null}
        <button
          className="button button--accent"
          type="button"
          disabled={status === "submitting" || status === "complete"}
          onClick={() => void pay()}
        >
          {status === "submitting"
            ? "Recording deposit…"
            : status === "complete"
              ? "✓ Deposit recorded"
              : status === "error"
                ? "Try again"
                : "Pay deposit"}
        </button>
        <small>No real card is charged in this development environment.</small>
      </section>
    );
  }

  return (
    <section className="edward-widget" aria-label={widget.title}>
      <div className="edward-widget__heading">
        <span aria-hidden="true">{widget.type === "document_upload" ? "↑" : "◷"}</span>
        <div>
          <strong>{widget.title}</strong>
          <small>
            {widget.type === "document_upload" ? "Document workflow" : "Live support"}
          </small>
        </div>
      </div>
      <p>{widget.description}</p>
      <Link className="button button--accent" href={widget.href}>
        {widget.type === "document_upload" ? "Choose a document" : "Choose a time"}
      </Link>
    </section>
  );
}

export function EdwardAssistant({
  studentName,
  variant = "floating",
}: {
  studentName: string;
  variant?: "floating" | "embedded";
}) {
  const [open, setOpen] = useState(variant === "embedded");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${studentName}. I’m Edward. I can securely read your current enrollment, financial, academic, and campus context, then open the right action for you.`,
      provider: "guided",
      actions: [
        { label: "View enrollment", href: "/enrollment" },
        { label: "Explore classes", href: "/classrooms" },
      ],
    },
  ]);
  const input = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const { track } = useActivityTracking();

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

  const addSystemMessage = (content: string) => {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        provider: "guided",
      },
    ]);
  };

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
      (response.toolsUsed ?? []).forEach((toolName) => {
        track("ui.edward_tool_invoked.v1", {
          tool_name: toolName,
          page_context: window.location.pathname,
        });
      });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.message,
          actions: response.suggestedActions,
          provider: response.provider,
          toolsUsed: response.toolsUsed ?? [],
          widgets: response.widgets ?? [],
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
      id={variant === "floating" ? "edward-panel" : "edward-workspace"}
      className={
        variant === "floating"
          ? "edward-panel"
          : "edward-panel edward-panel--embedded"
      }
      role={variant === "floating" ? "dialog" : "region"}
      aria-label="Edward AI student guide"
    >
      <header className="edward-panel__header">
        <span className="edward-avatar" aria-hidden="true">
          E
        </span>
        <div>
          <strong>Edward</strong>
          <span>
            <i aria-hidden="true" /> Connected to your Aster record
          </span>
        </div>
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
            <p>{message.content}</p>
            {message.toolsUsed?.length ? (
              <div className="edward-tools" aria-label="Portal data checked">
                {message.toolsUsed.map((tool) => (
                  <span key={`${message.id}-${tool}`}>
                    ✓ {tool.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            ) : null}
            {message.widgets?.map((widget) => (
              <ActionWidget
                widget={widget}
                onCompleted={addSystemMessage}
                key={`${message.id}-${widget.id}`}
              />
            ))}
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
                  ? "AI-generated guidance · verify important decisions"
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
            Edward is checking your portal
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
            <button type="button" onClick={() => void send(prompt)} key={prompt}>
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <form className="edward-composer" onSubmit={submit}>
        <label htmlFor={`edward-message-${variant}`}>
          Ask about your student journey
        </label>
        <div>
          <input
            ref={input}
            id={`edward-message-${variant}`}
            value={draft}
            maxLength={2_000}
            autoComplete="off"
            placeholder="Ask about enrollment, classes, aid, or campus…"
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
          credentials. Edward cannot approve academic or aid decisions.
        </small>
      </form>
    </section>
  );

  if (variant === "embedded") return panel;

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
      {open ? panel : null}
    </>
  );
}
