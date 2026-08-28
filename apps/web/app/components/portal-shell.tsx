"use client";

import type {
  FerpaPortalScope,
  StudentExperienceUpdate,
  StudentMessage,
  StudentRequirementDetail,
} from "@vv/contracts";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  decideStudentExperienceUpdate,
  deferStudentExperienceUpdates,
  getStudentBootstrap,
  getStudentMessages,
  getStudentRequirements,
  markStudentMessageRead,
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
import { connectStudentRealtime } from "./student-realtime";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";
import { isParentPortalPath, parentPortalHref } from "../lib/parent-portal-routes";
import Icon from "../design-system/Icon.jsx";
import Avatar from "../design-system/primitives/Avatar.jsx";
import { IconButton } from "../design-system/primitives/Button.jsx";
import AudentraMark from "../design-system/marks/AudentraMark.jsx";
import Popover from "../design-system/patterns/Popover.jsx";
import {
  NAV,
  PROFILE_ID,
  UTILITY_ID,
  destinationById,
} from "../design-lib/navigation.js";
import { NotificationPanel } from "./notification-panel";
import { PointsInfoModal, PointsPopover } from "./points-popover";
import { PageShell, type HeroCopy } from "./page-shell";

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

/** The production section a page names → the destination the design model knows it as. */
const destinationOf: Partial<Record<PortalSection, string>> = {
  enrollment: "my-enrollment",
  appointments: "appointments",
  classrooms: "my-classrooms",
  health: "health",
  housing: "housing",
  financials: "financials-overview",
  financial_aid: "financials-aid",
  payments: "financials-payments",
  campus_life: "events",
  clubs: "clubs",
  help: "help",
  profile: "profile",
  documents: "profile-documents",
};

/** The delegate scope a section is read under. */
function scopeOf(section: PortalSection): FerpaPortalScope {
  return (section === "financial_aid" ? "financials" : section === "clubs" ? "campus_life" : section) as FerpaPortalScope;
}

const sectionOfDestination: Record<string, PortalSection> = Object.fromEntries(
  Object.entries(destinationOf).map(([section, id]) => [id, section as PortalSection]),
);

const GROUP_STORE = "aster.nav.open";

