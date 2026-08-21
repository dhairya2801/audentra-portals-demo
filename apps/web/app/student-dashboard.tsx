"use client";

import {
  studentRequirementSlug,
  type CampusLifeFeed,
  type FerpaPortalScope,
  type FinancialDocumentRequirement,
  type StudentAcademics,
  type StudentDashboard,
  type StudentFinancials,
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
  getStudentBootstrap,
  getStudentDashboard,
  getStudentFinancials,
} from "./lib/api-client";
import { prioritizeDashboardRequirements } from "./lib/enrollment-dashboard-action";
import { dashboardStudentCalendarEntries } from "./lib/student-calendar";
import { safePortalDestination } from "./lib/safe-destination";
import { TenantLink as Link } from "./components/tenant-link";
import { useTenant } from "./components/tenant-provider";

type ScopeAwareDashboard = Omit<StudentDashboard, "offer" | "journey"> & {
  offer?: Partial<StudentDashboard["offer"]>;
  journey?: StudentDashboard["journey"];
  delegateRestricted?: boolean;
};

type DashboardFinancialProjection = Pick<
  StudentFinancials,
  | "academicYear"
  | "acceptedAidCents"
  | "paymentsCents"
  | "remainingBalanceCents"
  | "requiredDocuments"
  | "paymentPlans"
  | "paymentSchedule"
  | "generatedAt"
>;

type DashboardAcademicsProjection = Pick<
  StudentAcademics,
  "selectedProgram" | "exemptionRecommendations" | "generatedAt"
>;

type DashboardCampusProjection = Pick<CampusLifeFeed, "events" | "generatedAt">;

type ReadyDashboardPageData = {
  restricted: false;
  dashboard: ScopeAwareDashboard;
  financials: DashboardFinancialProjection;
  academics: DashboardAcademicsProjection;
  campus: DashboardCampusProjection;
  delegateScopes: FerpaPortalScope[] | null;
  loadedAt: string;
};

type DashboardPageData =
  | ReadyDashboardPageData
  | {
      restricted: true;
      delegateScopes: FerpaPortalScope[];
    };

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
  canOpen,
}: {
  document: FinancialDocumentRequirement;
  canOpen: boolean;
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
      {canOpen ? (
        <span className={dashboardStyles.progressTaskArrow} aria-hidden="true">
          {destination.external ? "↗" : "→"}
        </span>
      ) : null}
    </>
  );
  return canOpen && destination.external ? (
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
  ) : canOpen ? (
    <li>
      <Link className={dashboardStyles.progressTask} href={destination.href}>
        {content}
      </Link>
    </li>
  ) : (
    <li>
      <div className={dashboardStyles.progressTask}>{content}</div>
    </li>
  );
}

function dashboardDocumentScope(document: FinancialDocumentRequirement) {
  const fallback = document.documentId
    ? `/documents?document=${encodeURIComponent(document.documentId)}`
    : "/documents";
  const destination = safePortalDestination(document.href, fallback);
  return !destination.external && destination.href.startsWith("/documents")
    ? "documents"
    : "financials";
}

function DashboardProgressRequirement({
  item,
  pointName,
  canOpen,
}: {
  item: StudentRequirementSummary;
  pointName: string;
  canOpen: boolean;
}) {
  const content = (
    <>
      <span className={dashboardStyles.progressTaskMarker} aria-hidden="true">
        {item.blocking ? "!" : "✓"}
      </span>
      <span className={dashboardStyles.progressTaskCopy}>
        <small>
          {requirementState(item)}
          {item.reward?.points ? ` · +${item.reward.points} ${pointName} Points` : ""}
        </small>
        <strong>{item.title}</strong>
      </span>
      {canOpen ? (
        <span className={dashboardStyles.progressTaskArrow} aria-hidden="true">
          →
        </span>
      ) : null}
    </>
  );

  return (
    <li>
      {canOpen ? (
        <Link
          className={dashboardStyles.progressTask}
          href={`/enrollment/requirements/${encodeURIComponent(
            studentRequirementSlug(item.code),
          )}`}
        >
          {content}
        </Link>
      ) : (
        <div className={dashboardStyles.progressTask}>{content}</div>
      )}
    </li>
  );
}

