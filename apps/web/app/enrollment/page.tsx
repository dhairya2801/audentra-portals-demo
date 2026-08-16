"use client";

import type {
  StudentOnboarding,
  StudentRequirementDetail,
  StudentRequirementList,
} from "@vv/contracts";
import { TenantLink as Link } from "../components/tenant-link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { PortalShell } from "../components/portal-shell";
import { StudentCalendar } from "../components/student-calendar";
import type { StudentCalendarEntry } from "../lib/student-calendar";
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
import {
  getStudentOnboarding,
  getStudentRequirements,
} from "../lib/api-client";

type EnrollmentPageData = {
  requirements: StudentRequirementList;
  onboarding: StudentOnboarding;
};

const residencyReviewLabels = {
  home_address_review: "Permanent address review",
  document_upload: "Supporting documents requested",
  advisor_review: "Advisor review requested",
} as const;

const insuranceLabels = {
  not_now: "Not requested",
  learn_more: "Comparison information requested",
  tuition: "Tuition protection information requested",
  housing: "Housing protection information requested",
  both: "Tuition and housing information requested",
} as const;

const accommodationLabels = {
  not_now: "No follow-up requested",
  housing: "Housing follow-up requested",
  academic: "Academic follow-up requested",
  both: "Housing and academic follow-up requested",
} as const;

const terminalRequirementStatuses = new Set([
  "completed",
  "waived",
  "not_applicable",
]);

type EnrollmentSegment = "action" | "review" | "complete";
type PrioritizedRequirement = StudentRequirementDetail & { priority?: number };

const enrollmentSegments: Array<{
  id: EnrollmentSegment;
  title: string;
  description: string;
}> = [
  {
    id: "action",
    title: "Action needed",
    description: "Tasks you can work on now, including prerequisites that explain what unlocks next.",
  },
  {
    id: "review",
    title: "In review",
    description: "Submitted work currently being checked by the responsible university office.",
  },
  {
    id: "complete",
    title: "Completed",
    description: "Finished, waived, or not-applicable requirements kept here for reference.",
  },
];

function enrollmentSegment(item: StudentRequirementDetail): EnrollmentSegment {
  if (terminalRequirementStatuses.has(item.status)) return "complete";
  if (item.status === "submitted" || item.status === "under_review") return "review";
  return "action";
}

