"use client";

import type { StudentDocument } from "@vv/contracts";
import { useCallback, useRef, useState } from "react";
import { useApiAction } from "../hooks/use-api-resource";
import { confirmStudentDocumentExtraction } from "../lib/api-client";
import { documentExtractionFailurePresentation } from "../lib/document-extraction-ui";
import { DocumentExtractionRetry } from "./document-extraction-retry";
import { ActionFeedback } from "./portal-ui";

/**
 * Shared human-review boundary for agentic document extraction.
 *
 * Parsing may classify and structure an uploaded document. Transcripts are
 * projected automatically into advisory academic records; profile-bearing
 * documents retain an explicit human-review boundary.
 */
export function DocumentExtractionReview({
  document,
  onDocumentChanged,
}: {
  document: StudentDocument;
  onDocumentChanged: (document: StudentDocument) => void;
}) {
  const extraction = document.extraction;
  const courses = extraction?.courses ?? [];
  const intentKey = useRef<string | null>(null);
  const [acceptedKeys, setAcceptedKeys] = useState(
    () => new Set(extraction?.fields.map((field) => field.key) ?? []),
  );
  const confirmAction = useCallback(
    (fieldKeys: string[], key: string) =>
      confirmStudentDocumentExtraction(
        document.id,
        { acceptedFieldKeys: fieldKeys },
        key,
      ),
    [document.id],
  );
  const confirm = useApiAction(confirmAction);

  if (!extraction) return null;

  if (extraction.status === "processing") {
    return (
      <div
        className="extraction-state extraction-state--waiting"
        aria-live="polite"
      >
        <strong>Original saved — extracting a reviewable record</strong>
        <p>
          Your file is already attached to your student record. Edward is
          reading it in the background; this page will refresh automatically.
        </p>
      </div>
    );
  }

  if (extraction.status === "pending_configuration") {
    return (
      <div className="extraction-state extraction-state--waiting">
        <strong>AI extraction is ready to connect</strong>
        <p>{extraction.summary}</p>
        <code>GROQ_API_KEY or OPENROUTER_API_KEY</code>
        {extraction.warnings.length ? (
          <ul className="extraction-warnings">
            {extraction.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <DocumentExtractionRetry
          document={document}
          onRetried={onDocumentChanged}
        />
      </div>
    );
  }

  if (extraction.status === "failed") {
    const failure = documentExtractionFailurePresentation(extraction);
    return (
      <div className="extraction-state extraction-state--error" role="alert">
        <strong>{failure.title}</strong>
        <p>{extraction.summary}</p>
        <p className="muted">{failure.guidance}</p>
        {extraction.warnings.length ? (
          <ul className="extraction-warnings">
            {extraction.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <DocumentExtractionRetry
          document={document}
          onRetried={onDocumentChanged}
        />
      </div>
    );
  }

  if (extraction.status !== "completed") return null;

  if (extraction.documentType === "transcript") {
    return (
      <div className="extraction-state extraction-state--success" role="status">
        <strong>Transcript parsed automatically</strong>
        <p>
          {courses.length > 0
            ? `${courses.length} course${courses.length === 1 ? "" : "s"} were added to your academic record for advisory matching.`
            : "The transcript was stored and parsed. Academic matching will update when course data is available."}
        </p>
        <p className="muted">
          Potential course matches are advisory until the Registrar completes
          its review.
        </p>
      </div>
    );
  }

  const confirmFields = async () => {
    const key =
      intentKey.current ?? (intentKey.current = crypto.randomUUID());
    try {
      const changed = await confirm.run([...acceptedKeys], key);
      intentKey.current = null;
      onDocumentChanged(changed);
    } catch {
      // Keep the idempotency key for a safe retry of the same confirmation.
    }
  };

  return (
    <details className="extraction-review" open={document.status === "needs_review"}>
      <summary>
        <span>
          <strong>Review extracted data</strong>
          <small>
            {extraction.fields.length} structured{" "}
            {extraction.fields.length === 1 ? "field" : "fields"}
            {courses.length
              ? ` · ${courses.length} courses`
              : ""}
          </small>
        </span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <p>{extraction.summary}</p>
      {extraction.fields.length ? (
        <div className="extraction-fields">
          {extraction.fields.map((field) => (
            <label key={field.key}>
              <input
                type="checkbox"
                checked={acceptedKeys.has(field.key)}
                disabled={document.status !== "needs_review"}
                onChange={(event) => {
                  setAcceptedKeys((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(field.key);
                    else next.delete(field.key);
                    return next;
                  });
                }}
              />
              <span>
                <strong>{field.label}</strong>
                <small>{field.value}</small>
              </span>
              <em>{Math.round(field.confidence * 100)}%</em>
            </label>
          ))}
        </div>
      ) : null}
      {courses.length ? (
        <div className="extraction-course-summary">
          <strong>Courses ready for transfer-credit review</strong>
          <ul>
            {courses.slice(0, 8).map((course, index) => (
              <li key={`${course.sourceCode ?? course.title}-${index}`}>
                <span>{course.sourceCode ?? "Course"}</span>
                {course.title}
                {course.grade ? ` · ${course.grade}` : ""}
              </li>
            ))}
          </ul>
          {courses.length > 8 ? (
            <small>
              And {courses.length - 8} more extracted courses.
            </small>
          ) : null}
        </div>
      ) : null}
      {extraction.warnings.length ? (
        <ul className="extraction-warnings">
          {extraction.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {document.status === "needs_review" ? (
        <>
          <ActionFeedback
            status={confirm.status}
            error={confirm.message}
            success="Extracted data confirmed and synced to your student record."
          />
          <button
            className="button button--primary"
            type="button"
            disabled={confirm.status === "loading"}
            onClick={() => void confirmFields()}
          >
            {confirm.status === "loading"
              ? "Saving review…"
              : "Confirm selected fields"}
          </button>
        </>
      ) : (
        <p className="confirmed-line">
          <span aria-hidden="true">✓</span>
          Reviewed{" "}
          {extraction.verifiedAt
            ? new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(new Date(extraction.verifiedAt))
            : "by the student"}
        </p>
      )}
    </details>
  );
}
