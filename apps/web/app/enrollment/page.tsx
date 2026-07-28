"use client";

import type { StudentRequirementDetail } from "@vv/contracts";
import { TenantLink as Link } from "../components/tenant-link";
import { useCallback, useEffect, useRef } from "react";
import { PortalShell } from "../components/portal-shell";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageCard,
  StatusPill,
} from "../components/portal-ui";
import { useApiResource } from "../hooks/use-api-resource";
import {
  durationBucket,
  useActivityTracking,
} from "../hooks/use-activity-tracking";
import { getStudentRequirements } from "../lib/api-client";

const terminalRequirementStatuses = new Set([
  "completed",
  "waived",
  "not_applicable",
]);

function normalizedProgress(progressPercent: number) {
  if (!Number.isFinite(progressPercent)) return 0;
  return Math.round(Math.min(100, Math.max(0, progressPercent)));
}

function progressForRequirements(items: StudentRequirementDetail[]) {
  if (items.length === 0) return 0;

  const total = items.reduce(
    (sum, item) => sum + normalizedProgress(item.progressPercent),
    0,
  );
  return Math.round(total / items.length);
}

const requirementActionLabels: Record<string, string> = {
  profile_verification: "Verify profile",
  identity_document: "Upload ID",
  official_transcript: "Upload transcript",
  financial_aid_verification: "Upload aid documents",
  immunization_record: "Upload health records",
  housing_preference: "Select housing",
  enrollment_deposit: "Pay deposit",
  orientation_registration: "Select orientation",
};

function requirementActionLabel(item: StudentRequirementDetail) {
  if (terminalRequirementStatuses.has(item.status)) return "Review";
  if (item.status === "blocked") return "View prerequisites";
  if (item.status === "submitted") return "View submission";
  if (item.status === "under_review") return "View review";
  if (item.status === "rejected") return "Fix and resubmit";
  if (item.status === "expired") return "Review options";

  return (
    requirementActionLabels[item.code] ??
    (item.submissionType === "document"
      ? "Upload document"
      : item.submissionType === "payment"
        ? "Make payment"
        : item.submissionType === "form"
          ? "Complete form"
          : "View details")
  );
}

function RequirementItem({
  item,
  onView,
}: {
  item: StudentRequirementDetail;
  onView: (item: StudentRequirementDetail) => void;
}) {
  const progress = normalizedProgress(item.progressPercent);
  const isTerminal = terminalRequirementStatuses.has(item.status);
  const actionLabel = requirementActionLabel(item);

  return (
    <li
      className={`resource-list__item enrollment-requirement enrollment-requirement--${item.status}`}
    >
      <div className="resource-list__symbol" aria-hidden="true">
        {isTerminal ? "✓" : "○"}
      </div>
      <div className="resource-list__content">
        <div className="resource-list__title">
          <h3>{item.title}</h3>
        </div>
        <p>{item.description}</p>
        <div className="resource-list__meta">
          <span>{item.responsibleOffice}</span>
          {item.dueAt ? (
            <span>
              Due{" "}
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(item.dueAt))}
            </span>
          ) : null}
          {item.blocking ? <span>Required</span> : <span>Optional</span>}
        </div>
        <div className="enrollment-requirement__progress">
          <span>Task progress</span>
          <div
            aria-label={`${item.title} progress`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="enrollment-requirement__progress-track"
            role="progressbar"
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <div className="enrollment-requirement__status">
        <StatusPill value={item.status} />
        <span>{progress}%</span>
      </div>
      <Link
        aria-label={`${actionLabel} ${item.title}`}
        className="button button--secondary resource-list__action"
        href={`/enrollment/requirements/${encodeURIComponent(item.slug)}`}
        onClick={() => onView(item)}
      >
        {actionLabel}
      </Link>
    </li>
  );
}

export default function EnrollmentPage() {
  const loadRequirements = useCallback(
    (signal: AbortSignal) => getStudentRequirements(signal),
    [],
  );
  const requirements = useApiResource(loadRequirements);
  const { track } = useActivityTracking();
  const viewedAt = useRef(0);
  const lastTask = useRef<StudentRequirementDetail | null>(null);

  useEffect(() => {
    track("ui.enrollment_started.v1", { entry_point: "portal_navigation" });
    const onHidden = () => {
      if (document.visibilityState !== "hidden" || !lastTask.current) return;
      track("ui.enrollment_task_abandoned.v1", {
        task_code: lastTask.current.code,
        task_status: lastTask.current.status,
        duration_bucket: durationBucket(Date.now() - viewedAt.current),
        last_interaction: "checklist_view",
      });
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [track]);

  const viewTask = (item: StudentRequirementDetail) => {
    lastTask.current = item;
    viewedAt.current = Date.now();
    track("ui.enrollment_task_viewed.v1", {
      task_code: item.code,
      task_status: item.status,
      entry_point: "enrollment_checklist",
    });
  };
  const overallProgress =
    requirements.status === "ready"
      ? progressForRequirements(requirements.data.items)
      : 0;

  return (
    <PortalShell
      active="enrollment"
      eyebrow="Enrollment center"
      title="Your requirements"
      description="Everything needed to secure your place at Aster, organized in one clear path."
    >
      {requirements.status === "loading" ? (
        <LoadingState label="Loading your enrollment requirements" />
      ) : requirements.status === "error" ? (
        <ErrorState message={requirements.error} onRetry={requirements.reload} />
      ) : requirements.data.total === 0 ? (
        <EmptyState
          title="No requirements assigned"
          description="Your enrollment requirements will appear here once your journey begins."
          action={
            <Link className="button button--primary" href="/dashboard">
              Return to dashboard
            </Link>
          }
        />
      ) : (
        <div className="resource-layout resource-layout--enrollment">
          <PageCard
            className="enrollment-overview"
            eyebrow="Enrollment checklist"
            title={`${requirements.data.total} ${requirements.data.total === 1 ? "requirement" : "requirements"}`}
            action={
              <div className="enrollment-overview__progress-summary">
                <span>Overall progress</span>
                <strong>{overallProgress}%</strong>
                <div
                  aria-label="Overall enrollment progress"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={overallProgress}
                  className="enrollment-overview__progress-track"
                  role="progressbar"
                >
                  <span style={{ width: `${overallProgress}%` }} />
                </div>
              </div>
            }
          >
            <ul className="resource-list">
              {requirements.data.items.map((item) => (
                <RequirementItem item={item} onView={viewTask} key={item.id} />
              ))}
            </ul>
          </PageCard>
          <aside className="resource-aside">
            <div className="aside-note">
              <span aria-hidden="true">?</span>
              <h2>Why these steps?</h2>
              <p>
                Each requirement protects your student record or prepares a
                university service before arrival.
              </p>
              <Link href="/help">Learn about enrollment</Link>
            </div>
            <nav className="aside-links" aria-label="Related enrollment services">
              <Link href="/documents">Manage documents <span>→</span></Link>
              <Link href="/payments">View payments <span>→</span></Link>
              <Link href="/appointments">Meet an advisor <span>→</span></Link>
            </nav>
          </aside>
        </div>
      )}
    </PortalShell>
  );
}