function requirementPriority(item: StudentRequirementDetail) {
  const value = (item as PrioritizedRequirement).priority;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function requirementDueTime(item: StudentRequirementDetail) {
  if (!item.dueAt) return Number.POSITIVE_INFINITY;
  const time = Date.parse(item.dueAt);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function sortEnrollmentRequirements(items: readonly StudentRequirementDetail[]) {
  return [...items].sort(
    (left, right) =>
      requirementPriority(right) - requirementPriority(left) ||
      (right.reward?.points ?? 0) - (left.reward?.points ?? 0) ||
      requirementDueTime(left) - requirementDueTime(right) ||
      left.title.localeCompare(right.title),
  );
}

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
          {requirementPriority(item) > 0 ? (
            <span>Priority {requirementPriority(item)}</span>
          ) : null}
        </div>
        {item.reward ? (
          <div
            className={`enrollment-reward${item.reward.earned ? " enrollment-reward--earned" : ""}`}
          >
            <span aria-hidden="true">✦</span>
            {item.reward.earned
              ? `${item.reward.points} points earned`
              : `Earn ${item.reward.points} points`}
          </div>
        ) : null}
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

function OptionalSupportChecklist({
  onboarding,
}: {
  onboarding: StudentOnboarding;
}) {
  const { data } = onboarding;
  const choices = [
    {
      key: "residency",
      title: "Residency verification",
      description:
        "Confirm how Enrollment Services should review your residency classification.",
      value: data.residencyVerificationPath
        ? residencyReviewLabels[data.residencyVerificationPath]
        : "Review path not selected",
      selected: Boolean(data.residencyVerificationPath),
    },
    {
      key: "insurance",
      title: "Optional tuition and housing protection",
      description:
        "Request information without purchasing or enrolling in a policy.",
      value: data.insuranceInterest
        ? insuranceLabels[data.insuranceInterest]
        : "No preference recorded",
      selected: Boolean(data.insuranceInterest),
    },
    {
      key: "accommodations",
      title: "Accommodations follow-up",
      description:
        "Privately flag a housing or academic follow-up without submitting medical records.",
      value: data.accommodationInterest
        ? accommodationLabels[data.accommodationInterest]
        : "No preference recorded",
      selected: Boolean(data.accommodationInterest),
    },
  ];

  return (
    <section className="enrollment-support-choices" aria-labelledby="support-choices-title">
      <div className="enrollment-support-choices__heading">
        <div>
          <p className="eyebrow">Optional support choices</p>
          <h2 id="support-choices-title">Your onboarding follow-ups</h2>
        </div>
        <Link href="/appointments">Ask an advisor</Link>
      </div>
      <div className="enrollment-support-choices__grid">
        {choices.map((choice) => (
          <article key={choice.key}>
            <span aria-hidden="true">{choice.selected ? "✓" : "○"}</span>
            <div>
              <h3>{choice.title}</h3>
              <p>{choice.description}</p>
              <strong>{choice.value}</strong>
            </div>
          </article>
        ))}
      </div>
      <p className="enrollment-support-choices__privacy">
        These choices coordinate follow-up only. Sensitive health information
        belongs in each office’s separate protected process.
      </p>
    </section>
  );
}

export default function EnrollmentPage() {
  const loadEnrollment = useCallback(
    async (signal: AbortSignal): Promise<EnrollmentPageData> => {
      const [requirements, onboarding] = await Promise.all([
        getStudentRequirements(signal),
        getStudentOnboarding(signal),
      ]);
      return { requirements, onboarding };
    },
    [],
  );
  const enrollment = useApiResource(loadEnrollment);
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
    enrollment.status === "ready"
      ? progressForRequirements(enrollment.data.requirements.items)
      : 0;
  const groupedRequirements = useMemo(() => {
    const groups: Record<EnrollmentSegment, StudentRequirementDetail[]> = {
      action: [],
      review: [],
      complete: [],
    };
    if (enrollment.status !== "ready") return groups;
    for (const item of enrollment.data.requirements.items) {
      groups[enrollmentSegment(item)].push(item);
    }
    for (const segment of enrollmentSegments) {
      groups[segment.id] = sortEnrollmentRequirements(groups[segment.id]);
    }
    return groups;
  }, [enrollment.data, enrollment.status]);
  const enrollmentDeadlines = useMemo<StudentCalendarEntry[]>(() => {
    if (enrollment.status !== "ready") return [];
    return enrollment.data.requirements.items.flatMap((item) =>
      item.dueAt
        ? [
            {
              id: `enrollment-${item.id}`,
              kind: "enrollment" as const,
              title: item.title,
              description: item.description,
              startsAt: item.dueAt,
              status: item.status,
              href: `/enrollment/requirements/${encodeURIComponent(item.slug)}`,
              actionLabel: requirementActionLabel(item),
            },
          ]
        : [],
    );
  }, [enrollment.data, enrollment.status]);

  return (
    <PortalShell
      active="enrollment"
      eyebrow="Enrollment center"
      title="Your requirements"
      description="Everything needed to secure your place at {institution}, organized in one clear path."
    >
      {enrollment.status === "loading" ? (
        <LoadingState label="Loading your enrollment requirements" />
      ) : enrollment.status === "error" ? (
        <ErrorState message={enrollment.error} onRetry={enrollment.reload} />
      ) : enrollment.data.requirements.total === 0 ? (
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
        <div className="enrollment-experience-layout">
        <div className="resource-layout resource-layout--enrollment">
          <div className="enrollment-checklist-column">
            <PageCard
              className="enrollment-overview"
              eyebrow="Enrollment checklist"
              title={`${enrollment.data.requirements.total} ${enrollment.data.requirements.total === 1 ? "requirement" : "requirements"}`}
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
              <div className="enrollment-segments">
                {enrollmentSegments.map((segment) => (
                  <section
                    className={`enrollment-segment enrollment-segment--${segment.id}`}
                    aria-labelledby={`enrollment-segment-${segment.id}`}
                    key={segment.id}
                  >
                    <header className="enrollment-segment__heading">
                      <div>
                        <h3 id={`enrollment-segment-${segment.id}`}>{segment.title}</h3>
                        <p>{segment.description}</p>
                      </div>
                      <span>{groupedRequirements[segment.id].length}</span>
                    </header>
                    {groupedRequirements[segment.id].length > 0 ? (
                      <ul className="resource-list">
                        {groupedRequirements[segment.id].map((item) => (
                          <RequirementItem item={item} onView={viewTask} key={item.id} />
                        ))}
                      </ul>
                    ) : (
                      <p className="enrollment-segment__empty">
                        {segment.id === "action"
                          ? "You have no open actions in this section."
                          : segment.id === "review"
                            ? "Nothing is waiting for review."
                            : "Completed tasks will collect here."}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            </PageCard>
            <OptionalSupportChecklist onboarding={enrollment.data.onboarding} />
          </div>
          <aside className="resource-aside">
            <nav className="aside-links" aria-label="Related enrollment services">
              <Link href="/documents">Manage documents <span>→</span></Link>
              <Link href="/payments">View payments <span>→</span></Link>
              <Link href="/appointments">Meet an advisor <span>→</span></Link>
            </nav>
          </aside>
        </div>
        <StudentCalendar
          entries={enrollmentDeadlines}
          title="Enrollment deadlines"
        />
        </div>
      )}
    </PortalShell>
  );
}
