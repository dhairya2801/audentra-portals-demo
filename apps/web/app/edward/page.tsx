"use client";

import { useCallback } from "react";
import { EdwardAssistant } from "../components/edward-assistant";
import { PortalShell } from "../components/portal-shell";
import { ErrorState, LoadingState } from "../components/portal-ui";
import { useTenant } from "../components/tenant-provider";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentProfile } from "../lib/api-client";
import styles from "./edward-page.module.css";

function EdwardWorkspace() {
  const load = useCallback(
    (signal: AbortSignal) => getStudentProfile(signal),
    [],
  );
  const profile = useApiResource(load);

  return (
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
  );
}

export default function EdwardPage() {
  const { tenant } = useTenant();

  return (
    <PortalShell
      active="edward"
      eyebrow="Edward AI"
      title="Ask Edward"
      description="Your private AI guide for questions and next steps across the student portal."
    >
      {tenant.capabilities.assistant === false ? (
        <div className="resource-state" role="alert">
          <span className="state-symbol" aria-hidden="true">i</span>
          <h2>Edward is not available for this institution</h2>
          <p>Contact student support if you need help finding the right resource.</p>
        </div>
      ) : (
        <EdwardWorkspace />
      )}
    </PortalShell>
  );
}
