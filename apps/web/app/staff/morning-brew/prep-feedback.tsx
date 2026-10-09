"use client";
import { useState } from "react";
import { submitBrewPrepFeedback } from "../../lib/api-client";
import type { StaffBrewPrepFeedback } from "@vv/contracts";
export function PrepFeedback({
  subjectId,
  snapshotAt,
}: {
  subjectId: string;
  snapshotAt: string;
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [attempt, setAttempt] = useState<StaffBrewPrepFeedback | null>(null);
  const options =
    rating === "up"
      ? [
          ["accurate", "Accurate information"],
          ["useful_context", "Useful context"],
          ["clear_actions", "Clear next steps"],
          ["easy_to_scan", "Easy to scan"],
        ]
      : [
          ["inaccurate", "Information is inaccurate"],
          ["missing_context", "Missing context"],
          ["unclear_actions", "Unclear next steps"],
          ["too_long", "Too much detail"],
        ];
  async function send(form: HTMLFormElement, skip: boolean) {
    if (!rating || busy) return;
    const values = new FormData(form),
      body = {
        subjectId,
        snapshotAt,
        dataOrigin: "demo" as const,
        rating,
        reasons: skip ? [] : values.getAll("reason").map(String),
        comment: skip ? "" : String(values.get("comment") || ""),
      };
    const payload = {
      ...body,
      id:
        attempt &&
        JSON.stringify({ ...attempt, id: undefined }) === JSON.stringify(body)
          ? attempt.id
          : crypto.randomUUID(),
    };
    setAttempt(payload);
    setBusy(true);
    setMessage("");
    try {
      await submitBrewPrepFeedback(payload);
      setRating(null);
      setMessage("Feedback saved for this demo prep sheet. Thank you.");
    } catch {
      setMessage(
        "Feedback could not be saved. Your selections are retained; please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="brew-prep-rating">
      <div>
        <strong>Was this prep helpful?</strong>
        <button
          disabled={busy}
          aria-label="Helpful prep"
          aria-pressed={rating === "up"}
          onClick={() => {
            setRating("up");
            setMessage("");
          }}
        >
          👍
        </button>
        <button
          disabled={busy}
          aria-label="Unhelpful prep"
          aria-pressed={rating === "down"}
          onClick={() => {
            setRating("down");
            setMessage("");
          }}
        >
          👎
        </button>
      </div>
      {rating ? (
        <form
          className="brew-prep-feedback-popup"
          aria-label="Meeting prep feedback"
          onSubmit={(e) => {
            e.preventDefault();
            void send(e.currentTarget, false);
          }}
        >
          <header>
            <strong>
              {rating === "up" ? "What worked?" : "What could improve?"}
            </strong>
            <button
              type="button"
              disabled={busy}
              aria-label="Close feedback"
              onClick={() => setRating(null)}
            >
              ×
            </button>
          </header>
          <fieldset disabled={busy}>
            {options.map(([id, label]) => (
              <label key={id}>
                <input type="checkbox" name="reason" value={id} />
                {label}
              </label>
            ))}
            <label className="brew-feedback-comment">
              Anything else? (optional)
              <textarea name="comment" maxLength={1000} />
            </label>
            <div className="brew-feedback-actions">
              <button
                type="button"
                onClick={(e) => void send(e.currentTarget.form!, true)}
              >
                Skip details
              </button>
              <button type="submit">{busy ? "Saving…" : "Submit"}</button>
            </div>
          </fieldset>
          <small>
            Saved feedback is tied to this demo prep sheet and your staff
            account.
          </small>
        </form>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
