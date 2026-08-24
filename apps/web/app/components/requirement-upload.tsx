"use client";

import type {
  StudentDocument,
  StudentDocumentCategory,
} from "@vv/contracts";
import { documentProcessingModeForCategory } from "@vv/contracts";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Icon from "../design-system/Icon.jsx";
import Button, { IconButton } from "../design-system/primitives/Button.jsx";
import {
  ApiClientError,
  getStudentDocuments,
  uploadStudentDocumentBundle,
  type StudentDocumentUploadBundleResult,
} from "../lib/api-client";
import {
  currentDocumentProjection,
  processingDocumentProjections,
  reconcileProcessingPollProjection,
  terminalDocumentProjectionFingerprint,
} from "../lib/document-extraction-ui";
import { useTenant } from "./tenant-provider";

/**
 * The requirement page's file field — the production `DocumentUpload` bundle
 * flow (same limits, same idempotent bundle upload, same processing poll and
 * projection reconciliation) drawn in the reference document drawer's shape:
 * one `upload-zone` row, the chosen files named under it, the refusal under
 * the rule it broke, the privacy line, one primary send.
 */

const maximumFileBytes = 10 * 1024 * 1024;
const maximumBundleBytes = 30 * 1024 * 1024;
const maximumBundleFiles = 8;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

type UploadStatus = "queued" | "uploading" | "uploaded" | "error";

type SelectedDocument = {
  id: string;
  file: File;
  idempotencyKey: string;
  status: UploadStatus;
  message: string | null;
  document: StudentDocument | null;
  validationError: string | null;
};

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getUploadErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "We couldn’t upload this file. Check your connection and try again.";
}

function statusLabel(
  item: SelectedDocument,
  activeDocument?: StudentDocument | null,
) {
  const document =
    activeDocument?.id === item.document?.id ? activeDocument : item.document;
  if (item.validationError) return item.validationError;
  if (item.status === "queued") return "Ready to send";
  if (item.status === "uploading") return "Saving the original…";
  if (item.status === "uploaded") {
    if (
      document?.processingMode === "manual_review" &&
      document.status === "under_review"
    ) {
      return "Stored for staff review";
    }
    const extraction = document?.extraction;
    return extraction?.status === "processing"
      ? document?.processingMode === "classification_only"
        ? "Stored · Edward is checking the document type"
        : "Stored · Edward is reading it"
      : extraction?.status === "completed"
        ? `${document?.processingMode === "classification_only" ? "Checked" : "Read"} as ${extraction.documentType.replaceAll("_", " ")}`
        : extraction?.status === "failed"
          ? "Stored · reading needs attention"
          : extraction?.status === "pending_configuration"
            ? "Stored · reading is not configured"
            : "Stored · result needs review";
  }
  return item.message ?? "Upload needs attention";
}

function matchesExpectedCategory(
  document: StudentDocument,
  categoryHint?: StudentDocumentCategory,
) {
  if (!categoryHint || document.extraction?.status !== "completed") return true;
  const expectedType = {
    consent: "ferpa",
    financial_aid: "financial_aid",
    health: "immunization",
    identity: "identity",
    other: "other",
    residency: "residency",
    transcript: "transcript",
  }[categoryHint];
  return document.extraction.documentType === expectedType;
}

