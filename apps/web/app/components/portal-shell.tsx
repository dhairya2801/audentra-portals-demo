"use client";

import type { FerpaPortalScope, StudentExperienceUpdate } from "@vv/contracts";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  decideStudentExperienceUpdate,
  deferStudentExperienceUpdates,
  getStudentBootstrap,
  signOutFerpaDelegate,
} from "../lib/api-client";
import {
  beginExperienceUpdateVisit,
  studentExperienceUpdateSessionKey,
  touchExperienceUpdateVisit,
} from "../lib/experience-update-session";
import { EdwardAssistant } from "./edward-assistant";
import { ErrorState, LoadingState } from "./portal-ui";
import { RewardCelebration } from "./reward-celebration";
import { StudentNotificationCenter } from "./student-notification-center";
import { connectStudentRealtime } from "./student-realtime";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";
import { formatTenantMoney } from "../lib/tenant";
import { isParentPortalPath, parentPortalHref } from "../lib/parent-portal-routes";
import {
  StudentPortalIcon,
  type StudentPortalIconName,
} from "./student-portal-icon";

export type PortalSection =
  | "dashboard"
  | "enrollment"
  | "financials"
  | "financial_aid"
  | "classrooms"
  | "campus_life"
  | "edward"
  | "profile"
  | "documents"
  | "messages"
  | "appointments"
  | "payments"
  | "help"
  | "health"
  | "housing"
  | "clubs";

const navigation: {
  key: PortalSection;
  label: string;
  shortLabel: string;
  href: string;
  icon: StudentPortalIconName;
  group: "primary" | "financials" | "campus" | "after_groups" | "record" | "utility";
}[] = [
  {
    key: "enrollment",
    label: "My Enrollment",
    shortLabel: "Enroll",
    href: "/enrollment",
    icon: "checklist",
    group: "primary",
  },
  {
    key: "appointments",
    label: "Appointments",
    shortLabel: "Meet",
    href: "/appointments",
    icon: "calendar",
    group: "primary",
  },
  {
    key: "classrooms",
    label: "My Degree",
    shortLabel: "Degree",
    href: "/classrooms",
    icon: "degree",
    group: "primary",
  },
  {
    key: "health",
    label: "My Health and Wellness",
    shortLabel: "Health",
    href: "/health",
    icon: "health",
    group: "primary",
  },
  {
    key: "financials",
    label: "Overview",
    shortLabel: "Finance",
    href: "/financials",
    icon: "wallet",
    group: "financials",
  },
  {
    key: "financial_aid",
    label: "Financial aid",
    shortLabel: "Aid",
    href: "/financials/aid",
    icon: "spark",
    group: "financials",
  },
  {
    key: "payments",
    label: "Payments",
    shortLabel: "Pay",
    href: "/payments",
    icon: "card",
    group: "financials",
  },
  {
    key: "campus_life",
    label: "Events",
    shortLabel: "Events",
    href: "/campus-life",
    icon: "ticket",
    group: "campus",
  },
  {
    key: "clubs",
    label: "Clubs",
    shortLabel: "Clubs",
    href: "/campus-life?view=clubs",
    icon: "users",
    group: "campus",
  },
  {
    key: "housing",
    label: "Housing",
    shortLabel: "Housing",
    href: "/housing",
    icon: "home",
    group: "after_groups",
  },
  {
    key: "help",
    label: "Help",
    shortLabel: "Help",
    href: "/help",
    icon: "help",
    group: "utility",
  },
  {
    key: "profile",
    label: "Profile",
    shortLabel: "Profile",
    href: "/profile",
    icon: "profile",
    group: "utility",
  },
  /* Existing production destinations remain addressable, but the design puts
     them behind page entry points rather than in the primary sidebar. */
  { key: "dashboard", label: "Dashboard", shortLabel: "Home", href: "/dashboard", icon: "home", group: "record" },
  { key: "messages", label: "Messages", shortLabel: "Messages", href: "/messages", icon: "message", group: "record" },
  { key: "edward", label: "Edward AI", shortLabel: "Edward", href: "/edward", icon: "spark", group: "record" },
  { key: "documents", label: "My Documents", shortLabel: "Documents", href: "/documents", icon: "file", group: "record" },
];

