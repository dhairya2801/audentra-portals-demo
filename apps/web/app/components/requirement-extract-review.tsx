"use client";

import type { StudentDocument } from "@vv/contracts";
import { useCallback, useRef, useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import { useApiAction } from "../hooks/use-api-resource";
import {
  confirmStudentDocumentExtraction,
  retryStudentDocumentExtraction,
} from "../lib/api-client";
import { documentExtractionFailurePresentation } from "../lib/document-extraction-ui";
import { useTenant } from "./tenant-provider";
import { formatTenantDate, type TenantConfig } from "../lib/tenant";

/**
 * Edward's document check, put back in front of the student — the reference
 * `ExtractReview`'s shape (the machine's answer marked as the machine's, one
 * decision per field, nothing decided until she decides it) over the
 * production human-review boundary: `confirmStudentDocumentExtraction` with
 * the field keys she accepted, and `retryStudentDocumentExtraction` when the
 * read failed or is not configured.
 */

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string, tenant: TenantConfig) {
  return formatTenantDate(value, tenant, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RetryRead({
  document,
  onRetried,
  title,
  body,
}: {
  document: StudentDocument;
  onRetried: (document: StudentDocument) => void | Promise<void>;
  title: string;
  body: string;
}) {
  const retryIntentKey = useRef<string | null>(null);
  const retry = useApiAction(
    useCallback(
      (documentId: string, idempotencyKey: string) =>
        retryStudentDocumentExtraction(documentId, idempotencyKey),
      [],
    ),
  );
  const extraction = document.extraction;
  const canRetry =
    extraction?.status === "pending_configuration" ||
    (extraction?.status === "failed" && extraction.retryable !== false);

  const retryParsing = async () => {
    const idempotencyKey =
      retryIntentKey.current ?? (retryIntentKey.current = crypto.randomUUID());
    try {
      const updatedDocument = await retry.run(document.id, idempotencyKey);
      retryIntentKey.current = null;
      await onRetried(updatedDocument);
    } catch {
      // Keep the key for a safe retry if the network result was ambiguous.
    }
  };

  return (
    <div className="upload-failed" role="alert">
      <p>
        <strong>{title}</strong> {body}
      </p>
      {extraction?.warnings.length ? (
        <ul className="reject-remedies">
          {extraction.warnings.map((warning) => (
            <li key={warning}>
              <Icon name="info" size={14} />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
      {canRetry ? (
        <div className="upload-failed-actions">
          <Button
            kind="primary"
            leadingIcon="refresh"
            pending={retry.status === "loading"}
            onClick={() => void retryParsing()}
          >
            Ask Edward to read it again
          </Button>
        </div>
      ) : null}
      {retry.status === "error" ? (
        <p className="upload-refusal" role="alert">
          <Icon name="alert" size={14} /> {retry.message}
        </p>
      ) : null}
    </div>
  );
}

export function RequirementExtractReview({
  document,
  expectedType,
  onDocumentChanged,
}: {
  document: StudentDocument;
  expectedType: string | null;
  onDocumentChanged: (document: StudentDocument) => void;
}) {
  const { tenant } = useTenant();
  const extraction = document.extraction;
  const courses = extraction?.courses ?? [];
  const intentKey = useRef<string | null>(null);
  const [acceptedKeys, setAcceptedKeys] = useState(
    () => new Set(extraction?.fields.map((field) => field.key) ?? []),
  );
  const confirm = useApiAction(
    useCallback(
      (fieldKeys: string[], key: string) =>
        confirmStudentDocumentExtraction(
          document.id,
          { acceptedFieldKeys: fieldKeys },
          key,
        ),
      [document.id],
    ),
  );

  if (!extraction) return null;

  if (extraction.status === "processing") {
    return (
      <Notice tone="working" icon="clock" title="Edward is reading it">
        {document.fileName} is safely stored. This page refreshes on its own
        when the read finishes.
      </Notice>
    );
  }

  if (extraction.status === "pending_configuration") {
    return (
      <RetryRead
        document={document}
        onRetried={onDocumentChanged}
        title="Stored, but not read."
        body={`${extraction.summary} ${tenant.shortName} staff can still open the original.`}
      />
    );
  }

  if (extraction.status === "failed") {
    const failure = documentExtractionFailurePresentation(extraction);
    return (
      <RetryRead
        document={document}
        onRetried={onDocumentChanged}
        title={`${failure.title}.`}
        body={`${extraction.summary} ${failure.guidance}`}
      />
    );
  }

  if (extraction.status !== "completed") return null;

  const mismatch = expectedType !== null && extraction.documentType !== expectedType;
  const read = document.processingMode === "classification_only" ? "checked" : "read";
  const compliance = extraction.immunizationCompliance ?? null;

  // What Edward decided about the file as a whole — the one tinted line.
  const verdict = mismatch ? (
    <Notice tone="soon" icon="alert" title={`Edward ${read} this as ${humanize(extraction.documentType)}`}>
      {expectedType ? `This step asks for ${humanize(expectedType)}. ` : ""}
      {extraction.summary} {tenant.shortName} staff make the final call on the original.
    </Notice>
  ) : (
    <Notice tone="done" icon="check" title={`Edward ${read} this as ${humanize(extraction.documentType)}`}>
      {extraction.summary}
    </Notice>
  );

  if (extraction.documentType === "transcript" && document.processingMode === "agentic") {
    return (
      <>
        {verdict}
        {courses.length > 0 ? (
          <p className="extract-note">
            {courses.length} course{courses.length === 1 ? "" : "s"} joined your
            academic record for advisory matching. Matches stay advisory until the
            Registrar reviews them.
          </p>
        ) : (
          <p className="extract-note">
            The transcript was stored and read. Academic matching updates when
            course data is available.
          </p>
        )}
      </>
    );
  }

  const confirmFields = async () => {
    const key = intentKey.current ?? (intentKey.current = crypto.randomUUID());
    try {
      const changed = await confirm.run([...acceptedKeys], key);
      intentKey.current = null;
      onDocumentChanged(changed);
    } catch {
      // Keep the idempotency key for a safe retry of the same confirmation.
    }
  };
  const reviewable =
    document.processingMode === "agentic" && extraction.fields.length > 0;
  const deciding = document.status === "needs_review";
  const left = reviewable && deciding
    ? extraction.fields.length - acceptedKeys.size
    : 0;

  return (
    <>
      {verdict}

      {extraction.warnings.length ? (
        <ul className="reject-remedies">
          {extraction.warnings.map((warning) => (
            <li key={warning}>
              <Icon name="info" size={14} />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {compliance ? (
        <section className="extract-review" aria-labelledby="compliance-title">
          <div className="extract-head">
            <h3 id="compliance-title">What Edward found in this record</h3>
            <p className="extract-note">
              Checked against {compliance.policyVersion}. Health Services makes the
              final determination.
            </p>
          </div>
          <ul className="extract-fields">
            {compliance.requirements.map((item) => (
              <li
                key={item.ruleId}
                className={`extract-field ${item.status === "met" ? "right" : "open"}`}
              >
                <label>{item.name}</label>
                <div className="extract-control">
                  <span
                    className={`extract-verdict ${item.status === "met" ? "right" : "fixed"}`}
                  >
                    <Icon
                      name={item.status === "met" ? "check" : item.status === "missing" ? "alert" : "help"}
                      size={14}
                    />{" "}
                    {humanize(item.status)}
                  </span>
                </div>
                <span className="extract-read">{item.rationale}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reviewable ? (
        <section className="extract-review" aria-labelledby="extract-title">
          <div className="extract-head">
            <h3 id="extract-title">Check what Edward read</h3>
            <p className="extract-note">
              {deciding
                ? "Each value below is Edward’s reading of your file, with how sure it was. Confirm the ones that are right; leave any that are wrong unconfirmed and staff will read the original."
                : `Reviewed ${extraction.verifiedAt ? formatDate(extraction.verifiedAt, tenant) : "by you"}. These values are on your record.`}
            </p>
          </div>
          <ul className="extract-fields">
            {extraction.fields.map((field) => {
              const accepted = acceptedKeys.has(field.key);
              return (
                <li
                  key={field.key}
                  className={`extract-field ${accepted ? "right" : "open"}`}
                >
                  <label htmlFor={`extract-${field.key}`}>{field.label}</label>
                  <div className="extract-control">
                    <input
                      id={`extract-${field.key}`}
                      type="text"
                      value={field.value}
                      readOnly
                      aria-describedby={`extract-read-${field.key}`}
                    />
                    {deciding ? (
                      accepted ? (
                        <button
                          type="button"
                          className="extract-verdict right"
                          aria-pressed="true"
                          onClick={() =>
                            setAcceptedKeys((current) => {
                              const next = new Set(current);
                              next.delete(field.key);
                              return next;
                            })
                          }
                        >
                          <Icon name="check" size={14} /> Confirmed
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="extract-agree"
                          onClick={() =>
                            setAcceptedKeys((current) => new Set(current).add(field.key))
                          }
                        >
                          This is right
                        </button>
                      )
                    ) : (
                      <span className={`extract-verdict ${accepted ? "right" : "fixed"}`}>
                        <Icon name={accepted ? "check" : "pen"} size={14} />{" "}
                        {accepted ? "Confirmed" : "Left for staff"}
                      </span>
                    )}
                  </div>
                  <span className="extract-read" id={`extract-read-${field.key}`}>
                    read from your file · {Math.round(field.confidence * 100)}% sure
                  </span>
                </li>
              );
            })}
          </ul>
          {courses.length > 0 ? (
            <ul className="reject-remedies">
              {courses.slice(0, 8).map((course, index) => (
                <li key={`${course.sourceCode ?? course.title}-${index}`}>
                  <Icon name="book" size={14} />
                  {course.sourceCode ? `${course.sourceCode} · ` : ""}
                  {course.title}
                  {course.grade ? ` · ${course.grade}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {deciding ? (
            <>
              <p className="extract-left" role="status">
                {left === 0
                  ? "Every field is confirmed. Nothing was assumed."
                  : `${left} field${left === 1 ? "" : "s"} left unconfirmed — staff will read ${left === 1 ? "it" : "them"} from the original.`}
              </p>
              {confirm.status === "error" ? (
                <p className="upload-refusal" role="alert">
                  <Icon name="alert" size={14} /> {confirm.message}
                </p>
              ) : null}
              <Button
                kind="primary"
                icon="arrow"
                full
                pending={confirm.status === "loading"}
                onClick={() => void confirmFields()}
              >
                Confirm what I checked
              </Button>
            </>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
