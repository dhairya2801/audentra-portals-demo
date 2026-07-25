"use client";

import type {
  StudentDocument,
  StudentDocumentCategory,
} from "@vv/contracts";
import {
  type FormEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { useApiAction } from "../hooks/use-api-resource";
import { uploadStudentDocument } from "../lib/api-client";
import { ActionFeedback } from "./portal-ui";

const maximumFileBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

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
  const form = useRef<HTMLFormElement>(null);
  const intentKey = useRef<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const uploadAction = useCallback(
    (file: File, key: string) =>
      uploadStudentDocument(
        file,
        { categoryHint, requirementId },
        key,
      ),
    [categoryHint, requirementId],
  );
  const upload = useApiAction(uploadAction);

  const submitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    upload.reset();
    const values = new FormData(event.currentTarget);
    const file = values.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setValidationError("Choose a PDF, JPEG, or PNG document.");
      return;
    }
    if (!allowedMimeTypes.has(file.type)) {
      setValidationError(
        "This file type isn’t supported. Use PDF, JPEG, or PNG.",
      );
      return;
    }
    if (file.size > maximumFileBytes) {
      setValidationError("The document must be no larger than 10 MB.");
      return;
    }

    const key =
      intentKey.current ?? (intentKey.current = crypto.randomUUID());
    try {
      const document = await upload.run(file, key);
      intentKey.current = null;
      form.current?.reset();
      await onUploaded(document);
    } catch {
      // Keep the idempotency key so retrying the same intent is safe.
    }
  };

  return (
    <form
      ref={form}
      className="document-dropzone"
      onSubmit={submitDocument}
    >
      <label>
        <span className="document-dropzone__icon" aria-hidden="true">
          ↑
        </span>
        <strong>
          {expectedLabel ? `Upload ${expectedLabel}` : "Choose a document"}
        </strong>
        <small>PDF, JPEG, or PNG · maximum 10 MB</small>
        <input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          required
        />
      </label>
      <p className="document-auto-classify">
        Edward identifies the document from its contents and extracts a
        reviewable student-record structure. You do not need to classify it.
      </p>
      {validationError ? (
        <p className="field-error" role="alert">
          {validationError}
        </p>
      ) : null}
      <ActionFeedback
        status={upload.status}
        error={upload.message}
        success="Document uploaded. Review the parsing result below."
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
        <span aria-hidden="true">◆</span> Encrypted storage boundary · student
        review required
      </p>
    </form>
  );
}
