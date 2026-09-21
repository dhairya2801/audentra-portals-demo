"use client";

import type {
  AskEdwardResponse,
  AssistantResponseBlock,
  EdwardActionWidget,
  EdwardChatMessage,
  EdwardContextReceipt,
  EdwardActionIntent,
  EdwardActionReceipt,
} from "@vv/contracts";
import type { RefObject } from "react";
import Icon from "../design-system/Icon.jsx";
import { AssistantBlocks } from "./assistant-blocks";
import { ActionWidget } from "./edward-action-widget";
import { EdwardActionCard } from "./edward-action-card";
import { EdwardAnswerFeedback } from "./edward-answer-feedback";
import { TenantLink as Link } from "./tenant-link";

export type EdwardDisplayMessage = EdwardChatMessage & {
  id: string;
  inputMode?: "text" | "voice";
  actions?: AskEdwardResponse["suggestedActions"];
  provider?: AskEdwardResponse["provider"];
  contextReceipts?: AskEdwardResponse["contextReceipts"];
  widgets?: EdwardActionWidget[];
  actionIntents?: EdwardActionIntent[];
  actionReceipts?: EdwardActionReceipt[];
  blocks?: AssistantResponseBlock[];
  traceId?: string;
  /** The composer's context chip at the moment the question was sent. */
  context?: string | null;
};

export const EDWARD = { name: "Edward", mark: "E" } as const;

export const STANDING_CAUTION =
  "AI guidance, grounded in your record. You review changes before they happen.";

const BOUNDARY_NOTE = "Edward can only see your record.";

export const contextSourceLabels: Record<EdwardContextReceipt["source"], string> = {
  university: "University records",
  institution_knowledge: "Institutional policies",
  dashboard: "Enrollment summary",
  profile: "Profile",
  documents: "Documents",
  onboarding: "Onboarding",
  payments: "Payments",
  academics: "Academic plan",
  financials: "Financial plan",
  financial_aid: "Financial aid",
  housing: "Housing",
  holds: "Holds",
  registration: "Registration",
  deadlines: "Deadlines",
  appointments: "Appointments",
  policies: "University policies",
  account: "Account balance",
  messages: "Messages",
  campus_life: "Campus life",
};

export interface EdwardSuggestion {
  id: string;
  text: string;
}

export interface EdwardSuggestionGroup {
  id: string;
  label: string;
  items: EdwardSuggestion[];
}

export interface EdwardLiveCaption {
  text: string;
  final: boolean;
}

/** Paragraphs from a plain-text answer; a run of newlines is a break. */
function Body({ content }: { content: string }) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return <p>{content}</p>;
  return paragraphs.map((paragraph, index) =>
    paragraph.includes("\n") ? (
      <ul className="edward-list" key={index}>
        {paragraph.split("\n").map((line, lineIndex) => (
          <li key={`${lineIndex}-${line}`}>{line}</li>
        ))}
      </ul>
    ) : (
      <p key={index}>{paragraph}</p>
    ),
  );
}

