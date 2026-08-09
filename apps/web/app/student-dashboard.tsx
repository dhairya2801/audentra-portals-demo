"use client";

import {
  studentRequirementSlug,
  type FinancialDocumentRequirement,
  type StudentRequirementSummary,
} from "@vv/contracts";
import { useCallback, useEffect } from "react";
import { PortalShell } from "./components/portal-shell";
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
import { prioritizeDashboardRequirements } from "./lib/enrollment-dashboard-action";
import { dashboardStudentCalendarEntries } from "./lib/student-calendar";
import { safePortalDestination } from "./lib/safe-destination";
import { TenantLink as Link } from "./components/tenant-link";
import { useTenant } from "./components/tenant-provider";

function requirementState(item: StudentRequirementSummary) {
  if (["completed", "waived", "not_applicable"].includes(item.status)) {
    return "Complete";
  }
  if (item.status === "blocked") return "Waiting";
  if (["rejected", "expired"].includes(item.status)) return "Attention";
  return item.progressPercent > 0 ? "In progress" : "To do";
}

function DashboardProgressDocument({
  document,
}: {
  document: FinancialDocumentRequirement;
}) {
  const fallback = document.documentId
    ? `/documents?document=${encodeURIComponent(document.documentId)}`
    : "/documents";
  const destination = safePortalDestination(document.href, fallback);
  const content = (
    <>
      <span className={dashboardStyles.progressTaskMarker} aria-hidden="true">
        $
      </span>
      <span className={dashboardStyles.progressTaskCopy}>
        <small>Financial aid · action needed</small>
        <strong>{document.title}</strong>
      </span>
      <span className={dashboardStyles.progressTaskArrow} aria-hidden="true">
        {destination.external ? "↗" : "→"}
      </span>
    </>
  );
  return destination.external ? (
    <li>
      <a
        className={dashboardStyles.progressTask}
        href={destination.href}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </a>
    </li>
  ) : (
    <li>
      <Link className={dashboardStyles.progressTask} href={destination.href}>
        {content}
      </Link>
    </li>
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

      <div className={dashboardStyles.overview}>
        <DashboardCampusEvents events={campus.events} asOf={loadedAt} />
      </div>

      <div className={dashboardStyles.workingArea}>
        <div className={dashboardStyles.workingStack}>
        <section
          className={`aster-card aster-progress-card ${dashboardStyles.progressCard}`}
        >
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
              ? `${pendingRequirements.length} priority items need your attention.`
              : "Your current enrollment requirements are complete."}
          </p>

          <div className={dashboardStyles.progressTodoHeading}>
            <div>
              <span>Next up</span>
              <strong>Your enrollment to-dos</strong>
            </div>
            <Link href="/enrollment">View all →</Link>
          </div>

          {pendingRequirements.length > 0 || actionDocuments.length > 0 ? (
            <ul
              className={dashboardStyles.progressTasks}
              aria-label="Priority enrollment to-dos"
            >
              {pendingRequirements.map((item) => (
                <li key={item.id}>
                  <Link
                    className={dashboardStyles.progressTask}
                    href={`/enrollment/requirements/${encodeURIComponent(
                      studentRequirementSlug(item.code),
                    )}`}
                  >
                    <span
                      className={dashboardStyles.progressTaskMarker}
                      aria-hidden="true"
                    >
                      {item.blocking ? "!" : "✓"}
                    </span>
                    <span className={dashboardStyles.progressTaskCopy}>
                      <small>
                        {requirementState(item)}
                        {item.reward?.points
                          ? ` · +${item.reward.points} ${tenant.shortName} Points`
                          : ""}
                      </small>
                      <strong>{item.title}</strong>
                    </span>
                    <span
                      className={dashboardStyles.progressTaskArrow}
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
              {actionDocuments
                .slice(0, Math.max(0, 3 - pendingRequirements.length))
                .map((document) => (
                  <DashboardProgressDocument
                    document={document}
                    key={document.id}
                  />
                ))}
            </ul>
          ) : (
            <div className={dashboardStyles.progressComplete}>
              <span aria-hidden="true">✓</span>
              <div>
                <strong>You are caught up</strong>
                <p>New enrollment actions will appear here.</p>
              </div>
            </div>
          )}
        </section>

        <DashboardFinancialSnapshot financials={financials} />
        <Link
          className={`aster-domain-card ${dashboardStyles.classroomsCard}`}
          href="/classrooms"
        >
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
        </div>
        <div className={dashboardStyles.calendarColumn}>
          <StudentCalendar entries={calendarEntries} />
        </div>
      </div>
    </PortalShell>
  );
}
