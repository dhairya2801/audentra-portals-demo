"use client";

import type {
  AcceptOfferResponse,
  OfferStatus,
  RequirementStatus,
  StudentDashboard,
  StudentRequirementSummary,
} from "@vv/contracts";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useActivityTracking } from "./hooks/use-activity-tracking";
import {
  acceptAdmissionOffer,
  ApiClientError,
  getStudentDashboard,
} from "./lib/api-client";

type LoadState = "loading" | "ready" | "error";

const requirementStatusLabels: Record<RequirementStatus, string> = {
  not_applicable: "Not applicable",
  blocked: "Blocked",
  ready: "Ready to start",
  in_progress: "In progress",
  submitted: "Submitted",
  under_review: "Under review",
  completed: "Complete",
  waived: "Waived",
  rejected: "Needs attention",
  expired: "Overdue",
};

const completedRequirementStatuses = new Set<RequirementStatus>([
  "completed",
  "waived",
  "not_applicable",
]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatMoney(amountInCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);
}

function getInitials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusLabel(status: OfferStatus) {
  return (
    {
      offered: "Awaiting your decision",
      accepted: "Offer accepted",
      declined: "Offer declined",
      expired: "Offer expired",
    } satisfies Record<OfferStatus, string>
  )[status];
}

function userFacingError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.status === 403) {
      return "Your session has expired. Please sign in again.";
    }
    return error.message;
  }
  return "We couldn’t connect to the student portal. Please try again.";
}

function PortalMark() {
  return (
    <span className="portal-mark" aria-hidden="true">
      A
    </span>
  );
}

function LoadingDashboard() {
  return (
    <main className="load-state" aria-busy="true" aria-live="polite">
      <div className="load-state__card">
        <PortalMark />
        <p className="eyebrow">Aster University</p>
        <h1>Preparing your student dashboard</h1>
        <p>We’re securely loading your offer and enrollment progress.</p>
        <span className="loader" aria-hidden="true" />
      </div>
    </main>
  );
}

function ErrorDashboard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="load-state">
      <div className="load-state__card" role="alert">
        <PortalMark />
        <p className="eyebrow">Aster University</p>
        <h1>Your dashboard isn’t available yet</h1>
        <p>{message}</p>
        <button className="button button--primary" type="button" onClick={onRetry}>
          Try again
        </button>
        <a className="text-link" href="mailto:enrollment@aster.edu">
          Contact enrollment support
        </a>
      </div>
    </main>
  );
}

function RequirementIcon({ complete }: { complete: boolean }) {
  return (
    <span
      className={`requirement-icon${complete ? " requirement-icon--complete" : ""}`}
      aria-hidden="true"
    >
      {complete ? "✓" : ""}
    </span>
  );
}

