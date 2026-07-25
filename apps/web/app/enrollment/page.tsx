"use client";

import type { StudentRequirementDetail } from "@vv/contracts";
import Link from "next/link";
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

function RequirementItem({
  item,
  onView,
}: {
  item: StudentRequirementDetail;
  onView: (item: StudentRequirementDetail) => void;
}) {
  return (
    <li className="resource-list__item">
      <div className="resource-list__symbol" aria-hidden="true">
        {item.status === "completed" || item.status === "waived" ? "✓" : "○"}
      </div>
      <div className="resource-list__content">
        <div className="resource-list__title">
          <h3>{item.title}</h3>
          <StatusPill value={item.status} />
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
      </div>
      <Link
        className="button button--secondary resource-list__action"
        href={`/enrollment/requirements/${encodeURIComponent(item.slug)}`}
        onClick={() => onView(item)}
      >
        View
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
        <div className="resource-layout">
          <PageCard
            eyebrow="Enrollment checklist"
            title={`${requirements.data.total} ${requirements.data.total === 1 ? "requirement" : "requirements"}`}
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
