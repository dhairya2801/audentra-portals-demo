"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { getStudentBootstrap } from "../lib/api-client";
import { useApiResource } from "../hooks/use-api-resource";
import { PortalMark } from "./portal-ui";
import { ErrorState, LoadingState } from "./portal-ui";

type PortalSection =
  | "dashboard"
  | "enrollment"
  | "documents"
  | "messages"
  | "appointments"
  | "payments"
  | "profile"
  | "help";

const primaryNavigation: {
  key: PortalSection;
  label: string;
  shortLabel: string;
  href: string;
  symbol: string;
}[] = [
  {
    key: "dashboard",
    label: "Overview",
    shortLabel: "Home",
    href: "/dashboard",
    symbol: "⌂",
  },
  {
    key: "enrollment",
    label: "Enrollment",
    shortLabel: "Enroll",
    href: "/enrollment",
    symbol: "✓",
  },
  {
    key: "documents",
    label: "Documents",
    shortLabel: "Docs",
    href: "/documents",
    symbol: "□",
  },
  {
    key: "messages",
    label: "Messages",
    shortLabel: "Inbox",
    href: "/messages",
    symbol: "✉",
  },
  {
    key: "help",
    label: "Help",
    shortLabel: "Help",
    href: "/help",
    symbol: "?",
  },
];

const utilityNavigation: { key: PortalSection; label: string; href: string }[] = [
  { key: "appointments", label: "Appointments", href: "/appointments" },
  { key: "payments", label: "Payments", href: "/payments" },
  { key: "profile", label: "Profile", href: "/profile" },
];

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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
  const loadBootstrap = useCallback(
    (signal: AbortSignal) => getStudentBootstrap(signal),
    [],
  );
  const identity = useApiResource(loadBootstrap);
  const needsOnboarding =
    identity.data?.onboarding.required &&
    identity.data.onboarding.status !== "completed";
  const needsSignIn =
    identity.status === "error" &&
    (identity.errorStatus === 401 || identity.errorStatus === 403);

  useEffect(() => {
    if (needsSignIn) {
      window.location.replace("/sign-in");
    } else if (needsOnboarding) {
      window.location.replace("/onboarding");
    }
  }, [needsOnboarding, needsSignIn]);

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
    <div className="portal-shell portal-shell--resource">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header resource-header">
        <div className="header-inner resource-header__inner">
          <Link
            className="brand"
            href="/dashboard"
            aria-label="Aster University portal home"
          >
            <PortalMark />
            <span>
              <strong>Aster</strong>
              <small>University</small>
            </span>
          </Link>
          <nav className="primary-nav resource-primary-nav" aria-label="Student portal">
            {primaryNavigation.slice(0, 4).map((item) => (
              <Link
                className={active === item.key ? "primary-nav__active" : undefined}
                href={item.href}
                aria-current={active === item.key ? "page" : undefined}
                key={item.key}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-utilities">
            <nav aria-label="Student services">
              {utilityNavigation.map((item) => (
                <Link
                  className={active === item.key ? "utility-link--active" : undefined}
                  href={item.href}
                  aria-current={active === item.key ? "page" : undefined}
                  key={item.key}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                className={active === "help" ? "utility-link--active" : undefined}
                href="/help"
                aria-current={active === "help" ? "page" : undefined}
              >
                Help
              </Link>
            </nav>
            <Link
              className="student-menu"
              href="/profile"
              aria-label={
                `Open profile for ${identity.data.student.fullName}`
              }
            >
              <span className="student-avatar" aria-hidden="true">
                {initials(identity.data.student.fullName)}
              </span>
              <span className="student-menu__name">
                {identity.data.student.preferredName}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="resource-main">
        <header className="resource-title">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {actions ? <div className="resource-title__actions">{actions}</div> : null}
        </header>
        {children}
      </main>

      <nav className="mobile-nav" aria-label="Mobile student portal">
        {primaryNavigation.map((item) => (
          <Link
            className={active === item.key ? "mobile-nav__active" : undefined}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            key={item.key}
          >
            <span aria-hidden="true">{item.symbol}</span>
            {item.shortLabel}
          </Link>
        ))}
      </nav>

      <footer className="site-footer resource-footer">
        <p>© {new Date().getFullYear()} Aster University</p>
        <nav aria-label="Portal policies">
          <Link href="/help">Privacy & accessibility</Link>
          <Link href="/help">Student support</Link>
        </nav>
      </footer>
    </div>
  );
}
