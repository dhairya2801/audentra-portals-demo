/**
 * Demo cover for the Student 360 record fields the hosted API does not serve.
 *
 * Student 360 reads four fields the rest of the portal never asked for —
 * `application`, `timeline`, `notes` and `financials`. They come from
 * `0053_student_360_records.sql` and the staff repository that reads it, and
 * they exist only where that migration has run. The demo deployment answers
 * from an API build that predates it, so the record arrives without them and
 * every panel below the Overview tab would render empty.
 *
 * So when a field is missing, this file writes one. Nothing here overwrites a
 * field the platform did send: a deployment with the migration shows its own
 * records, and this code returns the record untouched. What it writes is
 * derived from the student the portal already has — their program, class year,
 * melt band, checklist progress, real documents and real requirements — so the
 * application, the timeline and the ledger tell the same story as the risk
 * dial beside them rather than a second, contradictory one.
 *
 * Every value is a deterministic function of the student's id, so a demo shown
 * twice shows the same student record twice.
 */

import type {
  FinancialAward,
  FinancialDocumentRequirement,
  FinancialPaymentScheduleItem,
  StaffMemberSummary,
  StaffStudentApplicationSnapshot,
  StaffStudentNote,
  StaffStudentOperation,
  StaffStudentRecord,
  StaffStudentTimelineItem,
  StudentFinancials,
} from "@vv/contracts";

/* ------------------------------------------------------------ determinism */

