"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback } from "react";
import { PortalShell } from "../../../components/portal-shell";
import {
  ErrorState,
  LoadingState,
  PageCard,
  StatusPill,
} from "../../../components/portal-ui";
import { useApiResource } from "../../../hooks/use-api-resource";
import { getStudentRequirement } from "../../../lib/api-client";

const actionByType = {
  form: { label: "Update your profile", href: "/profile" },
  document: { label: "Go to documents", href: "/documents" },
  payment: { label: "Go to payments", href: "/payments" },
  none: { label: "Ask for help", href: "/help" },
} as const;

export default function RequirementDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const loadRequirement = useCallback(
    (signal: AbortSignal) => getStudentRequirement(id, signal),
    [id],
  );
  const requirement = useApiResource(loadRequirement);

  return (
    <PortalShell
      active="enrollment"
      eyebrow="Enrollment requirement"
      title={requirement.data?.title || "Requirement details"}
      description="Review what is needed, why Aster asks for it, and where to complete the next action."
      actions={
        <Link className="button button--secondary" href="/enrollment">
          ← Back to requirements
        </Link>
      }
    >
      {requirement.status === "loading" ? (
        <LoadingState label="Loading requirement details" />
      ) : requirement.status === "error" ? (
        <ErrorState
          message={
            requirement.errorStatus === 400 || requirement.errorStatus === 404
              ? "We couldn’t find that enrollment requirement."
              : requirement.error
          }
          onRetry={requirement.reload}
        />
      ) : (
        <div className="resource-layout">
          <PageCard
            eyebrow={requirement.data.code}
            title={requirement.data.title}
            action={<StatusPill value={requirement.data.status} />}
          >
            <div className="requirement-detail">
              <p className="requirement-detail__description">
                {requirement.data.description}
              </p>
              <dl className="detail-grid">
                <div>
                  <dt>Responsible office</dt>
                  <dd>{requirement.data.responsibleOffice}</dd>
                </div>
                <div>
                  <dt>Due date</dt>
                  <dd>
                    {requirement.data.dueAt
                      ? new Intl.DateTimeFormat("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        }).format(new Date(requirement.data.dueAt))
                      : "No due date"}
                  </dd>
                </div>
                <div>
                  <dt>Submission type</dt>
                  <dd>{requirement.data.submissionType}</dd>
                </div>
                <div>
                  <dt>Progress</dt>
                  <dd>{requirement.data.progressPercent}%</dd>
                </div>
              </dl>
              <div
                className="progress-track detail-progress"
                role="progressbar"
                aria-label={`${requirement.data.title} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={requirement.data.progressPercent}
              >
                <span style={{ width: `${requirement.data.progressPercent}%` }} />
              </div>
              <Link
                className="button button--primary"
                href={actionByType[requirement.data.submissionType].href}
              >
                {actionByType[requirement.data.submissionType].label}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </PageCard>
          <aside className="resource-aside">
            <div className="aside-note">
              <span aria-hidden="true">i</span>
              <h2>Why we ask</h2>
              <p>
                This item is managed by {requirement.data.responsibleOffice}.
                Its status only changes after Aster confirms the required record.
              </p>
            </div>
            {requirement.data.dependencyCodes.length > 0 ? (
              <div className="aside-note aside-note--plain">
                <h2>Complete first</h2>
                <ul>
                  {requirement.data.dependencyCodes.map((code) => (
                    <li key={code}>{code.replaceAll("_", " ")}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </PortalShell>
  );
}
