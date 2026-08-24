import type {
  FinancialAward,
  FinancialDocumentRequirement,
  FinancialPaymentScheduleItem,
  StudentFinancials,
  StudentPayment,
} from "@vv/contracts";
import { safePortalDestination } from "../lib/safe-destination";
import { formatTenantDate, formatTenantMoney, type TenantConfig } from "../lib/tenant";

/**
 * The reference's `features/financials/logic.js`, read against the production
 * `StudentFinancials` contract. Every figure the three leaves print comes from
 * here, so the ledger, the schedule and the rail cannot disagree.
 */

/** Whole dollars when the amount is whole, cents only when they are real. */
export function moneyFor(tenant: TenantConfig) {
  const whole = new Intl.NumberFormat(tenant.localization.locale, {
    style: "currency",
    currency: tenant.localization.currencyCode,
    maximumFractionDigits: 0,
  });
  const format = (cents: number) =>
    cents % 100 === 0 ? whole.format(cents / 100) : formatTenantMoney(cents, tenant);
  /** Ledger credits read as −$33,600 rather than -$33,600. */
  const credit = (cents: number) =>
    cents === 0 ? format(0) : `−${format(Math.abs(cents))}`;
  return { format, credit };
}

/** 'Aug 12' — the way the reference schedule writes a date. */
export function shortDate(value: string, tenant: TenantConfig) {
  return formatTenantDate(value, tenant, { month: "short", day: "numeric" });
}

const DOCUMENTS_SECTION = "/profile?section=documents";

/**
 * Where a financial document request opens. The backend names a destination;
 * it is read through the same guard every stored link passes, and when the
 * request already carries the document it opens that row of My Documents.
 */
export function documentHref(document: FinancialDocumentRequirement) {
  const documentId = document.documentId;
  const withDocument = (base: string) =>
    documentId ? `${base}${base.includes("?") ? "&" : "?"}document=${encodeURIComponent(documentId)}` : base;
  const destination = safePortalDestination(document.href, withDocument(DOCUMENTS_SECTION));
  if (
    !destination.external &&
    (destination.href === "/documents" || destination.href === DOCUMENTS_SECTION)
  ) {
    return withDocument(destination.href);
  }
  return destination.href;
}

export function daysUntil(value: string, today = new Date()) {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(value);
  const to = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

const ESCALATION_WINDOW = 14;

/** How hard a deadline is pushed on screen. ENR-160 AC 6. */
export function escalation(daysLeft: number | null): "urgent" | "soon" | null {
  if (daysLeft === null) return null;
  if (daysLeft <= ESCALATION_WINDOW) return "urgent";
  if (daysLeft <= 30) return "soon";
  return null;
}

export function deadlineLabel(daysLeft: number | null) {
  if (daysLeft === null) return "No due date";
  if (daysLeft <= 0) return "Overdue";
  if (daysLeft === 1) return "Due tomorrow";
  return `Due in ${daysLeft} days`;
}

/** Reads a percentage for a bar without ever dividing by zero. */
export function share(amount: number, whole: number) {
  if (!whole) return 0;
  return Math.max(0, Math.min(100, (amount / whole) * 100));
}

export type ScheduleRow = {
  id: string;
  kind: "deposit" | "installment";
  label: string;
  dueAt: string;
  amountCents: number;
  status: "received" | "due" | "scheduled";
  projected: boolean;
};

export type CoverageSegment = { key: "aid" | "paid" | "open"; label: string; amount: number };

export type Ledger = {
  cost: number;
  aidAccepted: number;
  paid: number;
  balance: number;
  additionalTotal: number;
  pending: FinancialAward[];
  hasPending: boolean;
  schedule: ScheduleRow[];
  deposit: ScheduleRow | null;
  installmentCount: number;
  installmentTotal: number;
  nextInstallmentIndex: number;
  nextPayment: ScheduleRow | null;
  scheduleTotal: number;
  enrolledPlan: StudentFinancials["paymentPlans"][number] | null;
  coverage: CoverageSegment[];
};

function rowOf(item: FinancialPaymentScheduleItem): ScheduleRow {
  return {
    id: item.id,
    kind: item.kind,
    label: item.label,
    dueAt: item.dueAt,
    amountCents: item.amountCents,
    status: item.status === "paid" ? "received" : item.status === "due" ? "due" : "scheduled",
    projected: item.projected,
  };
}

/**
 * Build the ledger from the financials record. A recorded deposit payment
 * (the payments API) marks the schedule's deposit row received even when the
 * financial projection has not caught up yet.
 */
export function buildLedger(data: StudentFinancials, payments: StudentPayment[] = []): Ledger {
  const pending = data.awards.filter((award) => award.status === "pending" || award.status === "offered");
  const depositPaid = payments.some((payment) => payment.status === "succeeded");

  const schedule = (data.paymentSchedule ?? []).map(rowOf).map((row) =>
    row.kind === "deposit" && depositPaid ? { ...row, status: "received" as const } : row,
  );
  const upcoming = schedule.filter((row) => row.status !== "received");
  const deposit = schedule.find((row) => row.kind === "deposit") ?? null;
  const installments = schedule.filter((row) => row.kind === "installment");
  const openInstallments = installments.filter((row) => row.status !== "received");

  const coverage: CoverageSegment[] = [
    { key: "aid", label: "Aid accepted", amount: data.acceptedAidCents },
    { key: "paid", label: "You’ve paid", amount: data.paymentsCents },
    { key: "open", label: "Estimated remaining balance", amount: data.remainingBalanceCents },
  ].filter((segment) => segment.amount > 0) as CoverageSegment[];

  return {
    cost: data.costOfAttendanceCents,
    aidAccepted: data.acceptedAidCents,
    paid: data.paymentsCents,
    balance: data.remainingBalanceCents,
    additionalTotal: data.pendingAidCents,
    pending,
    hasPending: pending.length > 0,
    schedule,
    deposit,
    installmentCount: installments.length,
    installmentTotal: installments.reduce((sum, row) => sum + row.amountCents, 0),
    nextInstallmentIndex: installments.length - openInstallments.length,
    nextPayment: upcoming[0] ?? null,
    scheduleTotal: schedule.reduce((sum, row) => sum + row.amountCents, 0),
    enrolledPlan: data.paymentPlans.find((plan) => plan.status === "enrolled") ?? null,
    coverage,
  };
}

const OUTSTANDING = new Set<FinancialDocumentRequirement["status"]>(["not_started", "action_required"]);

export function isOutstanding(document: FinancialDocumentRequirement) {
  return OUTSTANDING.has(document.status);
}

/** The nearest outstanding document by due date; undated ones come last. */
export function urgentDocument(documents: FinancialDocumentRequirement[]) {
  return (
    [...documents]
      .filter(isOutstanding)
      .sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity))[0] ??
    null
  );
}

