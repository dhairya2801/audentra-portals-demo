"use client";

import type { StudentDocument } from "@vv/contracts";
import { useCallback, useRef } from "react";
import { useApiAction } from "../hooks/use-api-resource";
import { retryStudentDocumentExtraction } from "../lib/api-client";

export function canRetryDocumentExtraction(document: StudentDocument) {
  const extraction = document.extraction;
  return (
    extraction?.status === "pending_configuration" ||
    (extraction?.status === "failed" && extraction.retryable !== false)
  );
}

/**
 * Retries the stored original with a stable idempotency key. The server owns
 * the processing claim, so repeated clicks cannot create parallel parser jobs.
 */
export function DocumentExtractionRetry({
  document,
  onRetried,
}: {
  document: StudentDocument;
  onRetried: (document: StudentDocument) => void | Promise<void>;
}) {
  const retryIntentKey = useRef<string | null>(null);
  const retryRequest = useCallback(
    (documentId: string, idempotencyKey: string) =>
      retryStudentDocumentExtraction(documentId, idempotencyKey),
    [],
  );
  const retry = useApiAction(retryRequest);

  if (!canRetryDocumentExtraction(document)) return null;

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
    <div className="document-extraction-retry">
      <button
        className="button button--secondary"
        disabled={retry.status === "loading"}
        onClick={() => void retryParsing()}
        type="button"
      >
        {retry.status === "loading" ? "Retrying parsing…" : "Retry parsing"}
      </button>
      {retry.status === "error" ? (
        <p className="document-extraction-retry__error" role="alert">
          {retry.message}
        </p>
      ) : null}
    </div>
  );
}
