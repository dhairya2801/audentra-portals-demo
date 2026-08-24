"use client";

import type { EdwardFeedbackInput, EdwardFeedbackRating } from "@vv/contracts";
import { type FormEvent, useState } from "react";
import {
  submitStaffEdwardFeedback,
  submitStudentEdwardFeedback,
} from "../lib/api-client";
import styles from "./edward-response-feedback.module.css";

export interface EdwardFeedbackTarget {
  assistantKind: "student" | "staff";
  assistantMessageId: string;
  traceId: string;
}

export function EdwardResponseFeedback({
  target,
}: {
  target: EdwardFeedbackTarget;
}) {
  const [rating, setRating] = useState<EdwardFeedbackRating | null>(null);
  const [writtenFeedback, setWrittenFeedback] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const save = async (input: Omit<EdwardFeedbackInput, "traceId">) => {
    setStatus("saving");
    try {
      const submit =
        target.assistantKind === "student"
          ? submitStudentEdwardFeedback
          : submitStaffEdwardFeedback;
      const saved = await submit(target.assistantMessageId, {
        traceId: target.traceId,
        ...input,
      });
      setRating(saved.rating);
      setWrittenFeedback(saved.writtenFeedback);
      setStatus("saved");
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  };

  const chooseRating = async (next: EdwardFeedbackRating) => {
    if (status === "saving" || next === rating) return;
    await save({ rating: next });
  };

  const submitWritten = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = draft.trim();
    if (!normalized || status === "saving") return;
    if (
      await save({
        writtenFeedback: normalized,
      })
    ) {
      setDraft(normalized);
      setEditorOpen(false);
    }
  };

  return (
    <div className={styles.feedback} aria-label="Feedback for this Edward response">
      <div className={styles.controls}>
        <button
          type="button"
          className={rating === "positive" ? styles.selected : undefined}
          aria-label="Helpful response"
          aria-pressed={rating === "positive"}
          title="Helpful"
          disabled={status === "saving"}
          onClick={() => void chooseRating("positive")}
        >
          <span aria-hidden="true">👍</span>
        </button>
        <button
          type="button"
          className={rating === "negative" ? styles.selected : undefined}
          aria-label="Unhelpful response"
          aria-pressed={rating === "negative"}
          title="Not helpful"
          disabled={status === "saving"}
          onClick={() => void chooseRating("negative")}
        >
          <span aria-hidden="true">👎</span>
        </button>
        <button
          type="button"
          className={writtenFeedback ? styles.selected : undefined}
          aria-label="Write feedback"
          aria-expanded={editorOpen}
          title="Write feedback"
          disabled={status === "saving"}
          onClick={() => {
            setDraft(writtenFeedback ?? draft);
            setEditorOpen((current) => !current);
            setStatus("idle");
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20">
            <path d="M3.25 3.75h13.5v9.5H8l-3.65 3v-3H3.25z" />
          </svg>
        </button>
        {status === "saving" ? (
          <span className={styles.state} role="status">
            Saving…
          </span>
        ) : status === "saved" ? (
          <span className={styles.state} role="status">
            Thanks for the feedback.
          </span>
        ) : status === "error" ? (
          <span className={styles.error} role="alert">
            Couldn’t save. Try again.
          </span>
        ) : null}
      </div>
      {editorOpen ? (
        <form className={styles.editor} onSubmit={submitWritten}>
          <label htmlFor={`edward-feedback-${target.assistantMessageId}`}>
            What could Edward do better?
          </label>
          <textarea
            id={`edward-feedback-${target.assistantMessageId}`}
            value={draft}
            rows={3}
            maxLength={4_000}
            autoFocus
            placeholder="Share a little more context…"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div>
            <button
              type="button"
              disabled={status === "saving"}
              onClick={() => setEditorOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === "saving" || draft.trim().length === 0}
            >
              Submit
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
