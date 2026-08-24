"use client";

import type { ReactNode } from "react";
import PageHero from "../design-system/patterns/PageHero.jsx";
import { heroFor } from "../design-lib/navigation.js";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";

export type HeroCopy = {
  flag?: string | null;
  kicker?: string;
  title?: string;
  lede?: string;
  motif?: string | null;
  figure?: ReactNode;
};

/**
 * The frame every page inherits — the reference's `PageShell`, with the
 * institution's own footer in place of the sample experience's line. Four
 * slots, always in this sequence: hero, summary (with the notice docked in
 * its foot), notice on its own when there is no summary, tabs, then the body
 * and its rail.
 */
export function PageShell({
  destination,
  hero,
  tabs,
  summary,
  summaryLabel,
  notice,
  rail,
  footerLinks = [],
  children,
}: {
  destination: unknown;
  hero?: HeroCopy;
  tabs?: ReactNode;
  summary?: ReactNode;
  summaryLabel?: string;
  notice?: ReactNode;
  rail?: ReactNode;
  footerLinks?: { label: string; href: string }[];
  children: ReactNode;
}) {
  const runtime = useTenant();
  const merged = { ...heroFor(destination), ...hero } as HeroCopy;
  const copy = (value?: string) => (value ? runtime.copy(value) : value);

  return (
    <>
      <PageHero
        flag={copy(merged.flag ?? undefined)}
        kicker={copy(merged.kicker)}
        title={copy(merged.title)}
        lede={copy(merged.lede)}
        motif={merged.motif}
        figure={merged.figure}
      />

      {summary && (
        <section className="page-summary" aria-label={summaryLabel}>
          <div className="summary-main">{summary}</div>
          {notice && <div className="summary-alert">{notice}</div>}
        </section>
      )}

      {notice && !summary ? <div className="page-notice">{notice}</div> : null}
      {tabs}

      {rail ? (
        <div className="page-body">
          <div className="page-main">{children}</div>
          <aside className="page-rail">{rail}</aside>
        </div>
      ) : (
        children
      )}

      <footer>
        <span>
          © {new Date().getFullYear()} {runtime.tenant.legalName}
        </span>
        <span>
          {footerLinks.map((link) =>
            link.href.startsWith("/") && !link.href.startsWith("//") ? (
              <Link href={link.href} key={link.label}>
                {link.label}
              </Link>
            ) : (
              <a href={link.href} key={link.label}>
                {link.label}
              </a>
            ),
          )}
        </span>
      </footer>
    </>
  );
}
