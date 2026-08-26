import type {
  StaffActionCenterDueWindow,
  StaffActionCenterQuery,
  StaffActionCenterSort,
  StaffActionCenterStatusScope,
  StaffMemberSummary,
  StaffWorkItem,
  StaffWorkItemPriority,
  StaffWorkItemStatus,
  StaffWorkItemType,
} from "@vv/contracts";

export type TaskOwnershipScope = "all" | "mine" | "unassigned";
export type TaskDueWindow = StaffActionCenterDueWindow;
export type TaskStatusFilter = StaffActionCenterStatusScope | StaffWorkItemStatus;

/**
 * The toolbar state of the task board. Every field maps onto a parameter of
 * `GET /v1/staff/action-center`; nothing here is filtered in the browser.
 */
export interface TaskBoardFilters {
  query: string;
  ownership: TaskOwnershipScope;
  assigneeId: string;
  workType: "all" | StaffWorkItemType;
  priority: "all" | StaffWorkItemPriority;
  status: TaskStatusFilter;
  component: string;
  dueWindow: TaskDueWindow;
  stale: boolean;
  ownerRisk: boolean;
  sort: StaffActionCenterSort;
}

export const emptyTaskBoardFilters: TaskBoardFilters = {
  query: "",
  ownership: "all",
  assigneeId: "all",
  workType: "all",
  priority: "all",
  status: "open",
  component: "all",
  dueWindow: "all",
  stale: false,
  ownerRisk: false,
  sort: "priority",
};

/** Items fetched per request; the board appends pages rather than loading the whole queue. */
export const TASK_BOARD_PAGE_SIZE = 100;
/** Largest single request the API accepts. */
export const TASK_BOARD_MAX_LIMIT = 200;

export const openWorkStatuses: StaffWorkItemStatus[] = [
  "todo",
  "in_progress",
  "follow_up_required",
  "blocked",
];
export const closedWorkStatuses: StaffWorkItemStatus[] = ["done", "cancelled"];
const allWorkStatuses: StaffWorkItemStatus[] = [...openWorkStatuses, ...closedWorkStatuses];

const priorityRank: Record<StaffWorkItemPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const workStatuses = new Set<string>(allWorkStatuses);
const workTypes = new Set<string>(["enrollment", "document_review", "communication"]);
const priorities = new Set<string>(Object.keys(priorityRank));
const dueWindows = new Set<string>(["all", "overdue", "today", "seven_days", "no_due"]);
const sorts = new Set<string>(["priority", "due", "updated", "created", "stale"]);

function timestamp(value: string | null, fallback: number) {
  if (!value) return fallback;
  const result = Date.parse(value);
  return Number.isNaN(result) ? fallback : result;
}

/** Priority order, matching the API's default sort; used by legacy list views. */
export function compareStaffWorkItems(left: StaffWorkItem, right: StaffWorkItem) {
  const byPriority = priorityRank[left.priority] - priorityRank[right.priority];
  if (byPriority !== 0) return byPriority;

  const byDueDate =
    timestamp(left.dueAt, Number.POSITIVE_INFINITY) -
    timestamp(right.dueAt, Number.POSITIVE_INFINITY);
  if (byDueDate !== 0) return byDueDate;

  const byCreated =
    timestamp(left.createdAt, Number.POSITIVE_INFINITY) -
    timestamp(right.createdAt, Number.POSITIVE_INFINITY);
  if (byCreated !== 0) return byCreated;
  return left.key.localeCompare(right.key, undefined, { numeric: true });
}

/** Turn toolbar state into the server query for one page. */
export function buildActionCenterQuery(
  filters: TaskBoardFilters,
  page: { limit?: number; offset?: number } = {},
): StaffActionCenterQuery {
  const search = filters.query.trim();
  const assignee =
    filters.ownership === "mine"
      ? "me"
      : filters.ownership === "unassigned"
        ? "unassigned"
        : filters.assigneeId !== "all"
          ? filters.assigneeId
          : undefined;
  return {
    status: filters.status,
    priority: filters.priority === "all" ? undefined : filters.priority,
    workType: filters.workType === "all" ? undefined : filters.workType,
    component: filters.component === "all" ? undefined : filters.component,
    assignee,
    search: search || undefined,
    due: filters.dueWindow === "all" ? undefined : filters.dueWindow,
    stale: filters.stale ? true : undefined,
    ownerRisk: filters.ownerRisk ? true : undefined,
    sort: filters.sort,
    limit: page.limit ?? TASK_BOARD_PAGE_SIZE,
    offset: page.offset ?? 0,
  };
}

