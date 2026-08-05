"use client";

import type {
  StudentDocument,
  StudentDocumentList,
} from "@vv/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentExtractionRetry } from "../components/document-extraction-retry";
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
import {
  beginDocumentExtractionProjection,
  defaultAcceptedDocumentExtractionFieldKeys,
  documentExtractionFailurePresentation,
  preferredDocumentProjection,
  reconcileDocumentExtractionProjection,
  type DocumentExtractionProjectionState,
} from "../lib/document-extraction-ui";

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
  onDocumentChanged: (document: StudentDocument) => void;
}) {
  const extraction = document.extraction;
  const intentKey = useRef<string | null>(null);
  const [acceptedKeys, setAcceptedKeys] = useState(
    () => new Set(defaultAcceptedDocumentExtractionFieldKeys(extraction)),
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
  onDocumentChanged,
}: {
  list: StudentDocumentList;
  onDocumentChanged: (document: StudentDocument) => void;
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
        <DocumentUpload onUploaded={onDocumentChanged} />
      </section>

      <div className="documents-layout">
        <PageCard
          eyebrow="Your student record"
          title={`Submitted & signed documents (${list.total})`}
          className="documents-list-card"
        >
          <p className="documents-list-card__intro">
            Uploaded records and completed signature documents stay together in
            one reviewable library.
          </p>
          {list.items.length === 0 ? (
            <EmptyState
              title="No documents yet"
              description="Uploads and documents signed during onboarding will appear together here."
            />
          ) : (
            <ul className="submitted-document-grid">
              {list.items.map((document) => {
                const contentUrl = getStudentDocumentContentUrl(document);
                const isSigned = document.signature != null;
                const documentKind = isSigned
                  ? "Signed document"
                  : "Submitted document";
                return (
                  <li key={document.id}>
                    <div className="submitted-document__preview" aria-hidden="true">
                      <span>
                        {document.mimeType === "application/pdf" ? "PDF" : "IMG"}
                      </span>
                      <strong>{isSigned ? "SIGNED" : "FILED"}</strong>
                      <i />
                      <i />
                      <i />
                      <em>
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(document.createdAt))}
                      </em>
                    </div>
                    <div className="submitted-document__body">
                      <div className="document-record__top">
                      <div>
                        <span className="submitted-document__kind">{documentKind}</span>
                        <h3>
                          {document.signature?.title ?? document.fileName}
                        </h3>
                        {document.signature ? (
                          <p>
                            Signed{" "}
                            {new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }).format(
                              new Date(document.signature.signedAt),
                            )}{" "}
                            · {document.signature.method} signature ·{" "}
                            {formatFileSize(document.sizeBytes)}
                          </p>
                        ) : (
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
                            · {formatFileSize(document.sizeBytes)}
                          </p>
                        )}
                      </div>
                      {document.signature ? (
                        <span className="submitted-document__signed-status">
                          ✓ Signed
                        </span>
                      ) : (
                        <StatusPill value={document.status} />
                      )}
                      </div>
                      <div className="document-record__actions">
                        {contentUrl ? (
                          <a href={contentUrl} target="_blank" rel="noreferrer">
                            {document.signature
                              ? "View signed PDF"
                              : "View original"}{" "}
                            <span aria-hidden="true">↗</span>
                          </a>
                        ) : null}
                        {document.sha256 ? (
                          <span title={document.sha256}>
                            <i aria-hidden="true">✓</i> Integrity checked ·{" "}
                            {document.sha256.slice(0, 8)}
                          </span>
                        ) : null}
                      </div>
                      {document.signature ? (
                        <dl className="submitted-document__signature-details">
                          <div>
                            <dt>Signed by</dt>
                            <dd>{document.signature.signerName}</dd>
                          </div>
                          <div>
                            <dt>Document version</dt>
                            <dd>
                              Onboarding v
                              {document.signature.onboardingVersion}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <ExtractionReview
                          key={`${document.id}:${document.extraction?.status ?? "none"}:${document.extraction?.processedAt ?? ""}`}
                          document={document}
                          onDocumentChanged={onDocumentChanged}
                        />
                      )}
                    </div>
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
            <p className="eyebrow">Official form templates</p>
            <h2 id="official-forms-title">Reference forms students may encounter</h2>
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

function applyDocumentProjections(
  list: StudentDocumentList,
  projections: Readonly<Record<string, DocumentExtractionProjectionState>>,
): StudentDocumentList {
  const documentsById = new Map(
    list.items.map((document) => [document.id, document]),
  );
  for (const projection of Object.values(projections)) {
    documentsById.set(
      projection.document.id,
      preferredDocumentProjection(
        documentsById.get(projection.document.id),
        projection,
      ),
    );
  }
  const items = [...documentsById.values()].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
  return { ...list, items, total: Math.max(list.total, items.length) };
}

export default function DocumentsPage() {
  const loadDocuments = useCallback(
    (signal: AbortSignal) => getStudentDocuments(signal),
    [],
  );
  const documents = useApiResource(loadDocuments);
  const refreshDocuments = documents.refresh;
  const [documentProjections, setDocumentProjections] = useState<
    Record<string, DocumentExtractionProjectionState>
  >({});
  const projectedDocuments = useMemo(
    () =>
      documents.data
        ? applyDocumentProjections(documents.data, documentProjections)
        : null,
    [documentProjections, documents.data],
  );
  const pendingDocuments = useMemo(
    () =>
      projectedDocuments?.items.filter(
        (document) => document.extraction?.status === "processing",
      ) ?? [],
    [projectedDocuments],
  );
  const pendingDocumentKey = pendingDocuments
    .map((document) => document.id)
    .sort()
    .join(",");
  const pendingDocumentsRef = useRef<readonly StudentDocument[]>([]);
  useEffect(() => {
    pendingDocumentsRef.current = pendingDocuments;
  }, [pendingDocuments]);
  const rememberDocumentProjection = useCallback(
    (document: StudentDocument) => {
      setDocumentProjections((current) => {
        const previousDocument =
          current[document.id]?.document ??
          documents.data?.items.find((candidate) => candidate.id === document.id);
        return {
          ...current,
          [document.id]: beginDocumentExtractionProjection(
            document,
            previousDocument,
          ),
        };
      });
      refreshDocuments();
    },
    [documents.data, refreshDocuments],
  );

  useEffect(() => {
    if (!pendingDocumentKey) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = () => {
      timer = window.setTimeout(async () => {
        try {
          const latest = await getStudentDocuments();
          if (cancelled) return;
          setDocumentProjections((current) => {
            let changed = false;
            const next = { ...current };
            for (const pendingDocument of pendingDocumentsRef.current) {
              const candidate = latest.items.find(
                (item) => item.id === pendingDocument.id,
              );
              if (!candidate) continue;
              const projection =
                current[pendingDocument.id] ??
                beginDocumentExtractionProjection(pendingDocument);
              const updatedProjection = reconcileDocumentExtractionProjection(
                projection,
                candidate,
              );
              if (
                projection.document !== updatedProjection.document ||
                projection.supersededTerminalFingerprint !==
                  updatedProjection.supersededTerminalFingerprint ||
                projection.observedCurrentProcessing !==
                  updatedProjection.observedCurrentProcessing
              ) {
                next[pendingDocument.id] = updatedProjection;
                changed = true;
              }
            }
            return changed ? next : current;
          });
          refreshDocuments();
        } catch {
          refreshDocuments();
        } finally {
          if (!cancelled) poll();
        }
      }, 2_500);
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [pendingDocumentKey, refreshDocuments]);

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
        <DocumentWorkspace
          list={projectedDocuments ?? documents.data}
          onDocumentChanged={rememberDocumentProjection}
        />
      )}
    </PortalShell>
  );
}
