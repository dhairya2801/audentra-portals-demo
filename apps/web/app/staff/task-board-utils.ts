import type {
  StaffWorkItem,
  StaffWorkItemPriority,
  StaffWorkItemStatus,
  StaffWorkItemType,
} from "@vv/contracts";

export type TaskOwnershipScope = "all" | "mine" | "unassigned";
export type TaskDueWindow = "all" | "overdue" | "today" | "seven_days" | "no_due";

export interface TaskBoardFilters {
  query: string;
  ownership: TaskOwnershipScope;
  assigneeId: string;
  workType: "all" | StaffWorkItemType;
  priority: "all" | StaffWorkItemPriority;
  status: "all" | StaffWorkItemStatus;
  component: string;
  dueWindow: TaskDueWindow;
}

export const emptyTaskBoardFilters: TaskBoardFilters = {
  query: "",
  ownership: "all",
  assigneeId: "all",
  workType: "all",
  priority: "all",
  status: "all",
  component: "all",
  dueWindow: "all",
};

const priorityRank: Record<StaffWorkItemPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function timestamp(value: string | null, fallback: number) {
  if (!value) return fallback;
  const result = Date.parse(value);
  return Number.isNaN(result) ? fallback : result;
}

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

function isInDueWindow(item: StaffWorkItem, dueWindow: TaskDueWindow, now: Date) {
  if (dueWindow === "all") return true;
  if (dueWindow === "no_due") return item.dueAt === null;
  if (!item.dueAt) return false;

  const due = new Date(item.dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  if (dueWindow === "overdue") return due < now;
  if (dueWindow === "today") return due >= startOfToday && due < startOfTomorrow;

  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  return due >= now && due <= sevenDaysFromNow;
}

export function filterAndSortStaffWorkItems(
  items: StaffWorkItem[],
  filters: TaskBoardFilters,
  currentStaffId: string,
  now = new Date(),
) {
  const search = filters.query.trim().toLocaleLowerCase();
  return items
    .filter((item) => {
      if (filters.ownership === "mine" && item.assignee?.id !== currentStaffId) return false;
      if (filters.ownership === "unassigned" && item.assignee !== null) return false;
      if (filters.assigneeId !== "all" && item.assignee?.id !== filters.assigneeId) return false;
      if (filters.workType !== "all" && item.type !== filters.workType) return false;
      if (filters.priority !== "all" && item.priority !== filters.priority) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.component !== "all" && item.component !== filters.component) return false;
      if (!isInDueWindow(item, filters.dueWindow, now)) return false;
      if (!search) return true;
      return [
        item.key,
        item.title,
        item.description,
        item.student.name,
        item.student.preferredName,
        item.component,
        item.assignee?.name ?? "unassigned",
        item.type,
        item.actionType,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search);
    })
    .sort(compareStaffWorkItems);
}

export function hasActiveTaskBoardFilters(filters: TaskBoardFilters) {
  return Object.entries(emptyTaskBoardFilters).some(
    ([key, value]) => filters[key as keyof TaskBoardFilters] !== value,
  );
}