function Suggestions({
  groups,
  onAsk,
}: {
  groups: EdwardSuggestionGroup[];
  onAsk: (item: EdwardSuggestion) => void;
}) {
  return (
    <div className="edward-suggestions">
      {groups.map((group) => (
        <section key={group.id}>
          <p className="panel-label">{group.label}</p>
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="edward-suggestion"
              onClick={() => onAsk(item)}
            >
              <span>{item.text}</span>
              <Icon name="arrow" size={15} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

export function EdwardMessage({
  message,
  playing,
  onPlay,
  onWidgetCompleted,
}: {
  message: EdwardDisplayMessage;
  /** The id of the answer the browser is reading aloud, if any. */
  playing: string | null;
  /** Read this answer aloud with the browser's speech synthesis; absent when unsupported. */
  onPlay: ((id: string, text: string) => void) | null;
  onWidgetCompleted: (content: string) => void;
}) {
  if (message.role === "user") {
    return (
      <article className="edward-turn student">
        <p className="edward-bubble">{message.content}</p>
        {message.inputMode === "voice" ? (
          <p className="edward-asked-from">
            <Icon name="mic" size={12} /> asked by voice
          </p>
        ) : message.context ? (
          <p className="edward-asked-from">
            <Icon name="pin" size={12} /> asked from {message.context}
          </p>
        ) : null}
      </article>
    );
  }

  const receipts = message.contextReceipts ?? [];
  const semantic = message.blocks?.some(block => block.type === "answer");

  return (
    <article className="edward-turn edward">
      <div className="edward-answer">
        {message.blocks?.length ? (
          <AssistantBlocks blocks={message.blocks} idPrefix={message.id} />
        ) : (
          <Body content={message.content} />
        )}

        {receipts.length > 0 && !semantic ? (
          <p
            className="edward-source"
            aria-label="Student record context used for this response"
          >
            <Icon name="shield" size={13} />
            Based on your record ·{" "}
            {receipts.map(({ source }) => contextSourceLabels[source]).join(", ")}
          </p>
        ) : null}


        {message.widgets?.map((widget) => (
          <ActionWidget
            widget={widget}
            onCompleted={onWidgetCompleted}
            key={`${message.id}-${widget.id}`}
          />
        ))}

        {message.actionIntents?.map((intent) => (
          <EdwardActionCard intent={intent} actor="student" key={intent.id} />
        ))}

        {message.actions?.length || message.traceId || onPlay ? (
          <div className="edward-answer-actions">
            {message.actions?.map((action) => (
              <Link
                className="edward-route"
                href={action.href}
                key={`${message.id}-${action.href}`}
              >
                {action.label} <Icon name="arrow" size={15} />
              </Link>
            ))}
            {onPlay ? (
              <button
                type="button"
                className={`edward-play${playing === message.id ? " playing" : ""}`}
                aria-label={
                  playing === message.id
                    ? "Stop playing this answer"
                    : "Play this answer"
                }
                onClick={() => onPlay(message.id, message.content)}
              >
                {playing === message.id ? (
                  <>
                    <span className="edward-wave" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    Playing…
                  </>
                ) : (
                  <>
                    <Icon name="sound" size={14} /> Play answer
                  </>
                )}
              </button>
            ) : null}
            {message.traceId ? (
              <EdwardAnswerFeedback
                target={{
                  assistantKind: "student",
                  assistantMessageId: message.id,
                  traceId: message.traceId,
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function EdwardThread({
  studentName,
  messages,
  suggestions,
  thinking,
  error,
  canRetry,
  caption,
  playing,
  onPlay,
  onAsk,
  onRetry,
  onWidgetCompleted,
  bottomRef,
}: {
  playing: string | null;
  onPlay: ((id: string, text: string) => void) | null;
  studentName: string;
  greeting: EdwardDisplayMessage | null;
  messages: EdwardDisplayMessage[];
  suggestions: EdwardSuggestionGroup[];
  thinking: boolean;
  error: string | null;
  canRetry: boolean;
  caption: EdwardLiveCaption | null;
  onAsk: (item: EdwardSuggestion) => void;
  onRetry: () => void;
  onWidgetCompleted: (content: string) => void;
  bottomRef: RefObject<HTMLDivElement | null>;
}) {
  const empty = messages.length === 0;

  return (
    <div
      className="edward-thread"
      role="log"
      aria-live="polite"
      aria-label="Conversation with Edward"
    >
      {empty ? (
        <div className="edward-greeting">
          <span className="edward-mark" aria-hidden="true">
            {EDWARD.mark}
          </span>
          <h3>Let’s find your next step, {studentName}.</h3>
          <p>Understand what’s happening, what matters now, and who can help. Start wherever you are.</p>
          <p className="edward-boundary">
            <Icon name="shield" size={13} /> {BOUNDARY_NOTE}
          </p>
        </div>
      ) : null}

      {messages.map((message) => (
        <EdwardMessage
          key={message.id}
          message={message}
          playing={playing}
          onPlay={onPlay}
          onWidgetCompleted={onWidgetCompleted}
        />
      ))}

      {caption ? (
        <article className="edward-turn student">
          <p className="edward-bubble edward-live-caption">
            <span className="edward-wave" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            {caption.text}
          </p>
          <p className="edward-asked-from" role="status">
            <Icon name="mic" size={12} />{" "}
            {caption.final ? "heard" : "listening…"}
          </p>
        </article>
      ) : null}

      {thinking ? (
        <article className="edward-turn edward">
          <p className="edward-thinking" role="status">
            <span className="edward-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Reading your record…
          </p>
        </article>
      ) : null}

      {error ? (
        <article className="edward-turn edward">
          <div className="edward-answer error" role="alert">
            <p>
              <Icon name="alert" size={16} /> {error}
            </p>
            {canRetry ? (
              <button type="button" className="secondary-button" onClick={onRetry}>
                <Icon name="refresh" size={15} /> Try again
              </button>
            ) : null}
          </div>
        </article>
      ) : null}

      {empty && suggestions.length > 0 ? (
        <Suggestions groups={suggestions} onAsk={onAsk} />
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
