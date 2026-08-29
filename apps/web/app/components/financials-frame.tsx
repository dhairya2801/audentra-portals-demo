"use client";

import type { FinancialDocumentRequirement, StudentFinancials } from "@vv/contracts";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import Icon from "../design-system/Icon.jsx";
import { InfoTip } from "../design-system/primitives/Tooltip.jsx";
import ActionBand from "../design-system/patterns/ActionBand.jsx";
import AdvisorBar from "../design-system/patterns/AdvisorBar.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import SummaryFigure from "../design-system/patterns/SummaryFigure.jsx";
import { GROUPS, groupLeaves } from "../design-lib/navigation.js";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentFinancials } from "../lib/api-client";
import { officeAdvisor } from "./office-contact";
import { PortalShell, type PortalSection } from "./portal-shell";
import { TenantLink as Link } from "./tenant-link";
import { useTenant } from "./tenant-provider";
import {
  buildLedger,
  daysUntil,
  deadlineLabel,
  escalation,
  financialTerms,
  moneyFor,
  documentHref,
  shortDate,
  urgentDocument,
  type Ledger,
} from "./financials-logic";

export type FinancialsLeaf = "financials-overview" | "financials-aid" | "financials-payments";

const SECTION_OF: Record<FinancialsLeaf, PortalSection> = {
  "financials-overview": "financials",
  "financials-aid": "financial_aid",
  "financials-payments": "payments",
};

/** One financials record per page — the same hook, so the leaves cannot disagree. */
export function useFinancials() {
  return useApiResource(useCallback((signal: AbortSignal) => getStudentFinancials(signal), []));
}

/**
 * The reference's `TermTip`: a dictionary lookup in front of `InfoTip`. The
 * bubble, the hover, the tap and the keyboard are the design system's.
 */
export function TermTip({ term, label }: { term: string; label?: string }) {
  const { copy } = useTenant();
  const entry = financialTerms[term];
  if (!entry) return null;
  return (
    <InfoTip title={entry.title} label={`What ${label ?? entry.title} means`}>
      {copy(entry.body)}
    </InfoTip>
  );
}

/**
 * The reference's `GroupTabs`, drawn with tenant-aware links so a delegate
 * session keeps its prefix. Same DOM, same classes, same labels and glyphs —
 * they come from the vendored navigation model.
 */
export function FinancialsTabs({ activeId }: { activeId: FinancialsLeaf }) {
  const leaves = groupLeaves("financials");
  if (leaves.length < 2) return null;
  return (
    <nav className="group-tabs" aria-label={`${GROUPS.financials} sections`}>
      {leaves.map((leaf) => {
        const active = leaf.id === activeId;
        return (
          <Link
            key={leaf.id}
            className={active ? "active" : undefined}
            href={leaf.route}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={leaf.icon} size={16} />
            {leaf.tab ?? leaf.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BalanceStrip({ data, ledger }: { data: StudentFinancials; ledger: Ledger }) {
  const runtime = useTenant();
  const { tenant, copy } = runtime;
  const router = useRouter();
  const money = moneyFor(tenant);
  const contact = tenant.contacts.financialAid ?? tenant.contacts.support;
  // The counselor who packages this student's aid, on the office contact the
  // institution published — `components/office-contact.ts`.
  const advisor = officeAdvisor("financialAid", contact, "Your financial aid contact");

  const onContact = (channel: "email" | "message") => {
    if (channel === "email" && contact.email) {
      window.location.href = `mailto:${contact.email}`;
      return;
    }
    router.push(runtime.href(channel === "email" ? "/help" : "/messages"));
  };

  return (
    <>
      <SummaryFigure
        money
        label="Estimated remaining balance"
        explain={{ title: financialTerms.balance.title, body: copy(financialTerms.balance.body) }}
        figure={
          <span className="balance-figure">
            {money.format(ledger.balance)}
            <span className="estimate-chip">Estimate</span>
          </span>
        }
      >
        {ledger.hasPending
          ? `This is an estimate for ${data.academicYear}. It can go down, never up.`
          : copy(`Your package is final. This can still change if your housing or meal plan does. ${data.academicYear} academic year.`)}
      </SummaryFigure>

      {advisor ? <AdvisorBar advisor={advisor} onContact={onContact} /> : null}
    </>
  );
}

function bandFor(
  urgent: FinancialDocumentRequirement | null,
  ledger: Ledger,
  open: (document: FinancialDocumentRequirement) => void,
  pay: () => void,
  dateOf: (value: string) => string,
) {
  if (urgent) {
    const daysLeft = urgent.dueAt ? daysUntil(urgent.dueAt) : null;
    const level = escalation(daysLeft);
    return {
      icon: level === "urgent" ? "alert" : "clock",
      label: `${urgent.title} · ${deadlineLabel(daysLeft).toLowerCase()}`,
      action: { label: "Open it", onClick: () => open(urgent) },
    };
  }
  if (ledger.nextPayment) {
    return {
      icon: "calendar",
      label: `Your ${ledger.nextPayment.label.toLowerCase()} is due ${dateOf(ledger.nextPayment.dueAt)}`,
      action: { label: "Make a payment", icon: "arrow", onClick: pay },
    };
  }
  return null;
}

/**
 * The frame the three My Financials leaves share — the reference's
 * `FinancialsPage`. Everything above the tab row is written once, here: the
 * balance, the person who owns it, the most urgent document (or the next
 * payment) in the band, and the tab row. A leaf supplies only its body and rail.
 */
export function FinancialsFrame({
  leaf,
  data,
  ledger,
  rail,
  children,
}: {
  leaf: FinancialsLeaf;
  data: StudentFinancials;
  ledger: Ledger;
  rail?: ReactNode;
  children: ReactNode;
}) {
  const runtime = useTenant();
  const router = useRouter();
  const urgent = useMemo(() => urgentDocument(data.requiredDocuments), [data.requiredDocuments]);
  const band = bandFor(
    urgent,
    ledger,
    (document) => router.push(runtime.href(documentHref(document))),
    () => router.push(runtime.href("/payments")),
    (value) => shortDate(value, runtime.tenant),
  );

  return (
    <PortalShell
      active={SECTION_OF[leaf]}
      summaryLabel="Your balance"
      summary={<BalanceStrip data={data} ledger={ledger} />}
      notice={band ? <ActionBand icon={band.icon} label={band.label} action={band.action} /> : null}
      tabs={<FinancialsTabs activeId={leaf} />}
      rail={rail}
    >
      {children}
    </PortalShell>
  );
}

/** The frame while the record is loading or failed — the reference's skeleton and error shapes. */
export function FinancialsPending({
  leaf,
  status,
  label,
  onRetry,
}: {
  leaf: FinancialsLeaf;
  status: "loading" | "error";
  label: string;
  onRetry: () => void;
}) {
  return (
    <PortalShell active={SECTION_OF[leaf]}>
      {status === "loading" ? <PageSkeleton label={label} /> : <PageError label={label} onRetry={onRetry} />}
    </PortalShell>
  );
}

export { buildLedger };