export function RequirementUpload({
  requirementId,
  categoryHint,
  activeDocument,
  onUploaded,
}: {
  requirementId?: string;
  categoryHint?: StudentDocumentCategory;
  activeDocument?: StudentDocument | null;
  onUploaded: (document: StudentDocument) => void | Promise<void>;
}) {
  const { tenant } = useTenant();
  const picker = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<SelectedDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [bundleMessage, setBundleMessage] = useState<string | null>(null);
  const onUploadedRef = useRef(onUploaded);
  const processingDocumentsRef = useRef<readonly StudentDocument[]>([]);
  const supersededTerminalFingerprintsRef = useRef(new Map<string, string>());
  const previousActiveDocumentRef = useRef(activeDocument);
  const processingMode = categoryHint
    ? documentProcessingModeForCategory(categoryHint)
    : "manual_review";
  const parsingEnabled = processingMode !== "manual_review";
  const classificationOnly = processingMode === "classification_only";
  const localActiveDocument = activeDocument
    ? documents.find((item) => item.document?.id === activeDocument.id)?.document
    : null;
  const reconciledActiveDocument = currentDocumentProjection(
    localActiveDocument,
    activeDocument,
  );
  const serverProcessing =
    reconciledActiveDocument?.extraction?.status === "processing";
  const pendingDocuments = documents.filter(
    (item) => item.status !== "uploaded",
  );
  const validPending = pendingDocuments.filter(
    (item) => item.validationError === null,
  );
  const hasSubmittableFiles = validPending.some(
    (item) => item.status === "queued" || item.status === "error",
  );
  const hasRetryableUpload = pendingDocuments.some(
    (item) => item.status === "error" && !item.validationError,
  );
  const refusal =
    pendingDocuments.find((item) => item.validationError)?.validationError ??
    null;
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);
  const processingDocuments = useMemo(
    () =>
      processingDocumentProjections(
        documents
          .filter((item) => item.status === "uploaded")
          .map((item) => item.document)
          .filter((document): document is StudentDocument => Boolean(document)),
        reconciledActiveDocument,
      ),
    [documents, reconciledActiveDocument],
  );
  const processingDocumentIds = processingDocuments
    .map((document) => document.id)
    .sort();
  const processingDocumentKey = processingDocumentIds.join(",");
  const processingDeadlineKey = useMemo(
    () =>
      processingDocuments
        .map(
          (document) =>
            `${document.id}:${document.extraction?.processingDeadlineAt ?? ""}`,
        )
        .sort()
        .join(","),
    [processingDocuments],
  );
  useEffect(() => {
    processingDocumentsRef.current = processingDocuments;
  }, [processingDocuments]);
  useEffect(() => {
    const previousActiveDocument = previousActiveDocumentRef.current;
    if (activeDocument) previousActiveDocumentRef.current = activeDocument;
    if (!reconciledActiveDocument) return;
    if (reconciledActiveDocument.extraction?.status !== "processing") {
      supersededTerminalFingerprintsRef.current.delete(
        reconciledActiveDocument.id,
      );
      return;
    }
    const fingerprint =
      terminalDocumentProjectionFingerprint(localActiveDocument) ??
      (previousActiveDocument?.id === reconciledActiveDocument.id
        ? terminalDocumentProjectionFingerprint(previousActiveDocument)
        : null);
    if (fingerprint) {
      supersededTerminalFingerprintsRef.current.set(
        reconciledActiveDocument.id,
        fingerprint,
      );
    }
  }, [activeDocument, localActiveDocument, reconciledActiveDocument]);

  useEffect(() => {
    if (!processingDocumentKey) return;

    const watchedIds = new Set(processingDocumentKey.split(","));
    const processingById = new Map(
      processingDocumentsRef.current.map((document) => [document.id, document]),
    );
    const observedCurrentProcessing = new Set<string>();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let requestController: AbortController | undefined;
    let attempts = 0;
    const deadlines = processingDeadlineKey
      .split(",")
      .map((entry) => Date.parse(entry.slice(entry.indexOf(":") + 1)))
      .filter(Number.isFinite);
    const expectedCompletionAt =
      deadlines.length > 0
        ? Math.max(...deadlines) + 10_000
        : Date.now() + 100_000;

    const poll = async () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        attempts += 1;
        requestController = new AbortController();
        const requestTimeout = setTimeout(
          () => requestController?.abort(),
          10_000,
        );
        try {
          const latest = await getStudentDocuments(requestController.signal);
          const changed = latest.items
            .filter((item) => watchedIds.has(item.id))
            .map((candidate) => {
              const processingDocument = processingById.get(candidate.id);
              if (!processingDocument) return candidate;
              const reconciled = reconcileProcessingPollProjection(
                processingDocument,
                candidate,
                {
                  supersededTerminalFingerprint:
                    supersededTerminalFingerprintsRef.current.get(candidate.id),
                  observedCurrentProcessing: observedCurrentProcessing.has(
                    candidate.id,
                  ),
                },
              );
              if (reconciled.observedCurrentProcessing) {
                observedCurrentProcessing.add(candidate.id);
              }
              if (reconciled.document.extraction?.status === "processing") {
                processingById.set(candidate.id, reconciled.document);
              }
              return reconciled.document;
            });
          if (cancelled) return;

          setDocuments((current) =>
            current.map((item) => {
              const refreshed = changed.find(
                (candidate) => candidate.id === item.document?.id,
              );
              return refreshed ? { ...item, document: refreshed } : item;
            }),
          );

          for (const document of changed) {
            if (document.extraction?.status !== "processing") {
              await onUploadedRef.current(document);
            }
          }
          if (cancelled) return;

          const stillProcessing = changed.some(
            (document) => document.extraction?.status === "processing",
          );
          if (!stillProcessing && changed.length > 0) {
            const acceptedCount = changed.filter(
              (document) =>
                document.extraction?.status === "completed" &&
                matchesExpectedCategory(document, categoryHint),
            ).length;
            const attentionCount = changed.length - acceptedCount;
            const completedVerb = classificationOnly ? "checked" : "read";
            setBundleMessage(
              attentionCount > 0
                ? `${acceptedCount} document${acceptedCount === 1 ? "" : "s"} ${completedVerb}; ${attentionCount} stored document${attentionCount === 1 ? " needs" : "s need"} attention.`
                : `${acceptedCount} document${acceptedCount === 1 ? "" : "s"} ${completedVerb} and ready for your review.`,
            );
          } else if (stillProcessing) {
            if (Date.now() >= expectedCompletionAt) {
              setBundleMessage(
                "The original is safely stored. Reading it is taking longer than expected, so this page keeps checking in the background.",
              );
            }
            void poll();
          } else if (changed.length === 0) {
            // The upload response is authoritative, but a temporarily stale list
            // projection must not terminate reconciliation.
            void poll();
          }
        } catch {
          if (!cancelled) {
            setBundleMessage(
              "The connection was interrupted. Your original is safely stored and this page will retry automatically.",
            );
            void poll();
          }
        } finally {
          clearTimeout(requestTimeout);
          requestController = undefined;
        }
      }, Date.now() >= expectedCompletionAt ? 15_000 : Math.min(5_000, 1_000 + attempts * 500));
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      requestController?.abort();
    };
  }, [
    categoryHint,
    classificationOnly,
    processingDeadlineKey,
    processingDocumentKey,
  ]);

  const addFiles = (files: readonly File[]) => {
    if (files.length === 0) return;
    if (serverProcessing) {
      setBundleMessage(
        `${activeDocument?.fileName ?? "The current document"} is still being read. Wait for this attempt to finish or fail before sending another document.`,
      );
      return;
    }

    setBundleMessage(null);
    setDocuments((current) => {
      const currentBundle = current.filter((item) => item.status !== "uploaded");
      let aggregateBytes = currentBundle.reduce(
        (total, item) =>
          item.validationError === null ? total + item.file.size : total,
        0,
      );
      let validFileCount = currentBundle.filter(
        (item) => item.validationError === null,
      ).length;

      const additions = files.map((file) => {
        let validationError: string | null = null;
        if (!allowedMimeTypes.has(file.type)) {
          validationError = `${file.name} is not a PDF, JPG or PNG.`;
        } else if (file.size === 0) {
          validationError = `${file.name} is empty.`;
        } else if (file.size > maximumFileBytes) {
          validationError = `${file.name} is larger than 10 MB.`;
        } else if (validFileCount >= maximumBundleFiles) {
          validationError = `Up to ${maximumBundleFiles} files can be sent together.`;
        } else if (aggregateBytes + file.size > maximumBundleBytes) {
          validationError = "Everything sent together must stay at or below 30 MB.";
        }

        if (!validationError) {
          aggregateBytes += file.size;
          validFileCount += 1;
        }

        return {
          id: crypto.randomUUID(),
          file,
          idempotencyKey: crypto.randomUUID(),
          status: validationError ? "error" : "queued",
          message: null,
          document: null,
          validationError,
        } satisfies SelectedDocument;
      });

      return [...current, ...additions];
    });
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    // Allow someone to re-select the same file after removing or retrying it.
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (serverProcessing) return;
    addFiles(Array.from(event.dataTransfer.files));
  };

  const removeDocument = (id: string) => {
    setDocuments((current) =>
      current.filter((item) => item.id !== id || item.status === "uploading"),
    );
  };

  const submitDocument = async () => {
    if (serverProcessing) {
      setBundleMessage(
        `${activeDocument?.fileName ?? "The current document"} is still being read. Another upload will be available when this attempt finishes or fails.`,
      );
      return;
    }
    const queuedDocuments = documents.filter(
      (item) =>
        item.validationError === null &&
        (item.status === "queued" || item.status === "error"),
    );

    if (queuedDocuments.length === 0) {
      setBundleMessage("Choose at least one file before sending.");
      return;
    }

    setBundleMessage(null);
    setIsUploading(true);

    try {
      const results = await uploadStudentDocumentBundle(
        queuedDocuments.map(({ file, idempotencyKey }) => ({
          file,
          idempotencyKey,
        })),
        { categoryHint, requirementId },
        {
          onFileStart: (entry) => {
            setDocuments((current) =>
              current.map((item) =>
                item.idempotencyKey === entry.idempotencyKey
                  ? { ...item, status: "uploading", message: null }
                  : item,
              ),
            );
          },
          onFileSettled: (result) => {
            setDocuments((current) =>
              current.map((item) =>
                item.idempotencyKey === result.idempotencyKey
                  ? resultToDocumentState(item, result)
                  : item,
              ),
            );
          },
        },
      );

      const uploaded = results.filter(
        (
          result,
        ): result is Extract<
          StudentDocumentUploadBundleResult,
          { status: "uploaded" }
        > => result.status === "uploaded",
      );
      for (const result of uploaded) {
        try {
          await onUploaded(result.document);
        } catch {
          // The original document and extraction were saved. A parent refresh can retry later.
        }
      }

      const failedCount = results.length - uploaded.length;
      const acceptedCount = uploaded.filter(
        (result) =>
          result.document.extraction?.status === "completed" &&
          matchesExpectedCategory(result.document, categoryHint),
      ).length;
      const processingCount = uploaded.filter(
        (result) => result.document.extraction?.status === "processing",
      ).length;
      const manualReviewCount = uploaded.filter(
        (result) =>
          result.document.processingMode === "manual_review" &&
          result.document.status === "under_review",
      ).length;
      const storedForAttentionCount = uploaded.length - acceptedCount;
      const completedVerb = classificationOnly ? "checked" : "read";
      setBundleMessage(
        failedCount > 0
          ? `${uploaded.length} stored; ${failedCount} need${
              failedCount === 1 ? "s" : ""
            } attention before the send could finish.`
          : processingCount > 0
            ? `${uploaded.length} original${uploaded.length === 1 ? " is" : "s are"} safely stored. Edward is ${classificationOnly ? "checking the document type" : `reading ${processingCount === uploaded.length ? (uploaded.length === 1 ? "it" : "them") : "the remaining files"}`} in the background.`
            : manualReviewCount === uploaded.length && manualReviewCount > 0
              ? `${manualReviewCount} original${manualReviewCount === 1 ? " was" : "s were"} safely stored and sent to ${tenant.shortName} for review.`
              : storedForAttentionCount > 0
                ? `${acceptedCount} document${acceptedCount === 1 ? "" : "s"} ${completedVerb}; ${storedForAttentionCount} safely stored but need${
                    storedForAttentionCount === 1 ? "s" : ""
                  } attention.`
                : `${acceptedCount} document${acceptedCount === 1 ? "" : "s"} ${completedVerb} and ready for your review.`,
      );
    } catch (error) {
      setDocuments((current) =>
        current.map((item) =>
          item.status === "uploading"
            ? { ...item, status: "error", message: getUploadErrorMessage(error) }
            : item,
        ),
      );
      setBundleMessage(getUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const rules = "PDF, JPG or PNG · up to 10 MB each · up to 8 files";
  const zoneState = refusal
    ? "refused"
    : serverProcessing
      ? "has-file"
      : validPending.length > 0
        ? "has-file"
        : "";
  const zoneIcon = refusal
    ? "alert"
    : serverProcessing
      ? "spinner"
      : validPending.length > 0
        ? "check"
        : "upload";
  const zoneTitle = serverProcessing
    ? `${reconciledActiveDocument?.fileName ?? "Your document"} is being read`
    : validPending.length === 0
      ? "Choose your files"
      : validPending.length === 1
        ? validPending[0].file.name
        : `${validPending.length} files ready to send`;
  const zoneLine = serverProcessing
    ? "Another send opens when this one finishes or fails"
    : validPending.length === 1
      ? `${formatFileSize(validPending[0].file.size)} · ${statusLabel(validPending[0], reconciledActiveDocument)}`
      : validPending.length > 1
        ? `${formatFileSize(validPending.reduce((total, item) => total + item.file.size, 0))} together`
        : isDragging
          ? "Drop to add"
          : rules;
  const privacy =
    categoryHint === "transcript"
      ? `Encrypted, read by Edward to build your course record, and reviewed by ${tenant.shortName} staff.`
      : categoryHint === "identity"
        ? `Encrypted. Edward locates the portrait for your ID preview; only authorized ${tenant.shortName} staff see the original.`
        : categoryHint === "financial_aid"
          ? "Encrypted. Edward only checks the document type — no financial figures are extracted or added to your profile."
          : `Encrypted, and read only by authorized ${tenant.shortName} staff.`;

  return (
    <section className="document-upload" aria-labelledby="upload-title">
      <h3 id="upload-title">Send it</h3>
      <input
        ref={picker}
        name="file"
        type="file"
        className="visually-hidden"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        multiple
        onChange={handleFileSelection}
        disabled={serverProcessing}
      />
      <div
        className={`upload-zone ${zoneState}${isDragging ? " dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (serverProcessing) return;
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false);
        }}
        onDrop={handleDrop}
        aria-busy={serverProcessing || undefined}
      >
        <span className="upload-mark" aria-hidden="true">
          <Icon name={zoneIcon} size={22} />
        </span>
        <div className="upload-chosen">
          <strong>{zoneTitle}</strong>
          <span>{zoneLine}</span>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={serverProcessing}
          onClick={() => picker.current?.click()}
        >
          {validPending.length === 0 ? "Browse" : "Add more"}
        </button>
        {validPending.length === 1 && validPending[0].status !== "uploading" ? (
          <IconButton
            name="close"
            size={18}
            label={`Remove ${validPending[0].file.name}`}
            tip="Remove"
            onClick={() => removeDocument(validPending[0].id)}
          />
        ) : null}
      </div>

      {validPending.length > 1 ? (
        <ul className="upload-files" aria-live="polite">
          {validPending.map((item) => (
            <li key={item.id}>
              <Icon name="file" size={15} />
              <span className="upload-file-name">{item.file.name}</span>
              <span className="upload-file-size">
                {formatFileSize(item.file.size)} · {statusLabel(item, reconciledActiveDocument)}
              </span>
              {item.status !== "uploading" ? (
                <IconButton
                  name="close"
                  size={16}
                  label={`Remove ${item.file.name}`}
                  tip="Remove"
                  onClick={() => removeDocument(item.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {refusal ? (
        <p className="upload-refusal" role="alert">
          <Icon name="alert" size={14} /> {refusal}{" "}
          <button
            className="link-button"
            type="button"
            onClick={() =>
              setDocuments((current) => current.filter((item) => !item.validationError))
            }
          >
            Dismiss
          </button>
        </p>
      ) : null}

      <p className="upload-privacy">
        <Icon name="shield" size={14} /> {privacy}
      </p>

      {hasRetryableUpload ? (
        <div className="upload-failed" role="alert">
          <p>
            <strong>This did not reach {tenant.shortName}.</strong>{" "}
            {bundleMessage ?? "Nothing was recorded."}{" "}
            {validPending.length > 1 ? "Your files are" : "Your file is"} still here.
          </p>
          <div className="upload-failed-actions">
            <Button
              kind="primary"
              leadingIcon="refresh"
              pending={isUploading}
              onClick={() => void submitDocument()}
            >
              Try again
            </Button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => picker.current?.click()}
            >
              Choose {validPending.length > 1 ? "other files" : "another file"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <Button
            kind="primary"
            icon="arrow"
            disabled={serverProcessing || !hasSubmittableFiles}
            pending={isUploading}
            onClick={() => void submitDocument()}
          >
            {isUploading
              ? classificationOnly
                ? "Sending and checking…"
                : parsingEnabled
                  ? "Sending and reading…"
                  : "Sending securely…"
              : `Send to ${tenant.shortName}`}
          </Button>
          {bundleMessage ? (
            <p className="upload-blocked" role="status">
              {bundleMessage}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function resultToDocumentState(
  item: SelectedDocument,
  result: StudentDocumentUploadBundleResult,
): SelectedDocument {
  if (result.status === "uploaded") {
    return {
      ...item,
      status: "uploaded",
      document: result.document,
      message: null,
    };
  }

  return {
    ...item,
    status: "error",
    document: null,
    message: getUploadErrorMessage(result.error),
  };
}
