"use client";

import { useCallback } from "react";
import { EdwardAssistant } from "../components/edward-assistant";
import { PortalShell } from "../components/portal-shell";
import { ErrorState, LoadingState } from "../components/portal-ui";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentProfile } from "../lib/api-client";
import styles from "./edward-page.module.css";

export default function EdwardPage() {
  const load = useCallback(
    (signal: AbortSignal) => getStudentProfile(signal),
    [],
  );
  const profile = useApiResource(load);

  return (
    <PortalShell
      active="edward"
      eyebrow="Edward AI"
      title="Ask Edward"
      description="Your private AI guide for questions and next steps across the student portal."
    >
      <div className={styles.page}>
        {profile.status === "loading" ? (
          <LoadingState label="Connecting Edward to your student context" />
        ) : profile.status === "error" ? (
          <ErrorState message={profile.error} onRetry={profile.reload} />
        ) : (
          <EdwardAssistant
            studentName={profile.data.preferredName}
            variant="embedded"
          />
        )}
      </div>
    </PortalShell>
  );
}