const navigationGroups: Array<{
  id: Exclude<(typeof navigation)[number]["group"], "primary" | "utility">;
  label: string;
}> = [
  { id: "financials", label: "My Financials" },
  { id: "campus", label: "My Campus Life" },
];

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function relationshipLabel(value: string) {
  return value === "partner"
    ? "Partner"
    : value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
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
  const pathname = usePathname() || "/";
  const { tenant } = tenantRuntime;
  const advisorContact =
    tenant.contacts.admissions ??
    tenant.contacts.financialAid ??
    tenant.contacts.support;
  const tenantNavigation = navigation.filter((item) => {
    if (item.key === "campus_life" || item.key === "clubs") {
      return tenant.capabilities.campusLife !== false;
    }
    if (item.key === "edward") {
      return tenant.capabilities.assistant !== false;
    }
    return true;
  });
  const publicFooterLinks: { label: string; href: string }[] = [];
  if (tenant.publicLinks.privacy) {
    publicFooterLinks.push({ label: "Privacy", href: tenant.publicLinks.privacy });
  }
  if (tenant.publicLinks.accessibility) {
    publicFooterLinks.push({
      label: "Accessibility",
      href: tenant.publicLinks.accessibility,
    });
  }
  if (tenant.publicLinks.institution) {
    publicFooterLinks.push({
      label: "Institution website",
      href: tenant.publicLinks.institution,
    });
  }
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigationPanel = useRef<HTMLElement>(null);
  const [openNavigationGroups, setOpenNavigationGroups] = useState<
    Record<string, boolean>
  >(() => {
    const activeGroup = navigation.find((item) => item.key === active)?.group;
    return activeGroup && !["primary", "utility"].includes(activeGroup)
      ? { [activeGroup]: true }
      : {};
  });
  const [experienceUpdates, setExperienceUpdates] = useState<
    StudentExperienceUpdate[]
  >([]);
  const [experienceVisit, setExperienceVisit] = useState(0);
  const presentedExperienceVisit = useRef<string | null>(null);
  const { track } = useActivityTracking();
  const experienceDecision = useApiAction(decideStudentExperienceUpdate);
  const experienceDeferral = useApiAction(deferStudentExperienceUpdates);
  const delegateSignOut = useApiAction(signOutFerpaDelegate);
  const runExperienceDecision = experienceDecision.run;
  const runExperienceDeferral = experienceDeferral.run;
  const loadBootstrap = useCallback(
    (signal: AbortSignal) => getStudentBootstrap(signal),
    [],
  );
  const identity = useApiResource(loadBootstrap);
  const refreshIdentity = identity.refresh;
  const delegateActor =
    identity.status === "ready" && identity.data.actor?.type === "delegate"
      ? identity.data.actor
      : null;
  const visibleNavigation = navigation.filter((item) => {
    if (delegateActor) {
      const delegatedSection = item.key === "financial_aid" ? "financials" : item.key;
      return delegateActor.scopes.includes(delegatedSection as FerpaPortalScope);
    }
    return tenantNavigation.some((candidate) => candidate.key === item.key);
  });
  const activeNavigationItem = navigation.find((item) => item.key === active);
  const primaryNavigation = visibleNavigation.filter(
    (item) => item.group === "primary",
  );
  const utilityNavigation = visibleNavigation.filter(
    (item) => item.group === "utility",
  );
  const afterGroupNavigation = visibleNavigation.filter(
    (item) => item.group === "after_groups",
  );
  const portalHome = visibleNavigation[0]?.href ?? "/help";
  const activeAllowed =
    !delegateActor || delegateActor.scopes.includes((active === "financial_aid" ? "financials" : active) as FerpaPortalScope);
  const needsOnboarding =
    !delegateActor && identity.data?.onboarding?.required &&
    identity.data.onboarding.status !== "completed";
  const needsSignIn =
    identity.status === "error" &&
    (identity.errorStatus === 401 || identity.errorStatus === 403);
  const experienceSessionKey =
    identity.status === "ready" && !delegateActor
      ? studentExperienceUpdateSessionKey(tenant.id, identity.data.student.id)
      : null;

  useEffect(() => {
    if (!menuOpen) return;
    const panel = navigationPanel.current;
    if (!panel) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => element.getClientRects().length > 0,
      );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        window.requestAnimationFrame(() => menuButton.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
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

    document.body.style.overflow = "hidden";
    panel.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => focusable()[0]?.focus());
    return () => {
      panel.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [menuOpen]);

  useEffect(() => {
    if (needsSignIn) {
      window.location.replace(tenantRuntime.href("/sign-in"));
    } else if (needsOnboarding) {
      window.location.replace(tenantRuntime.href("/onboarding"));
    }
  }, [needsOnboarding, needsSignIn, tenantRuntime]);

  useEffect(() => {
    if (!delegateActor || isParentPortalPath(pathname)) return;

    // Upgrade old parent bookmarks and a manually entered bare student route
    // before the parent continues navigating. If the route is student-only
    // (for example FERPA administration), return to the parent's first
    // allowed page instead of exposing a student-context destination.
    const current = `${pathname}${window.location.search}${window.location.hash}`;
    const destination = parentPortalHref(current);
    window.location.replace(
      destination === current ? parentPortalHref(portalHome) : destination,
    );
  }, [delegateActor, pathname, portalHome]);

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
    if (
      identity.status !== "ready" ||
      identity.data.actor?.type === "delegate" ||
      needsOnboarding ||
      needsSignIn
    ) return;
    return connectStudentRealtime((event) => {
      refreshIdentity();
      window.dispatchEvent(
        new CustomEvent("vv:student-realtime", { detail: event }),
      );
    });
  }, [identity.data, identity.status, needsOnboarding, needsSignIn, refreshIdentity]);

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

  const presentedTitle =
    active === "enrollment" && title === "Your requirements"
      ? `You’re in, ${identity.data.student.preferredName}. Here’s what’s left.`
        : active === "financials" || active === "financial_aid"
        ? "What the year costs, and what covers it."
        : active === "classrooms"
          ? "What your degree asks of you."
          : active === "appointments"
            ? "Book time with the people who can help."
            : active === "campus_life"
              ? "Find your people."
              : active === "help"
                ? `Get unstuck, ${identity.data.student.preferredName}.`
                : active === "profile"
                  ? `What ${tenant.shortName} knows about you.`
                  : title;
  const presentedDescription =
    active === "enrollment" && title === "Your requirements"
      ? "Your next steps are in the order that keeps things moving. Start with the first one, or pick any task you can do now."
      : active === "financials" || active === "financial_aid"
        ? "What the year costs, what’s covering it, and what still needs you—all from your current student account."
        : active === "classrooms"
          ? "Every requirement your program sets, the courses that satisfy each one, and the current reading of your record."
          : active === "appointments"
            ? "Schedule focused time with the people who can unblock a step or answer a question."
            : active === "campus_life"
              ? `Events, clubs, and the people who run them, published for ${tenant.shortName} students.`
              : active === "help"
                ? `${tenant.shortName} guides and a direct route to the support team that owns your question.`
                : active === "profile"
                  ? "Some details are yours to change. The rest belong to the office responsible for your official record."
                  : description;

  return (
    <div className="aster-shell app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <section className="workspace">
      <header className="aster-topbar topbar">
        <button
          ref={menuButton}
          className="aster-menu-button mobile-menu icon-button"
          type="button"
          aria-label={menuOpen ? "Close portal menu" : "Open portal menu"}
          aria-expanded={menuOpen}
          aria-controls="portal-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <StudentPortalIcon name={menuOpen ? "close" : "menu"} />
        </button>
        <Link
          className="aster-mobile-brand mobile-school"
          href={portalHome}
          aria-label={`${tenant.name} student portal`}
        >
          {tenant.shortName}
        </Link>
        <div className="aster-topbar__section" aria-hidden="true">
          {activeNavigationItem?.label ?? "Student portal"}
        </div>
        <div className="aster-topbar__right topbar-actions">
          {!delegateActor && identity.data.rewards ? (
            <details className="aster-points-popover popover">
              <summary
                className="aster-points-balance topbar-chip points-chip"
                aria-label={`Your momentum, ${identity.data.rewards.lifetimePoints.toLocaleString()} points`}
                title="Open your momentum"
              >
                <span aria-hidden="true"><StudentPortalIcon name="spark" size={17} /></span>
                <strong className="chip-figure">{identity.data.rewards.lifetimePoints.toLocaleString()}</strong>
                <small className="chip-unit">pts</small>
              </summary>
              <section className="section-card pop-panel points-balance-panel" aria-label="Your momentum">
                <div className="anchor-card balance-card">
                  <span className="balance-mark" aria-hidden="true"><StudentPortalIcon name="spark" size={18} /></span>
                  <span className="panel-label">Your momentum</span>
                  <strong>{identity.data.rewards.lifetimePoints.toLocaleString()} <small>pts</small></strong>
                  <p>Points come from completed enrollment steps and never replace an outstanding required action.</p>
                </div>
                <div className="points-balance-details">
                  <div><span>Bookstore credit</span><strong>{formatTenantMoney(identity.data.rewards.bookstoreCreditCents, tenant)}</strong></div>
                  <div><span>Point program</span><strong>{identity.data.rewards.pointName}</strong></div>
                </div>
                <Link className="secondary-button points-balance-link" href="/enrollment#momentum">See how points work <StudentPortalIcon name="chevron" size={14} /></Link>
              </section>
            </details>
          ) : null}
          {!delegateActor || delegateActor.scopes.includes("messages") ? (
            <StudentNotificationCenter
              fallbackUnreadCount={identity.data.unreadMessageCount}
              suppressTransient={experienceUpdates.length > 0}
            />
          ) : null}
          {(!delegateActor || delegateActor.scopes.includes("profile")) ? <Link
            className="aster-student"
            href="/profile"
            aria-label={`Open profile for ${identity.data.student.fullName}`}
          >
            <span aria-hidden="true">
              {initials(identity.data.student.fullName)}
            </span>
            <div>
              <strong>{identity.data.student.preferredName}</strong>
                <small>{delegateActor ? relationshipLabel(delegateActor.relationship) : "Student"}</small>
            </div>
          </Link> : (
            <div className="aster-student" aria-label={`Viewing ${identity.data.student.fullName}`}>
              <span aria-hidden="true">{initials(identity.data.student.fullName)}</span>
              <div><strong>{identity.data.student.preferredName}</strong><small>{relationshipLabel(delegateActor!.relationship)}</small></div>
            </div>
          )}
        </div>
      </header>

      {delegateActor ? (
        <section className="delegate-session-banner" aria-label="Delegated portal session">
          <span aria-hidden="true">◆</span>
          <div>
            <strong>
              Viewing {delegateActor.studentName} as {relationshipLabel(delegateActor.relationship)}
            </strong>
            <small>
              You can use only the pages the student shared. FERPA settings remain student-controlled.
            </small>
          </div>
          <button
            type="button"
            disabled={delegateSignOut.status === "loading"}
            onClick={() => {
              void delegateSignOut.run().then(() => {
                window.location.replace(tenantRuntime.href("/sign-in"));
              }).catch(() => undefined);
            }}
          >
            {delegateSignOut.status === "loading" ? "Signing out…" : "End delegated session"}
          </button>
        </section>
      ) : null}

      {menuOpen ? (
        <button
          className="aster-nav-backdrop nav-scrim"
          type="button"
          aria-label="Close portal menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        ref={navigationPanel}
        id="portal-navigation"
        className={`aster-sidebar sidebar${menuOpen ? " aster-sidebar--open sidebar-open" : ""}`}
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen ? "true" : undefined}
        aria-label={menuOpen ? "Student portal navigation" : undefined}
      >
        <div className="aster-sidebar__brand-row brand-row">
          <Link
            className="aster-brand"
            href={portalHome}
            aria-label={`${tenant.name} student portal`}
            onClick={() => setMenuOpen(false)}
          >
            <span className="brand-mark" aria-hidden="true">
              <img className="audentra-a-mark" src="/a-mark-only.png" width="40" height="40" alt="" />
            </span>
            <span className="brand-name">
              <strong>{tenant.shortName}</strong>
              <span>New Student Portal</span>
            </span>
          </Link>
          <button
            className="aster-sidebar__close nav-close icon-button compact"
            type="button"
            aria-label="Close portal menu"
            onClick={() => setMenuOpen(false)}
          >
            <StudentPortalIcon name="close" size={19} />
          </button>
        </div>
        <nav className="main-nav" aria-label="Student portal sections">
          <div className="aster-nav-group aster-nav-group--primary nav-list">
            {primaryNavigation.map((item) => (
              <Link
                className={`nav-item${active === item.key ? " aster-nav-link--active active" : ""}`}
                href={item.href}
                aria-current={active === item.key ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                key={item.key}
              >
                <span className="nav-icon" aria-hidden="true"><StudentPortalIcon name={item.icon} /></span>
                <span className="nav-label">{item.label}</span>
              </Link>
            ))}
          </div>
          {navigationGroups.map((group) => {
            const items = visibleNavigation.filter((item) => item.group === group.id);
            if (items.length === 0) return null;
            const holdsActive = items.some((item) => item.key === active);
            const groupOpen = Boolean(openNavigationGroups[group.id] || holdsActive);
            return (
              <section className="aster-nav-group nav-group" key={group.id}>
                <button
                  className={`nav-group-toggle${holdsActive ? " holds-active" : ""}`}
                  type="button"
                  aria-expanded={groupOpen}
                  aria-controls={`portal-nav-group-${group.id}`}
                  onClick={() =>
                    setOpenNavigationGroups((current) => ({
                      ...current,
                      [group.id]: !current[group.id],
                    }))
                  }
                >
                  <span>{group.label}</span>
                  <span className={`group-chevron${groupOpen ? " open" : ""}`}>
                    <StudentPortalIcon name="chevron" size={14} />
                  </span>
                </button>
                <div className="nav-sublist" id={`portal-nav-group-${group.id}`} hidden={!groupOpen}>
                  {items.map((item) => (
                    <Link
                      className={`nav-item${active === item.key ? " aster-nav-link--active active" : ""}`}
                      href={item.href}
                      aria-current={active === item.key ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      key={item.key}
                    >
                      <span className="nav-icon" aria-hidden="true"><StudentPortalIcon name={item.icon} /></span>
                      <span className="nav-label">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
          {afterGroupNavigation.length > 0 ? (
            <div className="nav-list aster-nav-after-groups">
              {afterGroupNavigation.map((item) => (
                <Link
                  className={`nav-item${active === item.key ? " aster-nav-link--active active" : ""}`}
                  href={item.href}
                  aria-current={active === item.key ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  key={item.key}
                >
                  <span className="nav-icon" aria-hidden="true"><StudentPortalIcon name={item.icon} /></span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </nav>
        <div className="aster-sidebar__bottom sidebar-bottom">
          {(!delegateActor || delegateActor.scopes.includes("help") || delegateActor.scopes.includes("appointments")) ? <div className="aster-sidebar__support">
            <span aria-hidden="true"><StudentPortalIcon name="help" size={17} /></span>
            <div>
              <strong>Your student support team</strong>
              <p>
                {advisorContact.hours || `${tenant.shortName} advisors are available to help.`}
              </p>
              <div className="aster-sidebar__support-links">
                {!delegateActor || delegateActor.scopes.includes("help")
                  ? advisorContact.email
                    ? <a href={`mailto:${advisorContact.email}`}>{advisorContact.email}</a>
                    : advisorContact.url
                      ? <a href={tenantRuntime.href(advisorContact.url)}>{advisorContact.label}</a>
                      : null
                  : null}
                {!delegateActor || delegateActor.scopes.includes("appointments") ? (
                  <Link href="/appointments">Book an advisor</Link>
                ) : null}
              </div>
            </div>
          </div> : null}
          <div className="aster-sidebar__utilities">
            {utilityNavigation.map((item) => (
              <Link
            className={`${item.key === "profile" ? "profile-chip" : "nav-item"}${active === item.key ? " aster-nav-link--active active" : ""}`}
                href={item.href}
                aria-current={active === item.key ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                key={item.key}
              >
                {item.key === "profile" ? (
                  <img
                    className="avatar avatar-md"
                    src="/people/maya-johnson.webp"
                    width="40"
                    height="40"
                    alt=""
                  />
                ) : (
                  <span aria-hidden="true"><StudentPortalIcon name={item.icon} /></span>
                )}
                <span className={item.key === "profile" ? "profile-name" : undefined}>
                  <strong>{item.key === "profile" ? identity.data.student.preferredName : item.label}</strong>
                  {item.key === "profile" ? <span>{delegateActor ? relationshipLabel(delegateActor.relationship) : "Student"}</span> : null}
                </span>
                {item.key === "profile" ? <span className="chip-chevron" aria-hidden="true"><StudentPortalIcon name="chevron" size={16} /></span> : null}
              </Link>
            ))}
          </div>
          <p className="aster-powered-by powered-by">
            <span>Powered by</span>
            <span className="audentra-powered-logo" aria-hidden="true">
              <img src="/main-logo.png" width="84" height="84" alt="" />
            </span>
          </p>
        </div>
      </aside>

      <main id="main-content" className="aster-main content-wrap">
        <header className="aster-page-heading page-hero">
          <div className="aster-page-heading__copy hero-copy">
            <p className="eyebrow">{tenantRuntime.copy(eyebrow)}</p>
            <h1>{tenantRuntime.copy(presentedTitle)}</h1>
            <p className="hero-lede">{tenantRuntime.copy(presentedDescription)}</p>
          </div>
          <div className="aster-page-heading__figure hero-motif" aria-hidden="true">
            <i className="aster-orbit-ring aster-orbit-ring--outer orbit-ring ring-one" />
            <i className="aster-orbit-ring aster-orbit-ring--inner orbit-ring ring-two" />
            <span className="orbit-core"><StudentPortalIcon name={activeNavigationItem?.icon ?? "home"} size={30} /></span>
            <b className="aster-orbit-dot aster-orbit-dot--one spark-dot one" />
            <b className="aster-orbit-dot aster-orbit-dot--two spark-dot two" />
            <b className="aster-orbit-dot aster-orbit-dot--three spark-dot three" />
          </div>
          {actions ? <div className="aster-page-actions">{actions}</div> : null}
        </header>
        {activeAllowed ? children : (
          <section className="delegate-restricted-state" role="alert">
            <span aria-hidden="true">◇</span>
            <p className="eyebrow">Restricted page</p>
            <h2>This page is not shared</h2>
            <p>
              {delegateActor?.studentName || "The student"} has not granted this
              section to your delegated session. FERPA access can only be changed by the student.
            </p>
            <Link className="button button--primary" href={portalHome}>
              Open an available page
            </Link>
          </section>
        )}
        <footer className="aster-footer">
          <p>© {new Date().getFullYear()} {tenant.legalName}</p>
          <nav aria-label="Portal policies">
            {publicFooterLinks.map((link) =>
              link.href.startsWith("/") && !link.href.startsWith("//") ? (
                <Link href={link.href} key={link.label}>{link.label}</Link>
              ) : (
                <a href={link.href} key={link.label}>{link.label}</a>
              ),
            )}
            {!delegateActor || delegateActor.scopes.includes("help") ? (
              <Link href="/help">Student support</Link>
            ) : null}
          </nav>
        </footer>
      </main>
      </section>

      {active !== "edward" && tenant.capabilities.assistant !== false &&
      (!delegateActor || delegateActor.scopes.includes("edward")) ? (
        <EdwardAssistant
          studentName={identity.data.student.preferredName}
          variant="floating"
          allowLiveVoice={!delegateActor}
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

      {experienceUpdates.length === 0 && identity.data.rewards && !delegateActor ? (
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