export function StudentDashboardPage() {
  const { tenant } = useTenant();
  const load = useCallback(async (signal: AbortSignal): Promise<DashboardPageData> => {
    const bootstrap = await getStudentBootstrap(signal);
    const delegateScopes = bootstrap.actor?.type === "delegate"
      ? bootstrap.actor.scopes
      : null;
    if (delegateScopes && !delegateScopes.includes("dashboard")) {
      return { restricted: true, delegateScopes };
    }
    const [dashboard, financials, academics, campus] = await Promise.all([
      getStudentDashboard(signal),
      getStudentFinancials(signal),
      getStudentAcademics(signal),
      getCampusLife(signal),
    ]);
    return {
      restricted: false,
      dashboard: dashboard as ScopeAwareDashboard,
      financials: financials as DashboardFinancialProjection,
      academics: academics as DashboardAcademicsProjection,
      campus: campus as DashboardCampusProjection,
      delegateScopes,
      loadedAt: new Date().toISOString(),
    };
  }, []);
  const resource = useApiResource(load);
  const { track } = useActivityTracking();

  useEffect(() => {
    if (!resource.data || resource.data.restricted) return;
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

  if (resource.data.restricted) {
    return (
      <PortalShell
        active="dashboard"
        eyebrow="Your student home"
        title="Dashboard"
        description="Review the student pages that have been shared with you."
      >
        <div aria-hidden="true" />
      </PortalShell>
    );
  }

  const { dashboard, financials, academics, campus, delegateScopes, loadedAt } = resource.data;
  const offer = dashboard.offer;
  const journey = dashboard.journey;
  const canRead = (scope: FerpaPortalScope) =>
    delegateScopes === null || delegateScopes.includes(scope);
  const pendingRequirements = dashboard.journey
    ? prioritizeDashboardRequirements(dashboard.journey.requirements).slice(0, 3)
    : [];
  const actionDocuments = financials
    ? financials.requiredDocuments.filter(
        (document) => document.status === "action_required",
      )
    : [];
  const suggestedExemptions = (academics?.exemptionRecommendations ?? []).filter(
    (recommendation) =>
      ["suggested", "needs_review"].includes(recommendation.status),
  );
  const hasFullDashboard = Boolean(
    dashboard.offer?.id &&
    dashboard.offer.programName &&
    dashboard.offer.termName &&
    dashboard.offer.campusName &&
    dashboard.journey &&
    financials &&
    campus,
  );
  const calendarEntries = hasFullDashboard
    ? dashboardStudentCalendarEntries({
        dashboard: dashboard as StudentDashboard,
        financials: financials as StudentFinancials,
        campusEvents: campus!.events,
      })
    : [];
  const classroomsContent = (
    <>
      <span>My Classrooms</span>
      <h2>{suggestedExemptions.length} credit matches</h2>
      <p>
        Stored equivalency rules found potential exemptions for your program.
      </p>
      <div>
        <small>{academics.selectedProgram.degree}</small>
        <strong>{canRead("classrooms") ? "Review matches" : "Shared summary"}</strong>
      </div>
    </>
  );

  return (
    <PortalShell
      active="dashboard"
      eyebrow="Your student home"
      title={`Welcome back, ${dashboard.student.preferredName} 👋`}
      description="Here’s what is moving forward—and what deserves your attention next."
    >
      <section className="aster-info-strip" aria-label="Student program summary">
        {offer?.programName ? (
          <div>
            <span>Program</span>
            <strong>{offer.programName}</strong>
          </div>
        ) : null}
        {offer?.termName ? (
          <div>
            <span>Starting term</span>
            <strong>{offer.termName}</strong>
          </div>
        ) : null}
        {offer?.campusName ? (
          <div>
            <span>Campus</span>
            <strong>{offer.campusName}</strong>
          </div>
        ) : null}
        <div>
          <span>Class of</span>
          <strong>{dashboard.student.classYear}</strong>
        </div>
      </section>

      <div className={dashboardStyles.overview}>
        <DashboardCampusEvents
          events={campus.events}
          asOf={loadedAt}
          canOpenCampusLife={canRead("campus_life")}
        />
      </div>

      <div className={dashboardStyles.workingArea}>
        <div className={dashboardStyles.workingStack}>
        {journey ? (
          <section
          className={`aster-card aster-progress-card ${dashboardStyles.progressCard}`}
        >
          <div className="aster-card__heading">
            <div>
              <p className="eyebrow">Enrollment progress</p>
              <h2>Your place at {tenant.shortName}</h2>
            </div>
            <strong>{journey.completionPercent}%</strong>
          </div>
          <div
            className="aster-progress-track"
            role="progressbar"
            aria-label="Enrollment progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={journey.completionPercent}
          >
            <span style={{ width: `${journey.completionPercent}%` }} />
          </div>
          <div className="aster-progress-legend">
            <span className="is-complete">Offer</span>
            <span className={journey.completionPercent >= 34 ? "is-complete" : ""}>
              Preparation
            </span>
            <span className={journey.completionPercent >= 80 ? "is-complete" : ""}>
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
            {canRead("enrollment") ? (
              <Link href="/enrollment">View all →</Link>
            ) : (
              <small>Shared dashboard summary</small>
            )}
          </div>

          {pendingRequirements.length > 0 || actionDocuments.length > 0 ? (
            <ul
              className={dashboardStyles.progressTasks}
              aria-label="Priority enrollment to-dos"
            >
              {pendingRequirements.map((item) => (
                <DashboardProgressRequirement
                  item={item}
                  pointName={tenant.shortName}
                  canOpen={canRead("enrollment")}
                  key={item.id}
                />
              ))}
              {actionDocuments
                .slice(0, Math.max(0, 3 - pendingRequirements.length))
                .map((document) => (
                  <DashboardProgressDocument
                    document={document}
                    canOpen={canRead(dashboardDocumentScope(document))}
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
        ) : null}

        <DashboardFinancialSnapshot
          financials={financials}
          canOpen={canRead("financials")}
        />
        {canRead("classrooms") ? (
          <Link
            className={`aster-domain-card ${dashboardStyles.classroomsCard}`}
            href="/classrooms"
          >
            {classroomsContent}
          </Link>
        ) : (
          <section
            className={`aster-domain-card ${dashboardStyles.classroomsCard}`}
            aria-label="Academic summary"
          >
            {classroomsContent}
          </section>
        )}
        </div>
        <div className={dashboardStyles.calendarColumn}>
          <StudentCalendar
            entries={calendarEntries}
            canOpenEntry={(entry) => {
              const href = entry.href ?? "";
              if (entry.kind === "campus") return canRead("campus_life");
              if (entry.kind === "enrollment") return canRead("enrollment");
              if (entry.kind === "financial") {
                return href.startsWith("/documents")
                  ? canRead("documents")
                  : canRead("financials");
              }
              if (href.startsWith("/enrollment")) {
                return canRead("enrollment");
              }
              if (href.startsWith("/payments")) {
                return canRead("payments");
              }
              return canRead("financials");
            }}
          />
        </div>
      </div>
    </PortalShell>
  );
}
