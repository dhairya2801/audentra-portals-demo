/**
 * The demo corpus behind Today, the Action Center and the Task board.
 *
 * These three views used to read the tenant's own records, which is the right
 * thing for the product and the wrong thing for a demo: the Vice President has
 * no personal caseload, so Today and the Action Center answered zero to every
 * question, and the shared board answered with two and a half thousand tasks,
 * every one of them months overdue. Neither is a lie the product tells — it is
 * what the synthetic university actually contains — but neither shows what the
 * product does.
 *
 * So these three views read this file instead. Nothing here reaches the
 * platform: no request is made, no record is read, and every figure below was
 * written by hand. The rest of the workspace — Students, Messages, Journeys,
 * Knowledge, Campus life, Academics — is untouched and still reads the tenant.
 *
 * The corpus tells the same story Morning Brew tells, because the reader walks
 * from one to the other: commuter deposits slowing behind an aid-verification
 * queue, transfer volume running ahead of evaluation capacity, housing and
 * orientation trailing the deposit line.
 */

import type {
  CompleteStaffInteractionInput,
  CreateStaffWorkCommentInput,
  RecordStaffCommunicationInput,
  StartStaffInteractionInput,
  StaffActionCenter,
  StaffActionCenterQuery,
  StaffInquiry,
  StaffInteraction,
  StaffMemberSummary,
  StaffOutreachRun,
  StaffPersonalActionCenter,
  StaffPortalInventoryItem,
  StaffStudentOperation,
  StaffWorkItem,
  StaffWorkItemDetail,
  StaffWorkItemPriority,
  StaffWorkItemStatus,
  UpdateStaffWorkItemInput,
} from "@vv/contracts";

/* ------------------------------------------------------------------- clock */

/**
 * The morning the corpus describes, taken once when the module loads.
 *
 * Every date below is written as a number of days from here rather than as a
 * literal, so the board reads as this week's work whenever the demo is given
 * rather than as a fixed week that ages into nonsense.
 */
const ANCHOR = new Date();
ANCHOR.setUTCHours(12, 0, 0, 0);

