import type {
  StudentDocument,
  StudentDocumentCategory,
  StudentDocumentExtraction,
} from "@vv/contracts";

type FailureDetails = Pick<
  StudentDocumentExtraction,
  "failureCode" | "retryable"
>;

export type DocumentExtractionFailurePresentation = {
  title: string;
  guidance: string;
};

export function latestDocumentForCategory(
  documents: readonly StudentDocument[],
  category: StudentDocumentCategory,
): StudentDocument | null {
  return documents
    .filter(
      (document) =>
        document.category === category && document.status !== "placeholder",
    )
    .reduce<StudentDocument | null>((latest, document) => {
      if (!latest) return document;
      return Date.parse(document.createdAt) > Date.parse(latest.createdAt)
        ? document
        : latest;
    }, null);
}

export type DocumentExtractionProjectionState = {
  document: StudentDocument;
  supersededTerminalFingerprint: string | null;
  observedCurrentProcessing: boolean;
};

export function defaultAcceptedDocumentExtractionFieldKeys(
  extraction: Pick<StudentDocumentExtraction, "fields"> | null | undefined,
) {
  return extraction?.fields.map((field) => field.key) ?? [];
}

/**
 * Convert backend-authored failure categories into student-safe next steps.
 * The provider's summary and warnings remain separate so callers can retain
 * the exact server-authored context without exposing raw provider responses.
 */
export function documentExtractionFailurePresentation(
  extraction: FailureDetails,
): DocumentExtractionFailurePresentation {
  const retryGuidance =
    extraction.retryable === false
      ? "The stored original remains available for staff review. You can also upload a clearer PDF, JPEG, or PNG if you have one."
      : "Retry parsing without uploading the file again. If it still fails, upload a clearer PDF, JPEG, or PNG or ask staff to review the stored original.";

  switch (extraction.failureCode) {
    case "provider_unavailable":
      return {
        title: "The original is safe; the parsing service is temporarily unavailable",
        guidance: retryGuidance,
      };
    case "timeout":
      return {
        title: "The original is safe; parsing took longer than expected",
        guidance: retryGuidance,
      };
    case "invalid_response":
      return {
        title: "The original is safe; the parser could not produce a usable result",
        guidance: retryGuidance,
      };
    case "unsupported_capability":
      return {
        title: "The original is safe; this file cannot be parsed automatically",
        guidance:
          "The stored original remains available for staff review. If possible, upload a clear PDF, JPEG, or PNG version of the document.",
      };
    case "unknown":
    default:
      return {
        title: "The original is safe; parsing hit an unexpected problem",
        guidance: retryGuidance,
      };
  }
}

/**
 * The parent projection includes direct mutation responses (notably retry),
 * while the uploader may still hold the preceding terminal state. For the
 * same document, the parent projection is therefore authoritative.
 */
export function currentDocumentProjection(
  localDocument: StudentDocument | null | undefined,
  activeDocument: StudentDocument | null | undefined,
) {
  if (!activeDocument) return localDocument ?? null;
  if (!localDocument || localDocument.id === activeDocument.id) {
    return activeDocument;
  }
  return Date.parse(activeDocument.createdAt) > Date.parse(localDocument.createdAt)
    ? activeDocument
    : localDocument;
}

export function terminalDocumentProjectionFingerprint(
  document: StudentDocument | null | undefined,
) {
  const extraction = document?.extraction;
  if (!extraction || extraction.status === "processing") return null;
  return [
    document.id,
    extraction.status,
    extraction.processedAt ?? "",
    extraction.failureCode ?? "",
    extraction.summary,
  ].join(":");
}

export function beginDocumentExtractionProjection(
  document: StudentDocument,
  previousDocument?: StudentDocument | null,
): DocumentExtractionProjectionState {
  return {
    document,
    supersededTerminalFingerprint:
      document.extraction?.status === "processing"
        ? terminalDocumentProjectionFingerprint(previousDocument)
        : null,
    observedCurrentProcessing: false,
  };
}

