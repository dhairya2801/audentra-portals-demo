"use client";

import {
  studentRequirementSlug,
  type FinancialDocumentRequirement,
  type StudentRequirementSummary,
} from "@vv/contracts";
import { useCallback, useEffect } from "react";
import { PortalShell } from "./components/portal-shell";
import { DashboardEdwardBrief } from "./components/dashboard-edward-brief";
import { DashboardCampusEvents } from "./components/dashboard-campus-events";
import { DashboardFinancialSnapshot } from "./components/dashboard-financial-snapshot";
import dashboardStyles from "./components/student-dashboard-experience.module.css";
import { ErrorState, LoadingState } from "./components/portal-ui";
import { StudentCalendar } from "./components/student-calendar";
import { useActivityTracking } from "./hooks/use-activity-tracking";
import { useApiResource } from "./hooks/use-api-resource";
import {
  getCampusLife,
  getStudentAcademics,
  getStudentDashboard,
  getStudentFinancials,
} from "./lib/api-client";
import {
  prioritizeDashboardRequirements,
  selectDashboardEnrollmentAction,
} from "./lib/enrollment-dashboard-action";
import { dashboardStudentCalendarEntries } from "./lib/student-calendar";
import { safePortalDestination } from "./lib/safe-destination";
import { TenantLink as Link } from "./components/tenant-link";
import { useTenant } from "./components/tenant-provider";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function requirementState(item: StudentRequirementSummary) {
  if (["completed", "waived", "not_applicable"].includes(item.status)) {
    return "Complete";
  }
  if (item.status === "blocked") return "Waiting";
  if (["rejected", "expired"].includes(item.status)) return "Attention";
  return item.progressPercent > 0 ? "In progress" : "To do";
}

function DashboardDocumentTask({
  document,
  position,
}: {
  document: FinancialDocumentRequirement;
  position: number;
}) {
  const fallback = document.documentId
    ? `/documents?document=${encodeURIComponent(document.documentId)}`
    : "/documents";
  const destination = safePortalDestination(document.href, fallback);
  const content = (
    <>
      <span className="aster-task-number">{String(position).padStart(2, "0")}</span>
      <div>
        <small>Financial aid · action needed</small>
        <h3>{document.title}</h3>
        <p>{document.description}</p>
      </div>
      <span aria-hidden="true">{destination.external ? "↗" : "→"}</span>
    </>
  );
  return destination.external ? (
    <a
      className="aster-task-card"
      href={destination.href}
      target="_blank"
      rel="noreferrer"
    >
      {content}
    </a>
  ) : (
    <Link className="aster-task-card" href={destination.href}>
      {content}
    </Link>
  );
}

