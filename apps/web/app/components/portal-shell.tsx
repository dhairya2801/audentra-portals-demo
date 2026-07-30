"use client";

import { useCallback, useEffect, useState } from "react";
import { useActivityTracking } from "../hooks/use-activity-tracking";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentBootstrap } from "../lib/api-client";
import { EdwardAssistant } from "./edward-assistant";
import { ErrorState, LoadingState, PortalMark } from "./portal-ui";
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
  const { track } = useActivityTracking();
  const loadBootstrap = useCallback(
    (signal: AbortSignal) => getStudentBootstrap(signal),
    [],
  );
  const identity = useApiResource(loadBootstrap);
  const reloadIdentity = identity.reload;
  const needsOnboarding =
    identity.data?.onboarding.required &&
    identity.data.onboarding.status !== "completed";
  const needsSignIn =
    identity.status === "error" &&
    (identity.errorStatus === 401 || identity.errorStatus === 403);

  useEffect(() => {
    if (needsSignIn) {
      window.location.replace(tenantRuntime.href("/sign-in"));
    } else if (needsOnboarding) {
      window.location.replace(tenantRuntime.href("/onboarding"));
    }
  }, [needsOnboarding, needsSignIn, tenantRuntime]);

  useEffect(() => {
    track("ui.portal_section_viewed.v1", {
      section: active,
      entry_point: "portal_navigation",
    });
  }, [active, track]);

  useEffect(() => {
    const refreshStudentRecord = () => reloadIdentity();
    window.addEventListener(
      "vv:student-record-changed",
      refreshStudentRecord,
    );
    return () =>
      window.removeEventListener(
        "vv:student-record-changed",
        refreshStudentRecord,
      );
  }, [reloadIdentity]);

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
    </div>
  );
}
