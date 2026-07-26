"use client";

import type {
  StudentDocument,
  StudentDocumentList,
} from "@vv/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  canRetryDocumentExtraction,
  DocumentExtractionRetry,
} from "../components/document-extraction-retry";
import { DocumentUpload } from "../components/document-upload";
import { PortalShell } from "../components/portal-shell";
import {
  ActionFeedback,
  EmptyState,
  ErrorState,
  LoadingState,
  PageCard,
  StatusPill,
} from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  confirmStudentDocumentExtraction,
  getStudentDocumentContentUrl,
  getStudentDocuments,
} from "../lib/api-client";

const exampleDocuments = [
  {
    title: "2026–27 FAFSA form",
    office: "Federal Student Aid",
    detail:
      "Official paper Free Application for Federal Student Aid and filing instructions.",
    file: "https://studentaid.gov/sites/default/files/2026-27-fafsa-form.pdf",
    source:
      "https://studentaid.gov/sites/default/files/2026-27-fafsa-form.pdf",
    tag: "Financial aid",
  },
  {
    title: "Federal FERPA model consent",
    office: "U.S. Department of Education",
    detail: "Official model for disclosing education records in a higher-education program.",
    file: "/documents/examples/ed-ferpa-model-consent.pdf",
    source: "https://www.ed.gov/media/document/sample-ferpa-pep-consent-form",
    tag: "Federal privacy",
  },
  {
    title: "FERPA release authorization",
    office: "University of Alabama at Birmingham",
    detail: "Real university authorization to release education records.",
    file: "/documents/examples/uab-ferpa-authorization.pdf",
    source:
      "https://www.uab.edu/registrar/images/ferpa/ferpa-authorization-form.pdf",
    tag: "Privacy",
  },
  {
    title: "IRS Form W-9S",
    office: "Internal Revenue Service",
    detail: "Current student or borrower taxpayer ID certification form.",
    file: "/documents/examples/irs-form-w9s-2026.pdf",
    source: "https://www.irs.gov/pub/irs-pdf/fw9s.pdf",
    tag: "Student accounts",
  },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ExtractionReview({
  document,
  onDocumentChanged,
}: {
  document: StudentDocument;
  onDocumentChanged: () => void;
}) {
  const extraction = document.extraction;
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
      <div className="extraction-state extraction-state--waiting" aria-live="polite">
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
        <code>OPENROUTER_API_KEY</code>
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
    const retryable = canRetryDocumentExtraction(document);
    return (
      <div className="extraction-state extraction-state--error">
        <strong>
          {retryable
            ? "The original is safe, but extraction needs a retry"
            : "The original is safe, but this parser cannot complete it"}
        </strong>
        <p>{extraction.summary}</p>
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

  if (extraction.status !== "completed" || extraction.fields.length === 0) {
    const hasWarnings = extraction.warnings.length > 0;
    return (
      <div
        className={`extraction-state${hasWarnings ? " extraction-state--attention" : ""}`}
      >
        <strong>
          {hasWarnings
            ? "Document classified — review where it belongs"
            : "Document stored"}
        </strong>
        <p>{extraction.summary}</p>
        {hasWarnings ? (
          <ul className="extraction-warnings">
            {extraction.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const confirmFields = async () => {
    const key =
      intentKey.current ?? (intentKey.current = crypto.randomUUID());
    try {
      await confirm.run([...acceptedKeys], key);
      intentKey.current = null;
      onDocumentChanged();
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
          </small>
        </span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <p>{extraction.summary}</p>
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
            success="Extracted fields confirmed."
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

function DocumentWorkspace({
  list,
  reload,
}: {
  list: StudentDocumentList;
  reload: () => void;
}) {
  return (
    <>
      <section className="document-hero">
        <div>
          <p className="eyebrow">Secure document center</p>
          <h2>Upload once. Let the portal organize the details.</h2>
          <p>
            Your original stays attached to your student record. Edward’s
            document agent extracts a reviewable structure; it never silently
            overwrites verified profile information.
          </p>
        </div>
        <DocumentUpload onUploaded={() => reload()} />
      </section>

      <div className="documents-layout">
        <PageCard
          eyebrow="Your student record"
          title={`Submitted documents (${list.total})`}
          className="documents-list-card"
        >
          {list.items.length === 0 ? (
            <EmptyState
              title="No documents uploaded yet"
              description="When a checklist item asks for supporting evidence, upload the real file here."
            />
          ) : (
            <ul className="document-records">
              {list.items.map((document) => {
                const contentUrl = getStudentDocumentContentUrl(document);
                return (
                  <li key={document.id}>
                    <div className="document-record__top">
                      <span className="document-file-icon" aria-hidden="true">
                        {document.mimeType === "application/pdf" ? "PDF" : "IMG"}
                      </span>
                      <div>
                        <h3>{document.fileName}</h3>
                        <p>
                          {document.extraction?.status === "completed"
                            ? `Detected ${document.extraction.documentType.replaceAll(
                                "_",
                                " ",
                              )}`
                            : document.category.replaceAll("_", " ")}
                          {document.requirementId &&
                          document.extraction?.status === "completed"
                            ? ` · expected ${document.category.replaceAll(
                                "_",
                                " ",
                              )}`
                            : ""}{" "}
                          ·{" "}
                          {formatFileSize(document.sizeBytes)}
                        </p>
                      </div>
                      <StatusPill value={document.status} />
                    </div>
                    <div className="document-record__actions">
                      {contentUrl ? (
                        <a href={contentUrl} target="_blank" rel="noreferrer">
                          View original <span aria-hidden="true">↗</span>
                        </a>
                      ) : null}
                      {document.sha256 ? (
                        <span title={document.sha256}>
                          Integrity checked · {document.sha256.slice(0, 8)}
                        </span>
                      ) : null}
                    </div>
                    <ExtractionReview
                      document={document}
                      onDocumentChanged={reload}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </PageCard>

        <aside className="document-guidance">
          <PageCard eyebrow="How it works" title="Agentic, with a review gate">
            <ol className="processing-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Store the original</strong>
                  <p>File bytes and metadata are kept separately.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Extract a strict schema</strong>
                  <p>The model can only return allowed fields.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>You verify the result</strong>
                  <p>No extracted value becomes trusted automatically.</p>
                </div>
              </li>
            </ol>
          </PageCard>
        </aside>
      </div>

      <section className="official-forms" aria-labelledby="official-forms-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reference library</p>
            <h2 id="official-forms-title">Real forms students may encounter</h2>
          </div>
          <p>Official sources · provided as examples</p>
        </div>
        <div className="official-form-grid">
          {exampleDocuments.map((document) => (
            <article className="official-form-card" key={document.file}>
              <div className="official-form-preview" aria-hidden="true">
                <span>PDF</span>
                <strong>{document.tag}</strong>
                <i />
                <i />
                <i />
              </div>
              <div>
                <span>{document.office}</span>
                <h3>{document.title}</h3>
                <p>{document.detail}</p>
                <nav aria-label={`${document.title} links`}>
                  <a href={document.file} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                  <a href={document.source} target="_blank" rel="noreferrer">
                    Official source ↗
                  </a>
                </nav>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default function DocumentsPage() {
  const loadDocuments = useCallback(
    (signal: AbortSignal) => getStudentDocuments(signal),
    [],
  );
  const documents = useApiResource(loadDocuments);
  const refreshDocuments = documents.refresh;

  const hasPendingExtraction =
    documents.data?.items.some(
      (document) => document.extraction?.status === "processing",
    ) ?? false;

  useEffect(() => {
    if (!hasPendingExtraction) return;
    const interval = window.setInterval(() => {
      void refreshDocuments();
    }, 2_500);
    return () => window.clearInterval(interval);
  }, [hasPendingExtraction, refreshDocuments]);

  return (
    <PortalShell
      active="documents"
      eyebrow="Student records"
      title="Documents"
      description="Upload supporting records, review structured extraction, and keep the original file close."
    >
      {documents.status === "loading" ? (
        <LoadingState label="Loading your documents" />
      ) : documents.status === "error" ? (
        <ErrorState message={documents.error} onRetry={documents.reload} />
      ) : (
        <DocumentWorkspace list={documents.data} reload={documents.refresh} />
      )}
    </PortalShell>
  );
}
