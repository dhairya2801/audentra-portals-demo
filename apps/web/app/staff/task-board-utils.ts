import type {
  StaffActionCenterDueWindow,
  StaffActionCenterQuery,
  StaffActionCenterScopeCounts,
  StaffActionCenterScopes,
  StaffActionCenterSort,
  StaffActionCenterStatusScope,
  StaffAssignmentRole,
  StaffMemberSummary,
  StaffWorkItem,
  StaffWorkItemPriority,
  StaffWorkItemStatus,
  StaffWorkItemType,
} from "@vv/contracts";

/**
 * Who the board is read for. `mine` is `assignee=me`; `team` locks the
 * component filter to the signed-in member's component; `all` is the whole
 * institution. The three are the server's `scopes`, never a browser count.
 */
export type TaskBoardScope = "mine" | "team" | "all";
export type TaskDueWindow = StaffActionCenterDueWindow;
export type TaskStatusFilter = StaffActionCenterStatusScope | StaffWorkItemStatus;

/**
 * The toolbar state of the task board. Every field maps onto a parameter of
 * `GET /v1/staff/action-center`; nothing here is filtered in the browser.
 */
export interface TaskBoardFilters {
  query: string;
  scope: TaskBoardScope;
  /** `all`, `unassigned`, or a staff member id. Ignored in the `mine` scope. */
  assigneeId: string;
  workType: "all" | StaffWorkItemType;
  priority: "all" | StaffWorkItemPriority;
  status: TaskStatusFilter;
  /** In the `team` scope this is the member's own component and cannot change. */
  component: string;
  dueWindow: TaskDueWindow;
  stale: boolean;
  ownerRisk: boolean;
  sort: StaffActionCenterSort;
}

export const emptyTaskBoardFilters: TaskBoardFilters = {
  query: "",
  scope: "all",
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

/** The board opens on the member's own work when they own any; otherwise on their team's, else everyone's. */
export function defaultTaskBoardScope(
  scopes: Pick<StaffActionCenterScopes, "mine" | "myComponent"> | null | undefined,
): TaskBoardScope {
  if (!scopes) return "all";
  if (scopes.mine.open > 0) return "mine";
  if (scopes.myComponent.open > 0) return "team";
  return "all";
}

/** Move to a scope, keeping the other filters; `team` needs the member's component. */
export function withTaskBoardScope(
  filters: TaskBoardFilters,
  scope: TaskBoardScope,
  myComponent: string,
): TaskBoardFilters {
  if (scope === "team") {
    return { ...filters, scope, component: myComponent };
  }
  const component = filters.scope === "team" ? "all" : filters.component;
  return { ...filters, scope, component };
}

/** The server counts for the active scope: the column headers and the switch read these. */
export function scopeCountsFor(
  scopes: StaffActionCenterScopes | null | undefined,
  scope: TaskBoardScope,
): StaffActionCenterScopeCounts | null {
  if (!scopes) return null;
  return scope === "mine" ? scopes.mine : scope === "team" ? scopes.myComponent : scopes.all;
}

const assignmentRoleWords: Record<StaffAssignmentRole, string> = {
  primary_advisor: "primary adviser",
  admissions_counselor: "admissions",
  financial_aid_counselor: "financial aid",
  international_adviser: "international",
  housing_coordinator: "housing",
};

/** "your advisee (financial aid)" — the member's own relationship to an item's student, if any. */
export function viewerRelationshipLabel(
  roles: readonly StaffAssignmentRole[] | null | undefined,
): string | null {
  if (!roles || roles.length === 0) return null;
  if (roles.includes("primary_advisor") && roles.length === 1) return "Your advisee";
  const facets = roles
    .filter((role) => role !== "primary_advisor")
    .map((role) => assignmentRoleWords[role] ?? role.replaceAll("_", " "));
  return `Your advisee (${facets.join(", ")})`;
}

/** "financial aid counselor" — one role, humanized. */
export function assignmentRoleLabel(role: StaffAssignmentRole | string): string {
  return role === "primary_advisor" ? "primary adviser" : role.replaceAll("_", " ");
}

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

/** Turn toolbar state into the server query for one page. */
export function buildActionCenterQuery(
  filters: TaskBoardFilters,
  page: { limit?: number; offset?: number } = {},
): StaffActionCenterQuery {
  const search = filters.query.trim();
  const assignee =
    filters.scope === "mine"
      ? "me"
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

/**
 * The inverse of `buildActionCenterQuery`, for deep links from other views.
 * `assignee=me` lands in the `mine` scope; a component equal to the member's
 * own lands in `team`; anything else is read against everyone.
 */
export function filtersFromActionCenterQuery(
  query: StaffActionCenterQuery | null | undefined,
  myComponent?: string | null,
): TaskBoardFilters {
  if (!query) return { ...emptyTaskBoardFilters };
  const status = query.status;
  const scope: TaskBoardScope =
    query.assignee === "me"
      ? "mine"
      : query.component && myComponent && query.component === myComponent
        ? "team"
        : "all";
  return {
    query: query.search ?? "",
    scope,
    assigneeId: query.assignee && query.assignee !== "me" ? query.assignee : "all",
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

/** Whether anything beyond the scope itself narrows the board (the Clear button keeps the scope). */
export function hasActiveTaskBoardFilters(filters: TaskBoardFilters) {
  const baseline: TaskBoardFilters = {
    ...emptyTaskBoardFilters,
    scope: filters.scope,
    component: filters.scope === "team" ? filters.component : "all",
  };
  return Object.entries(baseline).some(
    ([key, value]) => filters[key as keyof TaskBoardFilters] !== value,
  );
}

/** Reset every filter but keep reading the same scope. */
export function clearedTaskBoardFilters(filters: TaskBoardFilters): TaskBoardFilters {
  return {
    ...emptyTaskBoardFilters,
    scope: filters.scope,
    component: filters.scope === "team" ? filters.component : "all",
  };
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
