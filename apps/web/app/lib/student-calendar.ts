import type {
  CampusEvent,
  StudentDashboard,
  StudentFinancials,
} from "@vv/contracts";
import { studentRequirementSlug } from "@vv/contracts";
import { safePortalDestination } from "./safe-destination";

export type StudentCalendarEntryKind =
  | "enrollment"
  | "campus"
  | "financial"
  | "payment";

export type StudentCalendarEntry = {
  id: string;
  kind: StudentCalendarEntryKind;
  title: string;
  description: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  status?: string | null;
  href: string;
  actionLabel: string;
};

export type StudentCalendarDay = {
  key: string;
  date: Date;
  dayNumber: number;
  inDisplayedMonth: boolean;
  isToday: boolean;
  entries: StudentCalendarEntry[];
};

export type StudentCalendarMonth = {
  key: string;
  label: string;
  days: StudentCalendarDay[];
  entries: StudentCalendarEntry[];
};

type OptionalPaymentScheduleItem = {
  id?: unknown;
  kind?: unknown;
  label?: unknown;
  title?: unknown;
  description?: unknown;
  dueAt?: unknown;
  date?: unknown;
  startsAt?: unknown;
  status?: unknown;
  amountCents?: unknown;
  href?: unknown;
};

const kindPriority: Record<StudentCalendarEntryKind, number> = {
  enrollment: 0,
  financial: 1,
  payment: 2,
  campus: 3,
};

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function utcDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function monthStart(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function shiftCalendarMonth(value: Date, amount: number) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1),
  );
}

export function defaultStudentCalendarMonth(
  entries: readonly StudentCalendarEntry[],
  now = new Date(),
) {
  const currentMonth = monthStart(now);
  const currentKey = `${currentMonth.getUTCFullYear()}-${currentMonth.getUTCMonth()}`;
  const hasCurrentMonthEntry = entries.some((entry) => {
    const entryMonth = monthStart(entry.startsAt);
    return `${entryMonth.getUTCFullYear()}-${entryMonth.getUTCMonth()}` === currentKey;
  });
  if (hasCurrentMonthEntry || entries.length === 0) return currentMonth;

  const nowTime = now.getTime();
  const next = [...entries]
    .filter((entry) => Date.parse(entry.startsAt) >= nowTime)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];
  return next ? monthStart(next.startsAt) : currentMonth;
}

export function buildStudentCalendarMonth(
  entries: readonly StudentCalendarEntry[],
  displayedMonth: Date,
  now = new Date(),
): StudentCalendarMonth {
  const first = monthStart(displayedMonth);
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const todayKey = utcDateKey(now);
  const sortedEntries = [...entries].sort(
    (left, right) =>
      left.startsAt.localeCompare(right.startsAt) ||
      kindPriority[left.kind] - kindPriority[right.kind] ||
      left.title.localeCompare(right.title),
  );
  const entryMap = new Map<string, StudentCalendarEntry[]>();
  for (const entry of sortedEntries) {
    const key = utcDateKey(entry.startsAt);
    entryMap.set(key, [...(entryMap.get(key) ?? []), entry]);
  }

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const key = utcDateKey(date);
    return {
      key,
      date,
      dayNumber: date.getUTCDate(),
      inDisplayedMonth: date.getUTCMonth() === first.getUTCMonth(),
      isToday: key === todayKey,
      entries: entryMap.get(key) ?? [],
    } satisfies StudentCalendarDay;
  });

  const monthEntries = sortedEntries.filter((entry) => {
    const entryDate = new Date(entry.startsAt);
    return (
      entryDate.getUTCFullYear() === first.getUTCFullYear() &&
      entryDate.getUTCMonth() === first.getUTCMonth()
    );
  });

  return {
    key: `${first.getUTCFullYear()}-${first.getUTCMonth() + 1}`,
    label: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(first),
    days,
    entries: monthEntries,
  };
}

