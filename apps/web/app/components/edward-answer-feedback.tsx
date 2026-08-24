"use client";

import type { EdwardFeedbackInput, EdwardFeedbackRating } from "@vv/contracts";
import { type FormEvent, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import { IconButton } from "../design-system/primitives/Button.jsx";
import {
  submitStaffEdwardFeedback,
  submitStudentEdwardFeedback,
} from "../lib/api-client";
import type { EdwardFeedbackTarget } from "./edward-response-feedback";

/**
 * The response-feedback controls in the reference's message-actions row
 * style: three icon buttons with tooltips (helpful, not helpful, write a
 * comment) and, below the row, the comment editor. Same endpoints and same
 * saved-state handling as `EdwardResponseFeedback`; only the shape differs.
 */
export function EdwardAnswerFeedback({ target }: { target: EdwardFeedbackTarget }) {
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
    if (await save({ writtenFeedback: normalized })) {
      setDraft(normalized);
      setEditorOpen(false);
    }
  };

  const editorId = `edward-feedback-${target.assistantMessageId}`;

  return (
    <>
      <span
        className="edward-feedback"
        role="group"
        aria-label="Feedback for this Edward response"
      >
        <IconButton
          name="thumbsUp"
          size={16}
          label="Helpful"
          placement="top"
          className={rating === "positive" ? "active" : undefined}
          aria-pressed={rating === "positive"}
          disabled={status === "saving"}
          onClick={() => void chooseRating("positive")}
        />
        <IconButton
          name="thumbsDown"
          size={16}
          label="Not helpful"
          placement="top"
          className={rating === "negative" ? "active" : undefined}
          aria-pressed={rating === "negative"}
          disabled={status === "saving"}
          onClick={() => void chooseRating("negative")}
        />
        <IconButton
          name="comment"
          size={16}
          label="Write feedback"
          placement="top"
          className={writtenFeedback ? "active" : undefined}
          aria-expanded={editorOpen}
          aria-controls={editorId}
          disabled={status === "saving"}
          onClick={() => {
            setDraft(writtenFeedback ?? draft);
            setEditorOpen((current) => !current);
            setStatus("idle");
          }}
        />
        {status === "saving" ? (
          <small role="status">Saving…</small>
        ) : status === "saved" ? (
          <small role="status">Thanks for the feedback.</small>
        ) : status === "error" ? (
          <small className="error" role="alert">
            Couldn’t save. Try again.
          </small>
        ) : null}
      </span>
      {editorOpen ? (
        <form className="edward-feedback-editor" onSubmit={submitWritten}>
          <label htmlFor={editorId}>What could Edward do better?</label>
          <textarea
            id={editorId}
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
              className="text-button"
              disabled={status === "saving"}
              onClick={() => setEditorOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="secondary-button"
              disabled={status === "saving" || draft.trim().length === 0}
            >
              <Icon name="send" size={15} /> Submit
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