/** `days` from the demo's morning, as an ISO instant. */
function at(days: number, hour = 12): string {
  const date = new Date(ANCHOR);
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

/* ------------------------------------------------------------------- staff */

/**
 * The colleagues the board is shared with. The signed-in Vice President is not
 * in this list — she arrives as the real `currentStaff`, so "@Me", the owner
 * filter and the assignment dropdown all still name the person actually
 * signed in.
 */
const COLLEAGUES = {
  aid: {
    id: "demo-staff-aid-dir",
    name: "Keziah Abernathy",
    email: "keziah.abernathy@aster.example.edu",
    component: "Financial Aid",
    title: "Director of Financial Aid",
    roleCode: "director",
    employmentStatus: "active",
  },
  admissions: {
    id: "demo-staff-adm-ad",
    name: "Desmond Okonkwo",
    email: "desmond.okonkwo@aster.example.edu",
    component: "Admissions",
    title: "Assistant Director of Admissions",
    roleCode: "assistant_director",
    employmentStatus: "active",
  },
  housing: {
    id: "demo-staff-housing",
    name: "Sylvie Marchetti",
    email: "sylvie.marchetti@aster.example.edu",
    component: "Residence Life",
    title: "Housing Operations Coordinator",
    roleCode: "housing_coordinator",
    employmentStatus: "active",
  },
  advising: {
    id: "demo-staff-adv-1",
    name: "Hana Dunmire",
    email: "hana.dunmire@aster.example.edu",
    component: "Academic Advising",
    title: "Senior Academic Adviser",
    roleCode: "academic_adviser",
    employmentStatus: "active",
  },
  international: {
    id: "demo-staff-iss",
    name: "Beatrix Zaragoza",
    email: "beatrix.zaragoza@aster.example.edu",
    component: "International Student Services",
    title: "International Student Adviser",
    roleCode: "international_adviser",
    // Away this week, so the board has one honest owner-availability signal.
    employmentStatus: "on_leave",
    leaveUntil: null,
  },
} satisfies Record<string, StaffMemberSummary>;

type ColleagueKey = keyof typeof COLLEAGUES;
/** `me` resolves to whoever is signed in; a key names a colleague; null is unassigned. */
type OwnerRef = "me" | ColleagueKey | null;

export const DEMO_STAFF_DIRECTORY: StaffMemberSummary[] = Object.values(COLLEAGUES);

/* --------------------------------------------------------------- work items */

interface WorkItemSeed {
  key: string;
  title: string;
  description: string;
  status: StaffWorkItemStatus;
  priority: StaffWorkItemPriority;
  type: StaffWorkItem["type"];
  actionType: StaffWorkItem["actionType"];
  component: string;
  owner: OwnerRef;
  student: StaffWorkItem["student"];
  /** Due date in days from the demo's morning; null for undated work. */
  due: number | null;
  createdDaysAgo: number;
  updatedDaysAgo: number;
  escalated?: boolean;
  overdueDays?: number;
  staleDays?: number;
  followUp?: number;
  blocker?: { code: string; detail: string; reviewAt: number | null };
  nextStep?: string;
  outcomeCode?: string;
  resolutionCode?: string;
  completedDaysAgo?: number;
}

const student = (
  id: string,
  name: string,
  programName: string,
  classYear = 2029,
): StaffWorkItem["student"] => ({
  id,
  name,
  preferredName: name.split(" ")[0],
  programName,
  classYear,
});

const SEEDS: WorkItemSeed[] = [
  /* ------------------------------------------------------------------ to do */
  {
    key: "AST-1042",
    title: "Call the 312 commuter admits with an open aid file",
    description:
      "Named-list outreach, not a broadcast. The message is the package date: every student on this list is waiting on verification, not deciding against us.",
    status: "todo",
    priority: "urgent",
    type: "communication",
    actionType: "deadline_risk",
    component: "Enrollment Leadership",
    owner: "aid",
    student: student("demo-stu-1", "Sarah Johnson", "Nursing, BSN"),
    due: 2,
    createdDaysAgo: 3,
    updatedDaysAgo: 1,
    escalated: true,
    nextStep: "Split the list across four counsellors and start with the 197 waiting on documents.",
  },
  {
    key: "AST-1037",
    title: "Release the 88 verification files awaiting review",
    description:
      "The only part of the queue inside this office's control. 88 files are packaged and waiting on a reviewer; the other 236 are waiting on families or in correction.",
    status: "in_progress",
    priority: "high",
    type: "enrollment",
    actionType: "missing_information",
    component: "Financial Aid",
    owner: "aid",
    student: student("demo-stu-2", "Michael Chen", "Computer Science, BS"),
    due: 4,
    createdDaysAgo: 6,
    updatedDaysAgo: 2,
  },
  {
    key: "AST-1031",
    title: "Add transfer evaluation capacity for Business and Health Sciences",
    description:
      "Transfer applications are 14% ahead of last year and credit evaluations are nine days behind the application date. The volume only converts if an offer reaches the student while they are still deciding.",
    status: "todo",
    priority: "high",
    type: "enrollment",
    actionType: "staff_decision",
    component: "Admissions",
    owner: "admissions",
    student: student("demo-stu-3", "Priya Raman", "Business Administration, BS", 2028),
    due: 6,
    createdDaysAgo: 4,
    updatedDaysAgo: 1,
  },
  {
    key: "AST-1028",
    title: "Send the housing intent confirmation to 261 commuter admits",
    description:
      "One yes-or-no question. The beds that come back negative release; the rest join the real assignment queue, which is manageable at 171 and is not at 432.",
    status: "todo",
    priority: "medium",
    type: "communication",
    actionType: "enrollment_follow_up",
    component: "Residence Life",
    owner: "housing",
    student: student("demo-stu-4", "Lucas Fernandez", "Mechanical Engineering, BS"),
    due: 5,
    createdDaysAgo: 2,
    updatedDaysAgo: 2,
  },
  {
    key: "AST-1024",
    title: "Rebalance orientation: move 44 places from Session 3 to Session 6",
    description:
      "Session 3 is 44 over capacity and Session 6 is at 68%. Moving the places costs nothing and opens the oversubscribed session to the 946 deposited students who have not registered.",
    status: "todo",
    priority: "medium",
    type: "enrollment",
    actionType: "onboarding_assistance",
    component: "Student Experience",
    owner: null,
    student: student("demo-stu-5", "Hannah Whitfield", "Psychology, BA"),
    due: 8,
    createdDaysAgo: 5,
    updatedDaysAgo: 5,
  },

  /* ------------------------------------------------------------ in progress */
  {
    key: "AST-0998",
    title: "Review the top two merit bands on 720 unreleased packages",
    description:
      "Institutional aid is running 46.4% against a 44.5% plan and the whole gap is in merit. Adjusting the bands on packages not yet released recovers roughly $1.4M without reopening a single issued offer.",
    status: "in_progress",
    priority: "urgent",
    type: "enrollment",
    actionType: "staff_decision",
    component: "Enrollment Leadership",
    owner: "me",
    student: student("demo-stu-6", "Wei Zhang", "Data Science, BS"),
    due: 3,
    createdDaysAgo: 7,
    updatedDaysAgo: 0,
    nextStep: "Model the two-step adjustment against the 720 and take the residual to the CFO.",
  },
  {
    key: "AST-0994",
    title: "Hold the deposit deadline — communications plan",
    description:
      "An extension moves the date, not the packages. The plan says so publicly and pairs the held deadline with the verification push behind it.",
    status: "in_progress",
    priority: "high",
    type: "communication",
    actionType: "communication_response",
    component: "Enrollment Leadership",
    owner: "me",
    student: student("demo-stu-7", "Daniel Okafor", "Economics, BA"),
    due: 1,
    createdDaysAgo: 4,
    updatedDaysAgo: 0,
  },
  {
    key: "AST-0987",
    title: "Two admitted-student evenings at the five feeder colleges",
    description:
      "61% of the transfer growth is in five community colleges within forty miles — a short enough list to build an event around before the round closes.",
    status: "in_progress",
    priority: "medium",
    type: "enrollment",
    actionType: "onboarding_assistance",
    component: "Admissions",
    owner: "admissions",
    student: student("demo-stu-8", "Camila Duarte", "Health Sciences, BS", 2028),
    due: 11,
    createdDaysAgo: 9,
    updatedDaysAgo: 2,
  },
  {
    key: "AST-0981",
    title: "Report the verification queue against arrivals, not its own size",
    description:
      "30 files clear a day against 38 arriving. Reported against itself the queue looks like a bad week; reported against arrivals it looks like what it is, which is a capacity gap.",
    status: "in_progress",
    priority: "medium",
    type: "document_review",
    actionType: "external_verification",
    component: "Financial Aid",
    owner: "aid",
    student: student("demo-stu-9", "Omar Haddad", "Civil Engineering, BS"),
    due: 7,
    createdDaysAgo: 16,
    updatedDaysAgo: 11,
    staleDays: 11,
  },

  /* -------------------------------------------------------------- follow-up */
  {
    key: "AST-0944",
    title: "CFO response on the $0.7M plan variance",
    description:
      "The residual after the merit-band adjustment, taken to the CFO as a variance rather than recovered from offers already made.",
    status: "follow_up_required",
    priority: "high",
    type: "communication",
    actionType: "staff_decision",
    component: "Enrollment Leadership",
    owner: "me",
    student: student("demo-stu-10", "Rosalind Vance", "Data Science, BS"),
    due: 9,
    createdDaysAgo: 6,
    updatedDaysAgo: 1,
    followUp: 3,
    nextStep: "Reopen when the CFO's office answers on Thursday.",
  },
  {
    key: "AST-0938",
    title: "Residence Life to confirm the released beds",
    description:
      "Waiting on the count coming back from the housing intent question before the waitlist is worked.",
    status: "follow_up_required",
    priority: "medium",
    type: "enrollment",
    actionType: "enrollment_follow_up",
    component: "Residence Life",
    owner: "housing",
    student: student("demo-stu-11", "Bianca Underhollow", "Marketing, BS"),
    due: 10,
    createdDaysAgo: 8,
    updatedDaysAgo: 2,
    followUp: 4,
  },
  {
    key: "AST-0930",
    title: "Registrar to confirm transfer credit turnaround",
    description:
      "Advising cannot promise a first-semester plan to transfer admits until the Registrar names a turnaround the evaluations can hold.",
    status: "follow_up_required",
    priority: "medium",
    type: "enrollment",
    actionType: "missing_information",
    component: "Academic Advising",
    owner: "advising",
    student: student("demo-stu-12", "Mateo Ironwood", "Electrical Engineering, BS", 2028),
    due: 12,
    createdDaysAgo: 10,
    updatedDaysAgo: 3,
    followUp: 5,
  },

  /* ---------------------------------------------------------------- blocked */
  {
    key: "AST-0902",
    title: "International credential verification — vendor backlog",
    description:
      "41 files are with the external evaluator and the vendor's own queue is nine days deep. Nothing here moves until they return.",
    status: "blocked",
    priority: "high",
    type: "document_review",
    actionType: "blocked_dependency",
    component: "International Student Services",
    owner: "international",
    student: student("demo-stu-13", "Emre Stonebrook", "Civil Engineering, BS"),
    due: -2,
    createdDaysAgo: 14,
    updatedDaysAgo: 4,
    overdueDays: 2,
    blocker: {
      code: "external_vendor",
      detail: "Credential evaluator has a nine-day backlog; 41 files outstanding.",
      reviewAt: 5,
    },
  },
  {
    key: "AST-0897",
    title: "Yield event budget approval",
    description:
      "The feeder-college evenings need a line against them before dates can be published to students.",
    status: "blocked",
    priority: "medium",
    type: "enrollment",
    actionType: "blocked_dependency",
    component: "Enrollment Leadership",
    owner: null,
    student: student("demo-stu-14", "Junia Calderwood", "Accounting, BS"),
    due: 4,
    createdDaysAgo: 11,
    updatedDaysAgo: 6,
    blocker: {
      code: "awaiting_budget",
      detail: "Finance has the request; approval expected with the monthly review.",
      reviewAt: 6,
    },
  },

  /* ------------------------------------------------------------------- done */
  {
    key: "AST-0871",
    title: "Commuter visit-day follow-up calls",
    description:
      "All 184 commuter families who attended the April visit day were called within the week. Attendance is flat year over year, which is how we know the deposit slip is not about interest.",
    status: "done",
    priority: "high",
    type: "communication",
    actionType: "enrollment_follow_up",
    component: "Admissions",
    owner: "admissions",
    student: student("demo-stu-15", "Sofia Marino", "Nursing, BSN"),
    due: -6,
    createdDaysAgo: 18,
    updatedDaysAgo: 6,
    completedDaysAgo: 6,
    outcomeCode: "reached",
    resolutionCode: "completed",
  },
  {
    key: "AST-0864",
    title: "Aid appeal committee decisions posted",
    description:
      "37 appeals heard, 29 adjusted, all decisions posted to the student portal the same afternoon.",
    status: "done",
    priority: "medium",
    type: "enrollment",
    actionType: "document_review",
    component: "Financial Aid",
    owner: "aid",
    student: student("demo-stu-16", "Caleb Brightwater", "Biology, BS"),
    due: -9,
    createdDaysAgo: 21,
    updatedDaysAgo: 9,
    completedDaysAgo: 9,
    outcomeCode: "resolved",
    resolutionCode: "completed",
  },
];

/* ------------------------------------------------------------ board state */

/**
 * The board, held in memory for the life of the page.
 *
 * Dragging a card between columns and completing a recommended action both
 * write here, so the demo behaves like the product — the move sticks, the
 * counts follow it — without a request leaving the browser. A reload starts
 * the story again.
 */
let board: StaffWorkItem[] | null = null;
let currentStaff: StaffMemberSummary | null = null;

function ownerOf(ref: OwnerRef): StaffMemberSummary | null {
  if (ref === null) return null;
  if (ref === "me") return currentStaff;
  return COLLEAGUES[ref];
}

function buildItem(seed: WorkItemSeed, index: number): StaffWorkItem {
  const assignee = ownerOf(seed.owner);
  const closed = seed.status === "done" || seed.status === "cancelled";
  return {
    id: `demo-work-${seed.key.toLowerCase()}`,
    key: seed.key,
    title: seed.title,
    description: seed.description,
    status: seed.status,
    priority: seed.priority,
    type: seed.type,
    actionType: seed.actionType,
    component: seed.component,
    dueAt: seed.due === null ? null : at(seed.due),
    escalated: seed.escalated ?? false,
    selectedChannel: seed.type === "communication" ? "email" : null,
    attemptCount: seed.status === "todo" ? 0 : 1,
    followUpAt: seed.followUp === undefined ? null : at(seed.followUp, 15),
    blocker: seed.blocker
      ? {
          code: seed.blocker.code,
          detail: seed.blocker.detail,
          reviewAt: seed.blocker.reviewAt === null ? null : at(seed.blocker.reviewAt),
        }
      : null,
    outcomeCode: seed.outcomeCode ?? null,
    resolutionCode: seed.resolutionCode ?? null,
    nextStep: seed.nextStep ?? null,
    terminalReason: null,
    startedAt: seed.status === "todo" ? null : at(-seed.createdDaysAgo + 1, 14),
    interactionCompletedAt: closed ? at(-(seed.completedDaysAgo ?? 0), 16) : null,
    completedAt: seed.completedDaysAgo === undefined ? null : at(-seed.completedDaysAgo, 16),
    cancelledAt: null,
    version: 1,
    createdAt: at(-seed.createdDaysAgo, 9),
    updatedAt: at(-seed.updatedDaysAgo, 15),
    assignee,
    student: seed.student,
    source: { type: "requirement", id: `demo-source-${index}` },
    history: [
      {
        id: `demo-log-${index}-1`,
        action: "created",
        message: "Raised from the enrollment operations review.",
        actorName: "Enrollment Operations",
        occurredAt: at(-seed.createdDaysAgo, 9),
      },
      ...(assignee
        ? [
            {
              id: `demo-log-${index}-2`,
              action: "assigned" as const,
              message: `Assigned to ${assignee.name}.`,
              actorName: "Enrollment Operations",
              occurredAt: at(-seed.createdDaysAgo, 10),
            },
          ]
        : []),
      ...(seed.status === "todo"
        ? []
        : [
            {
              id: `demo-log-${index}-3`,
              action: "status_changed" as const,
              message: `Moved to ${seed.status.replaceAll("_", " ")}.`,
              actorName: assignee?.name ?? "Enrollment Operations",
              occurredAt: at(-seed.updatedDaysAgo, 15),
            },
          ]),
    ],
    signals: {
      overdue: seed.overdueDays !== undefined,
      overdueDays: seed.overdueDays ?? null,
      stale: seed.staleDays !== undefined,
      staleDays: seed.staleDays ?? null,
      ageDays: seed.createdDaysAgo,
      unassigned: assignee === null && !closed,
      ownerRisk:
        assignee && assignee.employmentStatus === "on_leave" && !closed ? "on_leave" : null,
    },
  };
}

/** The board as it stands, built on first read against the signed-in person. */
function boardFor(staff: StaffMemberSummary): StaffWorkItem[] {
  if (!board || currentStaff?.id !== staff.id) {
    currentStaff = staff;
    board = SEEDS.map(buildItem);
  }
  return board;
}

/* --------------------------------------------------------------- filtering */

const PRIORITY_ORDER: Record<StaffWorkItemPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const OPEN: StaffWorkItemStatus[] = ["todo", "in_progress", "follow_up_required", "blocked"];
const isOpen = (item: StaffWorkItem) => OPEN.includes(item.status);

function matchesDue(item: StaffWorkItem, due: StaffActionCenterQuery["due"]): boolean {
  if (!due || due === "all") return true;
  if (due === "no_due") return item.dueAt === null;
  if (item.dueAt === null) return false;
  const days = Math.round(
    (new Date(item.dueAt).getTime() - ANCHOR.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (due === "overdue") return days < 0;
  if (due === "today") return days === 0;
  return days >= 0 && days <= 7;
}

function matches(
  item: StaffWorkItem,
  query: StaffActionCenterQuery,
  staff: StaffMemberSummary,
): boolean {
  const scope = query.status ?? "open";
  if (scope === "open") {
    if (!isOpen(item)) return false;
  } else if (scope === "closed") {
    if (isOpen(item)) return false;
  } else if (scope !== "all" && item.status !== scope) {
    return false;
  }
  if (query.priority && item.priority !== query.priority) return false;
  if (query.workType && item.type !== query.workType) return false;
  if (query.component && item.component !== query.component) return false;
  if (query.actionType && item.actionType !== query.actionType) return false;
  if (query.studentId && item.student.id !== query.studentId) return false;
  if (query.escalated !== undefined && item.escalated !== query.escalated) return false;
  if (query.stale && !item.signals.stale) return false;
  if (query.ownerRisk && !item.signals.ownerRisk) return false;
  if (query.assignee === "me" && item.assignee?.id !== staff.id) return false;
  if (query.assignee === "unassigned" && item.assignee !== null) return false;
  if (query.assignee && query.assignee !== "me" && query.assignee !== "unassigned") {
    const needle = query.assignee.toLowerCase();
    const owner = item.assignee;
    if (!owner || (owner.id !== query.assignee && !owner.name.toLowerCase().includes(needle))) {
      return false;
    }
  }
  if (!matchesDue(item, query.due)) return false;
  if (query.search) {
    const needle = query.search.trim().toLowerCase();
    const haystack = [
      item.key,
      item.title,
      item.description,
      item.component,
      item.student.name,
      item.assignee?.name ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

function sortItems(items: StaffWorkItem[], sort: StaffActionCenterQuery["sort"]) {
  const byDue = (left: StaffWorkItem, right: StaffWorkItem) =>
    (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999");
  const sorted = [...items];
  if (sort === "due") sorted.sort(byDue);
  else if (sort === "updated") sorted.sort((l, r) => r.updatedAt.localeCompare(l.updatedAt));
  else if (sort === "created") sorted.sort((l, r) => r.createdAt.localeCompare(l.createdAt));
  else if (sort === "stale") sorted.sort((l, r) => l.updatedAt.localeCompare(r.updatedAt));
  else {
    sorted.sort(
      (l, r) => PRIORITY_ORDER[l.priority] - PRIORITY_ORDER[r.priority] || byDue(l, r),
    );
  }
  return sorted;
}

/* ------------------------------------------------------------------ facets */

function facetsFor(items: StaffWorkItem[]): StaffActionCenter["facets"] {
  const open = items.filter(isOpen);
  const components = new Map<string, StaffActionCenter["facets"]["components"][number]>();
  for (const item of open) {
    const row = components.get(item.component) ?? {
      component: item.component,
      open: 0,
      overdue: 0,
      unassigned: 0,
      stale: 0,
      ownerRisk: 0,
      urgent: 0,
    };
    row.open += 1;
    if (item.signals.overdue) row.overdue += 1;
    if (item.signals.unassigned) row.unassigned += 1;
    if (item.signals.stale) row.stale += 1;
    if (item.signals.ownerRisk) row.ownerRisk += 1;
    if (item.priority === "urgent") row.urgent += 1;
    components.set(item.component, row);
  }
  const assignees = new Map<string, StaffActionCenter["facets"]["assignees"][number]>();
  for (const item of open) {
    const id = item.assignee?.id ?? "unassigned";
    const row = assignees.get(id) ?? {
      staff: item.assignee,
      open: 0,
      overdue: 0,
      stale: 0,
      urgent: 0,
    };
    row.open += 1;
    if (item.signals.overdue) row.overdue += 1;
    if (item.signals.stale) row.stale += 1;
    if (item.priority === "urgent") row.urgent += 1;
    assignees.set(id, row);
  }
  return {
    components: [...components.values()].sort((l, r) => r.open - l.open),
    assignees: [...assignees.values()].sort((l, r) => r.open - l.open),
  };
}

function countsFor(items: StaffWorkItem[]): StaffActionCenter["counts"] {
  const open = items.filter(isOpen);
  const count = (status: StaffWorkItemStatus) =>
    items.filter((item) => item.status === status).length;
  return {
    todo: count("todo"),
    inProgress: count("in_progress"),
    followUpRequired: count("follow_up_required"),
    blocked: count("blocked"),
    done: count("done"),
    cancelled: count("cancelled"),
    urgent: open.filter((item) => item.priority === "urgent").length,
    escalated: open.filter((item) => item.escalated).length,
    open: open.length,
    overdue: open.filter((item) => item.signals.overdue).length,
    stale: open.filter((item) => item.signals.stale).length,
    unassigned: open.filter((item) => item.signals.unassigned).length,
    ownerRisk: open.filter((item) => item.signals.ownerRisk).length,
  };
}

/* ------------------------------------------------------------------ reads */

/** One page of the demo board, in the shape `GET /v1/staff/action-center` returns. */
export function demoActionCenter(
  query: StaffActionCenterQuery,
  staff: StaffMemberSummary,
): StaffActionCenter {
  const items = boardFor(staff);
  const matched = sortItems(
    items.filter((item) => matches(item, query, staff)),
    query.sort,
  );
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const page = matched.slice(offset, offset + limit);
  return {
    items: page,
    staff: [staff, ...DEMO_STAFF_DIRECTORY],
    counts: countsFor(items),
    page: {
      limit,
      offset,
      total: matched.length,
      hasMore: offset + page.length < matched.length,
      distinctStudents: new Set(matched.map((item) => item.student.id)).size,
    },
    facets: facetsFor(items),
    query: {
      status: String(query.status ?? "open"),
      priority: query.priority ?? null,
      component: query.component ?? null,
      assignee: query.assignee ?? null,
      search: query.search ?? null,
      due: query.due ?? "all",
      stale: query.stale ?? null,
      ownerRisk: query.ownerRisk ?? null,
      escalated: query.escalated ?? null,
      actionType: query.actionType ?? null,
      workType: query.workType ?? null,
      studentId: query.studentId ?? null,
      inProgressDays: query.inProgressDays ?? null,
      sort: query.sort ?? "priority",
      limit,
      offset,
    },
    generatedAt: at(0, 11),
  };
}

/** Move a card. In memory, and only forward through the statuses the board drags to. */
export function demoMoveWorkItem(itemId: string, status: StaffWorkItemStatus): StaffWorkItem | null {
  const item = board?.find((entry) => entry.id === itemId);
  if (!item) return null;
  item.status = status;
  item.version += 1;
  item.updatedAt = at(0, 11);
  item.completedAt = status === "done" ? at(0, 11) : null;
  item.startedAt = status === "todo" ? null : (item.startedAt ?? at(0, 11));
  item.signals = {
    ...item.signals,
    stale: false,
    staleDays: null,
    unassigned: item.assignee === null && OPEN.includes(status),
  };
  item.history = [
    ...item.history,
    {
      id: `demo-log-${item.key}-${item.version}`,
      action: "status_changed",
      message: `Moved to ${status.replaceAll("_", " ")} on the task board.`,
      actorName: currentStaff?.name ?? "Enrollment Operations",
      occurredAt: at(0, 11),
    },
  ];
  return item;
}

/**
 * Whether an id belongs to this corpus.
 *
 * The work-item detail is opened from two places: the demo task board, and the
 * Students view, which still reads the tenant. Routing on the id keeps both
 * working — a demo card is answered from here, a real one still goes to the
 * platform.
 */
export const isDemoRecord = (id: string) => id.startsWith("demo-");

/** What the reader writes inside the detail panel, held for the session. */
const interactions = new Map<string, StaffInteraction[]>();
const comments = new Map<string, StaffWorkItemDetail["comments"]>();
let sequence = 0;
const nextId = (prefix: string) => `demo-${prefix}-${++sequence}`;

function findItem(itemId: string): StaffWorkItem | null {
  return board?.find((entry) => entry.id === itemId) ?? null;
}

function findInteraction(
  interactionId: string,
): { itemId: string; interaction: StaffInteraction } | null {
  for (const [itemId, list] of interactions) {
    const interaction = list.find((entry) => entry.id === interactionId);
    if (interaction) return { itemId, interaction };
  }
  return null;
}

/** The detail panel behind a card, assembled from the same corpus. */
export function demoWorkItemDetail(itemId: string): StaffWorkItemDetail | null {
  const item = findItem(itemId);
  if (!item) return null;
  return {
    workItem: item,
    taskInsight: {
      state: "ready",
      version: 1,
      summary: item.description,
      whyThisMatters:
        "It sits on the deposit line: every day it waits is a day a student decides without the answer they asked for.",
      objective: item.nextStep ?? "Close the gap between the student's question and our answer.",
      successDefinition:
        "The student has the decision they were waiting on, and the queue behind them is shorter than it was this morning.",
      suggestedApproach:
        "Work the named list rather than the total, and report progress against arrivals rather than against the queue's own size.",
      suggestedChannel: item.selectedChannel ?? "email",
      sourceIds: [],
      sourceRevision: 1,
      provider: "demo",
      model: "demo-corpus",
      generatedAt: at(0, 11),
    },
    studentSummary: {
      state: "ready",
      version: 1,
      summary: `${item.student.name} is admitted to ${item.student.programName} for the Class of ${item.student.classYear} and has not yet completed this step.`,
      keyFacts: [
        `Program: ${item.student.programName}`,
        `Owner: ${item.assignee?.name ?? "unassigned"}`,
        `Raised ${item.signals.ageDays} days ago`,
      ],
      risks: [
        "Deposit not posted",
        item.signals.overdue ? "Past the date the student was given" : "Inside the promised window",
      ],
      nextSteps: [item.nextStep ?? "Contact the student with the outstanding decision."],
      sourceIds: [],
      sourceRevision: 1,
      provider: "demo",
      model: "demo-corpus",
      generatedAt: at(0, 11),
    },
    interactions: interactions.get(itemId) ?? [],
    comments: comments.get(itemId) ?? [],
    relatedItems: (board ?? [])
      .filter((entry) => entry.id !== item.id && entry.component === item.component)
      .slice(0, 3),
    relatedDocuments: [],
    aiState: "ready",
    generatedAt: at(0, 11),
  };
}

/* -------------------------------------- what the detail panel writes back */

/** A field edit from the detail panel: status, owner, escalation, next step. */
export function demoUpdateWorkItem(
  itemId: string,
  input: UpdateStaffWorkItemInput,
): StaffWorkItem {
  const item = findItem(itemId);
  if (!item) throw new Error("That task is not part of the demo board.");
  if (input.status && input.status !== item.status) demoMoveWorkItem(itemId, input.status);
  if (input.assigneeId !== undefined) {
    item.assignee =
      input.assigneeId === null
        ? null
        : ([currentStaff, ...DEMO_STAFF_DIRECTORY].find(
            (staff) => staff?.id === input.assigneeId,
          ) ?? item.assignee);
    item.signals = { ...item.signals, unassigned: item.assignee === null && isOpen(item) };
  }
  if (input.escalated !== undefined) item.escalated = input.escalated;
  if (input.selectedChannel !== undefined) item.selectedChannel = input.selectedChannel;
  if (input.followUpAt !== undefined) item.followUpAt = input.followUpAt;
  if (input.nextStep !== undefined) item.nextStep = input.nextStep;
  if (input.outcomeCode !== undefined) item.outcomeCode = input.outcomeCode;
  if (input.resolutionCode !== undefined) item.resolutionCode = input.resolutionCode;
  if (input.terminalReason !== undefined) item.terminalReason = input.terminalReason;
  if (input.blockerCode !== undefined) {
    item.blocker = input.blockerCode
      ? {
          code: input.blockerCode,
          detail: input.blockerDetail ?? "",
          reviewAt: input.blockerReviewAt ?? null,
        }
      : null;
  }
  item.version += 1;
  item.updatedAt = at(0, 11);
  if (input.note) {
    item.history = [
      ...item.history,
      {
        id: nextId("log"),
        action: "commented",
        message: input.note,
        actorName: currentStaff?.name ?? "Enrollment Operations",
        occurredAt: at(0, 11),
      },
    ];
  }
  return item;
}

export function demoAddComment(
  itemId: string,
  input: CreateStaffWorkCommentInput,
): StaffWorkItemDetail {
  const item = findItem(itemId);
  if (!item) throw new Error("That task is not part of the demo board.");
  comments.set(itemId, [
    ...(comments.get(itemId) ?? []),
    {
      id: nextId("comment"),
      body: input.body,
      author: currentStaff ?? DEMO_STAFF_DIRECTORY[0],
      mentions: DEMO_STAFF_DIRECTORY.filter((staff) =>
        (input.mentionIds ?? []).includes(staff.id),
      ),
      createdAt: at(0, 11),
    },
  ]);
  item.version += 1;
  item.updatedAt = at(0, 11);
  return demoWorkItemDetail(itemId)!;
}

export function demoStartInteraction(
  itemId: string,
  input: StartStaffInteractionInput,
): StaffWorkItemDetail {
  const item = findItem(itemId);
  if (!item) throw new Error("That task is not part of the demo board.");
  const interaction: StaffInteraction = {
    id: nextId("interaction"),
    objective: input.objective,
    status: "collecting",
    selectedChannel: input.channel,
    sourceVersion: 1,
    coveredSourceVersion: 1,
    version: 1,
    quietUntil: null,
    lastActivityAt: at(0, 11),
    completedAt: null,
    communications: [],
    recordings: [],
    outcome: null,
    aiState: "not_requested",
  };
  interactions.set(itemId, [...(interactions.get(itemId) ?? []), interaction]);
  item.selectedChannel = input.channel;
  item.startedAt = item.startedAt ?? at(0, 11);
  item.version += 1;
  item.updatedAt = at(0, 11);
  return demoWorkItemDetail(itemId)!;
}

export function demoRecordCommunication(
  interactionId: string,
  input: RecordStaffCommunicationInput,
): StaffWorkItemDetail {
  const found = findInteraction(interactionId);
  if (!found) throw new Error("That interaction is not part of the demo board.");
  const { itemId, interaction } = found;
  interaction.communications = [
    ...interaction.communications,
    {
      id: nextId("comm"),
      channel: input.channel,
      direction: input.direction,
      subject: input.subject ?? null,
      body: input.body,
      deliveryStatus: input.direction === "inbound" ? "received" : "recorded",
      sourceSequence: interaction.communications.length + 1,
      occurredAt: input.occurredAt ?? at(0, 11),
    },
  ];
  interaction.version += 1;
  interaction.status = "provisional";
  interaction.lastActivityAt = at(0, 11);
  return demoWorkItemDetail(itemId)!;
}

export function demoCompleteInteraction(
  interactionId: string,
  input: CompleteStaffInteractionInput,
): StaffWorkItemDetail {
  const found = findInteraction(interactionId);
  if (!found) throw new Error("That interaction is not part of the demo board.");
  const { itemId, interaction } = found;
  interaction.status = "completed";
  interaction.completedAt = at(0, 11);
  interaction.version += 1;
  interaction.aiState = "ready";
  interaction.outcome = {
    id: nextId("outcome"),
    version: 1,
    finality: "final",
    summary: input.nextStep ?? "Recorded from the demo action centre.",
    channelResults: interaction.selectedChannel
      ? [{ channel: interaction.selectedChannel, result: input.outcomeCode }]
      : [],
    outcomeCode: input.outcomeCode,
    resolutionCode: input.resolutionCode,
    nextStep: input.nextStep ?? null,
    followUpRequired: Boolean(input.followUpAt),
    sourceIds: [],
    coveredSourceVersion: 1,
    confidence: 0.82,
    conversationSignals: {
      sentiment: { label: "receptive", score: 0.7 },
      engagement: { label: "engaged", score: 0.66 },
      intent: "wants the outstanding decision before the deadline",
      likelihoodToProgress: { label: "likely", score: 0.64 },
    },
    provider: "demo",
    model: "demo-corpus",
    generatedAt: at(0, 11),
  };
  const item = findItem(itemId)!;
  item.outcomeCode = input.outcomeCode;
  item.resolutionCode = input.resolutionCode;
  item.nextStep = input.nextStep ?? item.nextStep;
  item.followUpAt = input.followUpAt ?? item.followUpAt;
  item.interactionCompletedAt = at(0, 11);
  item.version += 1;
  item.updatedAt = at(0, 11);
  return demoWorkItemDetail(itemId)!;
}

/** The insights are already written; a refresh simply hands them back. */
export function demoRefreshedDetail(itemId: string): StaffWorkItemDetail {
  const detail = demoWorkItemDetail(itemId);
  if (!detail) throw new Error("That task is not part of the demo board.");
  return detail;
}

/* --------------------------------------------- my students / action center */

interface StudentSeed {
  id: string;
  name: string;
  programName: string;
  classYear: number;
  stage: string;
  completed: number;
  total: number;
  score: number;
  band: StaffStudentOperation["risk"]["band"];
  category: StaffStudentOperation["risk"]["category"];
  melt: number;
  recovery: number;
  reason: string;
  signals: string[];
  action: {
    title: string;
    rationale: string;
    channel: StaffStudentOperation["recommendedAction"]["channel"];
    impact: string;
    taskKey: string | null;
  };
  history: Array<{
    channel: StaffStudentOperation["communicationHistory"][number]["channel"];
    direction: "inbound" | "outbound";
    summary: string;
    outcome: StaffStudentOperation["communicationHistory"][number]["outcome"];
    daysAgo: number;
  }>;
}

const STUDENT_SEEDS: StudentSeed[] = [
  {
    id: "demo-stu-1",
    name: "Sarah Johnson",
    programName: "Nursing, BSN",
    classYear: 2029,
    stage: "Deposit",
    completed: 4,
    total: 7,
    score: 87,
    band: "critical",
    category: "financial",
    melt: 71,
    recovery: 64,
    reason:
      "Commuter admit with an open verification file for nineteen days; the deposit deadline is inside the week.",
    signals: [
      "Verification worksheet outstanding since the admit letter",
      "Opened the deposit page four times without paying",
      "Attended the April commuter visit day",
    ],
    action: {
      title: "Call with the package date, not a reminder",
      rationale:
        "She is not deciding against us — she is waiting on a number. A reminder without the date repeats the wait.",
      channel: "voice",
      impact: "+1 deposit · 1 file cleared",
      taskKey: "AST-1042",
    },
    history: [
      { channel: "email", direction: "outbound", summary: "Deposit deadline reminder", outcome: "opened", daysAgo: 3 },
      { channel: "portal", direction: "inbound", summary: "Viewed the deposit step", outcome: "no_response", daysAgo: 2 },
      { channel: "email", direction: "inbound", summary: "Asked when her aid package arrives", outcome: "needs_follow_up", daysAgo: 1 },
    ],
  },
  {
    id: "demo-stu-2",
    name: "Michael Chen",
    programName: "Computer Science, BS",
    classYear: 2029,
    stage: "Financial aid",
    completed: 3,
    total: 7,
    score: 79,
    band: "high",
    category: "financial",
    melt: 62,
    recovery: 70,
    reason: "Packaged but not deposited; the award is 4 points below the comparable offer he named.",
    signals: [
      "Package released eleven days ago",
      "Named a competing offer in his last message",
      "No portal activity since the package landed",
    ],
    action: {
      title: "Walk the package line by line",
      rationale:
        "The gap he is comparing is gross, not net. Fifteen minutes on the phone is worth more than a second letter.",
      channel: "voice",
      impact: "+1 deposit · $19.5K net tuition",
      taskKey: "AST-1037",
    },
    history: [
      { channel: "email", direction: "outbound", summary: "Financial aid package released", outcome: "opened", daysAgo: 11 },
      { channel: "email", direction: "inbound", summary: "Comparing with another offer", outcome: "needs_follow_up", daysAgo: 5 },
    ],
  },
  {
    id: "demo-stu-4",
    name: "Lucas Fernandez",
    programName: "Mechanical Engineering, BS",
    classYear: 2029,
    stage: "Housing",
    completed: 5,
    total: 7,
    score: 61,
    band: "high",
    category: "administrative",
    melt: 44,
    recovery: 81,
    reason: "Deposited, but the housing contract is unsigned and the assignment round closes in five days.",
    signals: [
      "Deposit posted twelve days ago",
      "Housing intent never confirmed",
      "Listed a home address within commuting distance",
    ],
    action: {
      title: "Ask the one housing question",
      rationale:
        "He may not need a bed at all. A yes-or-no answer either releases the room or moves him into the real queue.",
      channel: "sms",
      impact: "1 bed released or assigned",
      taskKey: "AST-1028",
    },
    history: [
      { channel: "portal", direction: "inbound", summary: "Enrollment deposit paid", outcome: "completed", daysAgo: 12 },
      { channel: "email", direction: "outbound", summary: "Housing contract available", outcome: "delivered", daysAgo: 8 },
    ],
  },
  {
    id: "demo-stu-3",
    name: "Priya Raman",
    programName: "Business Administration, BS",
    classYear: 2028,
    stage: "Transfer evaluation",
    completed: 2,
    total: 6,
    score: 58,
    band: "high",
    category: "timing",
    melt: 46,
    recovery: 77,
    reason: "Transfer admit waiting nine days on a credit evaluation she needs before she will commit.",
    signals: [
      "31 credits submitted for evaluation",
      "Asked twice how many transfer in",
      "Deposit deadline is the same as the first-year round",
    ],
    action: {
      title: "Give her the credit count before the deadline",
      rationale:
        "The volume only converts if the offer reaches her while she is still deciding. The evaluation is the offer.",
      channel: "email",
      impact: "Protects 1 of 46 transfers",
      taskKey: "AST-1031",
    },
    history: [
      { channel: "email", direction: "inbound", summary: "How many of my credits transfer?", outcome: "needs_follow_up", daysAgo: 9 },
      { channel: "email", direction: "outbound", summary: "Evaluation in progress", outcome: "opened", daysAgo: 7 },
    ],
  },
  {
    id: "demo-stu-5",
    name: "Hannah Whitfield",
    programName: "Psychology, BA",
    classYear: 2029,
    stage: "Orientation",
    completed: 5,
    total: 7,
    score: 42,
    band: "medium",
    category: "engagement",
    melt: 29,
    recovery: 86,
    reason: "Deposited and unregistered for orientation; the session she wants is oversubscribed.",
    signals: [
      "Deposit posted three weeks ago",
      "Opened the orientation page twice",
      "Session 3 is 44 places over capacity",
    ],
    action: {
      title: "Offer Session 6 directly",
      rationale:
        "The unregistered melt at roughly twice the registered rate. A named alternative is cheaper than a reminder.",
      channel: "email",
      impact: "1 place filled · 1 signal cleared",
      taskKey: "AST-1024",
    },
    history: [
      { channel: "portal", direction: "inbound", summary: "Viewed orientation sessions", outcome: "no_response", daysAgo: 6 },
      { channel: "email", direction: "outbound", summary: "Orientation registration open", outcome: "opened", daysAgo: 14 },
    ],
  },
  {
    id: "demo-stu-13",
    name: "Emre Stonebrook",
    programName: "Civil Engineering, BS",
    classYear: 2029,
    stage: "International documents",
    completed: 3,
    total: 8,
    score: 38,
    band: "medium",
    category: "administrative",
    melt: 26,
    recovery: 74,
    reason: "Credential evaluation is with the external vendor; nothing on our side is outstanding.",
    signals: [
      "41 files with the evaluator",
      "Vendor queue is nine days deep",
      "Visa appointment already booked",
    ],
    action: {
      title: "Tell him it is us waiting, not him",
      rationale:
        "Silence during an external wait reads as a problem with his file. One line prevents the call that follows.",
      channel: "email",
      impact: "Holds 1 deposit through the wait",
      taskKey: "AST-0902",
    },
    history: [
      { channel: "email", direction: "outbound", summary: "Documents sent for evaluation", outcome: "delivered", daysAgo: 14 },
      { channel: "email", direction: "inbound", summary: "Any update on my transcripts?", outcome: "needs_follow_up", daysAgo: 4 },
    ],
  },
];

function studentFrom(seed: StudentSeed, staff: StaffMemberSummary): StaffStudentOperation {
  const task = (board ?? []).find((item) => item.key === seed.action.taskKey);
  return {
    id: seed.id,
    name: seed.name,
    preferredName: seed.name.split(" ")[0],
    programName: seed.programName,
    classYear: seed.classYear,
    assignedStaffId: staff.id,
    syntheticSeed: true,
    journey: {
      stage: seed.stage,
      completedTasks: seed.completed,
      totalTasks: seed.total,
      lastActivityAt: at(-seed.history[0].daysAgo, 14),
    },
    risk: {
      score: seed.score,
      band: seed.band,
      category: seed.category,
      meltLikelihoodPercent: seed.melt,
      recoveryLikelihoodPercent: seed.recovery,
      reason: seed.reason,
      signals: seed.signals,
      modelVersion: "melt-risk v4.2",
      evaluatedAt: at(0, 11),
    },
    recommendedAction: {
      title: seed.action.title,
      rationale: seed.action.rationale,
      channel: seed.action.channel,
      expectedImpact: seed.action.impact,
      taskId: task?.id ?? null,
      recommendedToday: true,
    },
    communicationHistory: seed.history.map((entry, index) => ({
      id: `${seed.id}-comm-${index}`,
      channel: entry.channel,
      direction: entry.direction,
      summary: entry.summary,
      outcome: entry.outcome,
      occurredAt: at(-entry.daysAgo, 14),
    })),
  };
}

/**
 * The Vice President's own queue: the six students she is working herself, and
 * the board items behind them. Rebuilt on every read so a card moved on the
 * task board is reflected here too.
 */
export function demoPersonalActionCenter(
  staff: StaffMemberSummary,
): StaffPersonalActionCenter {
  const items = boardFor(staff);
  const students = STUDENT_SEEDS.map((seed) => studentFrom(seed, staff));
  const tasks = items.filter((item) =>
    STUDENT_SEEDS.some((seed) => seed.action.taskKey === item.key),
  );
  return {
    staff,
    students,
    tasks,
    counts: {
      studentsToday: students.length,
      critical: students.filter((entry) => entry.risk.band === "critical").length,
      highRisk: students.filter((entry) => entry.risk.band === "high").length,
      inProgress: tasks.filter((item) => item.status === "in_progress").length,
      completed: tasks.filter((item) => item.status === "done").length,
    },
    generatedAt: at(0, 11),
  };
}

/* -------------------------------------------------- the rest of the Today */

export const DEMO_INQUIRIES: StaffInquiry[] = [
  {
    id: "demo-inq-1",
    student: student("demo-stu-1", "Sarah Johnson", "Nursing, BSN"),
    topicCode: "payments",
    subject: "When will my aid package arrive?",
    message:
      "My deposit is due Friday and I still have not seen a package. I do not want to lose the place.",
    status: "new",
    priority: "urgent",
    assignee: null,
    createdAt: at(0, 7),
    updatedAt: at(0, 7),
    version: 1,
  },
  {
    id: "demo-inq-2",
    student: student("demo-stu-3", "Priya Raman", "Business Administration, BS", 2028),
    topicCode: "documents",
    subject: "How many of my credits transfer?",
    message:
      "I sent 31 credits for evaluation nine days ago. Can someone tell me where that stands?",
    status: "new",
    priority: "high",
    assignee: null,
    createdAt: at(0, 8),
    updatedAt: at(0, 8),
    version: 1,
  },
  {
    id: "demo-inq-3",
    student: student("demo-stu-4", "Lucas Fernandez", "Mechanical Engineering, BS"),
    topicCode: "getting_started",
    subject: "Do I need a housing contract if I live at home?",
    message: "I deposited two weeks ago but I am commuting. Is the contract still required?",
    status: "new",
    priority: "medium",
    assignee: null,
    createdAt: at(-1, 16),
    updatedAt: at(-1, 16),
    version: 1,
  },
  {
    id: "demo-inq-4",
    student: student("demo-stu-13", "Emre Stonebrook", "Civil Engineering, BS"),
    topicCode: "documents",
    subject: "Any update on my transcripts?",
    message: "My visa appointment is booked and I want to be sure the evaluation is moving.",
    status: "open",
    priority: "medium",
    assignee: COLLEAGUES.international,
    createdAt: at(-2, 10),
    updatedAt: at(-1, 9),
    version: 2,
  },
  {
    id: "demo-inq-5",
    student: student("demo-stu-5", "Hannah Whitfield", "Psychology, BA"),
    topicCode: "getting_started",
    subject: "Session 3 orientation is full",
    message: "Every session I pick says it is full. Which one still has room?",
    status: "waiting_on_student",
    priority: "low",
    assignee: COLLEAGUES.advising,
    createdAt: at(-3, 13),
    updatedAt: at(-1, 11),
    version: 3,
  },
];

/** What the Today tab counts as trusted, published guidance. */
export const DEMO_PUBLISHED_KNOWLEDGE = 24;

export const DEMO_PORTAL_INVENTORY: StaffPortalInventoryItem[] = [
  {
    id: "onboarding",
    label: "Onboarding",
    description: "The steps an admitted student is walked through.",
    recordCount: 18,
    managementState: "editable",
  },
  {
    id: "enrollment",
    label: "Enrollment",
    description: "Deposits, deadlines and the offer response.",
    recordCount: 12,
    managementState: "editable",
  },
  {
    id: "classrooms",
    label: "Classrooms",
    description: "Course shells, sections and first-semester plans.",
    recordCount: 46,
    managementState: "editable",
  },
  {
    id: "campus_life",
    label: "Campus life",
    description: "Orientation sessions, events and visit days.",
    recordCount: 31,
    managementState: "editable",
  },
  {
    id: "financials",
    label: "Financials",
    description: "Aid packages, payment plans and the deposit ledger.",
    recordCount: 9,
    managementState: "partially_editable",
  },
];

export const DEMO_OUTREACH_RUNS: StaffOutreachRun[] = [
  {
    id: "demo-run-1",
    title: "Commuter deposit — package date call list",
    audience: "312 commuter admits with an open verification file",
    channel: "voice",
    requestedCount: 312,
    status: "simulation_only",
    createdBy: "Vivian Hale",
    createdAt: at(-1, 15),
  },
  {
    id: "demo-run-2",
    title: "Housing intent — one question",
    audience: "261 deposited commuter admits with no housing contract",
    channel: "sms",
    requestedCount: 261,
    status: "simulation_only",
    createdBy: "Sylvie Marchetti",
    createdAt: at(-2, 11),
  },
  {
    id: "demo-run-3",
    title: "Orientation Session 6 — direct offer",
    audience: "946 deposited students not registered for orientation",
    channel: "email",
    requestedCount: 946,
    status: "simulation_only",
    createdBy: "Desmond Okonkwo",
    createdAt: at(-4, 9),
  },
];
