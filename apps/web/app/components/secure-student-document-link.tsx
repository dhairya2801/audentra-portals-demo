"use client";

import type { StudentDocument } from "@vv/contracts";
import { useState } from "react";
import Icon from "../design-system/Icon.jsx";
import { getStudentDocumentContent } from "../lib/api-client";
import { getApiErrorMessage } from "../hooks/use-api-resource";

/**
 * Opens a student document only after it has been fetched with the selected
 * student/delegate session. A raw API href cannot carry the delegate header.
 */
export function SecureStudentDocumentLink({
  document,
  label,
}: {
  document: StudentDocument;
  label: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const openDocument = async () => {
    // Open a blank tab during the user gesture, before the protected fetch, so
    // browsers do not classify the eventual viewer as an unsolicited popup.
    const viewer = window.open("", "_blank");
    if (viewer) {
      viewer.opener = null;
      viewer.document.title = "Loading protected document…";
    }

    setStatus("loading");
    setError(null);
    try {
      const blob = await getStudentDocumentContent(document);
      const objectUrl = URL.createObjectURL(blob);
      if (viewer && !viewer.closed) {
        viewer.location.replace(objectUrl);
      } else {
        const fallback = window.document.createElement("a");
        fallback.href = objectUrl;
        fallback.rel = "noopener noreferrer";
        fallback.target = "_blank";
        fallback.click();
      }

      // Give the viewer time to load while ensuring the object URL is never
      // retained for the duration of a portal visit.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setStatus("idle");
    } catch (cause) {
      if (viewer && !viewer.closed) viewer.close();
      setStatus("error");
      setError(getApiErrorMessage(cause));
    }
  };

  return (
    <span className="secure-document-link">
      <button
        className="link-button"
        type="button"
        disabled={status === "loading"}
        onClick={() => void openDocument()}
      >
        <Icon name={status === "loading" ? "spinner" : "download"} size={14} />{" "}
        {status === "loading" ? "Opening the protected file…" : label}
      </button>
      {error ? (
        <span className="field-error" role="alert">
          <Icon name="alert" size={13} /> {error}
        </span>
      ) : null}
    </span>
  );
}