export function reconcileProcessingPollProjection(
  processingDocument: StudentDocument,
  candidate: StudentDocument,
  options: {
    supersededTerminalFingerprint?: string | null;
    observedCurrentProcessing: boolean;
  },
) {
  if (candidate.id !== processingDocument.id) {
    return { document: candidate, observedCurrentProcessing: false };
  }
  if (candidate.extraction?.status === "processing") {
    return { document: candidate, observedCurrentProcessing: true };
  }
  const candidateFingerprint = terminalDocumentProjectionFingerprint(candidate);
  if (
    !options.observedCurrentProcessing &&
    candidateFingerprint !== null &&
    candidateFingerprint === options.supersededTerminalFingerprint
  ) {
    return {
      document: processingDocument,
      observedCurrentProcessing: false,
    };
  }
  return { document: candidate, observedCurrentProcessing: false };
}

export function reconcileDocumentExtractionProjection(
  projection: DocumentExtractionProjectionState,
  candidate: StudentDocument,
): DocumentExtractionProjectionState {
  if (
    projection.document.id !== candidate.id ||
    projection.document.extraction?.status !== "processing"
  ) {
    return beginDocumentExtractionProjection(
      currentDocumentProjection(projection.document, candidate) ?? candidate,
    );
  }
  const reconciled = reconcileProcessingPollProjection(
    projection.document,
    candidate,
    projection,
  );
  const terminal = reconciled.document.extraction?.status !== "processing";
  return {
    document: reconciled.document,
    supersededTerminalFingerprint: terminal
      ? null
      : projection.supersededTerminalFingerprint,
    observedCurrentProcessing: terminal
      ? false
      : projection.observedCurrentProcessing ||
        reconciled.observedCurrentProcessing,
  };
}

/**
 * A terminal mutation/poll result may briefly be newer than the list resource,
 * but it must stop masking that resource once the server has caught up. This
 * also lets later staff-side status changes become visible without a reload.
 */
export function preferredDocumentProjection(
  serverDocument: StudentDocument | null | undefined,
  projection: DocumentExtractionProjectionState,
) {
  if (!serverDocument || serverDocument.id !== projection.document.id) {
    return projection.document;
  }
  if (projection.document.extraction?.status === "processing") {
    return projection.document;
  }

  const projectionVerifiedAt = projection.document.extraction?.verifiedAt;
  const serverVerifiedAt = serverDocument.extraction?.verifiedAt;
  if (projectionVerifiedAt && !serverVerifiedAt) {
    return projection.document;
  }
  if (projectionVerifiedAt && serverVerifiedAt) {
    const projectionVerificationTime = Date.parse(projectionVerifiedAt);
    const serverVerificationTime = Date.parse(serverVerifiedAt);
    if (
      Number.isFinite(projectionVerificationTime) &&
      Number.isFinite(serverVerificationTime) &&
      projectionVerificationTime > serverVerificationTime
    ) {
      return projection.document;
    }
  }

  const projectionProcessedAt = projection.document.extraction?.processedAt;
  const serverProcessedAt = serverDocument.extraction?.processedAt;
  if (projectionProcessedAt && serverProcessedAt) {
    const projectionTime = Date.parse(projectionProcessedAt);
    const serverTime = Date.parse(serverProcessedAt);
    if (
      Number.isFinite(projectionTime) &&
      Number.isFinite(serverTime) &&
      projectionTime > serverTime
    ) {
      return projection.document;
    }
  }
  return serverDocument;
}

/** Build a de-duplicated poll set that also covers a retry started elsewhere. */
export function processingDocumentProjections(
  localDocuments: readonly StudentDocument[],
  activeDocument: StudentDocument | null | undefined,
) {
  const processing = new Map<string, StudentDocument>();
  for (const document of localDocuments) {
    if (document.extraction?.status === "processing") {
      processing.set(document.id, document);
    }
  }
  if (activeDocument?.extraction?.status === "processing") {
    processing.set(activeDocument.id, activeDocument);
  }
  return [...processing.values()];
}
