"use client";

import { useCallback } from "react";
import { EdwardAssistant } from "../components/edward-assistant";
import { PortalShell } from "../components/portal-shell";
import { ErrorState, LoadingState } from "../components/portal-ui";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentProfile } from "../lib/api-client";

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
      title="Your student guide, connected"
      description="Ask one question across enrollment, finances, academics, documents, and campus life—then complete the next action in place."
    >
      <div className="edward-page-layout">
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
        <aside className="edward-capabilities">
          <div>
            <p className="eyebrow">Connected tools</p>
            <h2>Edward can check</h2>
            <ul>
              <li><span>✓</span> Your enrollment checklist and deadlines</li>
              <li><span>✓</span> Aid, required documents, and balances</li>
              <li><span>✓</span> Program requirements and course catalog</li>
              <li><span>✓</span> Transcript-derived credit recommendations</li>
              <li><span>✓</span> Campus events and student clubs</li>
            </ul>
          </div>
          <div className="edward-boundary">
            <span aria-hidden="true">i</span>
            <div>
              <strong>You stay in control</strong>
              <p>
                Edward can prepare or open actions. Academic exemptions, aid
                decisions, and staff approvals remain in their authoritative
                workflows with a full audit trail.
              </p>
            </div>
          </div>
          <div className="edward-cost-note">
            <p className="eyebrow">Efficient by design</p>
            <p>
              Intent routing and database lookups happen before a model call.
              Only a compact, permission-scoped context is sent to the LLM.
            </p>
          </div>
        </aside>
      </div>
    </PortalShell>
  );
}
