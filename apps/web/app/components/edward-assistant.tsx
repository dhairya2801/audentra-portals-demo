"use client";

import type {
  AskEdwardResponse,
  EdwardActionWidget,
  EdwardChatMessage,
  EdwardContextReceipt,
} from "@vv/contracts";
import { TenantLink as Link } from "./tenant-link";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import {
  askEdward,
  createDepositPayment,
} from "../lib/api-client";
import { useTenant } from "./tenant-provider";

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
  contextReceipts?: AskEdwardResponse["contextReceipts"];
  widgets?: EdwardActionWidget[];
};

type SpeechRecognitionResultEvent = Event & {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionErrorEvent = Event & {
  error?: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type VoiceWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

const subscribeToVoiceCapability = () => () => undefined;

function voiceCapabilitySnapshot() {
  if (typeof window === "undefined") return false;
  const voiceWindow = window as VoiceWindow;
  return Boolean(
    voiceWindow.SpeechRecognition ||
      voiceWindow.webkitSpeechRecognition,
  );
}

const contextSourceLabels: Record<EdwardContextReceipt["source"], string> = {
  dashboard: "Enrollment summary",
  profile: "Profile",
  documents: "Documents",
  onboarding: "Onboarding",
  payments: "Payments",
  academics: "Academic plan",
  financials: "Financial plan",
  messages: "Messages",
  campus_life: "Campus life",
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
  const { tenant } = useTenant();
  const [open, setOpen] = useState(variant === "embedded");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voiceSupported = useSyncExternalStore(
    subscribeToVoiceCapability,
    voiceCapabilitySnapshot,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(false);
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
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  const { track } = useActivityTracking();

  useEffect(() => {
    return () => {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

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

  const send = async (message: string, speakResponse = voiceReplies) => {
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
      const contextReceipts = response.contextReceipts ?? [];
      if (contextReceipts.length > 0) {
        track("ui.edward_context_receipts_received.v1", {
          source_count: contextReceipts.length,
          page_context: window.location.pathname,
        });
      }
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.message,
          actions: response.suggestedActions,
          provider: response.provider,
          contextReceipts,
          widgets: response.widgets ?? [],
        },
      ]);
      if (speakResponse && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(response.message);
        utterance.lang = navigator.language || "en-US";
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
      }
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

  const toggleVoiceInput = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const voiceWindow = window as VoiceWindow;
    const Recognition =
      voiceWindow.SpeechRecognition ||
      voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError(
        "Voice input is not available in this browser. You can still type your question.",
      );
      return;
    }
    const nextRecognition = new Recognition();
    recognition.current = nextRecognition;
    nextRecognition.lang = navigator.language || "en-US";
    nextRecognition.continuous = false;
    nextRecognition.interimResults = false;
    nextRecognition.onstart = () => {
      setError(null);
      setListening(true);
    };
    nextRecognition.onend = () => {
      setListening(false);
      recognition.current = null;
    };
    nextRecognition.onerror = (event) => {
      setListening(false);
      recognition.current = null;
      setError(
        event.error === "not-allowed"
          ? "Microphone access was blocked. Allow microphone access or type your question."
          : "Edward could not hear that clearly. Please try again or type your question.",
      );
    };
    nextRecognition.onresult = (event) => {
      const spokenMessage = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (!spokenMessage) return;
      setDraft(spokenMessage);
      setVoiceReplies(true);
      void send(spokenMessage, true);
    };
    try {
      nextRecognition.start();
    } catch {
      setListening(false);
      recognition.current = null;
      setError(
        "Edward could not start the microphone. Please try again or type your question.",
      );
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
            <i aria-hidden="true" /> Connected to your {tenant.shortName} record
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
            {message.contextReceipts?.length ? (
              <div
                className="edward-context-receipts"
                aria-label="Student record context used for this response"
              >
                <span className="edward-context-receipts__label">
                  Record context
                </span>
                {message.contextReceipts.map(({ source }) => (
                  <span key={`${message.id}-${source}`}>
                    {contextSourceLabels[source]}
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
            className={`edward-voice-button${listening ? " is-listening" : ""}`}
            type="button"
            disabled={sending || !voiceSupported}
            aria-label={
              !voiceSupported
                ? "Voice input is unavailable"
                : listening
                  ? "Stop listening"
                  : "Ask Edward by voice"
            }
            aria-pressed={listening}
            title={
              voiceSupported
                ? "Ask Edward by voice"
                : "Voice input is not supported by this browser"
            }
            onClick={toggleVoiceInput}
          >
            <span aria-hidden="true">{listening ? "■" : "●"}</span>
          </button>
          <button
            className="edward-send-button"
            type="submit"
            disabled={sending || draft.trim().length === 0}
            aria-label="Send message"
          >
            ↑
          </button>
        </div>
        {listening ? (
          <p className="edward-voice-status" role="status">
            <span aria-hidden="true" /> Listening — ask your question naturally.
          </p>
        ) : voiceReplies ? (
          <button
            className="edward-voice-replies"
            type="button"
            onClick={() => {
              window.speechSynthesis?.cancel();
              setVoiceReplies(false);
            }}
          >
            Voice replies are on · turn off
          </button>
        ) : null}
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
