"use client";

import type {
  StudentDocument,
  StudentDocumentCategory,
  StudentDocumentList,
} from "@vv/contracts";
import {
  type FormEvent,
  useCallback,
  useRef,
  useState,
} from "react";
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
  uploadStudentDocument,
} from "../lib/api-client";

const MAXIMUM_FILE_BYTES = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

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
  onConfirmed,
}: {
  document: StudentDocument;
  onConfirmed: () => void;
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

  if (extraction.status === "pending_configuration") {
    return (
      <div className="extraction-state extraction-state--waiting">
        <strong>AI extraction is ready to connect</strong>
        <p>{extraction.summary}</p>
        <code>OPENROUTER_API_KEY</code>
      </div>
    );
  }

  if (extraction.status === "failed") {
    return (
      <div className="extraction-state extraction-state--error">
        <strong>The original is safe, but extraction needs a retry</strong>
        <p>{extraction.summary}</p>
      </div>
    );
  }

  if (extraction.status !== "completed" || extraction.fields.length === 0) {
    return (
      <div className="extraction-state">
        <strong>Document stored</strong>
        <p>{extraction.summary}</p>
      </div>
    );
  }

  const confirmFields = async () => {
    const key =
      intentKey.current ?? (intentKey.current = crypto.randomUUID());
    try {
      await confirm.run([...acceptedKeys], key);
      intentKey.current = null;
      onConfirmed();
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
  const form = useRef<HTMLFormElement>(null);
  const intentKey = useRef<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const uploadAction = useCallback(
    (file: File, category: StudentDocumentCategory, key: string) =>
      uploadStudentDocument(file, category, key),
    [],
  );
  const upload = useApiAction(uploadAction);

  const submitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    upload.reset();
    const values = new FormData(event.currentTarget);
    const file = values.get("file");
    const category = values.get("category") as StudentDocumentCategory;

    if (!(file instanceof File) || file.size === 0) {
      setValidationError("Choose a PDF, JPEG, or PNG document.");
      return;
    }
    if (!allowedMimeTypes.has(file.type)) {
      setValidationError("This file type isn’t supported. Use PDF, JPEG, or PNG.");
      return;
    }
    if (file.size > MAXIMUM_FILE_BYTES) {
      setValidationError("The document must be no larger than 10 MB.");
      return;
    }

    const key = intentKey.current ?? (intentKey.current = crypto.randomUUID());
    try {
      await upload.run(file, category, key);
      intentKey.current = null;
      form.current?.reset();
      reload();
    } catch {
      // Retain the same key so a retry cannot create a duplicate.
    }
  };

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
        <form ref={form} className="document-dropzone" onSubmit={submitDocument}>
          <label>
            <span className="document-dropzone__icon" aria-hidden="true">
              ↑
            </span>
            <strong>Choose a document</strong>
            <small>PDF, JPEG, or PNG · maximum 10 MB</small>
            <input
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              required
            />
          </label>
          <select name="category" defaultValue="transcript" aria-label="Document category">
            <option value="transcript">Academic transcript</option>
            <option value="identity">Identity document</option>
            <option value="residency">Residency evidence</option>
            <option value="financial_aid">Financial aid</option>
            <option value="health">Health or immunization</option>
            <option value="consent">Consent or FERPA</option>
            <option value="other">Other document</option>
          </select>
          {validationError ? (
            <p className="field-error" role="alert">
              {validationError}
            </p>
          ) : null}
          <ActionFeedback
            status={upload.status}
            error={upload.message}
            success="Document uploaded and processed."
          />
          <button
            className="button button--accent"
            type="submit"
            disabled={upload.status === "loading"}
          >
            {upload.status === "loading"
              ? "Uploading and extracting…"
              : upload.status === "error"
                ? "Retry upload"
                : "Upload document"}
          </button>
          <p className="document-privacy">
            <span aria-hidden="true">◆</span> Encrypted storage boundary ·
            student review required
          </p>
        </form>
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
                          {document.category.replaceAll("_", " ")} ·{" "}
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
                    <ExtractionReview document={document} onConfirmed={reload} />
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
