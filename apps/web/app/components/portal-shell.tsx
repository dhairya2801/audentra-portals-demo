"use client";

import type { StudentExperienceUpdate } from "@vv/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  decideStudentExperienceUpdate,
  deferStudentExperienceUpdates,
  getStudentBootstrap,
} from "../lib/api-client";
import {
  beginExperienceUpdateVisit,
  studentExperienceUpdateSessionKey,
  touchExperienceUpdateVisit,
} from "../lib/experience-update-session";
import { EdwardAssistant } from "./edward-assistant";
import { ErrorState, LoadingState, PortalMark } from "./portal-ui";
import { RewardCelebration } from "./reward-celebration";
import { StudentNotificationCenter } from "./student-notification-center";
import { connectStudentRealtime } from "./student-realtime";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";

export type PortalSection =
  | "dashboard"
  | "enrollment"
  | "financials"
  | "classrooms"
  | "campus_life"
  | "edward"
  | "profile"
  | "documents"
  | "messages"
  | "appointments"
  | "payments"
  | "help";

const navigation: {
  key: PortalSection;
  label: string;
  shortLabel: string;
  href: string;
  symbol: string;
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    href: "/dashboard",
    symbol: "⌂",
  },
  {
    key: "enrollment",
    label: "My Enrollment",
    shortLabel: "Enroll",
    href: "/enrollment",
    symbol: "✓",
  },
  {
    key: "financials",
    label: "My Financials",
    shortLabel: "Finance",
    href: "/financials",
    symbol: "$",
  },
  {
    key: "classrooms",
    label: "My Classrooms",
    shortLabel: "Classes",
    href: "/classrooms",
    symbol: "▤",
  },
  {
    key: "campus_life",
    label: "My Campus Life",
    shortLabel: "Campus",
    href: "/campus-life",
    symbol: "◉",
  },
  {
    key: "messages",
    label: "Messages",
    shortLabel: "Messages",
    href: "/messages",
    symbol: "\u2709",
  },
  {
    key: "edward",
    label: "Edward AI",
    shortLabel: "Edward",
    href: "/edward",
    symbol: "✦",
  },
  {
    key: "documents",
    label: "My Documents",
    shortLabel: "Documents",
    href: "/documents",
    symbol: "↑",
  },
  {
    key: "profile",
    label: "Profile",
    shortLabel: "Profile",
    href: "/profile",
    symbol: "○",
  },
];

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function bookstoreCredit(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

const experienceKindLabels: Record<StudentExperienceUpdate["kind"], string> = {
  onboarding: "Onboarding",
  enrollment: "Enrollment",
  academics: "Academics",
  campus_life: "Campus life",
};

function ExperienceUpdateDialog({
  updates,
  institutionName,
  busy,
  error,
  onDefer,
  onHandleNow,
}: {
  updates: StudentExperienceUpdate[];
  institutionName: string;
  busy: boolean;
  error: string | null;
  onDefer: () => Promise<void>;
  onHandleNow: (update: StudentExperienceUpdate) => Promise<void>;
}) {
  const dialog = useRef<HTMLElement>(null);
  const primaryUpdate = updates[0]!;
  const isBundle = updates.length > 1;
  const updateIds = updates.map((update) => update.id).join(":");

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const backdrop = element.parentElement;
    const shell = backdrop?.parentElement;
    const background = shell
      ? Array.from(shell.children).filter((child) => child !== backdrop)
      : [];
    const previousInert = background.map((child) => ({
      child,
      inert: child.hasAttribute("inert"),
    }));

    background.forEach((child) => child.setAttribute("inert", ""));
    document.body.style.overflow = "hidden";
    element.focus();

    return () => {
      previousInert.forEach(({ child, inert }) => {
        if (!inert) child.removeAttribute("inert");
      });
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [updateIds]);

  const trapFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      dialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((control) => !control.hidden && control.offsetParent !== null);
    if (controls.length === 0) {
      event.preventDefault();
      dialog.current?.focus();
      return;
    }
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="dialog-backdrop experience-update-backdrop">
      <section
        ref={dialog}
        className="confirmation-dialog experience-update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="experience-update-title"
        aria-describedby="experience-update-description"
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <span className="confirmation-dialog__symbol" aria-hidden="true">
          !
        </span>
        <div className="experience-update-dialog__meta">
          <span>
            {isBundle
              ? "Enrollment & onboarding"
              : experienceKindLabels[primaryUpdate.kind]}
          </span>
          <small>
            {isBundle
              ? `${updates.length} updates together`
              : primaryUpdate.status === "deferred"
                ? "Saved reminder"
                : "New update"}
          </small>
        </div>
        <p className="eyebrow">An update from {institutionName}</p>
        <h2 id="experience-update-title">
          {isBundle
            ? "Your enrollment and onboarding have updates"
            : primaryUpdate.title}
        </h2>
        <p id="experience-update-description">
          {isBundle
            ? "We grouped the latest changes so you can review them without repeated interruptions."
            : primaryUpdate.description}
        </p>
        {isBundle ? (
          <ul className="experience-update-dialog__list">
            {updates.map((update) => (
              <li key={update.id}>
                <div>
                  <small>{experienceKindLabels[update.kind]}</small>
                  <h3>{update.title}</h3>
                  <p>{update.description}</p>
                </div>
                <button
                  className="experience-update-dialog__handle"
                  type="button"
                  disabled={busy}
                  onClick={() => void onHandleNow(update)}
                >
                  Handle now
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="experience-update-dialog__guidance">
          {isBundle
            ? "Open any update now, or save this set for your next portal visit."
            : "You can take care of this now or save it for your next portal visit."}
        </p>
        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions experience-update-dialog__actions">
          <button
            className="button button--secondary"
            type="button"
            disabled={busy}
            onClick={() => void onDefer()}
          >
            {busy ? "Saving…" : "Remind me later"}
          </button>
          <button
            className="button"
            type="button"
            hidden={isBundle}
            disabled={busy}
            onClick={() => void onHandleNow(primaryUpdate)}
          >
            {busy ? "Opening…" : "Handle now"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function PortalShell({
  active,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  active: PortalSection;
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tenantRuntime = useTenant();
  const { tenant } = tenantRuntime;
  const [menuOpen, setMenuOpen] = useState(false);
  const [experienceUpdates, setExperienceUpdates] = useState<
    StudentExperienceUpdate[]
  >([]);
  const [experienceVisit, setExperienceVisit] = useState(0);
  const presentedExperienceVisit = useRef<string | null>(null);
  const { track } = useActivityTracking();
  const experienceDecision = useApiAction(decideStudentExperienceUpdate);
  const experienceDeferral = useApiAction(deferStudentExperienceUpdates);
  const runExperienceDecision = experienceDecision.run;
  const runExperienceDeferral = experienceDeferral.run;
  const loadBootstrap = useCallback(
    (signal: AbortSignal) => getStudentBootstrap(signal),
    [],
  );
  const identity = useApiResource(loadBootstrap);
  const refreshIdentity = identity.refresh;
  const needsOnboarding =
    identity.data?.onboarding.required &&
    identity.data.onboarding.status !== "completed";
  const needsSignIn =
    identity.status === "error" &&
    (identity.errorStatus === 401 || identity.errorStatus === 403);
  const experienceSessionKey =
    identity.status === "ready"
      ? studentExperienceUpdateSessionKey(tenant.id, identity.data.student.id)
      : null;

  useEffect(() => {
    if (needsSignIn) {
      window.location.replace(tenantRuntime.href("/sign-in"));
    } else if (needsOnboarding) {
      window.location.replace(tenantRuntime.href("/onboarding"));
    }
  }, [needsOnboarding, needsSignIn, tenantRuntime]);

  useEffect(() => {
    if (
      identity.status !== "ready" ||
      needsOnboarding ||
      needsSignIn ||
      !experienceSessionKey
    ) {
      return;
    }
    if (beginExperienceUpdateVisit(experienceSessionKey)) {
      const frame = window.requestAnimationFrame(() => {
        setExperienceVisit((current) => current + 1);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [
    experienceSessionKey,
    identity.status,
    needsOnboarding,
    needsSignIn,
  ]);

  useEffect(() => {
    if (
      identity.status !== "ready" ||
      needsOnboarding ||
      needsSignIn ||
      !experienceSessionKey ||
      experienceVisit === 0
    ) {
      return;
    }
    const presentationKey = `${experienceSessionKey}:${experienceVisit}`;
    if (presentedExperienceVisit.current === presentationKey) return;
    presentedExperienceVisit.current = presentationKey;
    const updates = (identity.data.experienceUpdates ?? []).filter(
      (update) =>
        (update.status === "pending" || update.status === "deferred") &&
        (update.kind === "enrollment" || update.kind === "onboarding"),
    );
    if (updates.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      setExperienceUpdates(updates);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    experienceSessionKey,
    experienceVisit,
    identity.data,
    identity.status,
    needsOnboarding,
    needsSignIn,
  ]);

  const handleExperienceUpdate = useCallback(
    async (update: StudentExperienceUpdate) => {
      let decision;
      try {
        decision = await runExperienceDecision(update.id, {
          action: "handle_now",
          expectedVersion: update.version,
        });
      } catch {
        return;
      }

      if (experienceSessionKey) touchExperienceUpdateVisit(experienceSessionKey);
      setExperienceUpdates([]);
      const destination = decision.requirementSlug
        ? `/enrollment/requirements/${encodeURIComponent(decision.requirementSlug)}`
        : "/enrollment";
      window.location.assign(tenantRuntime.href(destination));
    },
    [experienceSessionKey, runExperienceDecision, tenantRuntime],
  );

  const deferExperienceUpdates = useCallback(async () => {
    if (experienceUpdates.length === 0) return;
    try {
      await runExperienceDeferral({
        updates: experienceUpdates.map((update) => ({
          id: update.id,
          expectedVersion: update.version,
        })),
      });
    } catch {
      return;
    }
    if (experienceSessionKey) touchExperienceUpdateVisit(experienceSessionKey);
    setExperienceUpdates([]);
  }, [experienceSessionKey, experienceUpdates, runExperienceDeferral]);

  useEffect(() => {
    if (!experienceSessionKey) return;
    const touch = () => touchExperienceUpdateVisit(experienceSessionKey);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        touch();
        return;
      }
      if (document.visibilityState === "visible") {
        if (beginExperienceUpdateVisit(experienceSessionKey)) {
          setExperienceVisit((current) => current + 1);
          refreshIdentity();
        }
      }
    };
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("keydown", touch);
    window.addEventListener("focus", touch);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("focus", touch);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [experienceSessionKey, refreshIdentity]);

  const experienceBusy =
    experienceDecision.status === "loading" || experienceDeferral.status === "loading";
  const experienceError =
    experienceDecision.status === "error"
      ? experienceDecision.message
      : experienceDeferral.status === "error"
        ? experienceDeferral.message
        : null;

  useEffect(() => {
    track("ui.portal_section_viewed.v1", {
      section: active,
      entry_point: "portal_navigation",
    });
  }, [active, track]);

  useEffect(() => {
    const interval = window.setInterval(refreshIdentity, 15_000);
    const refreshAfterStudentAction = () => refreshIdentity();
    window.addEventListener(
      "vv:student-record-changed",
      refreshAfterStudentAction,
    );
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(
        "vv:student-record-changed",
        refreshAfterStudentAction,
      );
    };
  }, [refreshIdentity]);

  useEffect(() => {
    if (identity.status !== "ready" || needsOnboarding || needsSignIn) return;
    return connectStudentRealtime((event) => {
      refreshIdentity();
      window.dispatchEvent(
        new CustomEvent("vv:student-realtime", { detail: event }),
      );
    });
  }, [identity.status, needsOnboarding, needsSignIn, refreshIdentity]);

  if (identity.status === "loading" || needsSignIn || needsOnboarding) {
    return (
      <main className="load-state">
        <LoadingState label="Checking your portal access" />
      </main>
    );
  }

  if (identity.status === "error") {
    return (
      <main className="load-state">
        <ErrorState message={identity.error} onRetry={identity.reload} />
      </main>
    );
  }

  return (
    <div className="aster-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="aster-topbar">
        <button
          className="aster-menu-button"
          type="button"
          aria-label={menuOpen ? "Close portal menu" : "Open portal menu"}
          aria-expanded={menuOpen}
          aria-controls="portal-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
        <Link
          className="aster-brand"
          href="/dashboard"
          aria-label={tenant.portalLabel}
        >
          <PortalMark />
          <span>
            <strong>{tenant.shortName}</strong>
            <small>University</small>
          </span>
        </Link>
        <div className="aster-topbar__right">
          {identity.data.rewards ? (
            <div
              className="aster-points-balance"
              title={`${bookstoreCredit(identity.data.rewards.bookstoreCreditCents)} in bookstore credit`}
            >
              <span aria-hidden="true">✦</span>
              <div>
                <strong>{identity.data.rewards.lifetimePoints}</strong>
                <small>{identity.data.rewards.pointName}</small>
              </div>
            </div>
          ) : null}
          <Link className="aster-help-link" href="/help">
            Student support
          </Link>
          <StudentNotificationCenter
            fallbackUnreadCount={identity.data.unreadMessageCount}
            suppressTransient={experienceUpdates.length > 0}
          />
          <Link
            className="aster-student"
            href="/profile"
            aria-label={`Open profile for ${identity.data.student.fullName}`}
          >
            <span aria-hidden="true">
              {initials(identity.data.student.fullName)}
            </span>
            <div>
              <strong>{identity.data.student.preferredName}</strong>
              <small>Student</small>
            </div>
          </Link>
        </div>
      </header>

      {menuOpen ? (
        <button
          className="aster-nav-backdrop"
          type="button"
          aria-label="Close portal menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        id="portal-navigation"
        className={`aster-sidebar${menuOpen ? " aster-sidebar--open" : ""}`}
      >
        <p className="aster-sidebar__label">Student portal</p>
        <nav aria-label="Student portal sections">
          {navigation.map((item) => (
            <Link
              className={active === item.key ? "aster-nav-link--active" : undefined}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              key={item.key}
            >
              <span aria-hidden="true">{item.symbol}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        {identity.data.rewards ? (
          <section
            className="aster-sidebar__rewards"
            aria-label={`${identity.data.rewards.pointName} balance`}
          >
            <span aria-hidden="true">✦</span>
            <div>
              <small>{identity.data.rewards.pointName}</small>
              <strong>{identity.data.rewards.lifetimePoints} points</strong>
              <p>
                {bookstoreCredit(
                  identity.data.rewards.bookstoreCreditCents,
                )}{" "}
                bookstore credit
              </p>
            </div>
          </section>
        ) : null}
        <div className="aster-sidebar__support">
          <span aria-hidden="true">?</span>
          <div>
            <strong>Your student support team</strong>
            <p>
              {tenant.shortName} enrollment and financial-aid advisors are
              available weekdays.
            </p>
            <div className="aster-sidebar__support-links">
              <a href={`mailto:${tenant.admissionsEmail}`}>
                {tenant.admissionsEmail}
              </a>
              <Link href="/appointments">Book an advisor</Link>
            </div>
          </div>
        </div>
      </aside>

      <main id="main-content" className="aster-main">
        <header className="aster-page-heading">
          <div>
            <p className="eyebrow">{tenantRuntime.copy(eyebrow)}</p>
            <h1>{tenantRuntime.copy(title)}</h1>
            <p>{tenantRuntime.copy(description)}</p>
          </div>
          {actions ? <div className="aster-page-actions">{actions}</div> : null}
        </header>
        {children}
        <footer className="aster-footer">
          <p>© {new Date().getFullYear()} {tenant.name}</p>
          <nav aria-label="Portal policies">
            <Link href="/help">Privacy & accessibility</Link>
            <Link href="/help">Student support</Link>
          </nav>
        </footer>
      </main>

      <nav className="aster-mobile-nav" aria-label="Mobile portal navigation">
        {navigation.slice(0, 5).map((item) => (
          <Link
            className={active === item.key ? "aster-mobile-nav__active" : undefined}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            key={item.key}
          >
            <span aria-hidden="true">{item.symbol}</span>
            {item.shortLabel}
          </Link>
        ))}
      </nav>

      {active !== "edward" ? (
        <EdwardAssistant
          studentName={identity.data.student.preferredName}
          variant="floating"
        />
      ) : null}

      {experienceUpdates.length > 0 ? (
        <ExperienceUpdateDialog
          updates={experienceUpdates}
          institutionName={tenant.shortName}
          busy={experienceBusy}
          error={experienceError}
          onDefer={deferExperienceUpdates}
          onHandleNow={handleExperienceUpdate}
        />
      ) : null}

      {experienceUpdates.length === 0 && identity.data.rewards ? (
        <RewardCelebration
          tenantSlug={tenant.slug}
          studentId={identity.data.student.id}
          pointName={identity.data.rewards.pointName}
          lifetimePoints={identity.data.rewards.lifetimePoints}
        />
      ) : null}
    </div>
  );
}
