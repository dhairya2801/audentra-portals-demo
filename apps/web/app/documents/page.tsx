"use client";

import type {
  CreateStudentDocumentInput,
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
  createStudentDocument,
  getStudentDocuments,
} from "../lib/api-client";

const TEN_MEGABYTES = 10 * 1024 * 1024;
const ONE_MEGABYTE = 1024 * 1024;
const allowedMimeTypes = new Set<CreateStudentDocumentInput["mimeType"]>([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

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
  const createDocumentAction = useCallback(
    (input: CreateStudentDocumentInput, key: string) =>
      createStudentDocument(input, key),
    [],
  );
  const createDocument = useApiAction(createDocumentAction);

  const submitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    createDocument.reset();

    const values = new FormData(event.currentTarget);
    const fileName = String(values.get("fileName") ?? "").trim();
    const mimeType = values.get(
      "mimeType",
    ) as CreateStudentDocumentInput["mimeType"];
    const sizeMegabytes = Number(values.get("sizeMegabytes"));
    const category = values.get("category") as StudentDocumentCategory;

    if (!fileName) {
      setValidationError("Enter the document file name to continue.");
      return;
    }
    if (!allowedMimeTypes.has(mimeType)) {
      setValidationError("This file type isn’t supported. Use PDF, JPEG, or PNG.");
      return;
    }
    const sizeBytes = Math.round(sizeMegabytes * ONE_MEGABYTE);
    if (
      !Number.isFinite(sizeMegabytes) ||
      sizeBytes < ONE_MEGABYTE ||
      sizeBytes > TEN_MEGABYTES
    ) {
      setValidationError("The document must be between 1 MB and 10 MB.");
      return;
    }

    const input: CreateStudentDocumentInput = {
      fileName,
      mimeType,
      sizeBytes,
      category,
    };
    const key = intentKey.current ?? (intentKey.current = crypto.randomUUID());

    try {
      await createDocument.run(input, key);
      intentKey.current = null;
      form.current?.reset();
      reload();
    } catch {
      // The same intent key is retained so retrying is idempotent.
    }
  };

  return (
    <div className="resource-layout resource-layout--wide-aside">
      <PageCard
        eyebrow="Secure records"
        title={`Your documents (${list.total})`}
      >
        {list.items.length === 0 ? (
          <EmptyState
            title="No documents submitted"
            description="Add metadata for a document when your enrollment checklist asks for one."
          />
        ) : (
          <ul className="resource-list">
            {list.items.map((document) => (
              <li className="resource-list__item" key={document.id}>
                <div className="resource-list__symbol" aria-hidden="true">
                  ▤
                </div>
                <div className="resource-list__content">
                  <div className="resource-list__title">
                    <h3>{document.fileName}</h3>
                    <StatusPill value={document.status} />
                  </div>
                  <div className="resource-list__meta">
                    <span>{document.category}</span>
                    <span>
                      {(document.sizeBytes / ONE_MEGABYTE).toFixed(1)} MB
                    </span>
                    <time dateTime={document.createdAt}>
                      Added{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(new Date(document.createdAt))}
                    </time>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageCard>

      <PageCard eyebrow="Add document" title="Document metadata">
        <form ref={form} className="portal-form" onSubmit={submitDocument}>
          <p className="form-intro">
            This preview records only document metadata; it does not transfer
            the file itself. Production file contents will use Aster’s verified
            upload service.
          </p>
          <label className="field">
            <span>Document category</span>
            <select name="category" defaultValue="transcript" required>
              <option value="transcript">Transcript</option>
              <option value="identity">Identity</option>
              <option value="residency">Residency</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field">
            <span>File name</span>
            <input
              name="fileName"
              type="text"
              placeholder="For example: transcript.pdf"
              maxLength={255}
              required
            />
          </label>
          <label className="field">
            <span>File type</span>
            <select name="mimeType" defaultValue="application/pdf" required>
              <option value="application/pdf">PDF</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/png">PNG</option>
            </select>
          </label>
          <label className="field">
            <span>File size (MB)</span>
            <input
              name="sizeMegabytes"
              type="number"
              min="1"
              max="10"
              step="0.1"
              defaultValue="2"
              aria-describedby="document-file-hint document-file-error"
              required
            />
            <small id="document-file-hint">Between 1 MB and 10 MB</small>
          </label>
          {validationError ? (
            <p id="document-file-error" className="field-error" role="alert">
              {validationError}
            </p>
          ) : null}
          <ActionFeedback
            status={createDocument.status}
            error={createDocument.message}
            success="Document metadata added."
          />
          <button
            className="button button--primary"
            type="submit"
            disabled={createDocument.status === "loading"}
          >
            {createDocument.status === "loading"
              ? "Adding document…"
              : createDocument.status === "error"
                ? "Retry document"
                : "Add document"}
          </button>
        </form>
      </PageCard>
    </div>
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
      description="Track the records Aster has received and add requested document metadata."
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
