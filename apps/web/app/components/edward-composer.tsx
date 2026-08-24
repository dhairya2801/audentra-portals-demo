"use client";

import type { KeyboardEvent, ReactNode, RefObject } from "react";
import Icon from "../design-system/Icon.jsx";
import Tooltip from "../design-system/primitives/Tooltip.jsx";
import { STANDING_CAUTION } from "./edward-thread";

/**
 * The reference composer: the context chip inside it (droppable), the field,
 * the mic, the send — and the standing caution pinned under the field so no
 * surface scrolls it away. `voice` carries the production states: the browser
 * dictation and the platform live session both read as "listening".
 */
export function EdwardComposer({
  draft,
  onDraft,
  onSend,
  context,
  onDropContext,
  listening,
  micLabel,
  micDisabled,
  onMic,
  disabled,
  note,
  inputRef,
  children,
}: {
  draft: string;
  onDraft: (value: string) => void;
  onSend: (value: string) => void;
  context: string | null;
  onDropContext: () => void;
  listening: boolean;
  micLabel: string;
  micDisabled: boolean;
  onMic: () => void;
  disabled: boolean;
  /** A status line under the field: listening, voice replies, a mic problem. */
  note?: ReactNode;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /** Production-only controls (the live voice session) rendered above the field. */
  children?: ReactNode;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (draft.trim()) onSend(draft);
    }
  }

  return (
    <div className="edward-composer">
      {children}

      {context ? (
        <div className="edward-context">
          <span className="edward-context-chip">
            <Icon name="pin" size={12} />
            {context}
            <Tooltip tip="Stop asking about this">
              <button
                type="button"
                aria-label={`Stop asking about ${context}`}
                onClick={onDropContext}
              >
                <Icon name="close" size={12} />
              </button>
            </Tooltip>
          </span>
        </div>
      ) : null}

      <div className={`edward-field${listening ? " listening" : ""}`}>
        <label className="sr-only" htmlFor="edward-input">
          Ask Edward a question
        </label>
        <textarea
          ref={inputRef}
          id="edward-input"
          rows={1}
          maxLength={2_000}
          autoComplete="off"
          value={draft}
          placeholder={listening ? "Listening…" : "Ask about your enrollment"}
          disabled={disabled}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />

        <Tooltip tip={micLabel} placement="top">
          <button
            type="button"
            className={`edward-mic${listening ? " listening" : ""}`}
            aria-label={micLabel}
            aria-pressed={listening}
            disabled={micDisabled}
            onClick={onMic}
          >
            {listening ? (
              <span className="edward-wave" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            ) : (
              <Icon name="mic" size={16} />
            )}
          </button>
        </Tooltip>

        <Tooltip tip="Send" placement="top">
          <button
            type="button"
            className="edward-send"
            aria-label="Send question"
            disabled={disabled || !draft.trim()}
            onClick={() => onSend(draft)}
          >
            <Icon name="send" size={16} />
          </button>
        </Tooltip>
      </div>

      {note}

      <p className="edward-caution">
        <Icon name="shield" size={13} />
        {STANDING_CAUTION}
      </p>
    </div>
  );
}