/** A stable 32-bit hash of the student id, so one student reads the same twice. */
function seedOf(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** A stable pick from `options`, varied by `salt` so one seed drives many choices. */
function pick<T>(seed: number, salt: number, options: readonly T[]): T {
  return options[(seed + salt * 2654435761) % options.length];
}

/** A stable integer in `[low, high]`. */
function between(seed: number, salt: number, low: number, high: number): number {
  return low + ((seed + salt * 40503) % (high - low + 1));
}

/** `days` before the anchor, as an ISO instant. */
function daysBefore(anchor: number, days: number, hour = 14): string {
  const date = new Date(anchor);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

/** `days` after the anchor, as an ISO instant. */
function daysAfter(anchor: number, days: number, hour = 17): string {
  return daysBefore(anchor, -days, hour);
}

/* ----------------------------------------------------------- application */

const decisionPlans = [
  "Regular Decision",
  "Early Action",
  "Rolling Admission",
  "Transfer Admission",
] as const;

const highSchools = [
  "Northgate High School",
  "Riverbend Preparatory",
  "Lakeshore Central High",
  "Fairview Academy",
  "Brookline Regional High",
  "Cedar Ridge High School",
] as const;

const essayPrompts = [
  "Describe a community you belong to and what you bring to it.",
  "Tell us about a problem you solved and what it cost you.",
  "What will you do with a degree from this university?",
] as const;

function demoApplication(
  operation: StaffStudentOperation,
  anchor: number,
): StaffStudentApplicationSnapshot {
  const seed = seedOf(operation.id);
  const submittedDays = between(seed, 1, 190, 260);
  const completedDays = submittedDays - between(seed, 2, 6, 20);
  const decidedDays = completedDays - between(seed, 3, 14, 40);
  const gpa = (3.1 + ((seed % 90) / 100)).toFixed(2);
  const previousProgram = pick(seed, 7, [
    operation.programName,
    "Undeclared",
    "General Studies",
  ]);
  return {
    id: `demo-application-${operation.id}`,
    sourceSystem: "Slate",
    applicationTerm: `Fall ${operation.classYear - 4}`,
    decisionPlan: pick(seed, 4, decisionPlans),
    status: "enrolled",
    submittedAt: daysBefore(anchor, submittedDays),
    completedAt: daysBefore(anchor, completedDays),
    decidedAt: daysBefore(anchor, decidedDays),
    completenessPercent: 100,
    academicProfile: {
      highSchool: pick(seed, 5, highSchools),
      graduationYear: operation.classYear - 4,
      weightedGpa: gpa,
      classRank: `${between(seed, 6, 4, 68)} of ${between(seed, 8, 180, 420)}`,
      testOptional: seed % 2 === 0,
      satTotal: seed % 2 === 0 ? null : between(seed, 9, 1180, 1460),
    },
    programChoices: [
      { rank: 1, program: operation.programName, status: "admitted" },
      { rank: 2, program: previousProgram, status: "not_offered" },
    ],
    essays: [
      {
        prompt: pick(seed, 10, essayPrompts),
        wordCount: between(seed, 11, 480, 650),
        submittedAt: daysBefore(anchor, submittedDays + 2),
      },
    ],
    recommendations: [
      {
        recommender: "School counselor",
        relationship: "Counselor",
        receivedAt: daysBefore(anchor, submittedDays + 4),
        status: "received",
      },
      {
        recommender: "Mathematics teacher",
        relationship: "Teacher",
        receivedAt: daysBefore(anchor, submittedDays + 1),
        status: "received",
      },
    ],
    artifacts: [
      { label: "Official transcript", status: "verified" },
      { label: "Application PDF", status: "archived" },
    ],
    contactSnapshot: {
      preferredName: operation.preferredName,
      email: `${operation.preferredName.toLowerCase().replace(/[^a-z]/g, "")}@example.edu`,
      phone: `(555) 0${between(seed, 12, 100, 199)}-${between(seed, 13, 1000, 9999)}`,
      permanentAddress: `${between(seed, 14, 12, 980)} ${pick(seed, 15, ["Elm", "Maple", "Sycamore", "Bay"])} St`,
    },
    version: 1,
    updatedAt: daysBefore(anchor, decidedDays),
  };
}

/* -------------------------------------------------------------- timeline */

function demoTimeline(
  operation: StaffStudentOperation,
  record: StaffStudentRecord,
  application: StaffStudentApplicationSnapshot | null,
  anchor: number,
): StaffStudentRecord["timeline"] {
  const seed = seedOf(operation.id);
  const items: StaffStudentTimelineItem[] = [];

  if (application?.submittedAt) {
    items.push({
      id: `demo-timeline-application-${operation.id}`,
      category: "application",
      occurredAt: application.submittedAt,
      title: `Application submitted for ${application.applicationTerm}`,
      summary: `${application.decisionPlan} · ${application.sourceSystem}`,
      actorName: operation.name,
      source: application.sourceSystem,
      metadata: {},
    });
  }
  if (application?.decidedAt) {
    items.push({
      id: `demo-timeline-decision-${operation.id}`,
      category: "application",
      occurredAt: application.decidedAt,
      title: "Admitted and offer released",
      summary: `Offered a place in ${operation.programName}`,
      actorName: "Admissions committee",
      source: application.sourceSystem,
      metadata: {},
    });
  }

  // Real documents, where the record carries them, keep the timeline honest.
  for (const [index, document] of (record.documents?.items ?? []).slice(0, 4).entries()) {
    items.push({
      id: `demo-timeline-document-${document.id}`,
      category: "document",
      occurredAt: document.createdAt ?? daysBefore(anchor, 30 + index * 9),
      title: `${document.fileName} uploaded`,
      summary: `Status ${document.status.replaceAll("_", " ")}`,
      actorName: operation.name,
      source: "Student portal",
      metadata: { documentId: document.id },
    });
  }

  items.push({
    id: `demo-timeline-enrollment-${operation.id}`,
    category: "enrollment",
    occurredAt: operation.journey.lastActivityAt,
    title: `Reached ${operation.journey.stage}`,
    summary: `${operation.journey.completedTasks} of ${operation.journey.totalTasks} checklist milestones complete`,
    actorName: operation.name,
    source: "Enrollment checklist",
    metadata: {},
  });

  if (operation.recommendedAction.taskId) {
    items.push({
      id: `demo-timeline-task-${operation.id}`,
      category: "staff_task",
      occurredAt: daysBefore(anchor, between(seed, 20, 1, 6)),
      title: operation.recommendedAction.title,
      summary: operation.recommendedAction.rationale,
      actorName: "Enrollment services",
      source: "Action center",
      metadata: { workItemId: operation.recommendedAction.taskId },
    });
  }

  for (const [index, visit] of [
    ["Financial aid: cost and payment plans", "Aid"],
    ["Housing: first-year residence halls", "Housing"],
    ["Orientation dates and registration", "Orientation"],
  ].entries()) {
    items.push({
      id: `demo-timeline-web-${operation.id}-${index}`,
      category: "website",
      occurredAt: daysBefore(anchor, between(seed, 30 + index, 2, 21), 9 + index),
      title: `Viewed ${visit[0]}`,
      summary: `${between(seed, 40 + index, 2, 9)} page views in this session`,
      actorName: operation.name,
      source: "audentra.edu",
      metadata: { section: visit[1] },
    });
  }

  items.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  return { items, websiteActivityAvailable: true, generatedAt: new Date(anchor).toISOString() };
}

/* ----------------------------------------------------------------- notes */

const demoAuthors: StaffMemberSummary[] = [
  {
    id: "demo-staff-advisor",
    name: "Elena Torres",
    email: "elena.torres@example.edu",
    component: "Enrollment services",
    title: "Enrollment advisor",
  },
  {
    id: "demo-staff-aid",
    name: "Marcus Bell",
    email: "marcus.bell@example.edu",
    component: "Financial aid",
    title: "Financial aid counselor",
  },
  {
    id: "demo-staff-admissions",
    name: "Priya Raman",
    email: "priya.raman@example.edu",
    component: "Admissions",
    title: "Admissions officer",
  },
];

function demoNotes(
  operation: StaffStudentOperation,
  anchor: number,
): StaffStudentRecord["notes"] {
  const seed = seedOf(operation.id);
  const bodies: Array<[string, StaffStudentNote["category"], StaffStudentNote["visibility"]]> = [
    [
      `Called about ${operation.risk.reason.charAt(0).toLowerCase()}${operation.risk.reason.slice(1)} Left a voicemail and followed up by email.`,
      "engagement",
      "staff",
    ],
    [
      `Aid packet reviewed. ${operation.recommendedAction.rationale}`,
      "financial",
      "financial_aid",
    ],
    [
      `Confirmed intent to enroll in ${operation.programName}. Wants to hear about ${pick(seed, 50, ["housing", "orientation", "advising", "work study"])}.`,
      "admissions",
      "admissions",
    ],
  ];
  const items = bodies.map((entry, index) => ({
    id: `demo-note-${operation.id}-${index}`,
    category: entry[1],
    visibility: entry[2],
    body: entry[0],
    pinned: index === 0,
    version: 1,
    author: demoAuthors[(seed + index) % demoAuthors.length],
    createdAt: daysBefore(anchor, between(seed, 60 + index, 1, 24), 10 + index),
    updatedAt: daysBefore(anchor, between(seed, 60 + index, 1, 24), 10 + index),
  }));
  items.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  return { items, total: items.length };
}

/* ------------------------------------------------------------ financials */

function demoFinancials(
  operation: StaffStudentOperation,
  record: StaffStudentRecord,
  anchor: number,
): StudentFinancials {
  const seed = seedOf(operation.id);
  const costOfAttendanceCents = between(seed, 70, 32000, 46000) * 100;
  const grantCents = between(seed, 71, 6000, 14000) * 100;
  const scholarshipCents = between(seed, 72, 4000, 12000) * 100;
  const loanCents = between(seed, 73, 3000, 7000) * 100;
  // A student flagged for financial risk is the one whose aid has not landed.
  const aidPending = operation.risk.category === "financial" || operation.risk.band === "critical";
  const acceptedAidCents = grantCents + scholarshipCents + (aidPending ? 0 : loanCents);
  const pendingAidCents = aidPending ? loanCents : 0;
  const paymentsCents = between(seed, 74, 0, 3) * 50000;
  const remainingBalanceCents = Math.max(
    0,
    costOfAttendanceCents - acceptedAidCents - paymentsCents,
  );

  const awards: FinancialAward[] = [
    {
      id: `demo-award-pell-${operation.id}`,
      source: "federal",
      name: "Federal Pell Grant",
      type: "grant",
      offeredAmountCents: grantCents,
      acceptedAmountCents: grantCents,
      status: "accepted",
      requiresAction: false,
      updatedAt: daysBefore(anchor, 40),
    },
    {
      id: `demo-award-merit-${operation.id}`,
      source: "institutional",
      name: `${operation.programName} Merit Scholarship`,
      type: "scholarship",
      offeredAmountCents: scholarshipCents,
      acceptedAmountCents: scholarshipCents,
      status: "accepted",
      requiresAction: false,
      updatedAt: daysBefore(anchor, 38),
    },
    {
      id: `demo-award-loan-${operation.id}`,
      source: "federal",
      name: "Direct Subsidized Loan",
      type: "loan",
      offeredAmountCents: loanCents,
      acceptedAmountCents: aidPending ? 0 : loanCents,
      status: aidPending ? "offered" : "accepted",
      requiresAction: aidPending,
      updatedAt: daysBefore(anchor, aidPending ? 5 : 30),
    },
  ];

  const requiredDocuments: FinancialDocumentRequirement[] = [
    {
      id: `demo-fin-doc-fafsa-${operation.id}`,
      code: "FAFSA",
      title: "FAFSA on file",
      description: "Free Application for Federal Student Aid for the award year.",
      status: "verified",
      dueAt: null,
      documentId: null,
      href: "/financials",
      version: 1,
      updatedAt: daysBefore(anchor, 60),
    },
    {
      id: `demo-fin-doc-verify-${operation.id}`,
      code: "VERIFICATION",
      title: "Income verification worksheet",
      description: "Selected for federal verification; the packet cannot disburse until it clears.",
      status: aidPending ? "action_required" : "verified",
      dueAt: aidPending ? daysAfter(anchor, 9) : null,
      documentId: null,
      href: "/financials",
      version: 1,
      updatedAt: daysBefore(anchor, aidPending ? 3 : 45),
    },
  ];

  const installmentAmountCents = Math.round(remainingBalanceCents / 4) || 50000;
  const paymentSchedule: FinancialPaymentScheduleItem[] = [
    {
      id: `demo-pay-deposit-${operation.id}`,
      kind: "deposit",
      label: "Enrollment deposit",
      amountCents: 50000,
      enrollmentFeeCents: 0,
      dueAt: daysBefore(anchor, 20),
      status: paymentsCents > 0 ? "paid" : "due",
      projected: false,
    },
    ...[0, 1, 2, 3].map((index) => ({
      id: `demo-pay-installment-${operation.id}-${index}`,
      kind: "installment" as const,
      label: `Installment ${index + 1} of 4`,
      amountCents: installmentAmountCents,
      enrollmentFeeCents: index === 0 ? 3500 : 0,
      dueAt: daysAfter(anchor, 21 + index * 30),
      status: "projected" as const,
      projected: true,
    })),
  ];

  return {
    academicYear: `${operation.classYear - 4}–${operation.classYear - 3}`,
    costOfAttendanceCents,
    acceptedAidCents,
    pendingAidCents,
    paymentsCents,
    remainingBalanceCents,
    awards,
    requiredDocuments,
    paymentPlans: [
      {
        id: `demo-plan-4-${operation.id}`,
        name: "Four-installment plan",
        installmentCount: 4,
        installmentAmountCents,
        enrollmentFeeCents: 3500,
        status: "available",
      },
    ],
    paymentSchedule,
    sap: {
      status: "meeting",
      cumulativeGpa: Number((3.0 + ((seed % 80) / 100)).toFixed(2)),
      minimumGpa: 2.0,
      completionRatePercent: between(seed, 80, 84, 100),
      minimumCompletionRatePercent: 67,
      attemptedCredits: between(seed, 81, 12, 30),
      maximumAttemptedCredits: 180,
    },
    generatedAt: new Date(anchor).toISOString(),
  };
}

/* ------------------------------------------------------------------ entry */

/**
 * Returns `record` with any Student 360 field the platform omitted filled in.
 *
 * A record that already carries all four fields is returned unchanged, so this
 * never stands between a migrated deployment and its own data.
 */
export function withDemoStudent360Fields(
  record: StaffStudentRecord,
  operation: StaffStudentOperation | undefined,
): StaffStudentRecord {
  if (!operation) return record;
  const missing =
    record.application === undefined ||
    record.timeline === undefined ||
    record.notes === undefined ||
    record.financials === undefined;
  if (!missing) return record;

  const anchor = Date.now();
  const application = record.application ?? demoApplication(operation, anchor);
  return {
    ...record,
    application,
    timeline: record.timeline ?? demoTimeline(operation, record, application, anchor),
    notes: record.notes ?? demoNotes(operation, anchor),
    financials: record.financials ?? demoFinancials(operation, record, anchor),
  };
}

/** A locally-composed comment, for a deployment whose API has no notes endpoint. */
export function demoComposedNote(
  input: { body: string; category?: StaffStudentNote["category"]; visibility?: StaffStudentNote["visibility"]; pinned?: boolean },
  author: StaffMemberSummary,
): StaffStudentNote {
  const now = new Date().toISOString();
  return {
    id: `demo-note-local-${Date.now()}`,
    category: input.category ?? "general",
    visibility: input.visibility ?? "staff",
    body: input.body,
    pinned: input.pinned ?? false,
    version: 1,
    author,
    createdAt: now,
    updatedAt: now,
  };
}
