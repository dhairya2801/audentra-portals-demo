"use client";

import type {
  StudentDocument,
  StudentDocumentCategory,
} from "@vv/contracts";
import { documentProcessingModeForCategory } from "@vv/contracts";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ApiClientError,
  getStudentDocuments,
  uploadStudentDocumentBundle,
  type StudentDocumentUploadBundleResult,
} from "../lib/api-client";

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

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getUploadErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return "We couldn’t upload this file. Check your connection and try again.";
}

function statusLabel(item: SelectedDocument) {
  if (item.validationError) return item.validationError;
  if (item.status === "queued") return "Ready to upload";
  if (item.status === "uploading") return "Saving original document…";
  if (item.status === "uploaded") {
    if (
      item.document?.processingMode === "manual_review" &&
      item.document.status === "under_review"
    ) {
      return "Original stored for staff review";
    }
    const extraction = item.document?.extraction;
    return extraction?.status === "processing"
      ? item.document?.processingMode === "classification_only"
        ? "Original saved; Edward is checking the document type"
        : "Original saved; Edward is extracting it"
      : extraction?.status === "completed"
      ? `${item.document?.processingMode === "classification_only" ? "Classified" : "Extracted"} as ${extraction.documentType.replaceAll("_", " ")}`
      : extraction?.status === "failed"
        ? "Stored; parsing needs attention"
        : extraction?.status === "pending_configuration"
          ? "Stored; parsing is not configured"
          : "Stored; parsing result needs review";
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

export function DocumentUpload({
  requirementId,
  categoryHint,
  expectedLabel,
  onUploaded,
}: {
  requirementId?: string;
  categoryHint?: StudentDocumentCategory;
  expectedLabel?: string;
  onUploaded: (document: StudentDocument) => void | Promise<void>;
}) {
  const [documents, setDocuments] = useState<SelectedDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [bundleMessage, setBundleMessage] = useState<string | null>(null);
  const onUploadedRef = useRef(onUploaded);
  const processingMode = categoryHint
    ? documentProcessingModeForCategory(categoryHint)
    : "manual_review";
  const parsingEnabled = processingMode !== "manual_review";
  const classificationOnly = processingMode === "classification_only";
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);
  const processingDocumentIds = useMemo(
    () =>
      documents
        .filter(
          (item) =>
            item.status === "uploaded" &&
            item.document?.extraction?.status === "processing",
        )
        .map((item) => item.document?.id)
        .filter((id): id is string => Boolean(id))
        .sort(),
    [documents],
  );
  const processingDocumentKey = processingDocumentIds.join(",");

  useEffect(() => {
    if (!processingDocumentKey) return;

    const watchedIds = new Set(processingDocumentKey.split(","));
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const poll = async () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        attempts += 1;
        try {
          const latest = await getStudentDocuments();
          const changed = latest.items.filter((item) => watchedIds.has(item.id));
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
            const completedVerb = classificationOnly ? "checked" : "parsed";
            setBundleMessage(
              attentionCount > 0
                ? `${acceptedCount} document${acceptedCount === 1 ? "" : "s"} ${completedVerb}; ${attentionCount} stored document${attentionCount === 1 ? " needs" : "s need"} attention.`
                : `${acceptedCount} document${acceptedCount === 1 ? "" : "s"} ${completedVerb} and ready for your review.`,
            );
          } else if (stillProcessing && attempts < 90) {
            void poll();
          } else if (stillProcessing) {
            setBundleMessage(
              "The original is safely stored, but parsing is taking longer than expected. You can leave this page and return later.",
            );
          }
        } catch {
          if (!cancelled && attempts < 90) void poll();
        }
      }, 1_000);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [categoryHint, classificationOnly, processingDocumentKey]);

  const addFiles = (files: readonly File[]) => {
    if (files.length === 0) return;

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
          validationError = "Use PDF, JPEG, or PNG.";
        } else if (file.size === 0) {
          validationError = "This file is empty.";
        } else if (file.size > maximumFileBytes) {
          validationError = "This file is larger than 10 MB.";
        } else if (validFileCount >= maximumBundleFiles) {
          validationError = `A bundle can contain up to ${maximumBundleFiles} files.`;
        } else if (aggregateBytes + file.size > maximumBundleBytes) {
          validationError = "This bundle must stay at or below 30 MB.";
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

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const removeDocument = (id: string) => {
    setDocuments((current) =>
      current.filter((item) => item.id !== id || item.status === "uploading"),
    );
  };

  const submitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const queuedDocuments = documents.filter(
      (item) =>
        item.validationError === null &&
        (item.status === "queued" || item.status === "error"),
    );

    if (queuedDocuments.length === 0) {
      setBundleMessage("Add at least one valid document before uploading.");
      return;
    }

    setBundleMessage(
      `${classificationOnly ? "Checking" : parsingEnabled ? "Processing" : "Uploading"} ${queuedDocuments.length} document${
        queuedDocuments.length === 1 ? "" : "s"
      } as one requirement bundle.${
        classificationOnly
          ? " Edward checks each document type without extracting financial fields."
          : parsingEnabled
          ? " Each file gets its own extraction result."
          : " Each original will be stored and routed to staff review."
      }`,
    );
    setIsUploading(true);

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
      (result): result is Extract<StudentDocumentUploadBundleResult, { status: "uploaded" }> =>
        result.status === "uploaded",
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
    const completedVerb = classificationOnly ? "checked" : "parsed";
    setBundleMessage(
      failedCount > 0
        ? `${uploaded.length} stored; ${failedCount} need${
            failedCount === 1 ? "s" : ""
          } attention before upload could finish.`
        : processingCount > 0
          ? `${uploaded.length} original document${uploaded.length === 1 ? " is" : "s are"} safely stored. Edward is ${classificationOnly ? "checking document types" : `extracting ${processingCount === uploaded.length ? "them" : "the remaining files"}`} in the background.`
        : manualReviewCount === uploaded.length && manualReviewCount > 0
          ? `${manualReviewCount} original document${manualReviewCount === 1 ? " was" : "s were"} safely stored and sent for staff review.`
        : storedForAttentionCount > 0
          ? `${acceptedCount} document${acceptedCount === 1 ? "" : "s"} ${completedVerb}; ${storedForAttentionCount} safely stored but need${
              storedForAttentionCount === 1 ? "s" : ""
            } parsing attention.`
          : `${acceptedCount} document${acceptedCount === 1 ? "" : "s"} ${completedVerb} and ready for your review.`
    );
    setIsUploading(false);
  };

  return (
    <form
      className="document-dropzone"
      onSubmit={submitDocument}
    >
      <label
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false);
        }}
        onDrop={handleDrop}
        data-dragging={isDragging || undefined}
      >
        <span className="document-dropzone__icon" aria-hidden="true">
          ↑
        </span>
        <strong>
          {expectedLabel ? `Add ${expectedLabel}` : "Add documents"}
        </strong>
        <small>
          Drop files here or browse · PDF, JPEG, or PNG · up to 8 files / 30 MB
        </small>
        <input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          multiple
          onChange={handleFileSelection}
        />
      </label>
      <p className="document-auto-classify">
        {categoryHint === "transcript"
          ? "Add every page or file that belongs to your academic record. Edward identifies the transcript, builds the course record, and runs advisory matching automatically; you do not need to classify it."
          : categoryHint === "identity"
            ? "Add every side of your identity document. Edward identifies the document, locates the portrait region, and prepares a private ID preview for review."
            : categoryHint === "financial_aid"
              ? "Edward checks that each file is a financial-aid document before it reaches the review queue. Financial fields are not extracted or added to your profile."
            : "Add every file that supports this requirement. The originals are stored securely in your student record and routed directly to staff review."}
      </p>

      {documents.length ? (
        <div aria-live="polite" aria-atomic="false">
          <p>
            <strong>Requirement bundle ({documents.length})</strong>
            {" · "}
            {documents
              .filter((item) => item.validationError === null)
              .reduce((total, item) => total + item.file.size, 0) <=
            maximumBundleBytes
              ? `${formatFileSize(
                  documents
                    .filter((item) => item.validationError === null)
                    .reduce((total, item) => total + item.file.size, 0),
                )} selected`
              : "Review file limits"}
          </p>
          <ul>
            {documents.map((item) => (
              <li key={item.id}>
                <strong>{item.file.name}</strong>
                {" · "}
                {formatFileSize(item.file.size)} · {statusLabel(item)}
                {item.status !== "uploading" && item.status !== "uploaded" ? (
                  <button
                    type="button"
                    onClick={() => removeDocument(item.id)}
                    aria-label={`Remove ${item.file.name}`}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bundleMessage ? (
        <p
          className={
            documents.some((item) => item.status === "error" && !item.validationError)
              ? "field-error"
              : "action-feedback"
          }
          role={documents.some((item) => item.status === "error") ? "alert" : "status"}
        >
          {bundleMessage}
        </p>
      ) : null}
      <button
        className="button button--accent"
        type="submit"
        disabled={
          isUploading ||
          !documents.some(
            (item) =>
              item.validationError === null &&
              (item.status === "queued" || item.status === "error"),
          )
        }
      >
        {isUploading
          ? classificationOnly
            ? "Uploading and checking…"
            : parsingEnabled
              ? "Uploading and extracting…"
            : "Uploading securely…"
          : documents.some((item) => item.status === "error" && !item.validationError)
            ? "Retry files needing attention"
            : categoryHint === "transcript"
              ? "Upload transcript files"
              : "Upload requirement bundle"}
      </button>
      <p className="document-privacy">
        <span aria-hidden="true">◆</span> Encrypted storage boundary ·{" "}
        {categoryHint === "transcript"
          ? "automatic parsing after upload"
          : categoryHint === "identity"
            ? "private photo extraction after upload"
            : categoryHint === "financial_aid"
              ? "document-type check only; no financial-field extraction"
            : "direct staff review"}
      </p>
    </form>
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