function readOpenGroups(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(GROUP_STORE);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

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

const terminalStatuses = new Set(["completed", "waived", "not_applicable"]);

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
    <div className="center-modal-wrap experience-update-backdrop" role="presentation">
      <div className="modal-scrim" aria-hidden="true" />
      <section
        ref={dialog}
        className="info-modal experience-update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="experience-update-title"
        aria-describedby="experience-update-description"
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <span className="modal-kicker">
          <Icon name="bell" size={16} />{" "}
          {isBundle ? "Enrollment & onboarding" : experienceKindLabels[primaryUpdate.kind]}
          {" · "}
          {isBundle
            ? `${updates.length} updates together`
            : primaryUpdate.status === "deferred"
              ? "Saved reminder"
              : `An update from ${institutionName}`}
        </span>
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
          <div className="signal-grid experience-update-dialog__list">
            {updates.map((update) => (
              <div key={update.id}>
                <span>{experienceKindLabels[update.kind]}</span>
                <strong>{update.title}</strong>
                <p>{update.description}</p>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void onHandleNow(update)}
                >
                  Handle now <Icon name="arrow" size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="modal-note">
          <Icon name="info" size={18} />
          {isBundle
            ? "Open any update now, or save this set for your next portal visit."
            : "You can take care of this now or save it for your next portal visit."}
        </div>
        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="drawer-actions experience-update-dialog__actions">
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() => void onDefer()}
          >
            {busy ? "Saving…" : "Remind me later"}
          </button>
          {!isBundle ? (
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={() => void onHandleNow(primaryUpdate)}
            >
              {busy ? "Opening…" : "Handle now"} <Icon name="arrow" size={16} />
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** One destination, as a row — the design system's `NavItem`, routed through the tenant. */
function NavRow({
  id,
  activeId,
  count,
  countLabel,
  onNavigate,
}: {
  id: string;
  activeId: string | null;
  count?: number;
  countLabel?: string;
  onNavigate: () => void;
}) {
  const item = destinationById(id);
  if (!item) return null;
  const active = item.id === activeId;
  return (
    <li>
      <Link
        className={`nav-item${active ? " active" : ""}`}
        href={item.route}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
      >
        <span className="nav-icon" aria-hidden="true">
          <Icon name={item.icon} weight={active ? "fill" : "regular"} />
        </span>
        <span className="nav-label">{item.label}</span>
        {count && count > 0 ? (
          <span className="nav-count">
            <span aria-hidden="true">{count}</span>
            <span className="sr-only">{countLabel}</span>
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export function PortalShell({
  active,
  eyebrow,
  title,
  description,
  hero,
  summary,
  summaryLabel,
  notice,
  tabs,
  rail,
  actions,
  children,
}: {
  active: PortalSection;
  /** Legacy hero copy, used only by pages the design model has no destination for. */
  eyebrow?: string;
  title?: string;
  description?: string;
  /** Overrides on top of the destination's own hero copy. */
  hero?: HeroCopy;
  summary?: ReactNode;
  summaryLabel?: string;
  notice?: ReactNode;
  tabs?: ReactNode;
  rail?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const tenantRuntime = useTenant();
  const pathname = usePathname() || "/";
  const { tenant } = tenantRuntime;
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
  const [pointsModal, setPointsModal] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigationPanel = useRef<HTMLElement>(null);
  // Groups closed by default, the one holding the page you are on opened for
  // you, and what she opens after that remembered. The sidebar only renders
  // once the bootstrap has loaded on the client, so storage is readable here.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    typeof window === "undefined" ? {} : readOpenGroups(),
  );
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
  const activeDestinationId = destinationOf[active] ?? null;
  const sidebarActiveId =
    activeDestinationId?.startsWith("profile") ? "profile" : activeDestinationId;
  const canSee = useCallback(
    (destinationId: string) => {
      const section = sectionOfDestination[destinationId];
      if (!section) return false;
      if (section === "campus_life" || section === "clubs") {
        if (tenant.capabilities.campusLife === false) return false;
      }
      if (delegateActor) return delegateActor.scopes.includes(scopeOf(section));
      return true;
    },
    [delegateActor, tenant.capabilities.campusLife],
  );
  const firstVisible = NAV.flatMap((entry: { kind: string; id: string; items?: string[] }) =>
    entry.kind === "link" ? [entry.id] : entry.items ?? [],
  ).find((id: string) => canSee(id));
  const portalHome = firstVisible ? destinationById(firstVisible)!.route : "/help";
  const activeAllowed = !delegateActor || delegateActor.scopes.includes(scopeOf(active));
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

  // The sidebar's counts and the points ledger read the same requirement list
  // My Enrollment renders — never a copy of it.
  const canReadRequirements =
    identity.status === "ready" &&
    !needsOnboarding &&
    !needsSignIn &&
    (!delegateActor || delegateActor.scopes.includes("enrollment"));
  const loadRequirements = useCallback(
    (signal: AbortSignal) =>
      canReadRequirements
        ? getStudentRequirements(signal)
        : Promise.resolve({ items: [] as StudentRequirementDetail[], total: 0 }),
    [canReadRequirements],
  );
  const requirements = useApiResource(loadRequirements);
  const refreshRequirements = requirements.refresh;
  const openSteps =
    requirements.status === "ready"
      ? requirements.data.items.filter(
          (item) => !terminalStatuses.has(item.status) && item.status !== "blocked" && item.status !== "submitted" && item.status !== "under_review",
        ).length
      : null;
  const awarded = useMemo(
    () =>
      requirements.status === "ready"
        ? requirements.data.items.filter((item) => item.reward?.earned)
        : [],
    [requirements.data, requirements.status],
  );

  // What changed — the bell reads the platform's message list.
  const canReadMessages =
    identity.status === "ready" &&
    !needsOnboarding &&
    !needsSignIn &&
    (!delegateActor || delegateActor.scopes.includes("messages"));
  const loadMessages = useCallback(
    (signal: AbortSignal) =>
      canReadMessages
        ? getStudentMessages(signal)
        : Promise.resolve({ items: [] as StudentMessage[], unreadCount: 0 }),
    [canReadMessages],
  );
  const messages = useApiResource(loadMessages);
  const refreshMessages = messages.refresh;
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(() => new Set());
  const isRead = useCallback(
    (message: StudentMessage) => Boolean(message.readAt) || optimisticReadIds.has(message.id),
    [optimisticReadIds],
  );
  const feed = messages.status === "ready" ? messages.data.items : [];
  const unreadMessages = feed.filter((message) => !isRead(message));
  const unreadTotal =
    messages.status === "ready"
      ? unreadMessages.length
      : identity.status === "ready"
        ? identity.data.unreadMessageCount
        : 0;
  const unreadNeedsYou = unreadMessages.some((message) => Boolean(message.href));

  const markRead = useCallback(
    async (message: StudentMessage) => {
      if (message.readAt || optimisticReadIds.has(message.id)) return;
      setOptimisticReadIds((current) => new Set(current).add(message.id));
      try {
        await markStudentMessageRead(message.id);
        refreshMessages();
      } catch {
        setOptimisticReadIds((current) => {
          const next = new Set(current);
          next.delete(message.id);
          return next;
        });
      }
    },
    [optimisticReadIds, refreshMessages],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(GROUP_STORE, JSON.stringify(openGroups));
    } catch {
      // A portal that cannot remember a preference still has to navigate.
    }
  }, [openGroups]);

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
    const refreshAfterStudentAction = () => {
      refreshIdentity();
      refreshRequirements();
    };
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
  }, [refreshIdentity, refreshRequirements]);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") refreshMessages();
    };
    const interval = window.setInterval(poll, 8_000);
    return () => window.clearInterval(interval);
  }, [refreshMessages]);

  useEffect(() => {
    if (
      identity.status !== "ready" ||
      identity.data.actor?.type === "delegate" ||
      needsOnboarding ||
      needsSignIn
    ) return;
    return connectStudentRealtime((event) => {
      refreshIdentity();
      refreshRequirements();
      refreshMessages();
      window.dispatchEvent(
        new CustomEvent("vv:student-realtime", { detail: event }),
      );
    });
  }, [identity.data, identity.status, needsOnboarding, needsSignIn, refreshIdentity, refreshMessages, refreshRequirements]);

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

  const student = identity.data.student;
  const person = { name: student.fullName, initials: initials(student.fullName) };
  const standing = delegateActor ? relationshipLabel(delegateActor.relationship) : "Incoming student";
  const help = destinationById(UTILITY_ID)!;
  const profile = destinationById(PROFILE_ID)!;
  const rewards = !delegateActor ? identity.data.rewards : undefined;
  const destination = activeDestinationId ? destinationById(activeDestinationId) : null;
  const heroCopy: HeroCopy = destination
    ? {
        ...(destination.id === "my-enrollment"
          ? { title: `You’re in, ${student.preferredName}. Here’s what’s left.`, kicker: tenant.name }
          : destination.id === "help"
            ? { title: `Get unstuck, ${student.preferredName}.` }
            : {}),
        ...hero,
      }
    : { kicker: eyebrow, title, lede: description, motif: null, ...hero };

  return (
    <div className="app-shell">
      <a className="skip-to-content" href="#main-content">
        Skip to main content
      </a>

      <aside
        ref={navigationPanel}
        id="portal-navigation"
        className={`sidebar${menuOpen ? " sidebar-open" : ""}`}
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen ? "true" : undefined}
        aria-label="Primary navigation"
      >
        <div className="brand-row">
          <Link
            className="brand-home"
            href="/dashboard"
            aria-label={`${tenant.name} — student home`}
            onClick={() => setMenuOpen(false)}
          >
            <span className="brand-mark" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- the tenant's mark is a plain asset URL */}
              <img
                className="brand-mark-image"
                src={tenant.branding.logoUrl}
                width="40"
                height="40"
                alt=""
              />
            </span>
            <span className="brand-name">
              <strong>{tenant.name}</strong>
              <span>New Student Portal</span>
            </span>
          </Link>
          <IconButton
            className="nav-close"
            name="close"
            size={18}
            label="Close navigation"
            tip="Close"
            onClick={() => setMenuOpen(false)}
          />
        </div>

        <nav className="main-nav" aria-label="Primary">
          <ul className="nav-list">
            {NAV.map((entry: { kind: string; id: string; label?: string; items?: string[] }) => {
              if (entry.kind === "link") {
                if (!canSee(entry.id)) return null;
                return (
                  <NavRow
                    key={entry.id}
                    id={entry.id}
                    activeId={sidebarActiveId}
                    count={entry.id === "my-enrollment" && openSteps ? openSteps : undefined}
                    countLabel={openSteps === 1 ? "1 step still open" : `${openSteps} steps still open`}
                    onNavigate={() => setMenuOpen(false)}
                  />
                );
              }
              const items = (entry.items ?? []).filter(canSee);
              if (items.length === 0) return null;
              const holdsActive = items.includes(sidebarActiveId ?? "");
              // A closed group never hides where the student is: until she
              // toggles it herself, the group holding the page is open.
              const open = openGroups[entry.id] ?? holdsActive;
              const toggleId = `nav-group-${entry.id}`;
              const listId = `nav-group-list-${entry.id}`;
              return (
                <li className="nav-group" key={entry.id}>
                  <button
                    type="button"
                    className={`nav-group-toggle${holdsActive && !open ? " holds-active" : ""}`}
                    id={toggleId}
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() =>
                      setOpenGroups((current) => ({ ...current, [entry.id]: !open }))
                    }
                  >
                    {entry.label}
                    <span className={`group-chevron${open ? " open" : ""}`} aria-hidden="true">
                      <Icon name="chevron" size={14} />
                    </span>
                  </button>
                  <ul className="nav-sublist" id={listId} aria-labelledby={toggleId} hidden={!open}>
                    {items.map((id) => (
                      <NavRow
                        key={id}
                        id={id}
                        activeId={sidebarActiveId}
                        onNavigate={() => setMenuOpen(false)}
                      />
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          {requirements.status === "error" ? (
            <p className="nav-note">
              <Icon name="info" size={14} /> Some counts are unavailable. The sections still open.
            </p>
          ) : null}
        </nav>

        <div className="sidebar-bottom">
          {canSee(help.id) ? (
            <Link
              className={`nav-item${sidebarActiveId === help.id ? " active" : ""}`}
              href={help.route}
              aria-current={sidebarActiveId === help.id ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <span className="nav-icon" aria-hidden="true">
                <Icon name={help.icon} weight={sidebarActiveId === help.id ? "fill" : "regular"} />
              </span>
              <span className="nav-label">{help.label}</span>
            </Link>
          ) : null}
          {canSee(profile.id) ? (
            <Link
              className={`profile-chip${sidebarActiveId === profile.id ? " active" : ""}`}
              href={profile.route}
              aria-current={sidebarActiveId === profile.id ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Avatar person={person} size="md" />
              <span className="profile-name">
                <strong>{student.preferredName}</strong>
                <span>{standing}</span>
              </span>
              <span className="chip-chevron" aria-hidden="true">
                <Icon name="chevron" size={16} />
              </span>
            </Link>
          ) : (
            <div className="profile-chip" aria-label={`Viewing ${student.fullName}`}>
              <Avatar person={person} size="md" />
              <span className="profile-name">
                <strong>{student.preferredName}</strong>
                <span>{standing}</span>
              </span>
            </div>
          )}
          <p className="powered-by">
            Powered by <AudentraMark height={13} /> <strong>Audentra</strong>
          </p>
        </div>
      </aside>

      {menuOpen ? (
        <button
          className="nav-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <section className="workspace">
        <header className="topbar">
          <IconButton
            className="mobile-menu"
            name="menu"
            ref={menuButton}
            label="Open navigation"
            tip="Menu"
            aria-expanded={menuOpen}
            aria-controls="portal-navigation"
            onClick={() => setMenuOpen(true)}
          />
          <div className="topbar-title">
            <span className="mobile-school">{tenant.shortName}</span>
          </div>
          <div className="topbar-actions">
            {actions}
            {rewards ? (
              <Popover
                className="topbar-chip points-chip"
                tip="Your momentum"
                ariaLabel={`Your momentum, ${rewards.lifetimePoints.toLocaleString()} points`}
                panelLabel="Your momentum"
                panelClass="points-pop"
                trigger={
                  <>
                    <Icon name="spark" size={17} />
                    <span className="chip-figure">{rewards.lifetimePoints.toLocaleString()}</span>
                    <span className="chip-unit">pts</span>
                  </>
                }
              >
                {(close: () => void) => (
                  <PointsPopover
                    rewards={rewards}
                    awarded={awarded}
                    awardsState={
                      requirements.status === "ready"
                        ? "ready"
                        : requirements.status === "error"
                          ? "error"
                          : "loading"
                    }
                    onOpenPoints={() => setPointsModal(true)}
                    onClose={close}
                  />
                )}
              </Popover>
            ) : null}

            {canReadMessages ? (
              <Popover
                className="topbar-chip bell-chip"
                tip="What changed"
                ariaLabel={unreadTotal ? `What changed, ${unreadTotal} unread` : "What changed"}
                panelLabel="What changed"
                panelClass="note-pop"
                onOpen={refreshMessages}
                trigger={<Icon name="bell" size={19} weight={unreadTotal ? "fill" : "regular"} />}
                badge={
                  unreadTotal > 0 ? (
                    <span className={`bell-count ${unreadNeedsYou ? "needs-you" : ""}`}>
                      <span aria-hidden="true">{unreadTotal}</span>
                    </span>
                  ) : null
                }
              >
                {(close: () => void) => (
                  <NotificationPanel
                    feed={feed}
                    state={
                      messages.status === "ready"
                        ? "ready"
                        : messages.status === "error"
                          ? "error"
                          : "loading"
                    }
                    isRead={isRead}
                    onOpen={(message) => void markRead(message)}
                    onMarkAll={() => {
                      unreadMessages.forEach((message) => void markRead(message));
                    }}
                    onRetry={messages.reload}
                    onClose={close}
                  />
                )}
              </Popover>
            ) : null}

            <Link className="mobile-avatar" href={profile.route} aria-label="Profile">
              <Avatar person={person} size="sm" />
            </Link>
          </div>
        </header>

        {delegateActor ? (
          <div className="page-notice delegate-session-banner" aria-label="Delegated portal session">
            <div className="notice quiet">
              <span className="notice-mark" aria-hidden="true">
                <Icon name="users" size={16} />
              </span>
              <span className="notice-copy">
                <strong>
                  Viewing {delegateActor.studentName} as {relationshipLabel(delegateActor.relationship)}.
                </strong>{" "}
                You can use only the pages the student shared. FERPA settings remain student-controlled.
              </span>
              <button
                type="button"
                className="notice-action"
                disabled={delegateSignOut.status === "loading"}
                onClick={() => {
                  void delegateSignOut.run().then(() => {
                    window.location.replace(tenantRuntime.href("/sign-in"));
                  }).catch(() => undefined);
                }}
              >
                {delegateSignOut.status === "loading" ? "Signing out…" : "End delegated session"}
              </button>
            </div>
          </div>
        ) : null}

        <main className="content-wrap" id="main-content" tabIndex={-1}>
          <PageShell
            destination={destination}
            hero={heroCopy}
            summary={summary}
            summaryLabel={summaryLabel}
            notice={notice}
            tabs={tabs}
            rail={rail}
            footerLinks={[
              ...publicFooterLinks,
              ...(!delegateActor || delegateActor.scopes.includes("help")
                ? [{ label: "Help", href: "/help" }]
                : []),
            ]}
          >
            {activeAllowed ? children : (
              <div className="state-card error" role="alert">
                <span className="state-mark" aria-hidden="true">
                  <Icon name="lock" size={22} weight="duotone" />
                </span>
                <h3>This page is not shared</h3>
                <p>
                  {delegateActor?.studentName || "The student"} has not granted this section to your
                  delegated session. FERPA access can only be changed by the student.
                </p>
                <Link className="primary-button" href={portalHome}>
                  Open an available page <Icon name="arrow" size={16} />
                </Link>
              </div>
            )}
          </PageShell>
        </main>
      </section>

      {pointsModal && rewards ? (
        <PointsInfoModal rewards={rewards} onClose={() => setPointsModal(false)} />
      ) : null}

      {active !== "edward" && tenant.capabilities.assistant !== false &&
      (!delegateActor || delegateActor.scopes.includes("edward")) ? (
        <EdwardAssistant
          studentName={student.preferredName}
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

      {experienceUpdates.length === 0 && rewards && !delegateActor ? (
        <RewardCelebration
          tenantSlug={tenant.slug}
          studentId={student.id}
          pointName={rewards.pointName}
          lifetimePoints={rewards.lifetimePoints}
        />
      ) : null}
    </div>
  );
}