/**
 * Financial vocabulary, explained where it appears rather than assumed —
 * ENR-159 AC 5. Copy is the reference's; `{institution}` is the tenant's.
 */
export const financialTerms: Record<string, { title: string; body: string }> = {
  coa: {
    title: "Cost of attendance",
    body: "Everything the year is expected to cost: tuition and fees, plus housing, meals, books, and travel. It’s a planning figure, not a bill. {institution} only charges you for part of it.",
  },
  aid: {
    title: "Financial aid",
    body: "Money that lowers what you owe. Grants and scholarships are not repaid. Loans are. Each source below says which it is.",
  },
  balance: {
    title: "Estimated remaining balance",
    body: "What is left after the aid you have accepted and the payments {institution} has recorded. It is an estimate: it changes when aid is finalized, when your housing or meal plan changes, or after verification.",
  },
  estimate: {
    title: "Why this is an estimate",
    body: "{institution} has not finished confirming every figure. Estimates can change after verification, after your housing choice, and after your aid package is final.",
  },
  plan: {
    title: "Payment plan",
    body: "Instead of paying each term’s bill at once, what {institution} bills you is split into installments. A plan may carry an enrollment fee for the year, and the total does not otherwise change.",
  },
  schedule: {
    title: "How installments are worked out",
    body: "{institution} divides what it bills you, minus your accepted aid, across the payments left in the year. If your aid changes, every remaining installment is recalculated.",
  },
  gpa: {
    title: "Grade point average",
    body: "The average of your grades so far, on a four-point scale. {institution} sets a minimum to keep federal aid.",
  },
  pace: {
    title: "Completion pace",
    body: "The share of the credits you signed up for that you actually finished. Dropping a class after the deadline lowers it.",
  },
  credits: {
    title: "Attempted credits",
    body: "Every credit you have signed up for, including ones you dropped or repeated. Federal aid stops once you pass the maximum for your degree.",
  },
  progress: {
    title: "Academic progress",
    body: "A check {institution} runs at the end of each term to confirm you are moving through your degree. It decides whether your federal aid continues.",
  },
};

export const AWARD_KIND: Record<FinancialAward["type"], string> = {
  grant: "Grant · never repaid",
  scholarship: "Scholarship · never repaid",
  loan: "Loan · you repay it after you leave {institution}",
  work_study: "Work-study · earned by working",
};

export const AWARD_SOURCE: Record<FinancialAward["source"], string> = {
  federal: "Federal aid",
  state: "State aid",
  institutional: "{institutionName}",
  private: "Private source",
};

export const AWARD_STATUS: Record<FinancialAward["status"], string> = {
  accepted: "Accepted",
  pending: "Pending",
  offered: "Offered",
  declined: "Declined",
};