function optionalPaymentSchedule(financials: StudentFinancials) {
  const extended = financials as StudentFinancials & {
    paymentSchedule?: unknown;
    scheduledPayments?: unknown;
  };
  const direct = Array.isArray(extended.paymentSchedule)
    ? extended.paymentSchedule
    : Array.isArray(extended.scheduledPayments)
      ? extended.scheduledPayments
      : [];
  const planInstallments = financials.paymentPlans.flatMap((plan) => {
    const installments = (plan as typeof plan & { installments?: unknown })
      .installments;
    return Array.isArray(installments) ? installments : [];
  });
  return [...direct, ...planInstallments] as OptionalPaymentScheduleItem[];
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function dashboardStudentCalendarEntries(input: {
  dashboard: StudentDashboard;
  financials: StudentFinancials;
  campusEvents: readonly CampusEvent[];
}): StudentCalendarEntry[] {
  const { dashboard, financials, campusEvents } = input;
  const requirements = dashboard.journey.requirements
    .filter((requirement) => validDate(requirement.dueAt))
    .map(
      (requirement): StudentCalendarEntry => ({
        id: `requirement:${requirement.id}`,
        kind: "enrollment",
        title: requirement.title,
        description: requirement.description,
        startsAt: requirement.dueAt as string,
        status: requirement.status,
        href: `/enrollment/requirements/${encodeURIComponent(
          studentRequirementSlug(requirement.code),
        )}`,
        actionLabel: ["completed", "waived", "not_applicable"].includes(
          requirement.status,
        )
          ? "Review requirement"
          : "Open requirement",
      }),
    );
  const events = campusEvents
    .filter((event) => validDate(event.startsAt))
    .map((event): StudentCalendarEntry => {
      const registration = safePortalDestination(
        event.registrationUrl,
        "/campus-life",
      );
      const hasRegistrationDestination =
        Boolean(event.registrationUrl) && registration.href !== "/campus-life";
      return {
        id: `campus:${event.id}`,
        kind: "campus",
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        status: event.category,
        href: registration.href,
        actionLabel: hasRegistrationDestination
          ? "Registration details"
          : "Explore campus life",
      };
    });
  const financialDocuments = financials.requiredDocuments
    .filter((document) => validDate(document.dueAt))
    .map((document): StudentCalendarEntry => {
      const destination = safePortalDestination(document.href, "/financials");
      return {
        id: `financial:${document.id}`,
        kind: "financial",
        title: document.title,
        description: document.description,
        startsAt: document.dueAt as string,
        status: document.status,
        href: destination.href,
        actionLabel:
          document.status === "verified"
            ? "View document"
            : ["submitted", "under_review"].includes(document.status)
              ? "View submission status"
              : document.status === "action_required"
                ? "Resolve requirement"
                : "Complete item",
      };
    });
  const paymentSchedule = optionalPaymentSchedule(financials);
  const hasScheduledDeposit = paymentSchedule.some(
    (item) =>
      typeof item.kind === "string" && item.kind.toLowerCase() === "deposit",
  );
  const depositDeadline =
    !hasScheduledDeposit && validDate(dashboard.offer.responseDeadline)
    ? [
        {
          id: `payment:deposit:${dashboard.offer.id}`,
          kind: "payment" as const,
          title: "Enrollment deposit deadline",
          description: `${money(dashboard.offer.depositAmountCents)} confirms your place in ${dashboard.offer.programName}.`,
          startsAt: dashboard.offer.responseDeadline,
          status: dashboard.offer.status,
          href: "/enrollment/requirements/enrollment-deposit",
          actionLabel: "Review deposit",
        },
      ]
    : [];
  const scheduledPayments = paymentSchedule
    .map((item, index): StudentCalendarEntry | null => {
      const startsAt = item.dueAt ?? item.date ?? item.startsAt;
      if (!validDate(startsAt)) return null;
      const amount =
        typeof item.amountCents === "number" && Number.isFinite(item.amountCents)
          ? ` (${money(item.amountCents)})`
          : "";
      return {
        id:
          typeof item.id === "string"
            ? `payment:schedule:${item.id}`
            : `payment:schedule:${index}:${startsAt}`,
        kind: "payment",
        title:
          typeof item.title === "string"
            ? item.title
            : typeof item.label === "string"
              ? item.label
            : `Scheduled payment${amount}`,
        description:
          typeof item.description === "string"
            ? item.description
            : `Review this scheduled student-account payment${amount}.`,
        startsAt,
        status: typeof item.status === "string" ? item.status : "scheduled",
        href: safePortalDestination(item.href, "/financials").href,
        actionLabel: "Review payment",
      };
    })
    .filter((entry): entry is StudentCalendarEntry => entry !== null);

  return [
    ...requirements,
    ...events,
    ...financialDocuments,
    ...depositDeadline,
    ...scheduledPayments,
  ];
}