function RequirementRow({
  requirement,
}: {
  requirement: StudentRequirementSummary;
}) {
  const complete = completedRequirementStatuses.has(requirement.status);
  const urgent =
    requirement.status === "rejected" || requirement.status === "expired";

  return (
    <li className="requirement-row">
      <RequirementIcon complete={complete} />
      <div className="requirement-row__body">
        <div className="requirement-row__heading">
          <p>{requirement.title}</p>
          <span
            className={`status-label${urgent ? " status-label--urgent" : ""}`}
          >
            {requirementStatusLabels[requirement.status]}
          </span>
        </div>
        <div className="requirement-row__meta">
          {requirement.dueAt ? `Due ${formatDate(requirement.dueAt)}` : "No due date"}
          {requirement.blocking && !complete ? " · Required" : ""}
        </div>
        {!complete && requirement.progressPercent > 0 ? (
          <div
            className="mini-progress"
            role="progressbar"
            aria-label={`${requirement.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={requirement.progressPercent}
          >
            <span style={{ width: `${requirement.progressPercent}%` }} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function Header({
  dashboard,
  onHelp,
}: {
  dashboard: StudentDashboard;
  onHelp: () => void;
}) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/dashboard" aria-label="Aster University portal home">
            <PortalMark />
            <span>
              <strong>Aster</strong>
              <small>University</small>
            </span>
          </Link>
          <nav className="primary-nav dashboard-primary-nav" aria-label="Student portal">
            <Link className="primary-nav__active" href="/dashboard" aria-current="page">
              Overview
            </Link>
            <Link href="/enrollment">Enrollment</Link>
            <Link href="/documents">Documents</Link>
            <Link href="/messages">
              Messages
              {dashboard.unreadMessageCount > 0 ? (
                <span className="nav-count" aria-label={`${dashboard.unreadMessageCount} unread`}>
                  {dashboard.unreadMessageCount}
                </span>
              ) : null}
            </Link>
            <Link href="/help" onClick={onHelp}>
              Help
            </Link>
          </nav>
          <Link
            className="student-menu"
            href="/profile"
            aria-label={`Open profile for ${dashboard.student.fullName}`}
          >
            <span className="student-avatar" aria-hidden="true">
              {getInitials(dashboard.student.fullName)}
            </span>
            <span className="student-menu__name">{dashboard.student.preferredName}</span>
          </Link>
        </div>
      </header>
    </>
  );
}

function AcceptOfferDialog({
  open,
  programName,
  isSubmitting,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  programName: string;
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    cancelButton.current?.focus();

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog.current) return;

      const controls = Array.from(
        dialog.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", keepFocusInside);
    return () => window.removeEventListener("keydown", keepFocusInside);
  }, [open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        ref={dialog}
        className="confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-copy"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="confirmation-dialog__symbol" aria-hidden="true">
          A
        </span>
        <p className="eyebrow">Confirm your decision</p>
        <h2 id="confirmation-title">Accept your offer?</h2>
        <p id="confirmation-copy">
          By confirming, you accept your admission to {programName} and can begin
          the enrollment process. This decision will be recorded by Aster
          University.
        </p>
        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button
            ref={cancelButton}
            className="button button--secondary"
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Not yet
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
          >
            {isSubmitting ? "Accepting offer…" : "Yes, accept my offer"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Dashboard({
  dashboard,
  isRefreshing,
  successMessage,
  onAccept,
  onHelp,
}: {
  dashboard: StudentDashboard;
  isRefreshing: boolean;
  successMessage: string | null;
  onAccept: () => void;
  onHelp: () => void;
}) {
  const { student, offer, journey } = dashboard;
  const requirements = journey.requirements;
  const completeCount = requirements.filter((requirement) =>
    completedRequirementStatuses.has(requirement.status),
  ).length;
  const upcomingDeadlines = useMemo(
    () =>
      requirements
        .filter((requirement) => requirement.dueAt)
        .sort(
          (first, second) =>
            new Date(first.dueAt!).getTime() - new Date(second.dueAt!).getTime(),
        )
        .slice(0, 3),
    [requirements],
  );

  return (
    <div className="portal-shell">
      <Header dashboard={dashboard} onHelp={onHelp} />
      <main id="main-content" className="dashboard">
        {successMessage ? (
          <div className="success-banner" role="status">
            <span aria-hidden="true">✓</span>
            <p>
              <strong>You&apos;re officially Aster-bound.</strong>
              {successMessage}
            </p>
          </div>
        ) : null}

        <section className="welcome-row" aria-labelledby="welcome-title">
          <div>
            <p className="eyebrow">Student portal · Class of {student.classYear}</p>
            <h1 id="welcome-title">Welcome back, {student.preferredName}.</h1>
            <p>Your path to Aster starts here. Let’s keep the momentum going.</p>
          </div>
          {isRefreshing ? (
            <span className="refreshing" role="status">
              Refreshing…
            </span>
          ) : null}
        </section>

        <section className="progress-card" aria-labelledby="progress-heading">
          <div className="progress-card__copy">
            <span className="progress-kicker">Your enrollment journey</span>
            <h2 id="progress-heading">
              {journey.completionPercent}% complete
            </h2>
            <p>
              {completeCount} of {requirements.length} requirements complete
            </p>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Enrollment journey progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={journey.completionPercent}
          >
            <span style={{ width: `${journey.completionPercent}%` }} />
          </div>
          <div className="progress-card__aside">
            <span>Next up</span>
            <strong>{journey.nextAction.label}</strong>
          </div>
        </section>

        <div className="dashboard-grid">
          <div className="dashboard-main">
            <section className="next-action card" aria-labelledby="next-action-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Recommended next step</p>
                  <h2 id="next-action-title">{journey.nextAction.label}</h2>
                </div>
                <span className="next-action__number" aria-hidden="true">
                  01
                </span>
              </div>
              <p>
                Complete this step to keep your enrollment moving forward.
                Your progress is saved securely in the portal.
              </p>
              {offer.status === "offered" ? (
                <button
                  className="button button--primary button--wide-mobile"
                  type="button"
                  onClick={onAccept}
                >
                  Review and accept offer <span aria-hidden="true">→</span>
                </button>
              ) : offer.status === "accepted" ? (
                <Link
                  className="button button--primary button--wide-mobile"
                  href={journey.nextAction.href}
                >
                  Continue to next step <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <Link
                  className="button button--primary button--wide-mobile"
                  href="/help"
                >
                  Get help with your offer <span aria-hidden="true">→</span>
                </Link>
              )}
            </section>

            <section id="requirements" className="card requirements" aria-labelledby="requirements-title">
              <div className="section-heading section-heading--bordered">
                <div>
                  <p className="eyebrow">Your checklist</p>
                  <h2 id="requirements-title">Enrollment requirements</h2>
                </div>
                <span className="section-count">
                  {completeCount}/{requirements.length} done
                </span>
              </div>
              {requirements.length > 0 ? (
                <ul className="requirement-list">
                  {requirements.map((requirement) => (
                    <RequirementRow
                      key={requirement.id}
                      requirement={requirement}
                    />
                  ))}
                </ul>
              ) : (
                <p className="empty-state">Your requirements will appear here when they are assigned.</p>
              )}
            </section>
          </div>

          <aside className="dashboard-aside" aria-label="Offer and student updates">
            <section className="offer-card" aria-labelledby="offer-title">
              <div className="offer-card__topline">
                <span className={`offer-state offer-state--${offer.status}`}>
                  <span aria-hidden="true" />
                  {statusLabel(offer.status)}
                </span>
                <span>AU · {student.classYear}</span>
              </div>
              <p className="offer-card__overline">Your admission offer</p>
              <h2 id="offer-title">{offer.programName}</h2>
              <p>{offer.termName} · {offer.campusName}</p>
              <dl className="offer-facts">
                <div>
                  <dt>Respond by</dt>
                  <dd>{formatDate(offer.responseDeadline)}</dd>
                </div>
                <div>
                  <dt>Enrollment deposit</dt>
                  <dd>{formatMoney(offer.depositAmountCents)}</dd>
                </div>
              </dl>
              {offer.status === "offered" ? (
                <button
                  className="button button--light"
                  type="button"
                  onClick={onAccept}
                >
                  Accept my offer
                </button>
              ) : offer.status === "accepted" ? (
                <p className="offer-confirmed">
                  <span aria-hidden="true">✓</span> Your place is confirmed
                </p>
              ) : (
                <a className="button button--light" href="mailto:admissions@aster.edu">
                  Contact admissions
                </a>
              )}
            </section>

            <section className="card deadline-card" aria-labelledby="deadlines-title">
              <div className="section-heading section-heading--compact">
                <h2 id="deadlines-title">Upcoming deadlines</h2>
                <span aria-hidden="true">⌁</span>
              </div>
              <div className="deadline deadline--featured">
                <time dateTime={offer.responseDeadline}>
                  <strong>{new Date(offer.responseDeadline).getUTCDate()}</strong>
                  <span>
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      timeZone: "UTC",
                    }).format(new Date(offer.responseDeadline))}
                  </span>
                </time>
                <p>
                  <strong>Admission offer response</strong>
                  <span>{statusLabel(offer.status)}</span>
                </p>
              </div>
              {upcomingDeadlines.map((requirement) => (
                <div className="deadline" key={requirement.id}>
                  <time dateTime={requirement.dueAt!}>
                    <strong>{new Date(requirement.dueAt!).getUTCDate()}</strong>
                    <span>
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        timeZone: "UTC",
                      }).format(new Date(requirement.dueAt!))}
                    </span>
                  </time>
                  <p>
                    <strong>{requirement.title}</strong>
                    <span>{requirementStatusLabels[requirement.status]}</span>
                  </p>
                </div>
              ))}
            </section>

            <section id="messages" className="card messages-card" aria-labelledby="messages-title">
              <div className="message-icon" aria-hidden="true">✉</div>
              <div>
                <h2 id="messages-title">Messages</h2>
                <p>
                  {dashboard.unreadMessageCount > 0
                    ? `${dashboard.unreadMessageCount} unread ${dashboard.unreadMessageCount === 1 ? "message" : "messages"} from Aster`
                    : "You’re all caught up"}
                </p>
              </div>
              <Link href="/messages" aria-label="Open messages">
                <span aria-hidden="true">→</span>
              </Link>
            </section>

            <section id="help" className="help-card" aria-labelledby="help-title">
              <span className="help-card__mark" aria-hidden="true">?</span>
              <div>
                <h2 id="help-title">Need a hand?</h2>
                <p>Your enrollment team is here for you.</p>
                <a href="mailto:enrollment@aster.edu" onClick={onHelp}>
                  Get help <span aria-hidden="true">→</span>
                </a>
              </div>
            </section>
          </aside>
        </div>
      </main>
      <footer className="site-footer">
        <p>© {new Date().getFullYear()} Aster University</p>
        <nav aria-label="Legal">
          <Link href="/help">Privacy</Link>
          <Link href="/help">Accessibility</Link>
          <Link href="/help">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}

export function StudentDashboardPage() {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const acceptanceKey = useRef<string | null>(null);
  const acceptanceTrigger = useRef<HTMLElement | null>(null);
  const trackedDashboardVersion = useRef<number | null>(null);
  const { track } = useActivityTracking();

  const loadDashboard = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const nextDashboard = await getStudentDashboard(signal);
        setDashboard(nextDashboard);
        setLoadError(null);
        setLoadState("ready");
        return true;
      } catch (error) {
        if (signal?.aborted) return false;
        setLoadError(userFacingError(error));
        setLoadState("error");
        return false;
      }
    },
    [],
  );

  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const nextDashboard = await getStudentDashboard();
      setDashboard(nextDashboard);
      setLoadError(null);
      return true;
    } catch {
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getStudentDashboard(controller.signal)
      .then((nextDashboard) => {
        setDashboard(nextDashboard);
        setLoadError(null);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(userFacingError(error));
        setLoadState("error");
      });

    track("ui.portal_session_started.v1", { entry_point: "student_portal" });
    return () => controller.abort();
  }, [track]);

  useEffect(() => {
    if (
      dashboard &&
      trackedDashboardVersion.current !== dashboard.projectionVersion
    ) {
      trackedDashboardVersion.current = dashboard.projectionVersion;
      track("ui.dashboard_viewed.v1", {
        projection_version: dashboard.projectionVersion,
      });
      track("ui.admission_offer_viewed.v1", {
        offer_status: dashboard.offer.status,
      });
    }
  }, [dashboard, track]);

  const beginAcceptance = useCallback(() => {
    acceptanceTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    acceptanceKey.current ??= crypto.randomUUID();
    setAcceptError(null);
    setDialogOpen(true);
    track("ui.admission_decision_started.v1", {
      decision: "accept",
      entry_point: "dashboard",
    });
  }, [track]);

  const cancelAcceptance = useCallback(() => {
    if (isAccepting) return;
    acceptanceKey.current = null;
    setAcceptError(null);
    setDialogOpen(false);
    requestAnimationFrame(() => acceptanceTrigger.current?.focus());
  }, [isAccepting]);

  useEffect(() => {
    if (!dialogOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelAcceptance();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelAcceptance, dialogOpen]);

  const confirmAcceptance = useCallback(async () => {
    if (!dashboard || isAccepting || dashboard.offer.status !== "offered") return;

    const idempotencyKey =
      acceptanceKey.current ?? (acceptanceKey.current = crypto.randomUUID());
    setAcceptError(null);
    setIsAccepting(true);

    try {
      const accepted: AcceptOfferResponse = await acceptAdmissionOffer(
        dashboard.offer.id,
        idempotencyKey,
      );

      setDashboard((current) =>
        current
          ? {
              ...current,
              offer: { ...current.offer, status: accepted.offerStatus },
              journey: {
                ...current.journey,
                id: accepted.journeyId,
                status: accepted.journeyStatus,
              },
              projectionVersion: accepted.projectionVersion,
            }
          : current,
      );
      setSuccessMessage(
        " Your offer has been accepted. Your enrollment checklist is ready.",
      );
      setDialogOpen(false);
      requestAnimationFrame(() => acceptanceTrigger.current?.focus());
      acceptanceKey.current = null;
      track("ui.enrollment_started.v1", { entry_point: "offer_acceptance" });
      const refreshed = await refreshDashboard();
      if (!refreshed) {
        setSuccessMessage(
          " Your offer has been accepted. Some checklist updates are still syncing.",
        );
      }
    } catch (error) {
      setAcceptError(userFacingError(error));
    } finally {
      setIsAccepting(false);
    }
  }, [dashboard, isAccepting, refreshDashboard, track]);

  const openHelp = useCallback(() => {
    track("ui.help_opened.v1", { context: "dashboard" });
  }, [track]);

  if (loadState === "loading") return <LoadingDashboard />;

  if (loadState === "error" || !dashboard) {
    return (
      <ErrorDashboard
        message={loadError || "We couldn’t load your student information."}
        onRetry={() => {
          setLoadState("loading");
          void loadDashboard();
        }}
      />
    );
  }

  return (
    <>
      <Dashboard
        dashboard={dashboard}
        isRefreshing={isRefreshing}
        successMessage={successMessage}
        onAccept={beginAcceptance}
        onHelp={openHelp}
      />
      <AcceptOfferDialog
        open={dialogOpen}
        programName={dashboard.offer.programName}
        isSubmitting={isAccepting}
        error={acceptError}
        onCancel={cancelAcceptance}
        onConfirm={() => void confirmAcceptance()}
      />
    </>
  );
}