export function StudentDashboardPage() {
  const { tenant } = useTenant();
  const load = useCallback(async (signal: AbortSignal) => {
    const [dashboard, financials, academics, campus] = await Promise.all([
      getStudentDashboard(signal),
      getStudentFinancials(signal),
      getStudentAcademics(signal),
      getCampusLife(signal),
    ]);
    return {
      dashboard,
      financials,
      academics,
      campus,
      loadedAt: new Date().toISOString(),
    };
  }, []);
  const resource = useApiResource(load);
  const { track } = useActivityTracking();

  useEffect(() => {
    if (!resource.data) return;
    track("ui.dashboard_viewed.v1", {
      projection_version: resource.data.dashboard.projectionVersion,
    });
  }, [resource.data, track]);

  if (resource.status === "loading") {
    return (
      <main className="load-state">
        <LoadingState label="Preparing your student dashboard" />
      </main>
    );
  }

  if (resource.status === "error") {
    return (
      <main className="load-state">
        <ErrorState message={resource.error} onRetry={resource.reload} />
      </main>
    );
  }

  const { dashboard, financials, academics, campus, loadedAt } = resource.data;
  const pendingRequirements = prioritizeDashboardRequirements(
    dashboard.journey.requirements,
  ).slice(0, 3);
  const enrollmentAction = selectDashboardEnrollmentAction(
    dashboard.journey,
    (code) =>
      `/enrollment/requirements/${encodeURIComponent(
        studentRequirementSlug(code),
      )}`,
  );
  const actionDocuments = financials.requiredDocuments.filter(
    (document) => document.status === "action_required",
  );
  const suggestedExemptions = academics.exemptionRecommendations.filter(
    (recommendation) =>
      ["suggested", "needs_review"].includes(recommendation.status),
  );
  const calendarEntries = dashboardStudentCalendarEntries({
    dashboard,
    financials,
    campusEvents: campus.events,
  });

  return (
    <PortalShell
      active="dashboard"
      eyebrow="Your student home"
      title={`Welcome back, ${dashboard.student.preferredName} 👋`}
      description="Here’s what is moving forward—and what deserves your attention next."
      actions={
        <Link
          className={`button ${
            enrollmentAction.kind === "complete"
              ? "button--complete"
              : enrollmentAction.kind === "waiting"
                ? "button--secondary"
                : "button--accent"
          }`}
          data-enrollment-action-state={enrollmentAction.kind}
          href={enrollmentAction.href}
        >
          {enrollmentAction.label}
          {enrollmentAction.kind === "complete" ? (
            <span aria-hidden="true">✓</span>
          ) : null}
        </Link>
      }
    >
      <section className="aster-info-strip" aria-label="Student program summary">
        <div>
          <span>Program</span>
          <strong>{dashboard.offer.programName}</strong>
        </div>
        <div>
          <span>Starting term</span>
          <strong>{dashboard.offer.termName}</strong>
        </div>
        <div>
          <span>Campus</span>
          <strong>{dashboard.offer.campusName}</strong>
        </div>
        <div>
          <span>Class of</span>
          <strong>{dashboard.student.classYear}</strong>
        </div>
      </section>

      <div className="aster-dashboard-hero">
        <section className="aster-card aster-progress-card">
          <div className="aster-card__heading">
            <div>
              <p className="eyebrow">Enrollment progress</p>
              <h2>Your place at {tenant.shortName}</h2>
            </div>
            <strong>{dashboard.journey.completionPercent}%</strong>
          </div>
          <div
            className="aster-progress-track"
            role="progressbar"
            aria-label="Enrollment progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={dashboard.journey.completionPercent}
          >
            <span style={{ width: `${dashboard.journey.completionPercent}%` }} />
          </div>
          <div className="aster-progress-legend">
            <span className="is-complete">Offer</span>
            <span className={dashboard.journey.completionPercent >= 34 ? "is-complete" : ""}>
              Preparation
            </span>
            <span className={dashboard.journey.completionPercent >= 80 ? "is-complete" : ""}>
              Ready for campus
            </span>
          </div>
          <p>
            {pendingRequirements.length > 0
              ? `${pendingRequirements.length} priority items are visible below.`
              : "Your current enrollment requirements are complete."}
          </p>
        </section>

        <DashboardEdwardBrief projectionVersion={dashboard.projectionVersion} />
      </div>

      <section className="aster-section">
        <div className="aster-section__heading">
          <div>
            <p className="eyebrow">Your next moves</p>
            <h2>Keep the momentum going</h2>
          </div>
          <Link href="/enrollment">Full enrollment checklist →</Link>
        </div>
        <div className="aster-task-grid">
          {pendingRequirements.map((item, index) => (
            <Link
              className="aster-task-card"
              href={`/enrollment/requirements/${encodeURIComponent(
                studentRequirementSlug(item.code),
              )}`}
              key={item.id}
            >
              <span className="aster-task-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{requirementState(item)}</small>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
          {actionDocuments.slice(0, Math.max(0, 3 - pendingRequirements.length)).map(
            (document, index) => (
              <DashboardDocumentTask
                document={document}
                position={pendingRequirements.length + index + 1}
                key={document.id}
              />
            ),
          )}
        </div>
      </section>

      <div className={dashboardStyles.overview}>
        <StudentCalendar entries={calendarEntries} />
        <DashboardCampusEvents events={campus.events} asOf={loadedAt} />
        <DashboardFinancialSnapshot financials={financials} />
      </div>

      <section className="aster-domain-grid">
        <Link className="aster-domain-card aster-domain-card--financial" href="/financials">
          <span>My Financials</span>
          <h2>{money(financials.remainingBalanceCents)}</h2>
          <p>Estimated balance after accepted aid and recorded payments.</p>
          <div>
            <small>{money(financials.acceptedAidCents)} accepted aid</small>
            <strong>{actionDocuments.length} action item</strong>
          </div>
        </Link>
        <Link className="aster-domain-card" href="/classrooms">
          <span>My Classrooms</span>
          <h2>{suggestedExemptions.length} credit matches</h2>
          <p>
            Stored equivalency rules found potential exemptions for your program.
          </p>
          <div>
            <small>{academics.selectedProgram.degree}</small>
            <strong>Review matches</strong>
          </div>
        </Link>
        <Link className="aster-domain-card aster-domain-card--campus" href="/campus-life">
          <span>My Campus Life</span>
          <h2>{campus.events[0]?.title ?? "Discover campus"}</h2>
          <p>
            {campus.events[0]
              ? `${shortDate(campus.events[0].startsAt)} · ${campus.events[0].location}`
              : "Events and clubs will appear here."}
          </p>
          <div>
            <small>{campus.clubs.length} active clubs</small>
            <strong>Explore campus</strong>
          </div>
        </Link>
      </section>
    </PortalShell>
  );
}