/** The inverse of `buildActionCenterQuery`, for deep links from other views. */
export function filtersFromActionCenterQuery(
  query: StaffActionCenterQuery | null | undefined,
): TaskBoardFilters {
  if (!query) return { ...emptyTaskBoardFilters };
  const status = query.status;
  return {
    query: query.search ?? "",
    ownership:
      query.assignee === "me" ? "mine" : query.assignee === "unassigned" ? "unassigned" : "all",
    assigneeId:
      query.assignee && query.assignee !== "me" && query.assignee !== "unassigned"
        ? query.assignee
        : "all",
    priority: query.priority && priorities.has(query.priority) ? query.priority : "all",
    workType: query.workType && workTypes.has(query.workType) ? query.workType : "all",
    status:
      status && (status === "open" || status === "closed" || status === "all" || workStatuses.has(status))
        ? status
        : "open",
    component: query.component ?? "all",
    dueWindow: query.due && dueWindows.has(query.due) ? query.due : "all",
    stale: query.stale === true,
    ownerRisk: query.ownerRisk === true,
    sort: query.sort && sorts.has(query.sort) ? query.sort : "priority",
  };
}

/** Serialize a query to URL parameters: undefined is omitted, booleans are literal. */
export function actionCenterQueryToParams(query: StaffActionCenterQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") {
      params.set(key, value ? "true" : "false");
    } else if (typeof value === "number") {
      if (Number.isFinite(value)) params.set(key, String(value));
    } else if (String(value).length > 0) {
      params.set(key, String(value));
    }
  }
  return params;
}

/** Which status columns the board shows for a status filter. */
export function visibleWorkStatuses(status: TaskStatusFilter): StaffWorkItemStatus[] {
  if (status === "open") return openWorkStatuses;
  if (status === "closed") return closedWorkStatuses;
  if (status === "all") return allWorkStatuses;
  return [status];
}

/** One linear pass; the server already ordered the items. */
export function groupWorkItemsByStatus(items: StaffWorkItem[]) {
  const groups: Record<StaffWorkItemStatus, StaffWorkItem[]> = {
    todo: [],
    in_progress: [],
    follow_up_required: [],
    blocked: [],
    done: [],
    cancelled: [],
  };
  for (const item of items) {
    (groups[item.status] ?? (groups[item.status] = [])).push(item);
  }
  return groups;
}

export function hasActiveTaskBoardFilters(filters: TaskBoardFilters) {
  return Object.entries(emptyTaskBoardFilters).some(
    ([key, value]) => filters[key as keyof TaskBoardFilters] !== value,
  );
}

/** "Priya Shah · on leave until 2026-09-01" — for select options and cards. */
export function staffAvailabilityNote(staff: StaffMemberSummary | null | undefined) {
  if (!staff) return null;
  if (staff.employmentStatus === "departed") return "departed";
  if (staff.employmentStatus === "on_leave") {
    return staff.leaveUntil ? `on leave until ${staff.leaveUntil}` : "on leave";
  }
  if (staff.awayUntil) {
    return `${staff.awayKind ? staff.awayKind.replaceAll("_", " ") : "away"} until ${staff.awayUntil.slice(0, 10)}`;
  }
  return null;
}

export function ownerRiskLabel(item: StaffWorkItem) {
  const risk = item.signals?.ownerRisk;
  if (!risk) return null;
  const assignee = item.assignee;
  if (risk === "departed") return "Owner departed";
  if (risk === "on_leave") {
    return assignee?.leaveUntil
      ? `Owner on leave until ${assignee.leaveUntil}`
      : "Owner on leave";
  }
  return assignee?.awayUntil
    ? `Owner away until ${assignee.awayUntil.slice(0, 10)}`
    : "Owner away";
}
