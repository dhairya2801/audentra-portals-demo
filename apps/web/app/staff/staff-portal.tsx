"use client";
import {Student360Summary} from "./student360-summary";
import { ResetDemo } from "./reset-demo";

import { UniversityOperationsPanel, UniversityRecordPanel } from "../components/university-record";

import type {
  CampusEvent,
  CatalogCourse,
  CreateStaffWorkItemInput,
  StaffActionCenter,
  StaffActionCenterQuery,
  StaffActionCenterSort,
  StaffActionType,
  StaffCorePlay,
  StaffInquiry,
  StaffKnowledgeCard,
  StaffManagedConfiguration,
  StaffManagedConfigurationKind,
  StaffMemberSummary,
  StaffOperationsWorkspace,
  StaffStudentOperation,
  StaffWorkItem,
  StaffTaskBoardContext,
  StaffWorkItemPriority,
  StaffWorkItemStatus,
  StaffWorkItemType,
  StudentClub,
} from "@vv/contracts";
import {
  type DragEvent as ReactDragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TenantLink as Link } from "../components/tenant-link";
import { StaffEdwardAssistant } from "../components/staff-edward-assistant";
import { PortalMark } from "../components/portal-ui";
import { useApiAction, useApiResource } from "../hooks/use-api-resource";
import {
  ApiClientError,
  createStaffClub,
  createStaffCorePlay,
  createStaffKnowledgeCard,
  createStaffWorkItem,
  draftStaffConfigurationWithEdward,
  getStaffActionCenter,
  getStaffInquiryThread,
  getStaffMe,
  getStaffOperationsWorkspace,
  searchStaffStudents,
  signOutStaff,
  simulateStaffOutreach,
  updateStaffClub,
  updateStaffCorePlay,
  updateStaffInquiry,
  updateStaffKnowledgeCard,
  updateStaffManagedConfiguration,
  updateStaffWorkItem,
  uploadStaffPortalMedia,
} from "../lib/api-client";
import {
  StaffSignIn,
  StudentInspector,
  WorkItemCard,
  WorkItemSignals,
} from "./staff-action-center";
import { ActionCenterDetail } from "./action-center-detail";
import { ActionRulesEditor } from "./action-rules-editor";
import { JourneyFlowBuilder } from "./journey-flow-builder";
import { ApprovedTaskBoard, ApprovedBoardNavigation, useApprovedBoardOpenCount } from "./approved-task-board";
import { MorningBrewView } from "./morning-brew/morning-brew";
import { NotificationCenter } from "./notification-center";
import { StaffProfileView } from "./staff-profile";
import { connectStaffRealtime, type StaffRealtimeEvent } from "./staff-realtime";
import {
  assignmentRoleLabel,
  buildActionCenterQuery,
  clearedTaskBoardFilters,
  defaultTaskBoardScope,
  emptyTaskBoardFilters,
  filtersFromActionCenterQuery,
  groupWorkItemsByStatus,
  hasActiveTaskBoardFilters,
  scopeCountsFor,
  staffAvailabilityNote,
  TASK_BOARD_MAX_LIMIT,
  TASK_BOARD_PAGE_SIZE,
  viewerRelationshipLabel,
  visibleWorkStatuses,
  withTaskBoardScope,
  type TaskBoardFilters,
  type TaskBoardScope,
  type TaskDueWindow,
  type TaskStatusFilter,
} from "./task-board-utils";

type StaffView =
  | "morning_brew"
  | "overview"
  | "tasks"
  | "students"
  | "journeys"
  | "outreach"
  | "knowledge"
  | "core_plays"
  | "messages"
  | "campus_life"
  | "academics"
  | "edward"
  | "profile";

interface StaffRealtimeNotice {
  eventId: number;
  title: string;
  body: string;
  workItemId: string | null;
}

function realtimeWorkItemId(event: StaffRealtimeEvent) {
  if (!event.data || typeof event.data !== "object") return null;
  const envelope = event.data as {
    workItemId?: unknown;
    data?: { workItemId?: unknown };
  };
  const candidate = envelope.workItemId ?? envelope.data?.workItemId;
  return typeof candidate === "string" && candidate ? candidate : null;
}

function realtimeNoticeFor(event: StaffRealtimeEvent): StaffRealtimeNotice | null {
  const envelope =
    event.data && typeof event.data === "object"
      ? (event.data as { data?: unknown })
      : {};
  const payload =
    envelope.data && typeof envelope.data === "object"
      ? (envelope.data as Record<string, unknown>)
      : {};
  const workItemId = realtimeWorkItemId(event);
  const explicitTitle =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : null;
  const explicitBody =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body.trim()
      : null;
  if (event.type === "staff.ai_update.available") {
    return null;
  }
  if (event.type === "staff.inquiry.archived") {
    return null;
  }
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  const notices = {
    new_student_inquiry: {
      title: "New student inquiry",
      body: "A student requested help from the portal. The linked action is ready for triage.",
    },
    student_inquiry_reply: {
      title: "Student replied",
      body: "A new portal message is available on an existing student action.",
    },
    document_parse_review: {
      title: "Document parsing needs human review",
      body: "Automatic extraction failed. The original file is safe and the review action is ready.",
    },
    document_review_ready: {
      title: "Student document ready for review",
      body: "A newly uploaded student document is available for staff review.",
    },
    student_document_recovered: {
      title: "Student document issue resolved",
      body: "The student successfully uploaded a replacement and the linked help action was resolved.",
    },
    work_item_created: {
      title: "New enrollment task",
      body: "A new staff action was created and routed to its owner or team.",
    },
    follow_up_due: {
      title: "Scheduled follow-up is due",
      body: "The scheduler returned this action to To Do at its planned follow-up time.",
    },
    blocked_review_due: {
      title: "Blocked action needs review",
      body: "The blocker review time passed, so the scheduler escalated this action.",
    },
    sla_overdue: {
      title: "Action SLA is overdue",
      body: "The due time passed, so the scheduler escalated this action for team or leader attention.",
    },
  };
  const fallback = notices[kind as keyof typeof notices];
  return {
    eventId: event.id,
    title: explicitTitle ?? fallback?.title ?? "Staff workspace updated",
    body:
      explicitBody ??
      fallback?.body ??
      "Canonical staff data has refreshed. Open the related action when you are ready.",
    workItemId,
  };
}

const viewOrder: StaffView[] = [
  "morning_brew",
  "overview",
  "tasks",
  "students",
  "journeys",
  "outreach",
  "knowledge",
  "core_plays",
  "messages",
  "campus_life",
  "academics",
  "edward",
  "profile",
];

const navigation: Array<{
  label: string;
  items: Array<{
    id: StaffView;
    label: string;
    icon: string;
    badge?: "inquiries" | "tasks";
  }>;
}> = [
  {
    label: "Workspace",
    items: [
      { id: "morning_brew", label: "Morning Brew", icon: "✦" },
      { id: "tasks", label: "Task Board", icon: "✓", badge: "tasks" },
      { id: "students", label: "Student 360", icon: "◎" },
    ],
  },
  {
    label: "Developing",
    items: [
      { id: "outreach", label: "Action Center", icon: "↗" },
      { id: "overview", label: "Today", icon: "⌂" },
      { id: "messages", label: "Messages", icon: "M", badge: "inquiries" },
      { id: "journeys", label: "Journeys", icon: "J" },
      { id: "campus_life", label: "Campus life", icon: "C" },
      { id: "academics", label: "Academics", icon: "A" },
      { id: "knowledge", label: "Knowledge base", icon: "K" },
      { id: "core_plays", label: "Core plays", icon: "P" },
      { id: "edward", label: "Edward", icon: "E" },
    ],
  },
];

const workColumns: Array<{
  status: StaffWorkItemStatus;
  title: string;
  description: string;
}> = [
  { status: "todo", title: "To do", description: "Ready for an owner" },
  {
    status: "in_progress",
    title: "In progress",
    description: "Actively being worked",
  },
  {
    status: "follow_up_required",
    title: "Follow-up",
    description: "Waiting on a dated next action",
  },
  { status: "blocked", title: "Blocked", description: "Needs a dependency or decision" },
  { status: "done", title: "Done", description: "Resolved work" },
  { status: "cancelled", title: "Cancelled", description: "Closed without completion" },
];

const createTaskActionTypes: Array<{
  value: StaffActionType;
  label: string;
}> = [
  { value: "enrollment_follow_up", label: "Enrollment follow-up" },
  { value: "onboarding_assistance", label: "Onboarding assistance" },
  { value: "document_review", label: "Document review" },
  { value: "missing_information", label: "Missing information" },
  { value: "external_verification", label: "External verification" },
  { value: "deadline_risk", label: "Deadline risk" },
  { value: "staff_decision", label: "Staff decision" },
  { value: "communication_response", label: "Communication response" },
  { value: "blocked_dependency", label: "Blocked dependency" },
];

const viewCopy: Record<
  StaffView,
  { eyebrow: string; title: string; description: string }
> = {
  morning_brew: {
    eyebrow: "Executive intelligence",
    title: "Morning Brew",
    description:
      "Your personalized daily briefing across enrollment, student success, and institutional operations.",
  },
  overview: {
    eyebrow: "Enrollment operations",
    title: "Today’s enrollment work",
    description:
      "A clear view of today’s student work, team capacity, and content that needs attention.",
  },
  tasks: {
    eyebrow: "Enrollment task management",
    title: "Task board",
    description:
      "Coordinate student work Jira-style, assign owners, and keep every colleague on the same shared record.",
  },
  students: {
    eyebrow: "Student operations",
    title: "Student 360",
    description:
      "One student. The full picture. Understand their progress, connect the right people, and make the next step clear.",
  },
  journeys: {
    eyebrow: "Journey configuration",
    title: "Onboarding and enrollment",
    description:
      "Manage the ordered experiences students complete before and after accepting their offer.",
  },
  outreach: {
    eyebrow: "Assigned enrollment decisions",
    title: "Action center",
    description:
      "Work your prioritized students, understand why each was flagged, and take the next best action with full communication context.",
  },
  knowledge: {
    eyebrow: "Institutional knowledge",
    title: "Knowledge base",
    description:
      "Maintain trusted university and department guidance for staff, students, and future agents.",
  },
  core_plays: {
    eyebrow: "Operational playbooks",
    title: "Core plays",
    description:
      "Turn repeatable staff work into clear triggers, audiences, steps, and controlled automation.",
  },
  messages: {
    eyebrow: "Student communications",
    title: "Message portal",
    description:
      "Triage student inquiries, assign an owner, respond, and notify the student inbox.",
  },
  campus_life: {
    eyebrow: "Student-facing content",
    title: "Campus life",
    description:
      "Edit the events, clubs, and organizations students discover in their Campus Life experience.",
  },
  academics: {
    eyebrow: "Academic configuration",
    title: "Courses and catalog",
    description:
      "Manage the student classroom catalog and Edward-assisted academic planning content.",
  },
  edward: {
    eyebrow: "Staff copilot",
    title: "Edward for staff",
    description:
      "Ask for data, drafts, and operational plans across the staff workspace with confirmations before any write.",
  },  profile: {
    eyebrow: "Your record",
    title: "Profile",
    description:
      "Who you are in the organisation, your numbers, your calendar, and the students that are yours.",
  },
};

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

type ManagedDocument = Record<string, unknown>;

function editableConfigurationDocument(
  configuration: StaffManagedConfiguration,
): ManagedDocument {
  const document = configuration.document;
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("The managed configuration is not an editable document.");
  }
  return structuredClone(document);
}

function managedRecords(
  document: ManagedDocument,
  key: "flows" | "events" | "courses",
) {
  const records = document[key];
  if (!Array.isArray(records)) {
    throw new Error(`The managed configuration has no ${key} records.`);
  }
  return records as Array<Record<string, unknown>>;
}

function utcInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 16);
}

function utcIsoValue(value: FormDataEntryValue | null) {
  return new Date(`${String(value)}:00.000Z`).toISOString();
}

function optionalUtcIsoValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim() ? utcIsoValue(value) : null;
}

function newManagedEventId(title: string, records: Array<Record<string, unknown>>) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "campus-event";
  const existing = new Set(records.map((record) => String(record.id)));
  if (!existing.has(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function managementLabel(
  state: StaffOperationsWorkspace["portalInventory"][number]["managementState"],
) {
  if (state === "editable") return "Editable now";
  if (state === "partially_editable") return "Partially editable";
  return "Planned";
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "preview";
}) {
  return <span className={`staff-status-pill staff-status-pill--${tone}`}>{children}</span>;
}

function PageHeading({
  view,
  action,
}: {
  view: StaffView;
  action?: React.ReactNode;
}) {
  const copy = viewCopy[view];
  return (
    <header className="staff-page-heading staff-page-heading--workspace">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </div>
      {action}
    </header>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "navy",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "navy" | "gold" | "green" | "coral";
}) {
  return (
    <article className={`staff-metric-card staff-metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function OverviewView({
  workspace,
  navigate,
}: {
  workspace: StaffOperationsWorkspace;
  navigate: (view: StaffView) => void;
}) {
  const personal = workspace.personalActionCenter;
  // The first page of the member's own queue, already in attention order.
  const openItems = personal.tasks;
  const newInquiries = workspace.inquiries.filter(
    (item) => item.status === "new",
  );
  const publishedKnowledge = workspace.knowledgeBase.filter(
    (item) => item.status === "published",
  );

  return (
    <>
      <PageHeading
        view="overview"
        action={
          <button
            className="button button--primary"
            type="button"
            onClick={() => navigate("outreach")}
          >
            Open my Task Board
          </button>
        }
      />

      <section className="staff-metric-grid" aria-label="Today at a glance">
        <MetricCard
          label="Open work · mine"
          value={personal.counts.open}
          detail={`${personal.counts.inProgress} in progress · ${personal.counts.students} students`}
        />
        <MetricCard
          label="Overdue · mine"
          value={personal.counts.overdue}
          detail={`${personal.counts.escalated} escalated · ${personal.counts.dueToday} due today`}
          tone="coral"
        />
        <MetricCard
          label="New inquiries"
          value={newInquiries.length}
          detail="Waiting for first response"
          tone="gold"
        />
        <MetricCard
          label="Trusted guidance"
          value={publishedKnowledge.length}
          detail="Published knowledge cards"
          tone="green"
        />
      </section>

      <div className="staff-dashboard-grid">
        <section className="staff-panel staff-panel--priority">
          <header className="staff-panel__heading">
            <div>
              <p className="eyebrow">Your queue · start here</p>
              <h2>{personal.queue.total > 0 ? `${personal.queue.total.toLocaleString()} open items assigned to you` : "Nothing assigned to you"}</h2>
            </div>
            <button type="button" onClick={() => navigate("outreach")}>
              Open Task Board
            </button>
          </header>
          <div className="staff-priority-list">
            {openItems.length === 0 && <p className="staff-quiet-empty">Your assigned work is clear. Open the Action Center to review your team’s queue.</p>}
            {openItems.slice(0, 4).map((item) => (
              <button type="button" onClick={() => navigate("outreach")} key={item.id}>
                <span
                  className={`staff-priority-dot staff-priority-dot--${item.priority}`}
                  aria-hidden="true"
                />
                <span>
                  <strong>{item.student.name}</strong>
                  <small>{item.title}</small>
                </span>
                <span className="staff-priority-list__owner">
                  {item.component}
                  <small>{dueSummary(item)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="staff-panel">
          <header className="staff-panel__heading">
            <div>
              <p className="eyebrow">Student messages</p>
              <h2>Latest inquiries</h2>
            </div>
            <button type="button" onClick={() => navigate("messages")}>
              Open inbox
            </button>
          </header>
          <div className="staff-inquiry-preview">
            {workspace.inquiries.length === 0 && <p className="staff-quiet-empty">No active inquiries. Student questions will appear here when they arrive.</p>}
            {workspace.inquiries.slice(0, 3).map((inquiry) => (
              <button type="button" onClick={() => navigate("messages")} key={inquiry.id}>
                <span>{inquiry.student.preferredName.slice(0, 1)}</span>
                <span>
                  <strong>{inquiry.subject}</strong>
                  <small>
                    {inquiry.student.name} · {formatTime(inquiry.createdAt)}
                  </small>
                </span>
                <StatusPill tone={inquiry.status === "new" ? "warning" : "neutral"}>
                  {inquiry.status.replaceAll("_", " ")}
                </StatusPill>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="staff-panel staff-experience-panel">
        <header className="staff-panel__heading">
          <div>
            <p className="eyebrow">Student experience</p>
            <h2>Manage what students see</h2>
          </div>
          <button type="button" onClick={() => navigate("journeys")}>
            Manage student experience
          </button>
        </header>
        <div className="staff-experience-strip">
          {workspace.portalInventory.slice(0, 5).map((item) => (
            <article key={item.id}>
              <span>{item.label.slice(0, 1)}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.recordCount} managed records</small>
              </div>
              <StatusPill
                tone={
                  item.managementState === "editable"
                    ? "success"
                    : item.managementState === "planned"
                      ? "preview"
                      : "warning"
                }
              >
                {managementLabel(item.managementState)}
              </StatusPill>
            </article>
          ))}
        </div>
      </section>

      <section className="staff-automation-banner">
        <div className="staff-automation-banner__mark">E</div>
        <div>
          <p className="eyebrow">Edward for staff</p>
          <h2>Turn a request into a reviewable plan</h2>
          <p>
            Read operational data, draft journey changes, and preview outreach.
            External email, SMS, and voice execution remains disabled.
          </p>
        </div>
        <button type="button" onClick={() => navigate("edward")}>
          Ask Edward
        </button>
      </section>
    </>
  );
}

// Retained inspection component for internal tooling; product navigation uses ApprovedTaskBoard.
export function TaskBoardView({
  workspace,
  refresh,
  initialWorkItemId = null,
  initialQuery = null,
  onDetailClosed,
}: {
  workspace: StaffOperationsWorkspace;
  refresh: () => void;
  initialWorkItemId?: string | null;
  initialQuery?: StaffActionCenterQuery | null;
  onDetailClosed?: () => void;
}) {
  const [openDetailId, setOpenDetailId] = useState<string | null>(initialWorkItemId);
  const [createOpen, setCreateOpen] = useState(false);
  const myComponent = workspace.currentStaff.component;
  // A deep link decides the scope; otherwise the board opens on the reader's
  // own work when they own any, on their team's when they don't.
  const [filters, setFilters] = useState<TaskBoardFilters>(() =>
    initialQuery
      ? filtersFromActionCenterQuery(initialQuery, myComponent)
      : withTaskBoardScope(
          emptyTaskBoardFilters,
          defaultTaskBoardScope(workspace.actionCenter.scopes),
          myComponent,
        ),
  );
  const [debouncedQuery, setDebouncedQuery] = useState(filters.query);
  const draggedId = useRef<string | null>(null);
  const [dropTarget, setDropTarget] =
    useState<StaffWorkItemStatus | null>(null);
  const [boardMessage, setBoardMessage] = useState<string | null>(null);

  // The board is server-paged. `board` is the last page envelope (counts,
  // facets, page) and `items` is everything loaded so far, in server order.
  const [board, setBoard] = useState<StaffActionCenter>(workspace.actionCenter);
  const [items, setItems] = useState<StaffWorkItem[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadedCount = useRef(0);
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(filters.query), 300);
    return () => window.clearTimeout(timer);
  }, [filters.query]);

  const activeFilters = useMemo(
    () => ({ ...filters, query: debouncedQuery }),
    [filters, debouncedQuery],
  );
  const activeQueryKey = JSON.stringify(buildActionCenterQuery(activeFilters, { offset: 0 }));

  /**
   * Re-fetch everything the reader has loaded so far (at least one page), in
   * bounded requests, and replace the list atomically when the last one lands.
   */
  const reloadLoaded = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const sequence = ++requestSequence.current;
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      if (!options.silent) setLoadState("loading");
      const target = Math.max(TASK_BOARD_PAGE_SIZE, loadedCount.current);
      const collected: StaffWorkItem[] = [];
      try {
        let envelope: StaffActionCenter | null = null;
        for (let offset = 0; offset < target; offset += TASK_BOARD_MAX_LIMIT) {
          const limit = Math.min(TASK_BOARD_MAX_LIMIT, target - offset);
          envelope = await getStaffActionCenter(
            buildActionCenterQuery(activeFilters, { limit, offset }),
            controller.signal,
          );
          collected.push(...envelope.items);
          if (!envelope.page.hasMore) break;
        }
        if (sequence !== requestSequence.current || !envelope) return;
        setBoard(envelope);
        setItems(collected);
        loadedCount.current = collected.length;
        setLoadError(null);
        setLoadState("ready");
      } catch (error) {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setLoadError(
          error instanceof Error ? error.message : "The task board could not be loaded.",
        );
        setLoadState("error");
      }
    },
    [activeFilters],
  );

  // A new query starts again from the first page.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      loadedCount.current = 0;
      void reloadLoaded();
    });
    return () => {
      cancelled = true;
      activeController.current?.abort();
    };
    // activeQueryKey is the serialized form of activeFilters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQueryKey]);

  // The workspace poll and realtime events refresh the workspace every ~10s;
  // piggyback on that to keep the loaded pages current without a second timer.
  const workspaceStamp = workspace.actionCenter.generatedAt;
  const lastStamp = useRef(workspaceStamp);
  useEffect(() => {
    if (lastStamp.current === workspaceStamp) return;
    lastStamp.current = workspaceStamp;
    if (loadState !== "ready" || loadingMore) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reloadLoaded({ silent: true });
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceStamp, loadState, loadingMore, reloadLoaded]);

  const loadMore = async () => {
    if (loadingMore || !board.page.hasMore) return;
    const sequence = ++requestSequence.current;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setLoadingMore(true);
    try {
      const envelope = await getStaffActionCenter(
        buildActionCenterQuery(activeFilters, {
          limit: TASK_BOARD_PAGE_SIZE,
          offset: items.length,
        }),
        controller.signal,
      );
      if (sequence !== requestSequence.current) return;
      setBoard(envelope);
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        const next = current.concat(envelope.items.filter((item) => !seen.has(item.id)));
        loadedCount.current = next.length;
        return next;
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setBoardMessage(
        error instanceof Error ? error.message : "More tasks could not be loaded.",
      );
    } finally {
      if (sequence === requestSequence.current) setLoadingMore(false);
    }
  };

  const counts = board.counts;
  const scopes = board.scopes ?? workspace.actionCenter.scopes;
  const scopeCounts = scopeCountsFor(scopes, filters.scope);
  const facets = board.facets ?? workspace.actionCenter.facets;
  const staffDirectory = board.staff.length ? board.staff : workspace.actionCenter.staff;
  const grouped = useMemo(() => groupWorkItemsByStatus(items), [items]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const visibleColumns = useMemo(() => {
    const statuses = new Set(visibleWorkStatuses(filters.status));
    return workColumns.filter((column) => statuses.has(column.status));
  }, [filters.status]);

  const components = useMemo(() => {
    const byName = new Map<string, number | null>();
    for (const facet of facets?.components ?? []) byName.set(facet.component, facet.open);
    if (!byName.has(workspace.currentStaff.component)) {
      byName.set(workspace.currentStaff.component, null);
    }
    if (filters.component !== "all" && !byName.has(filters.component)) {
      byName.set(filters.component, null);
    }
    return Array.from(byName.entries())
      .map(([component, open]) => ({ component, open }))
      .sort((left, right) => left.component.localeCompare(right.component));
  }, [facets, filters.component, workspace.currentStaff.component]);
  const componentNames = useMemo(
    () => components.map((entry) => entry.component),
    [components],
  );

  const assignees = useMemo(() => {
    const openByStaff = new Map<string, number>();
    const byId = new Map<string, StaffMemberSummary>();
    for (const facet of facets?.assignees ?? []) {
      if (!facet.staff) continue;
      openByStaff.set(facet.staff.id, facet.open);
      byId.set(facet.staff.id, facet.staff);
    }
    for (const staff of staffDirectory) if (!byId.has(staff.id)) byId.set(staff.id, staff);
    const current = byId.get(workspace.currentStaff.id) ?? workspace.currentStaff;
    byId.delete(workspace.currentStaff.id);
    const rest = Array.from(byId.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    return [current, ...rest].map((staff) => ({
      staff,
      open: openByStaff.get(staff.id) ?? null,
    }));
  }, [facets, staffDirectory, workspace.currentStaff]);
  const assigneeSummaries = useMemo(
    () => assignees.map((entry) => entry.staff),
    [assignees],
  );

  const updateFilter = <Key extends keyof TaskBoardFilters>(
    key: Key,
    value: TaskBoardFilters[Key],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const afterMutation = () => {
    refresh();
    void reloadLoaded({ silent: true });
  };

  const moveItem = async (
    itemId: string,
    status: StaffWorkItemStatus,
  ) => {
    const item = itemsById.get(itemId);
    if (!item || item.status === status) return;
    if (!["todo", "in_progress"].includes(status)) {
      setOpenDetailId(item.id);
      setBoardMessage(
        `${columnTitle(status)} needs outcome, blocker, follow-up, or cancellation details.`,
      );
      return;
    }
    setBoardMessage(`Moving ${item.key}...`);
    try {
      await updateStaffWorkItem(item.id, {
        expectedVersion: item.version,
        status,
        note: `Moved to ${status.replaceAll("_", " ")} on the task board.`,
      });
      setBoardMessage(
        `${item.key} moved to ${status.replaceAll("_", " ")}.`,
      );
    } catch (error) {
      setBoardMessage(
        error instanceof Error
          ? error.message
          : "The task could not be moved.",
      );
    } finally {
      draggedId.current = null;
      setDropTarget(null);
      afterMutation();
    }
  };

  const total = board.page?.total ?? items.length;
  // Column totals describe the active scope (yours / your team's / everyone's),
  // from the server's scope counts; the legacy board-wide counts are the fallback.
  const columnSource = scopeCounts ?? counts;
  const columnCount = (status: StaffWorkItemStatus) =>
    status === "todo"
      ? columnSource.todo
      : status === "in_progress"
        ? columnSource.inProgress
        : status === "follow_up_required"
          ? columnSource.followUpRequired
          : status === "blocked"
            ? columnSource.blocked
            : status === "done"
              ? columnSource.done
              : columnSource.cancelled;
  const scopeLabel =
    filters.scope === "mine" ? "Mine" : filters.scope === "team" ? `My team · ${myComponent}` : "Everyone";
  const scopeOptions: Array<{ scope: TaskBoardScope; label: string; detail: string; open: number | null }> = [
    { scope: "mine", label: "Mine", detail: "Assigned to you", open: scopes?.mine.open ?? null },
    {
      scope: "team",
      label: "My team",
      detail: scopes?.component ?? myComponent,
      open: scopes?.myComponent.open ?? null,
    },
    { scope: "all", label: "Everyone", detail: "Whole institution", open: scopes?.all.open ?? null },
  ];
  const changeScope = (scope: TaskBoardScope) =>
    setFilters((current) => withTaskBoardScope(current, scope, myComponent));

  return (
    <>
      <PageHeading
        view="tasks"
        action={
          <div className="staff-heading-actions">
            <StatusPill tone="success">Live shared queue</StatusPill>
            <button
              className="staff-create-task-button"
              type="button"
              onClick={() => setCreateOpen(true)}
            >
              <span aria-hidden="true">+</span>
              Create task
            </button>
          </div>
        }
      />
      <section className="staff-task-toolbar" aria-label="Task filters">
        <div className="staff-task-toolbar__primary">
          <label className="staff-search-field">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search work items</span>
            <input
              type="search"
              value={filters.query}
              placeholder="Search task, key, student, owner, or team"
              onChange={(event) => updateFilter("query", event.target.value)}
            />
          </label>
          <strong aria-live="polite">
            {loadState === "loading"
              ? "Loading tasks…"
              : `Showing ${items.length} of ${total.toLocaleString()} tasks`}
          </strong>
        </div>
        <div className="staff-board-scope" role="group" aria-label="Board scope">
          <div className="staff-scope-switch">
            {scopeOptions.map((option) => (
              <button
                className={filters.scope === option.scope ? "is-active" : undefined}
                type="button"
                aria-pressed={filters.scope === option.scope}
                onClick={() => changeScope(option.scope)}
                data-board-scope={option.scope}
                key={option.scope}
              >
                <strong>{option.label}</strong>
                <span>
                  {option.open !== null ? `${option.open.toLocaleString()} open` : "—"}
                  {" · "}
                  {option.detail}
                </span>
              </button>
            ))}
          </div>
          <p className="staff-board-scope__note" aria-live="polite">
            {scopeCounts ? (
              <>
                <strong>{scopeLabel}:</strong> {scopeCounts.open.toLocaleString()} open across{" "}
                {scopeCounts.students.toLocaleString()} student{scopeCounts.students === 1 ? "" : "s"}
                {scopeCounts.overdue > 0 ? ` · ${scopeCounts.overdue.toLocaleString()} overdue` : ""}
                {scopeCounts.urgent > 0 ? ` · ${scopeCounts.urgent.toLocaleString()} urgent` : ""}
                {scopeCounts.escalated > 0 ? ` · ${scopeCounts.escalated.toLocaleString()} escalated` : ""}
                {scopeCounts.unassigned > 0 ? ` · ${scopeCounts.unassigned.toLocaleString()} unassigned` : ""}
                {filters.scope === "mine" && scopeCounts.open === 0
                  ? " — nothing is assigned to you; switch to your team or everyone."
                  : ""}
              </>
            ) : (
              "Counts are computed by the server for each scope."
            )}
          </p>
        </div>
        <div className="staff-task-filter-grid">
          <label hidden={filters.scope === "mine"}>
            <span>Assignee</span>
            <select
              value={filters.scope === "mine" ? "all" : filters.assigneeId}
              disabled={filters.scope === "mine"}
              onChange={(event) => updateFilter("assigneeId", event.target.value)}
            >
              <option value="all">Anyone</option>
              <option value="unassigned">
                Unassigned{scopeCounts ? ` (${scopeCounts.unassigned} open)` : ""}
              </option>
              {assignees.map(({ staff, open }) => {
                const note = staffAvailabilityNote(staff);
                return (
                  <option value={staff.id} key={staff.id}>
                    {staff.id === workspace.currentStaff.id
                      ? `@me · ${staff.name}`
                      : staff.name}
                    {open !== null ? ` (${open} open)` : ""}
                    {note ? ` · ${note}` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            <span>Task type</span>
            <select
              value={filters.workType}
              onChange={(event) =>
                updateFilter(
                  "workType",
                  event.target.value as "all" | StaffWorkItemType,
                )
              }
            >
              <option value="all">All types</option>
              <option value="enrollment">Enrollment</option>
              <option value="document_review">Document review</option>
              <option value="communication">Communication</option>
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select
              value={filters.priority}
              onChange={(event) =>
                updateFilter(
                  "priority",
                  event.target.value as "all" | StaffWorkItemPriority,
                )
              }
            >
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                updateFilter("status", event.target.value as TaskStatusFilter)
              }
            >
              <option value="open">Open work</option>
              <option value="closed">Closed work</option>
              <option value="all">All statuses</option>
              {workColumns.map((column) => (
                <option value={column.status} key={column.status}>
                  {column.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Team / component</span>
            <select
              value={filters.component}
              disabled={filters.scope === "team"}
              title={
                filters.scope === "team"
                  ? "The My team scope reads your own component; switch to Everyone to pick another."
                  : undefined
              }
              onChange={(event) => updateFilter("component", event.target.value)}
            >
              <option value="all">All teams</option>
              {components.map(({ component, open }) => (
                <option value={component} key={component}>
                  {component}
                  {open !== null ? ` (${open} open)` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Due</span>
            <select
              value={filters.dueWindow}
              onChange={(event) =>
                updateFilter("dueWindow", event.target.value as TaskDueWindow)
              }
            >
              <option value="all">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="seven_days">Next 7 days</option>
              <option value="no_due">No due date</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select
              value={filters.sort}
              onChange={(event) =>
                updateFilter("sort", event.target.value as StaffActionCenterSort)
              }
            >
              <option value="priority">Priority</option>
              <option value="due">Due date</option>
              <option value="updated">Recently updated</option>
              <option value="created">Recently created</option>
              <option value="stale">Longest untouched</option>
            </select>
          </label>
          <label>
            <span>Signals</span>
            <select
              value={filters.ownerRisk ? "owner_risk" : filters.stale ? "stale" : "all"}
              onChange={(event) => {
                const value = event.target.value;
                updateFilter("stale", value === "stale");
                updateFilter("ownerRisk", value === "owner_risk");
              }}
            >
              <option value="all">Any</option>
              <option value="stale">
                Stale{counts.stale !== undefined ? ` (${counts.stale})` : ""}
              </option>
              <option value="owner_risk">
                Owner unavailable{counts.ownerRisk !== undefined ? ` (${counts.ownerRisk})` : ""}
              </option>
            </select>
          </label>
          <button
            className="staff-clear-task-filters"
            type="button"
            disabled={!hasActiveTaskBoardFilters(filters)}
            onClick={() => setFilters((current) => clearedTaskBoardFilters(current))}
          >
            Clear filters
          </button>
        </div>
      </section>
      <p className="staff-board-announcement" aria-live="polite">
        {loadState === "error"
          ? loadError
          : (boardMessage ??
            "Select a task for full details. Drag between columns to update simple statuses.")}
      </p>

      <div className="staff-workspace staff-task-workspace">
        <div
          className="staff-board staff-task-board"
          aria-label="Enrollment work board"
          aria-busy={loadState === "loading"}
        >
          {visibleColumns.map((column) => {
            const columnItems = grouped[column.status];
            return (
              <section
                className={`staff-board-column${
                  dropTarget === column.status
                    ? " staff-board-column--drop-target"
                    : ""
                }`}
                data-work-status={column.status}
                onDragEnter={() => setDropTarget(column.status)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setDropTarget((current) =>
                      current === column.status ? null : current,
                    );
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const itemId =
                    draggedId.current ||
                    event.dataTransfer.getData("text/staff-work-item") ||
                    event.dataTransfer.getData("text/plain");
                  if (itemId) void moveItem(itemId, column.status);
                }}
                key={column.status}
              >
                <header>
                  <div>
                    <h2>{column.title}</h2>
                    <p>
                      {column.description}
                      {columnItems.length !== columnCount(column.status)
                        ? ` · ${columnItems.length} loaded`
                        : ""}
                    </p>
                  </div>
                  <span title={`${columnCount(column.status).toLocaleString()} in this scope (${scopeLabel})`}>
                    {columnCount(column.status).toLocaleString()}
                  </span>
                </header>
                <div>
                  {columnItems.map((item) => (
                    <WorkItemCard
                      item={item}
                      currentStaffId={workspace.currentStaff.id}
                      selected={openDetailId === item.id}
                      onSelect={() => setOpenDetailId(item.id)}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "text/staff-work-item",
                          item.id,
                        );
                        event.dataTransfer.setData("text/plain", item.id);
                        draggedId.current = item.id;
                        setBoardMessage(
                          `Moving ${item.key}. Drop it in another status column.`,
                        );
                      }}
                      onDragEnd={() => {
                        draggedId.current = null;
                        setDropTarget(null);
                      }}
                      key={item.id}
                    />
                  ))}
                  {columnItems.length === 0 ? (
                    <p className="staff-column-empty">
                      {loadState === "loading"
                        ? "Loading…"
                        : filters.scope === "mine"
                          ? "Nothing of yours here."
                          : "No matching work here."}
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {board.page?.hasMore ? (
        <div className="staff-board-pager">
          <button
            className="button button--secondary"
            type="button"
            disabled={loadingMore || loadState !== "ready"}
            onClick={() => void loadMore()}
          >
            {loadingMore
              ? "Loading more…"
              : `Load more (${Math.min(TASK_BOARD_PAGE_SIZE, total - items.length)} of ${
                  total - items.length
                } remaining)`}
          </button>
        </div>
      ) : null}
      {createOpen ? (
        <CreateTaskDialog
          workspace={workspace}
          components={componentNames}
          assignees={assigneeSummaries}
          onClose={() => setCreateOpen(false)}
          onCreated={(workItemId) => {
            setCreateOpen(false);
            setOpenDetailId(workItemId);
            setBoardMessage("Task created and opened.");
            afterMutation();
          }}
        />
      ) : null}
      {openDetailId ? (
        <TaskDetailDialog
          workItemId={openDetailId}
          workspace={workspace}
          onClose={() => {
            setOpenDetailId(null);
            onDetailClosed?.();
          }}
          onChanged={afterMutation}
        />
      ) : null}
    </>
  );
}

function StaffDialog({
  ariaLabel,
  className,
  onClose,
  children,
}: {
  ariaLabel: string;
  className: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="staff-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={"staff-dialog " + className}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        ref={dialogRef}
      >
        <button
          className="staff-dialog__close"
          type="button"
          aria-label={"Close " + ariaLabel.toLowerCase()}
          onClick={onClose}
          ref={closeRef}
        >
          ×
        </button>
        {children}
      </section>
    </div>
  );
}

function CreateTaskDialog({
  workspace,
  components,
  assignees,
  onClose,
  onCreated,
}: {
  workspace: StaffOperationsWorkspace;
  components: string[];
  assignees: StaffOperationsWorkspace["actionCenter"]["staff"];
  onClose: () => void;
  onCreated: (workItemId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(
    workspace.cohort[0]?.id ?? workspace.student.student.id,
  );
  const [selectedComponent, setSelectedComponent] = useState(
    workspace.currentStaff.component,
  );
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(
    workspace.currentStaff.id,
  );
  const studentOptions = useMemo(() => {
    const students = new Map(
      workspace.cohort.map((student) => [student.id, student]),
    );
    const canonicalStudent = workspace.student.student;
    if (!students.has(canonicalStudent.id)) {
      students.set(canonicalStudent.id, {
        ...workspace.cohort[0],
        ...canonicalStudent,
        assignedStaffId: workspace.currentStaff.id,
        syntheticSeed: false,
        journey: workspace.cohort[0]?.journey ?? {
          stage: "Enrollment",
          completedTasks: 0,
          totalTasks: 0,
          lastActivityAt: new Date(0).toISOString(),
        },
        externalRef: workspace.cohort[0]?.externalRef ?? null,
        termName: workspace.cohort[0]?.termName ?? null,
        campusName: workspace.cohort[0]?.campusName ?? null,
        primaryAdviser: workspace.cohort[0]?.primaryAdviser ?? null,
        openWorkItems: workspace.cohort[0]?.openWorkItems ?? 0,
        overdueWorkItems: workspace.cohort[0]?.overdueWorkItems ?? 0,
        attention: workspace.cohort[0]?.attention ?? {
          level: "none",
          signals: [],
          evaluatedAt: new Date(0).toISOString(),
        },
        recommendedAction: workspace.cohort[0]?.recommendedAction ?? {
          title: "No recommendation",
          rationale: "No recommendation is available.",
          channel: "portal",
          expectedImpact: "Not assessed",
          taskId: null,
          recommendedToday: false,
        },
        communicationHistory: workspace.cohort[0]?.communicationHistory ?? [],
      });
    }
    return Array.from(students.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [workspace]);
  const visibleStudentOptions = useMemo(() => {
    const search = studentQuery.trim().toLocaleLowerCase();
    const matches = search
      ? studentOptions.filter((student) =>
          [
            student.name,
            student.preferredName,
            student.programName,
            String(student.classYear),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(search),
        )
      : studentOptions;
    const visible = matches.slice(0, search ? 50 : 25);
    const selected = studentOptions.find(
      (student) => student.id === selectedStudentId,
    );
    return selected && !visible.some((student) => student.id === selected.id)
      ? [selected, ...visible]
      : visible;
  }, [selectedStudentId, studentOptions, studentQuery]);
  const componentAssignees = useMemo(
    () =>
      assignees.filter(
        (staff) =>
          staff.component.toLocaleLowerCase() ===
          selectedComponent.toLocaleLowerCase(),
      ),
    [assignees, selectedComponent],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dueAtValue = String(form.get("dueAt") ?? "").trim();
    const dueAt = dueAtValue ? new Date(dueAtValue) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      setError("Enter a valid due date and time.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const actionType = String(form.get("actionType") ?? "").trim();
      const created = await createStaffWorkItem(
        {
          studentId: String(form.get("studentId") ?? ""),
          flowKind: String(form.get("flowKind")) as "enrollment" | "onboarding",
          title: String(form.get("title") ?? "").trim(),
          description: String(form.get("description") ?? "").trim(),
          component: String(form.get("component") ?? ""),
          assigneeId: String(form.get("assigneeId") ?? "") || null,
          priority: String(form.get("priority")) as StaffWorkItemPriority,
          status: String(form.get("status")) as CreateStaffWorkItemInput["status"],
          dueAt: dueAt?.toISOString() ?? null,
          ...(actionType ? { actionType: actionType as StaffActionType } : {}),
        },
        crypto.randomUUID(),
      );
      onCreated(created.id);
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 404) {
        setError(
          "Task creation is not available from the platform yet. Your form is still here; retry after the backend endpoint is deployed.",
        );
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "The task could not be created. Review the fields and try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <StaffDialog
      ariaLabel="Create task"
      className="staff-create-task-dialog"
      onClose={onClose}
    >
      <header className="staff-dialog__heading">
        <p className="eyebrow">Enrollment task management</p>
        <h2>Create task</h2>
        <p>Add a shared student work item. Required fields are marked.</p>
      </header>
      <form className="staff-create-task-form" onSubmit={submit}>
        <label className="staff-create-task-form__wide">
          <span>Summary / title</span>
          <input name="title" required maxLength={240} autoFocus />
        </label>
        <label className="staff-create-task-form__wide">
          <span>Description</span>
          <textarea name="description" required maxLength={2_000} rows={4} />
        </label>
        <div className="staff-create-task-student">
          <label htmlFor="create-task-student-search">
            <span>Find student</span>
            <input
              id="create-task-student-search"
              type="search"
              value={studentQuery}
              placeholder="Search name, program, or class year"
              aria-controls="create-task-student-options"
              aria-describedby="create-task-student-search-help"
              onChange={(event) => setStudentQuery(event.target.value)}
            />
          </label>
          <label htmlFor="create-task-student-options">
            <span>Student</span>
            <select
              id="create-task-student-options"
              name="studentId"
              required
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
            >
            {visibleStudentOptions.map((student) => (
              <option value={student.id} key={student.id}>
                {student.name} · {student.programName}
              </option>
            ))}
            </select>
            <small id="create-task-student-search-help">
              {studentQuery.trim()
                ? visibleStudentOptions.length + " matching students shown"
                : "Showing 25 students. Type above to search the full cohort."}
            </small>
          </label>
        </div>
        <label>
          <span>Flow category</span>
          <select name="flowKind" defaultValue="enrollment">
            <option value="enrollment">Enrollment</option>
            <option value="onboarding">Onboarding</option>
          </select>
        </label>
        <label>
          <span>Task category</span>
          <select name="actionType" defaultValue="">
            <option value="">Use the flow default</option>
            {createTaskActionTypes.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Team / component</span>
          <select
            name="component"
            value={selectedComponent}
            onChange={(event) => {
              const nextComponent = event.target.value;
              setSelectedComponent(nextComponent);
              const assigneeStillMatches = assignees.some(
                (staff) =>
                  staff.id === selectedAssigneeId &&
                  staff.component.toLocaleLowerCase() ===
                    nextComponent.toLocaleLowerCase(),
              );
              if (!assigneeStillMatches) setSelectedAssigneeId("");
            }}
          >
            {components.map((component) => (
              <option value={component} key={component}>
                {component}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Assignee</span>
          <select
            name="assigneeId"
            value={selectedAssigneeId}
            onChange={(event) => setSelectedAssigneeId(event.target.value)}
          >
            <option value="">Unassigned</option>
            {componentAssignees.map((staff) => (
              <option value={staff.id} key={staff.id}>
                {staff.id === workspace.currentStaff.id
                  ? "@me · " + staff.name
                  : staff.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select name="priority" defaultValue="medium">
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select name="status" defaultValue="todo">
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="follow_up_required">Follow-up required</option>
            <option value="blocked">Blocked</option>
          </select>
        </label>
        <label className="staff-create-task-form__wide">
          <span>Due date and time</span>
          <input name="dueAt" type="datetime-local" />
        </label>
        {error ? (
          <p className="field-error staff-create-task-form__wide" role="alert">
            {error}
          </p>
        ) : null}
        <footer className="staff-create-task-form__actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="staff-create-task-form__submit" type="submit" disabled={busy}>
            {busy ? "Creating task…" : "Create task"}
          </button>
        </footer>
      </form>
    </StaffDialog>
  );
}

function TaskDetailDialog({
  workItemId,
  workspace,
  onClose,
  onChanged,
}: {
  workItemId: string;
  workspace: StaffOperationsWorkspace;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <StaffDialog
      ariaLabel="Enrollment action details"
      className="staff-task-detail-dialog"
      onClose={onClose}
    >
      <ActionCenterDetail
        key={workItemId}
        workItemId={workItemId}
        center={workspace.actionCenter}
        currentStaffId={workspace.currentStaff.id}
        presentation="dialog"
        onBack={onClose}
        onChanged={onChanged}
      />
    </StaffDialog>
  );
}

function columnTitle(status: StaffWorkItemStatus) {
  return workColumns.find((column) => column.status === status)?.title ?? status;
}

/** The rule-based attention signals for one student, as pills — counts, never a score. */
function AttentionPills({
  attention,
  compact = false,
}: {
  attention: StaffStudentOperation["attention"];
  compact?: boolean;
}) {
  const levelLabel: Record<StaffStudentOperation["attention"]["level"], string> = {
    none: "No signals",
    watch: "Watch",
    attention: "Needs attention",
    urgent: "Urgent",
  };
  return (
    <ul className="staff-attention" aria-label="Attention signals">
      <li className={`level-${attention.level}`}>{levelLabel[attention.level]}</li>
      {compact
        ? null
        : attention.signals.map((signal) => <li key={signal.code}>{signal.label}</li>)}
    </ul>
  );
}

function StudentsView({
  refresh,
  openTaskBoard,
  initialStudentId,
  initialQuery,
}: {
  refresh: () => void;
  openTaskBoard: (query: StaffActionCenterQuery) => void;
  /** A student opened from elsewhere in the workspace (the profile caseload, a search). */
  initialStudentId: string | null;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  // The whole tenant is searched on the server; this is one bounded page of it.
  const search = useApiResource(
    useCallback(
      (signal: AbortSignal) => searchStaffStudents({ query: debouncedQuery, limit: 50 }, signal),
      [debouncedQuery],
    ),
    { refreshOnAmbient: false },
  );
  const results = useMemo(() => search.data?.items ?? [], [search.data]);
  const [selectedId, setSelectedId] = useState<string | null>(initialStudentId ?? "ac2fa509-b4e3-402d-900b-ffb8440fc430");
  const selectedInResults = results.find((student) => student.id === selectedId) ?? null;

  // A student opened from elsewhere may not be on this page: read that one row on its own.
  const needsPinned = selectedId !== null && selectedInResults === null;
  const pinned = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        needsPinned && selectedId
          ? searchStaffStudents({ studentId: selectedId, limit: 1 }, signal)
          : Promise.resolve(null),
      [needsPinned, selectedId],
    ),
    { refreshOnAmbient: false },
  );
  const operation: StaffStudentOperation | null =
    selectedInResults ??
    (needsPinned ? (pinned.data?.items[0] ?? null) : null) ??
    results[0] ??
    null;
  const operationId = operation?.id ?? null;

  // The student's open work is its own bounded server query, never a slice of
  // whichever board page the workspace happened to load.
  const openWork = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        operationId
          ? getStaffActionCenter({ studentId: operationId, status: "open", limit: 10 }, signal)
          : Promise.resolve(null),
      [operationId],
    ),
    { refreshOnAmbient: false },
  );
  const work = openWork.data?.items ?? [];
  const inspectorItem = work[0] ?? null;
  const onBoardChanged = () => {
    refresh();
    openWork.refresh();
    search.refresh();
  };

  const cohortTotal = search.data?.cohortTotal ?? null;
  const searchField = (
    <div className="staff-heading-actions">
      <label className="staff-search-field staff-search-field--compact">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">Search students</span>
        <input
          type="search"
          placeholder={
            cohortTotal !== null
              ? `Search ${cohortTotal.toLocaleString()} students by name, ID or program`
              : "Search students by name, ID or program"
          }
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
    </div>
  );

  if (search.status === "error" && !search.data) {
    return (
      <>
        <PageHeading view="students" action={searchField} />
        <section className="staff-panel staff-empty-panel" role="alert">
          <h2>Students could not be loaded</h2>
          <p>{search.error}</p>
          <button className="button button--secondary" type="button" onClick={search.reload}>
            Try again
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeading view="students" action={searchField} />

      <div className="staff-student-layout student360-layout">
        <section className="staff-panel staff-student-directory">
          <header className="staff-panel__heading">
            <div>
              <p className="eyebrow">{debouncedQuery ? "Search results" : "Every student"}</p>
              <h2>
                {search.data
                  ? debouncedQuery
                    ? `${search.data.total.toLocaleString()} match${search.data.total === 1 ? "" : "es"}`
                    : `${search.data.cohortTotal.toLocaleString()} students`
                  : "Students"}
              </h2>
            </div>
            <span>
              {search.data && search.data.total > search.data.items.length
                ? `Showing ${search.data.items.length} of ${search.data.total.toLocaleString()} · narrow the search`
                : search.status === "loading"
                  ? "Searching…"
                  : ""}
            </span>
          </header>
          <div className="staff-student-directory__list">
            {search.status === "ready" && results.length === 0 ? (
              <div className="staff-empty-panel">
                <h3>No students match</h3>
                <p>Try part of a name, a student ID, or a program.</p>
              </div>
            ) : null}
            {(needsPinned && pinned.data?.items[0] && !debouncedQuery ? [pinned.data.items[0], ...results] : results).map((student) => (
              <button
                className={student.id === operationId ? "is-selected" : undefined}
                type="button"
                onClick={() => setSelectedId(student.id)}
                key={student.id}
              >
                <span className="staff-avatar">{student.preferredName.slice(0, 1)}</span>
                <span>
                  <strong>{student.name}</strong>
                  <small>
                    {student.programName}
                    {student.externalRef ? ` · ${student.externalRef}` : ""}
                  </small>
                </span>
                <span>
                  <AttentionPills attention={student.attention} compact />
                  <small>
                    {student.openWorkItems} open · {student.journey.completedTasks}/{student.journey.totalTasks} checklist
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>

        {operation ? (
          <section className="staff-student-record">
            <header className="staff-student-record__hero">
              <div className="staff-avatar staff-avatar--large">{operation.preferredName.slice(0, 1)}</div>
              <div>
                <p className="eyebrow">Student record{operation.externalRef ? ` · ${operation.externalRef}` : ""}</p>
                <h2>{operation.name}</h2>
                <p>
                  {[
                    operation.programName,
                    `Class of ${operation.classYear}`,
                    operation.termName,
                    operation.campusName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <AttentionPills attention={operation.attention} compact />
            </header>
            <div className="staff-student-facts staff-student-facts--five">
              <article>
                <span>Journey stage</span>
                <strong>{operation.journey.stage}</strong>
                <small>Last activity {formatTime(operation.journey.lastActivityAt)}</small>
              </article>
              <article>
                <span>Enrollment checklist</span>
                <strong>
                  {operation.journey.completedTasks}/{operation.journey.totalTasks}
                </strong>
                <small>Configured tasks complete</small>
              </article>
              <article>
                <span>Open work</span>
                <strong>{operation.openWorkItems}</strong>
                <small>
                  {operation.overdueWorkItems > 0
                    ? `${operation.overdueWorkItems} overdue`
                    : "None overdue"}
                </small>
              </article>
              <article>
                <span>Primary adviser</span>
                <strong>{operation.primaryAdviser?.name ?? "Not assigned"}</strong>
                <small>{operation.primaryAdviser ? "Active assignment" : "No active primary-adviser assignment"}</small>
              </article>
              <article>
                <span>Your role</span>
                <strong>
                  {operation.viewerAssignmentRoles.length > 0
                    ? operation.viewerAssignmentRoles.map(assignmentRoleLabel).join(", ")
                    : "Not on your caseload"}
                </strong>
                <small
                  title={operation.openWorkOwners.map((owner) => `${owner.name} (${owner.component})`).join(", ")}
                >
                  {operation.openWorkOwners.length === 0
                    ? "No open work owners"
                    : operation.openWorkOwners.length === 1
                      ? `Open work owned by ${operation.openWorkOwners[0].name}`
                      : `Open work owned by ${operation.openWorkOwners.length} people: ${operation.openWorkOwners
                          .slice(0, 2)
                          .map((owner) => owner.name)
                          .join(", ")}${operation.openWorkOwners.length > 2 ? ` +${operation.openWorkOwners.length - 2}` : ""}`}
                </small>
              </article>
            </div>
            <details className="staff-record-sections student360-work-disclosure"><summary>Enrollment progress & active work</summary>
              <article>
                <p className="eyebrow">Journey snapshot</p>
                <h3>Enrollment readiness</h3>
                <div className="staff-progress-track">
                  <span
                    style={{
                      width: `${
                        operation.journey.totalTasks === 0
                          ? 0
                          : Math.round(
                              (operation.journey.completedTasks / operation.journey.totalTasks) * 100,
                            )
                      }%`,
                    }}
                  />
                </div>
                <p className="eyebrow">Attention signals</p>
                {operation.attention.signals.length === 0 ? (
                  <p>No rule-based signals: nothing overdue, blocked, or escalated on this record.</p>
                ) : (
                  <AttentionPills attention={operation.attention} />
                )}
                <p>
                  <small>
                    Counted from requirements, staff work and adviser assignments at{" "}
                    {formatTime(operation.attention.evaluatedAt)}. There is no risk model behind these.
                  </small>
                </p>
              </article>
              <article>
                <p className="eyebrow">Open work</p>
                <h3>
                  {openWork.status === "loading" && !openWork.data
                    ? "Loading open work…"
                    : work.length > 0
                      ? `${openWork.data?.page.total ?? work.length} open staff ${(openWork.data?.page.total ?? work.length) === 1 ? "task" : "tasks"}`
                      : "No open staff tasks"}
                </h3>
                <p>
                  <button
                    className="staff-inline-link"
                    type="button"
                    onClick={() => openTaskBoard({ studentId: operation.id, status: "all" })}
                  >
                    Open every task for {operation.preferredName} on the board →
                  </button>
                </p>
                <ul>
                  {work.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <span>{item.key}</span>
                      <strong>{item.title}</strong>
                      <small>
                        {item.status.replaceAll("_", " ")} · {item.assignee?.name ?? "Unassigned"}
                        {item.assignee ? ` (${item.assignee.component})` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              </article>
            </details>
            <Student360Summary key={operation.id} studentId={operation.id} name={operation.name} /><div className="staff-student-university"><UniversityRecordPanel key={operation.id} studentId={operation.id} /></div>
          </section>
        ) : search.status === "loading" ? (
          <section className="staff-panel staff-empty-panel" aria-live="polite">
            <h2>Loading students…</h2>
          </section>
        ) : (
          <section className="staff-panel staff-empty-panel">
            <h2>No student selected</h2>
            <p>Pick a student from the list, or search the whole roster.</p>
          </section>
        )}
        {inspectorItem && openWork.data ? (
          <details className="student360-inspector"><summary>Student workspace · documents, requirements & communications</summary><StudentInspector
            item={inspectorItem}
            center={openWork.data}
            onBoardChanged={onBoardChanged}
            key={inspectorItem.id}
          /></details>
        ) : null}
      </div>
    </>
  );
}

function ConfigurationAssistant({
  configuration,
  kind,
  promptPlaceholder,
  onSaved,
}: {
  configuration: StaffManagedConfiguration;
  kind: StaffManagedConfigurationKind;
  promptPlaceholder: string;
  onSaved: () => void;
}) {
  const saveAction = useApiAction(updateStaffManagedConfiguration);
  const edwardAction = useApiAction(draftStaffConfigurationWithEdward);
  const [instruction, setInstruction] = useState("");
  const [draftDocument, setDraftDocument] = useState<ManagedDocument | null>(null);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [draftSummary, setDraftSummary] = useState<{
    summary: string;
    changes: string[];
    warnings: string[];
  } | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const askEdward = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const draft = await edwardAction.run({
        kind,
        expectedVersion: configuration.version,
        instruction,
      });
      setDraftDocument(structuredClone(draft.document));
      setDraftVersion(draft.expectedVersion);
      setDraftSummary({
        summary: draft.summary,
        changes: draft.changes,
        warnings: draft.warnings,
      });
      setSavedMessage(null);
    } catch {
      setDraftVersion(null);
      setDraftSummary(null);
    }
  };

  const publish = async () => {
    if (!draftDocument || draftVersion === null) return;
    try {
      const saved = await saveAction.run(kind, {
        expectedVersion: draftVersion,
        document: draftDocument,
        changeSummary:
          draftSummary?.summary ?? "Published from Edward's reviewed draft.",
      });
      setSavedMessage(
        `${saved.fileName} published as version ${saved.version}.`,
      );
      setDraftDocument(null);
      setDraftVersion(null);
      setDraftSummary(null);
      onSaved();
    } catch {
      setSavedMessage(null);
    }
  };

  return (
    <section className="staff-panel staff-configuration-assistant">
      <header className="staff-configuration-assistant__heading">
        <div>
          <p className="eyebrow">Edward content assistant</p>
          <h2>Describe a change naturally</h2>
          <p>
            Edward prepares a reviewable draft. Nothing is published until you
            confirm it.
          </p>
        </div>
        <div>
          <StatusPill tone="success">v{configuration.version}</StatusPill>
          <small>{configuration.recordCount} published records</small>
        </div>
      </header>
      <form className="staff-edward-config" onSubmit={askEdward}>
        <label>
          What should change?
          <textarea
            value={instruction}
            placeholder={promptPlaceholder}
            maxLength={2000}
            onChange={(event) => setInstruction(event.target.value)}
          />
        </label>
        <button
          className="button button--secondary"
          type="submit"
          disabled={
            edwardAction.status === "loading" || instruction.trim().length < 5
          }
        >
          {edwardAction.status === "loading"
            ? "Preparing draft..."
            : "Draft with Edward"}
        </button>
      </form>
      {draftSummary ? (
        <div className="staff-edward-draft" aria-live="polite">
          <strong>{draftSummary.summary}</strong>
          {draftSummary.changes.length ? (
            <ul>
              {draftSummary.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          ) : null}
          {draftSummary.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <small>
            Review this plan before publishing it to the student experience.
          </small>
        </div>
      ) : null}
      {edwardAction.message || saveAction.message ? (
        <p className="field-error" role="alert">
          {edwardAction.message ?? saveAction.message}
        </p>
      ) : null}
      {savedMessage ? (
        <p className="staff-action-success" role="status">
          {savedMessage}
        </p>
      ) : null}
      <footer className="staff-configuration-assistant__footer">
        <div>
          <strong>Review, validate, publish</strong>
          <small>
            Validation and versioning remain enforced behind the scenes.
          </small>
        </div>
        <button
          className="button button--primary"
          type="button"
          disabled={saveAction.status === "loading" || !draftDocument}
          onClick={() => void publish()}
        >
          {saveAction.status === "loading"
            ? "Validating..."
            : "Confirm and publish"}
        </button>
      </footer>
    </section>
  );
}

function EventEditor({
  campusEvent,
  configuration,
  onSaved,
  onClose,
}: {
  campusEvent: CampusEvent | null;
  configuration: StaffManagedConfiguration;
  onSaved: () => void;
  onClose: () => void;
}) {
  const action = useApiAction(updateStaffManagedConfiguration);
  const mediaAction = useApiAction(uploadStaffPortalMedia);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDragging, setImageDragging] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const selectImage = (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setEditorError("Choose a JPEG, PNG, or WebP event image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setEditorError("The event image must be 5 MB or smaller.");
      return;
    }
    setEditorError(null);
    setImageFile(file);
  };

  const dropImage = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setImageDragging(false);
    selectImage(event.dataTransfer.files.item(0));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditorError(null);
    const form = new FormData(event.currentTarget);
    try {
      const document = editableConfigurationDocument(configuration);
      const records = managedRecords(document, "events");
      const title = String(form.get("title")).trim();
      let record = campusEvent
        ? records.find((candidate) => candidate.id === campusEvent.id)
        : undefined;
      if (campusEvent && !record) throw new Error("This event is no longer available.");
      if (!record) {
        record = { id: newManagedEventId(title, records) };
        records.push(record);
      }
      let imageUrl = String(form.get("imageUrl") ?? "").trim() || null;
      if (imageFile) {
        imageUrl = (await mediaAction.run(imageFile)).publicUrl;
      }
      Object.assign(record, {
        title,
        description: String(form.get("description")),
        starts_at: utcIsoValue(form.get("startsAt")),
        ends_at: utcIsoValue(form.get("endsAt")),
        location: String(form.get("location")),
        category: String(form.get("category")),
        featured: form.get("featured") === "on",
        accent: String(form.get("accent")),
        visual_theme: String(form.get("visualTheme")),
        registration_url: String(form.get("registrationUrl")).trim() || null,
        image_url: imageUrl,
        image_alt: String(form.get("imageAlt")).trim() || null,
        image_attribution: String(form.get("imageAttribution")).trim() || null,
        advertisement_starts_at: optionalUtcIsoValue(form.get("advertisementStartsAt")),
        advertisement_ends_at: optionalUtcIsoValue(form.get("advertisementEndsAt")),
      });
      await action.run("campus_life", {
        expectedVersion: configuration.version,
        document,
        changeSummary: campusEvent
          ? `Updated campus event ${campusEvent.title}.`
          : `Created campus event ${title}.`,
      });
      onSaved();
      onClose();
    } catch (error) {
      setEditorError(
        error instanceof Error ? error.message : "The event could not be saved.",
      );
    }
  };

  const remove = async () => {
    if (!campusEvent) return;
    setEditorError(null);
    try {
      const document = editableConfigurationDocument(configuration);
      document.events = managedRecords(document, "events").filter(
        (candidate) => candidate.id !== campusEvent.id,
      );
      await action.run("campus_life", {
        expectedVersion: configuration.version,
        document,
        changeSummary: `Removed campus event ${campusEvent.title}.`,
      });
      onSaved();
      onClose();
    } catch (error) {
      setEditorError(
        error instanceof Error ? error.message : "The event could not be removed.",
      );
    }
  };

  return (
    <aside className="staff-editor-panel" aria-label="Edit campus event">
      <header>
        <div>
          <p className="eyebrow">Student carousel</p>
          <h2>{campusEvent ? "Edit event" : "Add event"}</h2>
        </div>
        <button type="button" aria-label="Close editor" onClick={onClose}>
          ×
        </button>
      </header>
      <form onSubmit={save}>
        <label>
          Event title
          <input name="title" defaultValue={campusEvent?.title ?? ""} required maxLength={180} />
        </label>
        <label>
          Description
          <textarea
            className="staff-editor-panel__body"
            name="description"
            defaultValue={campusEvent?.description ?? ""}
            required
            maxLength={1500}
          />
        </label>
        <label>
          Location
          <input name="location" defaultValue={campusEvent?.location ?? ""} required />
        </label>
        <div className="staff-form-grid">
          <label>
            Starts (UTC)
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={campusEvent ? utcInputValue(campusEvent.startsAt) : ""}
              required
            />
          </label>
          <label>
            Ends (UTC)
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={campusEvent ? utcInputValue(campusEvent.endsAt) : ""}
              required
            />
          </label>
          <label>
            Category
            <select name="category" defaultValue={campusEvent?.category ?? "social"}>
              <option value="academic">Academic</option>
              <option value="social">Social</option>
              <option value="career">Career</option>
              <option value="wellness">Wellness</option>
              <option value="athletics">Athletics</option>
            </select>
          </label>
          <label>
            Accent
            <select name="accent" defaultValue={campusEvent?.accent ?? "gold"}>
              <option value="gold">Gold</option>
              <option value="navy">Navy</option>
              <option value="blue">Blue</option>
              <option value="coral">Coral</option>
            </select>
          </label>
          <label>
            Visual theme
            <select
              name="visualTheme"
              defaultValue={campusEvent?.visualTheme ?? "community"}
            >
              <option value="festival">Festival</option>
              <option value="discovery">Discovery</option>
              <option value="career">Career</option>
              <option value="community">Community</option>
            </select>
          </label>
        </div>
        <section className="staff-type-configuration staff-event-image-editor">
          <div>
            <strong>Event image</strong>
            <p>Upload a JPEG, PNG, or WebP image up to 5 MB for the student carousel.</p>
          </div>
          {campusEvent?.imageUrl && !imageFile ? (
            <img
              src={campusEvent.imageUrl}
              alt={campusEvent.imageAlt ?? "Current event image"}
            />
          ) : null}
          <div
            className={`staff-event-image-dropzone${imageDragging ? " is-dragging" : ""}`}
            role="button"
            tabIndex={0}
            aria-label="Upload or drop an event image"
            onClick={() => imageInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                imageInputRef.current?.click();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setImageDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setImageDragging(false)}
            onDrop={dropImage}
          >
            <input
              ref={imageInputRef}
              name="imageFile"
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={(event) => selectImage(event.target.files?.item(0) ?? null)}
            />
            <span className="staff-event-image-dropzone__icon" aria-hidden="true">↑</span>
            <strong>{imageFile ? imageFile.name : "Drop an event image here"}</strong>
            <span>
              {imageFile
                ? `${Math.max(1, Math.round(imageFile.size / 1024))} KB selected · click to replace`
                : "or click to browse · JPEG, PNG, or WebP · maximum 5 MB"}
            </span>
          </div>
          <label>
            Or use an image URL
            <input name="imageUrl" type="url" defaultValue={campusEvent?.imageUrl ?? ""} />
          </label>
          <label>
            Image alt text
            <input name="imageAlt" defaultValue={campusEvent?.imageAlt ?? ""} maxLength={500} />
          </label>
          <label>
            Image attribution
            <input
              name="imageAttribution"
              defaultValue={campusEvent?.imageAttribution ?? ""}
              maxLength={500}
            />
          </label>
        </section>
        <section className="staff-type-configuration">
          <div>
            <strong>Advertisement window</strong>
            <p>Leave both blank to publish immediately and keep the event visible.</p>
          </div>
          <div className="staff-form-grid">
            <label>
              Advertise from (UTC)
              <input
                name="advertisementStartsAt"
                type="datetime-local"
                defaultValue={
                  campusEvent?.advertisementStartsAt
                    ? utcInputValue(campusEvent.advertisementStartsAt)
                    : ""
                }
              />
            </label>
            <label>
              Advertise until (UTC)
              <input
                name="advertisementEndsAt"
                type="datetime-local"
                defaultValue={
                  campusEvent?.advertisementEndsAt
                    ? utcInputValue(campusEvent.advertisementEndsAt)
                    : ""
                }
              />
            </label>
          </div>
        </section>
        <label>
          Registration URL
          <input
            name="registrationUrl"
            type="url"
            defaultValue={campusEvent?.registrationUrl ?? ""}
          />
        </label>
        <label className="staff-checkbox">
          <input name="featured" type="checkbox" defaultChecked={campusEvent?.featured ?? true} />
          Feature in the student carousel
        </label>
        <div className="staff-student-impact-note">
          Saving publishes this event to the student Campus Life carousel.
        </div>
        {campusEvent ? (
          <section className="staff-delete-confirmation">
            {confirmingDelete ? (
              <div role="alert">
                <strong>Remove {campusEvent.title}?</strong>
                <p>The event will disappear from the student carousel after publishing.</p>
                <div>
                  <button className="button button--secondary" type="button" onClick={() => setConfirmingDelete(false)}>
                    Keep event
                  </button>
                  <button className="button staff-button--danger" type="button" disabled={action.status === "loading"} onClick={() => void remove()}>
                    Confirm remove
                  </button>
                </div>
              </div>
            ) : (
              <button className="button staff-button--danger-outline" type="button" onClick={() => setConfirmingDelete(true)}>
                Remove event
              </button>
            )}
          </section>
        ) : null}
        {editorError || action.message || mediaAction.message ? (
          <p className="field-error" role="alert">
            {editorError ?? action.message ?? mediaAction.message}
          </p>
        ) : null}
        <footer>
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={action.status === "loading" || mediaAction.status === "loading"}
          >
            {mediaAction.status === "loading"
              ? "Uploading image..."
              : action.status === "loading"
                ? "Publishing..."
                : campusEvent
                  ? "Save and publish"
                  : "Create and publish"}
          </button>
        </footer>
      </form>
    </aside>
  );
}

function CourseEditor({
  course,
  configuration,
  onSaved,
  onClose,
}: {
  course: CatalogCourse;
  configuration: StaffManagedConfiguration;
  onSaved: () => void;
  onClose: () => void;
}) {
  const action = useApiAction(updateStaffManagedConfiguration);
  const [editorError, setEditorError] = useState<string | null>(null);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditorError(null);
    const form = new FormData(event.currentTarget);
    try {
      const document = editableConfigurationDocument(configuration);
      const record = managedRecords(document, "courses").find(
        (candidate) => candidate.id === course.id,
      );
      if (!record) throw new Error("This course is no longer available.");
      const existingPrerequisites = Array.isArray(record.prerequisites)
        ? (record.prerequisites as Array<Record<string, unknown>>)
        : [];
      const minimumGrades = new Map(
        existingPrerequisites.map((prerequisite) => [
          String(prerequisite.course_code),
          prerequisite.minimum_grade ?? null,
        ]),
      );
      const prerequisiteCodes = String(form.get("prerequisites"))
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      const existingVideos = Array.isArray(record.related_videos)
        ? (record.related_videos as Array<Record<string, unknown>>)
        : [];
      const videoUrl = String(form.get("videoUrl")).trim();
      const videoTitle = String(form.get("videoTitle")).trim();
      if (Boolean(videoUrl) !== Boolean(videoTitle)) {
        throw new Error("Add both a YouTube title and URL, or leave both blank.");
      }
      Object.assign(record, {
        code: String(form.get("code")).trim().toUpperCase(),
        title: String(form.get("title")),
        description: String(form.get("description")),
        credits: Number(form.get("credits")),
        level: Number(form.get("level")),
        prerequisites: prerequisiteCodes.map((code) => ({
          course_code: code,
          minimum_grade: minimumGrades.get(code) ?? null,
        })),
        instructor_names: String(form.get("instructors"))
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        meeting_pattern: String(form.get("meetingPattern")).trim() || null,
        availability_label: String(form.get("availabilityLabel")).trim() || null,
        related_videos: videoUrl
          ? [
              {
                id: existingVideos[0]?.id ?? "featured-course-video",
                title: videoTitle,
                description: String(form.get("videoDescription")).trim() || null,
                url: videoUrl,
                source_label: String(form.get("videoSource")).trim() || null,
              },
            ]
          : [],
      });
      await action.run("academics", {
        expectedVersion: configuration.version,
        document,
        changeSummary: `Updated course ${course.code}.`,
      });
      onSaved();
      onClose();
    } catch (error) {
      setEditorError(
        error instanceof Error ? error.message : "The course could not be saved.",
      );
    }
  };

  return (
    <aside className="staff-editor-panel" aria-label="Edit course">
      <header>
        <div>
          <p className="eyebrow">Student-visible catalog</p>
          <h2>Edit {course.code}</h2>
        </div>
        <button type="button" aria-label="Close editor" onClick={onClose}>
          ×
        </button>
      </header>
      <form onSubmit={save}>
        <div className="staff-form-grid">
          <label>
            Course code
            <input name="code" defaultValue={course.code} required maxLength={30} />
          </label>
          <label>
            Credits
            <input
              name="credits"
              type="number"
              min="0"
              max="30"
              step="0.5"
              defaultValue={course.credits}
              required
            />
          </label>
          <label>
            Level
            <input
              name="level"
              type="number"
              min="0"
              max="9999"
              defaultValue={course.level}
              required
            />
          </label>
        </div>
        <label>
          Course title
          <input name="title" defaultValue={course.title} required maxLength={180} />
        </label>
        <label>
          Description
          <textarea
            className="staff-editor-panel__body"
            name="description"
            defaultValue={course.description}
            required
            maxLength={1600}
          />
        </label>
        <label>
          Prerequisite course codes
          <input
            name="prerequisites"
            defaultValue={course.prerequisites.map((item) => item.courseCode).join(", ")}
            placeholder="MATH 151, CS 101"
          />
        </label>
        <label>
          Instructors
          <input
            name="instructors"
            defaultValue={(course.instructorNames ?? []).join(", ")}
            placeholder="Professor A, Professor B"
          />
        </label>
        <div className="staff-form-grid">
          <label>
            Meeting pattern
            <input name="meetingPattern" defaultValue={course.meetingPattern ?? ""} />
          </label>
          <label>
            Availability label
            <input
              name="availabilityLabel"
              defaultValue={course.availabilityLabel ?? ""}
            />
          </label>
        </div>
        <section className="staff-type-configuration">
          <div>
            <strong>Featured course video</strong>
            <p>
              Optional. Use an HTTPS YouTube video or playlist; students see a
              privacy-enhanced embedded player in course details.
            </p>
          </div>
          <label>
            Video title
            <input
              name="videoTitle"
              defaultValue={course.relatedVideos?.[0]?.title ?? ""}
              maxLength={180}
            />
          </label>
          <label>
            YouTube URL
            <input
              name="videoUrl"
              type="url"
              defaultValue={course.relatedVideos?.[0]?.url ?? ""}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </label>
          <label>
            Description
            <textarea
              name="videoDescription"
              defaultValue={course.relatedVideos?.[0]?.description ?? ""}
              maxLength={500}
            />
          </label>
          <label>
            Source label
            <input
              name="videoSource"
              defaultValue={course.relatedVideos?.[0]?.sourceLabel ?? ""}
              placeholder="CS50 or MIT OpenCourseWare"
              maxLength={180}
            />
          </label>
        </section>
        <div className="staff-student-impact-note">
          Saving updates the course shown in student classrooms and Edward’s
          academic-planning context.
        </div>
        {editorError || action.message ? (
          <p className="field-error" role="alert">
            {editorError ?? action.message}
          </p>
        ) : null}
        <footer>
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={action.status === "loading"}
          >
            {action.status === "loading" ? "Publishing…" : "Save and publish"}
          </button>
        </footer>
      </form>
    </aside>
  );
}

function JourneysView({
  workspace,
  refresh,
}: {
  workspace: StaffOperationsWorkspace;
  refresh: () => void;
}) {
  const [kind, setKind] = useState<"onboarding" | "enrollment">("onboarding");
  return (
    <>
      <PageHeading
        view="journeys"
        action={<StatusPill tone="success">Publishing live</StatusPill>}
      />
      <div className="staff-journey-studio">
        <section className="staff-panel staff-journey-studio__workspace">
          <div className="staff-journey-tabs" role="tablist">
            <button
              className={kind === "onboarding" ? "is-active" : undefined}
              type="button"
              role="tab"
              aria-selected={kind === "onboarding"}
              onClick={() => setKind("onboarding")}
            >
              <span aria-hidden="true">01</span>
              <span>
                <strong>Offer onboarding</strong>
                <small>Acceptance through student setup</small>
              </span>
            </button>
            <button
              className={kind === "enrollment" ? "is-active" : undefined}
              type="button"
              role="tab"
              aria-selected={kind === "enrollment"}
              onClick={() => setKind("enrollment")}
            >
              <span aria-hidden="true">02</span>
              <span>
                <strong>Enrollment checklist</strong>
                <small>Post-acceptance requirements</small>
              </span>
            </button>
          </div>
          <JourneyFlowBuilder
            key={`${kind}-${workspace.configurations.journeys.version}`}
            kind={kind}
            title={
              kind === "onboarding"
                ? "New student onboarding"
                : "Post-acceptance enrollment"
            }
            configuration={workspace.configurations.journeys}
            onSaved={refresh}
          />
        </section>
        <details className="staff-journey-copilot">
          <summary>
            <span aria-hidden="true">✦</span>
            <span>
              <strong>Draft a workflow change with Edward</strong>
              <small>Describe the change in plain language, then review the generated draft before publishing.</small>
            </span>
            <span>Open copilot</span>
          </summary>
          <ConfigurationAssistant
            key={`journeys-${workspace.configurations.journeys.version}`}
            configuration={workspace.configurations.journeys}
            kind="journeys"
            promptPlaceholder={'Try: Add "Choose a meal plan" to onboarding as a single selection worth 20 points.'}
            onSaved={refresh}
          />
        </details>
      </div>
      <ActionRulesEditor kind={kind} />
      <section className="staff-roadmap-note">
        <div>
          <p className="eyebrow">Version boundary</p>
          <h2>Published changes stay versioned</h2>
        </div>
        <p>
          Publishing updates the tenant blueprint, reward rules, and active
          student journeys. Completed student work remains complete while new or
          changed tasks are reconciled into the latest version.
        </p>
      </section>
    </>
  );
}

function KnowledgeEditor({
  card,
  onSaved,
  onClose,
}: {
  card: StaffKnowledgeCard | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const updateAction = useApiAction(updateStaffKnowledgeCard);
  const createAction = useApiAction(createStaffKnowledgeCard);
  const action = card ? updateAction : createAction;
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      title: String(form.get("title")),
      summary: String(form.get("summary")),
      body: String(form.get("body")),
      category: String(form.get("category")),
      audience: form.get("audience") as StaffKnowledgeCard["audience"],
      status: form.get("status") as StaffKnowledgeCard["status"],
    };
    try {
      if (card) {
        await updateAction.run(card.id, {
          expectedVersion: card.version,
          ...input,
        });
      } else {
        await createAction.run(input);
      }
      onSaved();
      onClose();
    } catch {
      // The action state renders the API message.
    }
  };
  return (
    <aside className="staff-editor-panel" aria-label="Edit knowledge card">
      <header>
        <div>
          <p className="eyebrow">Knowledge card</p>
          <h2>{card ? "Edit content" : "Create content"}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close editor">
          ×
        </button>
      </header>
      <form onSubmit={save}>
        <label>
          Title
          <input
            name="title"
            defaultValue={card?.title ?? ""}
            maxLength={120}
            required
          />
        </label>
        <label>
          Summary
          <textarea
            name="summary"
            defaultValue={card?.summary ?? ""}
            maxLength={240}
            required
          />
        </label>
        <label>
          Guidance
          <textarea
            className="staff-editor-panel__body"
            name="body"
            defaultValue={card?.body ?? ""}
            maxLength={2000}
            required
          />
        </label>
        <div className="staff-form-grid">
          <label>
            Category
            <input
              name="category"
              defaultValue={card?.category ?? "Enrollment"}
              maxLength={60}
              required
            />
          </label>
          <label>
            Audience
            <select name="audience" defaultValue={card?.audience ?? "internal"}>
              <option value="internal">Internal staff</option>
              <option value="student">Student-facing</option>
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={card?.status ?? "draft"}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        {action.message ? (
          <p className="field-error" role="alert">
            {action.message}
          </p>
        ) : null}
        <footer>
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={action.status === "loading"}
          >
            {action.status === "loading"
              ? "Saving…"
              : card
                ? "Save card"
                : "Create card"}
          </button>
        </footer>
      </form>
    </aside>
  );
}

function KnowledgeView({
  workspace,
  refresh,
}: {
  workspace: StaffOperationsWorkspace;
  refresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState<"all" | "internal" | "student">("all");
  const [selected, setSelected] = useState<
    StaffKnowledgeCard | null | undefined
  >(undefined);
  const filtered = workspace.knowledgeBase.filter((card) => {
    const search = query.toLowerCase().trim();
    return (
      (audience === "all" || card.audience === audience) &&
      (!search ||
        `${card.title} ${card.summary} ${card.category}`
          .toLowerCase()
          .includes(search))
    );
  });

  return (
    <>
      <PageHeading
        view="knowledge"
        action={
          <button
            className="button button--primary"
            type="button"
            onClick={() => setSelected(null)}
          >
            New knowledge card
          </button>
        }
      />
      <section className="staff-content-toolbar">
        <label className="staff-search-field">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search knowledge</span>
          <input
            type="search"
            placeholder="Search policies, answers, or departments"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="staff-segmented-control">
          {(["all", "internal", "student"] as const).map((value) => (
            <button
              className={audience === value ? "is-active" : undefined}
              type="button"
              onClick={() => setAudience(value)}
              key={value}
            >
              {value === "all"
                ? "All guidance"
                : value === "internal"
                  ? "Internal"
                  : "Student-facing"}
            </button>
          ))}
        </div>
      </section>
      {filtered.length === 0 && (
        <section className="staff-panel staff-empty-panel staff-empty-library">
          <span className="staff-empty-library__icon" aria-hidden="true">K</span>
          <h2>{query || audience !== "all" ? "No guidance matches these filters" : "A home for your team’s guidance"}</h2>
          <p>{query || audience !== "all" ? "Try a different search or view all guidance." : "Create a knowledge card with a clear answer, an owner, and an audience so your team can find trusted guidance."}</p>
          <button className="button button--secondary" type="button" onClick={() => { if (query || audience !== "all") { setQuery(""); setAudience("all"); } else setSelected(null); }}>{query || audience !== "all" ? "Clear filters" : "Create a knowledge card"}</button>
        </section>
      )}
      <div className="staff-content-grid">
        {filtered.map((card) => (
          <article className="staff-content-card" key={card.id}>
            <header>
              <span>{card.category.slice(0, 1)}</span>
              <div>
                <small>{card.category}</small>
                <StatusPill
                  tone={card.status === "published" ? "success" : "warning"}
                >
                  {card.status}
                </StatusPill>
              </div>
            </header>
            <h2>{card.title}</h2>
            <p>{card.summary}</p>
            <dl>
              <div>
                <dt>Audience</dt>
                <dd>{card.audience}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{card.owner}</dd>
              </div>
            </dl>
            <footer>
              <small>Updated {formatDate(card.updatedAt)} · v{card.version}</small>
              <button type="button" onClick={() => setSelected(card)}>
                Edit card
              </button>
            </footer>
          </article>
        ))}
      </div>
      {selected !== undefined ? (
        <div className="staff-editor-backdrop">
          <KnowledgeEditor
            card={selected}
            onSaved={refresh}
            onClose={() => setSelected(undefined)}
          />
        </div>
      ) : null}
    </>
  );
}

function CorePlayEditor({
  play,
  onSaved,
  onClose,
}: {
  play: StaffCorePlay | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const updateAction = useApiAction(updateStaffCorePlay);
  const createAction = useApiAction(createStaffCorePlay);
  const action = play ? updateAction : createAction;
  const [steps, setSteps] = useState(play?.steps.join("\n") ?? "");
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      title: String(form.get("title")),
      description: String(form.get("description")),
      trigger: String(form.get("trigger")),
      audience: String(form.get("audience")),
      steps: steps
        .split("\n")
        .map((step) => step.trim())
        .filter(Boolean),
      status: form.get("status") as StaffCorePlay["status"],
    };
    try {
      if (play) {
        await updateAction.run(play.id, {
          expectedVersion: play.version,
          ...input,
        });
      } else {
        await createAction.run(input);
      }
      onSaved();
      onClose();
    } catch {
      // The action state renders the API message.
    }
  };
  return (
    <aside className="staff-editor-panel" aria-label="Edit core play">
      <header>
        <div>
          <p className="eyebrow">Core play</p>
          <h2>{play ? "Edit playbook" : "Create playbook"}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close editor">
          ×
        </button>
      </header>
      <form onSubmit={save}>
        <label>
          Title
          <input name="title" defaultValue={play?.title ?? ""} required />
        </label>
        <label>
          Description
          <textarea
            name="description"
            defaultValue={play?.description ?? ""}
            required
          />
        </label>
        <label>
          Trigger
          <textarea name="trigger" defaultValue={play?.trigger ?? ""} required />
        </label>
        <label>
          Audience
          <input name="audience" defaultValue={play?.audience ?? ""} required />
        </label>
        <label>
          Steps (one per line)
          <textarea
            className="staff-editor-panel__body"
            value={steps}
            onChange={(event) => setSteps(event.target.value)}
            required
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={play?.status ?? "draft"}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        {action.message ? (
          <p className="field-error" role="alert">
            {action.message}
          </p>
        ) : null}
        <footer>
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={action.status === "loading"}
          >
            {action.status === "loading"
              ? "Saving…"
              : play
                ? "Save core play"
                : "Create core play"}
          </button>
        </footer>
      </form>
    </aside>
  );
}

function CorePlaysView({
  workspace,
  refresh,
}: {
  workspace: StaffOperationsWorkspace;
  refresh: () => void;
}) {
  const [selected, setSelected] = useState<
    StaffCorePlay | null | undefined
  >(undefined);
  return (
    <>
      <PageHeading
        view="core_plays"
        action={
          <button
            className="button button--primary"
            type="button"
            onClick={() => setSelected(null)}
          >
            New core play
          </button>
        }
      />
      {workspace.corePlays.length === 0 && (
        <section className="staff-panel staff-empty-panel staff-empty-library">
          <span className="staff-empty-library__icon" aria-hidden="true">P</span>
          <h2>Make good practice repeatable</h2>
          <p>Give your team a shared playbook: when to act, who to help, and the steps to follow.</p>
          <button className="button button--secondary" type="button" onClick={() => setSelected(null)}>Create your first core play</button>
        </section>
      )}
      <div className="staff-core-play-grid">
        {workspace.corePlays.map((play) => (
          <article className="staff-core-play" key={play.id}>
            <header>
              <span>CP</span>
              <StatusPill tone={play.status === "active" ? "success" : "warning"}>
                {play.status}
              </StatusPill>
            </header>
            <h2>{play.title}</h2>
            <p>{play.description}</p>
            <div>
              <small>When this happens</small>
              <strong>{play.trigger}</strong>
            </div>
            <div>
              <small>Audience</small>
              <strong>{play.audience}</strong>
            </div>
            <ol>
              {play.steps.slice(0, 4).map((step, index) => (
                <li key={`${play.id}-${index}`}>
                  <span>{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <footer>
              <small>{play.owner} · v{play.version}</small>
              <button type="button" onClick={() => setSelected(play)}>
                Edit play
              </button>
            </footer>
          </article>
        ))}
      </div>
      {selected !== undefined ? (
        <div className="staff-editor-backdrop">
          <CorePlayEditor
            play={selected}
            onSaved={refresh}
            onClose={() => setSelected(undefined)}
          />
        </div>
      ) : null}
    </>
  );
}

function MessageDetail({
  inquiry,
  workspace,
  onSaved,
  subscribeToRealtimeInvalidation,
}: {
  inquiry: StaffInquiry;
  workspace: StaffOperationsWorkspace;
  onSaved: () => void;
  subscribeToRealtimeInvalidation: (invalidate: () => void) => () => void;
}) {
  const action = useApiAction(updateStaffInquiry);
  const loadThread = useCallback(
    (signal: AbortSignal) => getStaffInquiryThread(inquiry.id, signal),
    [inquiry.id],
  );
  const thread = useApiResource(loadThread);
  useEffect(
    () => subscribeToRealtimeInvalidation(thread.refresh),
    [subscribeToRealtimeInvalidation, thread.refresh],
  );
  const [reply, setReply] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await action.run(inquiry.id, {
        expectedVersion: inquiry.version,
        status: form.get("status") as StaffInquiry["status"],
        assigneeId: String(form.get("assigneeId")) || null,
        ...(reply.trim() ? { responseNote: reply.trim() } : {}),
        notifyStudent: form.get("notifyStudent") === "on",
      });
      setReply("");
      thread.refresh();
      onSaved();
    } catch {
      onSaved();
    }
  };
  return (
    <article className="staff-message-reader">
      <header>
        <div className="staff-avatar">
          {inquiry.student.preferredName.slice(0, 1)}
        </div>
        <div>
          <p className="eyebrow">{inquiry.topicCode.replaceAll("_", " ")}</p>
          <h2>{inquiry.subject}</h2>
          <p>
            {inquiry.student.name} · {inquiry.student.programName}
          </p>
        </div>
        <StatusPill tone={inquiry.status === "new" ? "warning" : "neutral"}>
          {inquiry.status.replaceAll("_", " ")}
        </StatusPill>
      </header>
      <div className="staff-message-reader__body">
        <div className="staff-conversation-heading">
          <div>
            <p className="eyebrow">Live conversation</p>
            <h3>Message history</h3>
          </div>
          {thread.data?.expiresAt ? (
            <small>
              Active until {formatTime(thread.data.expiresAt)}
            </small>
          ) : null}
        </div>
        {thread.status === "loading" ? (
          <p className="staff-conversation-state" role="status">Loading messages…</p>
        ) : thread.status === "error" ? (
          <div className="staff-conversation-state" role="alert">
            <p>{thread.error}</p>
            <button type="button" onClick={thread.reload}>Retry</button>
          </div>
        ) : (
          <ol className="staff-conversation-thread" aria-live="polite">
            {(thread.data?.messages ?? []).map((message) => (
              <li
                className={`staff-conversation-message staff-conversation-message--${message.direction}${message.privateToStaff ? " staff-conversation-message--private" : ""}`}
                key={message.id}
              >
                <div>
                  <strong>{message.authorName}</strong>
                  <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                </div>
                <p>{message.body}</p>
                <small>
                  {message.privateToStaff ? "Staff-only note" : message.deliveryStatus}
                </small>
              </li>
            ))}
          </ol>
        )}
      </div>
      <form onSubmit={submit}>
        <div className="staff-form-grid">
          <label>
            Status
            <select name="status" defaultValue={inquiry.status}>
              <option value="new">New</option>
              <option value="open">Open</option>
              <option value="waiting_on_student">Waiting on student</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label>
            Owner
            <select
              name="assigneeId"
              defaultValue={inquiry.assignee?.id ?? ""}
            >
              <option value="">Unassigned</option>
              {workspace.actionCenter.staff.map((member) => (
                <option value={member.id} key={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Reply to student
          <textarea
            value={reply}
            maxLength={1000}
            placeholder="Write a student-safe response…"
            onChange={(event) => setReply(event.target.value)}
          />
        </label>
        <label className="staff-checkbox">
          <input name="notifyStudent" type="checkbox" defaultChecked />
          Deliver this portal message and notify the student in real time
        </label>
        {action.message ? (
          <p className="field-error" role="alert">
            {action.message}
          </p>
        ) : null}
        <footer>
          <button
            className="button button--primary"
            type="submit"
            disabled={action.status === "loading"}
          >
            {action.status === "loading" ? "Saving…" : "Save and reply"}
          </button>
        </footer>
      </form>
    </article>
  );
}

function MessagesView({
  workspace,
  refresh,
  subscribeToRealtimeInvalidation,
}: {
  workspace: StaffOperationsWorkspace;
  refresh: () => void;
  subscribeToRealtimeInvalidation: (invalidate: () => void) => () => void;
}) {
  const [selectedId, setSelectedId] = useState(
    workspace.inquiries[0]?.id ?? null,
  );
  const [scope, setScope] = useState<"all" | "new" | "open" | "resolved">(
    "all",
  );
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const inquiries = workspace.inquiries.filter(
    (inquiry) =>
      (scope === "all" ||
        inquiry.status === scope ||
        (scope === "open" && inquiry.status === "waiting_on_student")) &&
      (!needle ||
        `${inquiry.student.name} ${inquiry.subject} ${inquiry.message}`
          .toLowerCase()
          .includes(needle)),
  );
  const selected =
    workspace.inquiries.find((item) => item.id === selectedId) ??
    inquiries[0] ??
    null;
  return (
    <>
      <PageHeading
        view="messages"
        action={<StatusPill tone="success">Inquiry routing live</StatusPill>}
      />
      <div className="staff-message-layout">
        <section className="staff-message-list">
          <header>
            <label className="staff-search-field">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">Search messages</span>
              <input
                type="search"
                placeholder="Search by student, subject, or message"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="staff-message-scopes">
              {(["all", "new", "open", "resolved"] as const).map((value) => (
                <button
                  className={scope === value ? "is-active" : undefined}
                  type="button"
                  onClick={() => setScope(value)}
                  key={value}
                >
                  {value}
                </button>
              ))}
            </div>
          </header>
          <div>
            {inquiries.map((inquiry) => (
              <button
                className={selected?.id === inquiry.id ? "is-selected" : undefined}
                type="button"
                onClick={() => setSelectedId(inquiry.id)}
                key={inquiry.id}
              >
                <span className="staff-avatar">
                  {inquiry.student.preferredName.slice(0, 1)}
                </span>
                <span>
                  <strong>{inquiry.student.name}</strong>
                  <b>{inquiry.subject}</b>
                  <small>{inquiry.message}</small>
                </span>
                <span>
                  <time dateTime={inquiry.createdAt}>
                    {formatDate(inquiry.createdAt)}
                  </time>
                  {inquiry.status === "new" ? (
                    <i aria-label="Unread message" />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </section>
        {selected ? (
          <MessageDetail
            inquiry={selected}
            workspace={workspace}
            onSaved={refresh}
            subscribeToRealtimeInvalidation={subscribeToRealtimeInvalidation}
            key={`${selected.id}-${selected.version}`}
          />
        ) : (
          <section className="staff-panel staff-empty-panel">
            <h2>No inquiries in this view</h2>
            <p>New student questions will appear here.</p>
          </section>
        )}
      </div>
    </>
  );
}

function ClubEditor({
  club,
  onSaved,
  onClose,
}: {
  club: StudentClub | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const updateAction = useApiAction(updateStaffClub);
  const createAction = useApiAction(createStaffClub);
  const action = club ? updateAction : createAction;
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get("name")),
      category: String(form.get("category")),
      description: String(form.get("description")),
      latestUpdate: String(form.get("latestUpdate")),
      contactName: String(form.get("contactName")),
      contactRole: String(form.get("contactRole")),
      contactChannel: String(form.get("contactChannel")),
      membershipOpen: form.get("membershipOpen") === "on",
    };
    try {
      if (club) {
        await updateAction.run(club.id, {
          expectedVersion: club.version ?? 1,
          ...input,
        });
      } else {
        await createAction.run(input);
      }
      onSaved();
      onClose();
    } catch {
      // The action state renders the API message.
    }
  };
  return (
    <aside className="staff-editor-panel" aria-label="Edit club">
      <header>
        <div>
          <p className="eyebrow">Student-facing club</p>
          <h2>{club ? "Edit campus content" : "Create campus content"}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close editor">
          ×
        </button>
      </header>
      <form onSubmit={save}>
        <label>
          Club name
          <input name="name" defaultValue={club?.name ?? ""} required />
        </label>
        <label>
          Category
          <input name="category" defaultValue={club?.category ?? ""} required />
        </label>
        <label>
          Student description
          <textarea
            className="staff-editor-panel__body"
            name="description"
            defaultValue={club?.description ?? ""}
            required
          />
        </label>
        <label>
          Latest update
          <textarea
            name="latestUpdate"
            defaultValue={club?.latestUpdate ?? ""}
            required
          />
        </label>
        <div className="staff-form-grid">
          <label>
            Contact
            <input
              name="contactName"
              defaultValue={club?.contactName ?? ""}
              required
            />
          </label>
          <label>
            Role
            <input
              name="contactRole"
              defaultValue={club?.contactRole ?? ""}
              required
            />
          </label>
        </div>
        <label>
          Contact channel
          <input
            name="contactChannel"
            defaultValue={club?.contactChannel ?? ""}
            required
          />
        </label>
        <label className="staff-checkbox">
          <input
            name="membershipOpen"
            type="checkbox"
            defaultChecked={club?.membershipOpen ?? true}
          />
          Membership is open
        </label>
        <div className="staff-student-impact-note">
          Saving updates the canonical club record used by the student Campus
          Life page.
        </div>
        {action.message ? (
          <p className="field-error" role="alert">
            {action.message}
          </p>
        ) : null}
        <footer>
          <button className="button button--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--primary"
            type="submit"
            disabled={action.status === "loading"}
          >
            {action.status === "loading"
              ? "Publishing…"
              : club
                ? "Save and publish"
                : "Create and publish"}
          </button>
        </footer>
      </form>
    </aside>
  );
}

function CampusLifeView({
  workspace,
  refresh,
}: {
  workspace: StaffOperationsWorkspace;
  refresh: () => void;
}) {
  const [selected, setSelected] = useState<
    StudentClub | null | undefined
  >(undefined);
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent | null | undefined>(
    undefined,
  );
  return (
    <>
      <PageHeading
        view="campus_life"
        action={
          <div className="staff-heading-actions">
            <Link className="button button--secondary" href="/campus-life">
              Preview student page
            </Link>
            <button
              className="button button--primary"
              type="button"
              onClick={() => setSelected(null)}
            >
              Add club
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => setSelectedEvent(null)}
            >
              Add event
            </button>
          </div>
        }
      />
      <section className="staff-content-toolbar">
        <label className="staff-search-field">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search campus content</span>
          <input type="search" placeholder="Search clubs and organizations" />
        </label>
        <StatusPill tone="success">
          {workspace.campusLife.clubs.length} live clubs
        </StatusPill>
        <StatusPill tone="neutral">
          {workspace.campusLife.events.length} events
        </StatusPill>
      </section>
      <div className="staff-event-management">
        <section className="staff-panel">
          <header className="staff-panel__heading staff-panel__heading--padded">
            <div>
              <p className="eyebrow">Student carousel</p>
              <h2>Upcoming events</h2>
            </div>
            <StatusPill tone="success">
              {workspace.campusLife.events.length} published
            </StatusPill>
          </header>
          <div className="staff-event-list">
            {workspace.campusLife.events.map((event) => (
              <article key={event.id}>
                <div>
                  <span>
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(event.startsAt))}
                  </span>
                  <small>{event.category}</small>
                </div>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.description}</p>
                  <small>{event.location}</small>
                </div>
                <StatusPill tone={event.featured ? "success" : "neutral"}>
                  {event.featured ? "Featured" : "Published"}
                </StatusPill>
                <button
                  className="staff-event-edit-button"
                  type="button"
                  onClick={() => setSelectedEvent(event)}
                >
                  Edit event
                </button>
              </article>
            ))}
          </div>
        </section>
        <ConfigurationAssistant
          key={`campus-${workspace.configurations.campusLife.version}`}
          configuration={workspace.configurations.campusLife}
          kind="campus_life"
          promptPlaceholder={'Try: Add an event called "First-Gen Welcome" on 2027-09-18 at Student Commons.'}
          onSaved={refresh}
        />
      </div>
      <header className="staff-section-heading">
        <div>
          <p className="eyebrow">Student organizations</p>
          <h2>Clubs and communities</h2>
        </div>
        <p>
          Select any club or event to update the content students see. Every
          publish creates a validated, auditable version.
        </p>
      </header>
      <div className="staff-club-grid">
        {workspace.campusLife.clubs.map((club) => (
          <article key={club.id}>
            <div
              className="staff-club-card__image"
              style={{ backgroundImage: `url("${club.imageUrl}")` }}
            >
              <StatusPill tone={club.membershipOpen ? "success" : "neutral"}>
                {club.membershipOpen ? "Open to members" : "Closed"}
              </StatusPill>
            </div>
            <div className="staff-club-card__body">
              <small>{club.category}</small>
              <h2>{club.name}</h2>
              <p>{club.description}</p>
              <div>
                <span>{club.contactName}</span>
                <span>{club.latestUpdate}</span>
              </div>
              <footer>
                <small>v{club.version ?? 1}</small>
                <button type="button" onClick={() => setSelected(club)}>
                  Edit club
                </button>
              </footer>
            </div>
          </article>
        ))}
      </div>
      {selected !== undefined ? (
        <div className="staff-editor-backdrop">
          <ClubEditor
            club={selected}
            onSaved={refresh}
            onClose={() => setSelected(undefined)}
          />
        </div>
      ) : null}
      {selectedEvent !== undefined ? (
        <div className="staff-editor-backdrop">
          <EventEditor
            campusEvent={selectedEvent}
            configuration={workspace.configurations.campusLife}
            onSaved={refresh}
            onClose={() => setSelectedEvent(undefined)}
          />
        </div>
      ) : null}
    </>
  );
}

function AcademicsView({
  workspace,
  refresh,
}: {
  workspace: StaffOperationsWorkspace;
  refresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<
    CatalogCourse | undefined
  >(undefined);
  const courses = workspace.academicCatalog.courses.filter((course) => {
    const search = query.trim().toLowerCase();
    return (
      !search ||
      `${course.code} ${course.title} ${course.description}`
        .toLowerCase()
        .includes(search)
    );
  });

  return (
    <>
      <PageHeading
        view="academics"
        action={
          <Link className="button button--secondary" href="/classrooms">
            Preview student classrooms
          </Link>
        }
      />
      <section className="staff-content-toolbar">
        <label className="staff-search-field">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search courses</span>
          <input
            type="search"
            value={query}
            placeholder="Search course code, title, or topic"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <StatusPill tone="success">
          Catalog {workspace.academicCatalog.version}
        </StatusPill>
        <StatusPill tone="neutral">{courses.length} courses</StatusPill>
      </section>
      <div className="staff-academic-layout">
        <section className="staff-panel staff-course-management">
          <header className="staff-panel__heading staff-panel__heading--padded">
            <div>
              <p className="eyebrow">Canonical catalog</p>
              <h2>Student-visible courses</h2>
            </div>
          </header>
          <div className="staff-course-list">
            {courses.map((course) => (
              <article key={course.id}>
                <button
                  className="staff-content-edit-trigger"
                  type="button"
                  aria-label={`Edit ${course.code} ${course.title}`}
                  onClick={() => setSelectedCourse(course)}
                />
                <span>{course.code}</span>
                <div>
                  <strong>{course.title}</strong>
                  <p>{course.description}</p>
                  <small>
                    {course.credits} credits · Level {course.level} ·{" "}
                    {course.prerequisites.length
                      ? `${course.prerequisites.length} prerequisite${
                          course.prerequisites.length === 1 ? "" : "s"
                        }`
                      : "No prerequisites"}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>
        <ConfigurationAssistant
          key={`academics-${workspace.configurations.academics.version}`}
          configuration={workspace.configurations.academics}
          kind="academics"
          promptPlaceholder={'Try: Add course CS 250 called "Applied AI Studio" for 4 credits.'}
          onSaved={refresh}
        />
      </div>
      <section className="staff-roadmap-note">
        <div>
          <p className="eyebrow">Governance boundary</p>
          <h2>Catalog content is editable; student outcomes are not</h2>
        </div>
        <p>
          Staff can publish courses, prerequisites, instructors, and meeting
          patterns. Transcript exemptions and completed-course records remain
          governed student data and require their separate review workflows.
        </p>
      </section>
      {selectedCourse ? (
        <div className="staff-editor-backdrop">
          <CourseEditor
            course={selectedCourse}
            configuration={workspace.configurations.academics}
            onSaved={refresh}
            onClose={() => setSelectedCourse(undefined)}
          />
        </div>
      ) : null}
    </>
  );
}

/** "Overdue by 3 days" / "Due today" / "Not yet due" — from the server signals, never recomputed. */
function dueSummary(item: StaffWorkItem) {
  if (item.signals?.overdue) {
    return item.signals.overdueDays !== null && item.signals.overdueDays > 0
      ? `Overdue by ${item.signals.overdueDays} day${item.signals.overdueDays === 1 ? "" : "s"}`
      : "Overdue";
  }
  if (!item.dueAt) return "No due date";
  return `Due ${formatDate(item.dueAt)}`;
}

function OutreachView({
  workspace,
  refresh,
  openTaskBoard,
}: {
  workspace: StaffOperationsWorkspace;
  refresh: () => void;
  openTaskBoard: (query: StaffActionCenterQuery) => void;
}) {
  const personal = workspace.personalActionCenter;
  const scopes = workspace.actionCenter.scopes;
  const me = workspace.currentStaff;
  const outreachCapability = workspace.capabilities.externalOutreach;
  // Appointment outcomes live on /v1/staff/me (the profile's fuller record);
  // the queue counts are the board's own SQL scope counts for `assignee=me`.
  const staffMe = useApiResource(
    useCallback((signal: AbortSignal) => getStaffMe(signal), []),
    { refreshOnAmbient: false },
  );
  const awaitingOutcome = staffMe.data?.work.appointmentsAwaitingOutcome ?? null;

  // The workspace ships the first page of the member's open work in attention
  // order; further pages come from the same board query and are appended.
  const [morePages, setMorePages] = useState<StaffWorkItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const queueItems = useMemo(() => {
    const seen = new Set<string>();
    const merged: StaffWorkItem[] = [];
    for (const item of [...personal.tasks, ...morePages]) {
      if (seen.has(item.id) || item.status === "done" || item.status === "cancelled") continue;
      seen.add(item.id);
      merged.push(item);
    }
    return merged;
  }, [personal.tasks, morePages]);
  const queueTotal = personal.queue.total;
  const hasMore = queueItems.length < queueTotal;
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const envelope = await getStaffActionCenter({
        assignee: "me",
        status: "open",
        sort: "attention",
        limit: TASK_BOARD_PAGE_SIZE,
        offset: queueItems.length,
      });
      setMorePages((current) => current.concat(envelope.items));
      setQueueMessage(null);
    } catch (error) {
      setQueueMessage(
        error instanceof Error ? error.message : "More of your queue could not be loaded.",
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIndex = Math.max(
    0,
    queueItems.findIndex((item) => item.id === selectedId),
  );
  const selected = queueItems[selectedIndex] ?? null;
  const [detailId, setDetailId] = useState<string | null>(null);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const studentContext = selected
    ? (personal.students.find((student) => student.id === selected.student.id) ?? null)
    : null;
  const afterMutation = () => {
    setMorePages([]);
    refresh();
  };
  const moveTask = async (item: StaffWorkItem, status: StaffWorkItemStatus) => {
    setTaskMessage(`Updating ${item.key}...`);
    try {
      await updateStaffWorkItem(item.id, {
        expectedVersion: item.version,
        status,
        note:
          status === "done"
            ? "Completed from the personal Action Center."
            : "Started from the personal Action Center.",
      });
      setTaskMessage(
        status === "done" ? `${item.key} completed.` : `${item.key} is now in progress.`,
      );
    } catch (error) {
      setTaskMessage(
        error instanceof Error ? error.message : "The task could not be updated.",
      );
    } finally {
      afterMutation();
    }
  };

  const action = useApiAction(simulateStaffOutreach);
  const [result, setResult] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const run = await action.run({
        title: String(form.get("title")),
        audience: String(form.get("audience")),
        channel: form.get("channel") as "email" | "sms" | "voice",
        requestedCount: Number(form.get("requestedCount")),
      });
      setResult(
        `Simulation recorded for ${run.requestedCount} students. No external contact was sent.`,
      );
      refresh();
    } catch {
      setResult(null);
    }
  };

  const teamOpen = scopes?.myComponent.open ?? null;
  const allOpen = scopes?.all.open ?? null;
  const teamUnassigned = scopes?.myComponent.unassigned ?? null;
  const relationship = selected ? viewerRelationshipLabel(selected.viewerAssignmentRoles) : null;

  return (
    <>
      <PageHeading
        view="outreach"
        action={
          <div className="staff-heading-actions staff-scope-links" aria-label="Read the board as">
            <span>Board:</span>
            <button type="button" onClick={() => openTaskBoard({ assignee: "me" })}>
              Mine{scopes ? ` · ${scopes.mine.open.toLocaleString()}` : ""}
            </button>
            <button type="button" onClick={() => openTaskBoard({ component: me.component })}>
              {me.component}
              {teamOpen !== null ? ` · ${teamOpen.toLocaleString()}` : ""}
            </button>
            <button type="button" onClick={() => openTaskBoard({})}>
              Everyone{allOpen !== null ? ` · ${allOpen.toLocaleString()}` : ""}
            </button>
          </div>
        }
      />
      <section className="staff-metric-grid" aria-label="My work today">
        <MetricCard
          label="Open · mine"
          value={personal.counts.open}
          detail={`Across ${personal.counts.students} student${personal.counts.students === 1 ? "" : "s"} · ${personal.counts.inProgress} in progress`}
        />
        <MetricCard
          label="Overdue"
          value={personal.counts.overdue}
          detail={`${personal.counts.escalated} escalated · ${personal.counts.urgent} urgent`}
          tone="coral"
        />
        <MetricCard
          label="Due today"
          value={personal.counts.dueToday}
          detail={`${personal.counts.blocked} blocked · ${personal.counts.stale} stale in progress`}
          tone="gold"
        />
        <MetricCard
          label="Awaiting outcome"
          value={awaitingOutcome ?? (staffMe.status === "error" ? "—" : "…")}
          detail="Past appointments to close · full record on your profile"
          tone="green"
        />
      </section>
      <div className="staff-personal-action-layout">
        <section className="staff-panel staff-personal-queue">
          <header className="staff-panel__heading staff-panel__heading--padded">
            <div>
              <p className="eyebrow">Assigned to you · escalated, then overdue, then priority</p>
              <h2>My queue</h2>
            </div>
            <StatusPill tone={queueTotal > 0 ? "warning" : "neutral"}>
              {queueTotal.toLocaleString()} open
            </StatusPill>
          </header>
          {queueItems.length === 0 ? (
            <div className="staff-empty-panel staff-empty-panel--queue">
              <h3>Nothing is assigned to you</h3>
              <p>
                No open work item names {me.name} as its owner.
                {teamOpen !== null
                  ? ` ${me.component} has ${teamOpen.toLocaleString()} open item${teamOpen === 1 ? "" : "s"}${
                      teamUnassigned ? ` (${teamUnassigned.toLocaleString()} unassigned)` : ""
                    }`
                  : ""}
                {allOpen !== null ? `; the institution has ${allOpen.toLocaleString()}.` : "."}
              </p>
              <div className="staff-empty-panel__actions">
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => openTaskBoard({ component: me.component })}
                >
                  Open {me.component}&apos;s queue
                </button>
                {teamUnassigned ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => openTaskBoard({ component: me.component, assignee: "unassigned" })}
                  >
                    Unassigned in {me.component}
                  </button>
                ) : null}
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => openTaskBoard({})}
                >
                  Everyone
                </button>
              </div>
            </div>
          ) : (
            <div className="staff-personal-queue__list" data-personal-queue>
              {queueItems.map((item, index) => (
                <button
                  className={[
                    selected?.id === item.id ? "is-selected" : "",
                    index === 0 ? "is-start" : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setTaskMessage(null);
                  }}
                  key={item.id}
                >
                  <span>{index === 0 ? "★" : String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.student.name} · {item.component} · {item.key}
                      {viewerRelationshipLabel(item.viewerAssignmentRoles)
                        ? ` · ${viewerRelationshipLabel(item.viewerAssignmentRoles)}`
                        : ""}
                    </small>
                  </span>
                  <span>
                    <span className={`staff-priority staff-priority--${item.priority}`}>
                      {index === 0 ? "Start here" : item.priority}
                    </span>
                    <small>
                      {dueSummary(item)}
                      {item.escalated ? " · escalated" : ""}
                    </small>
                  </span>
                </button>
              ))}
              {hasMore ? (
                <div className="staff-board-pager">
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                  >
                    {loadingMore
                      ? "Loading more…"
                      : `Load more (${Math.min(TASK_BOARD_PAGE_SIZE, queueTotal - queueItems.length)} of ${
                          queueTotal - queueItems.length
                        } remaining)`}
                  </button>
                </div>
              ) : null}
              {queueMessage ? (
                <p className="staff-board-announcement" role="alert">
                  {queueMessage}
                </p>
              ) : null}
            </div>
          )}
        </section>
        {selected ? (
          <section className="staff-panel staff-student-decision" data-selected-task={selected.key}>
            <header>
              <div>
                <p className="eyebrow">
                  {selectedIndex === 0 ? "Start here" : `#${selectedIndex + 1} in your queue`} · {selected.key}
                </p>
                <h2>{selected.title}</h2>
                <span>
                  {selected.student.name} · {selected.student.programName} · Class of{" "}
                  {selected.student.classYear}
                </span>
              </div>
              <span className={`staff-priority staff-priority--${selected.priority}`}>
                {selected.priority}
              </span>
            </header>
            <div className="staff-decision-grid">
              <article>
                <p className="eyebrow">Why now</p>
                <h3>
                  {selected.escalated ? "Escalated · " : ""}
                  {dueSummary(selected)}
                </h3>
                <p>{selected.description}</p>
                <WorkItemSignals item={selected} />
                <ul>
                  <li>
                    Owner: <strong>{selected.assignee?.id === me.id ? "you" : (selected.assignee?.name ?? "Unassigned")}</strong>
                    {" · "}team: {selected.component}
                  </li>
                  <li>
                    Your relationship:{" "}
                    <strong>{relationship ?? "Not on your caseload"}</strong>
                    {studentContext?.primaryAdviser
                      ? ` · primary adviser ${studentContext.primaryAdviser.id === me.id ? "you" : studentContext.primaryAdviser.name}`
                      : studentContext
                        ? " · no primary adviser"
                        : ""}
                  </li>
                  <li>
                    Status: <strong>{selected.status.replaceAll("_", " ")}</strong>
                    {selected.followUpAt ? ` · follow up ${formatDate(selected.followUpAt)}` : ""}
                    {selected.blocker ? ` · blocked: ${selected.blocker.detail}` : ""}
                  </li>
                  {studentContext ? (
                    <li>
                      Student record: {studentContext.openWorkItems} open
                      {studentContext.overdueWorkItems > 0
                        ? ` · ${studentContext.overdueWorkItems} overdue`
                        : ""}
                      {" · "}
                      {studentContext.journey.stage} · {studentContext.journey.completedTasks}/
                      {studentContext.journey.totalTasks} checklist
                    </li>
                  ) : null}
                </ul>
                {studentContext ? <AttentionPills attention={studentContext.attention} /> : null}
              </article>
              <article className="staff-next-best-action">
                <p className="eyebrow">Act</p>
                <h3>{selected.nextStep ?? "Work this item"}</h3>
                <p>
                  {selected.status === "todo"
                    ? "Start it to claim the interaction, or open the full record to reassign, escalate, or log a communication."
                    : selected.status === "in_progress"
                      ? "Record the outcome when the interaction is done; blockers and follow-ups need the full record."
                      : "This item needs details before it moves; open the full record."}
                </p>
                <dl>
                  <div>
                    <dt>Channel</dt>
                    <dd>{selected.selectedChannel ?? "portal"}</dd>
                  </div>
                  <div>
                    <dt>Attempts</dt>
                    <dd>{selected.attemptCount}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{selected.actionType.replaceAll("_", " ")}</dd>
                  </div>
                </dl>
                <div>
                  {selected.status === "todo" ? (
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => void moveTask(selected, "in_progress")}
                    >
                      Start action
                    </button>
                  ) : null}
                  {selected.status === "todo" || selected.status === "in_progress" ? (
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={() => void moveTask(selected, "done")}
                    >
                      Mark complete
                    </button>
                  ) : null}
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => setDetailId(selected.id)}
                  >
                    Open full record
                  </button>
                </div>
                {taskMessage ? <small aria-live="polite">{taskMessage}</small> : null}
              </article>
            </div>
          </section>
        ) : (
          <section className="staff-panel staff-empty-panel">
            <h2>Pick up your team&apos;s work</h2>
            <p>
              With nothing assigned to you, the Task Board&apos;s <strong>My team</strong> scope shows
              what {me.component} is carrying; claim an item there and it appears here.
            </p>
          </section>
        )}
      </div>
      {detailId ? (
        <TaskDetailDialog
          workItemId={detailId}
          workspace={workspace}
          onClose={() => setDetailId(null)}
          onChanged={afterMutation}
        />
      ) : null}
      <header className="staff-section-heading">
        <div>
          <p className="eyebrow">Agentic delegation</p>
          <h2>Prepare a cohort action</h2>
        </div>
        <p>
          {outreachCapability === "simulation_only"
            ? "This deployment records outreach runs as simulations: the plan is saved and audited, and no student is contacted."
            : `External outreach capability: ${String(outreachCapability).replaceAll("_", " ")}.`}
        </p>
      </header>
      <div className="staff-outreach-layout">
        <section className="staff-panel staff-outreach-builder">
          <header>
            <div>
              <p className="eyebrow">Delegated action</p>
              <h2>Plan a student outreach run</h2>
            </div>
            <StatusPill tone="preview">
              {outreachCapability === "simulation_only" ? "Simulation only" : String(outreachCapability)}
            </StatusPill>
          </header>
          <form onSubmit={submit}>
            <label>
              Run name
              <input name="title" placeholder="What this run is for" required />
            </label>
            <label>
              Audience definition
              <textarea
                name="audience"
                placeholder="Describe who should be reached and why"
                required
              />
            </label>
            <div className="staff-form-grid">
              <label>
                Channel
                <select name="channel" defaultValue="" required>
                  <option value="" disabled>
                    Choose a channel
                  </option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="voice">Voice call</option>
                </select>
              </label>
              <label>
                Students
                <input
                  name="requestedCount"
                  type="number"
                  min="1"
                  max="10000"
                  placeholder="How many"
                  required
                />
              </label>
            </div>
            <div className="staff-simulation-warning">
              <strong>
                {outreachCapability === "simulation_only"
                  ? "Simulation only in this deployment"
                  : "Outreach capability"}
              </strong>
              <p>
                {outreachCapability === "simulation_only"
                  ? "The platform reports external outreach as simulation-only: this saves an auditable run and sends nothing by email, SMS, or voice."
                  : `The platform reports external outreach as “${String(outreachCapability).replaceAll("_", " ")}”.`}
              </p>
            </div>
            {action.message ? (
              <p className="field-error" role="alert">
                {action.message}
              </p>
            ) : null}
            {result ? <p className="staff-action-success">{result}</p> : null}
            <button
              className="button button--primary"
              type="submit"
              disabled={action.status === "loading"}
            >
              {action.status === "loading"
                ? "Saving run…"
                : outreachCapability === "simulation_only"
                  ? "Save simulated run"
                  : "Save run"}
            </button>
          </form>
        </section>
        <section className="staff-panel">
          <header className="staff-panel__heading">
            <div>
              <p className="eyebrow">Run history</p>
              <h2>Recent runs</h2>
            </div>
          </header>
          <div className="staff-run-history">
            {workspace.outreachRuns.length === 0 ? (
              <div className="staff-empty-panel">
                <h3>No runs recorded yet</h3>
                <p>Runs saved here are kept for audit; none has been created for this tenant.</p>
              </div>
            ) : (
              workspace.outreachRuns.map((run) => (
                <article key={run.id}>
                  <span>{run.channel.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{run.title}</strong>
                    <small>
                      {run.requestedCount} students · {run.channel}
                    </small>
                  </div>
                  <StatusPill tone="preview">{run.status.replaceAll("_", " ")}</StatusPill>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function EdwardView({ staffName }: { staffName: string }) {
  return (
    <>
      <PageHeading
        view="edward"
        action={<StatusPill tone="warning">Writes need your confirmation</StatusPill>}
      />
      <div className="edward-page-layout">
        <StaffEdwardAssistant staffName={staffName} variant="embedded" />
        <aside className="staff-edward-context">
          <div className="staff-edward-context__mark">E</div>
          <h2>Edward reads across</h2>
          <ul>
            <li>Student and cohort records</li>
            <li>Enrollment tasks and documents</li>
            <li>Your Task Board queue</li>
            <li>Staff guidance and action rules</li>
            <li>Student inquiries and draft replies</li>
          </ul>
          <div>
            <strong>Safety model</strong>
            <p>
              Edward can propose bounded changes — a follow-up, a work-item
              update, an email to send. Every proposal is previewed by the
              server, checked against policy, and applied only after you
              confirm it; the receipt is recorded on the conversation. It never
              changes a record or contacts a student on its own.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function StaffSidebar({
  view,
  workspace,
  navigate,
}: {
  view: StaffView;
  workspace: StaffOperationsWorkspace;
  navigate: (view: StaffView) => void;
}) {
  // The badge is the member's own open work; the institution's total is the
  // hover text. Both are the server's scope counts, never a page count.
  const scopes = workspace.actionCenter.scopes;
  const boardOpenCount = useApprovedBoardOpenCount();
  const demoBoard = view === "tasks" && workspace.currentStaff.id === "01973261-954a-5019-8e9e-24a699abea7b";
  const openTasks = demoBoard ? boardOpenCount ?? 0 : scopes?.mine.open ?? 0;
  const institutionOpen = demoBoard ? null : scopes?.all.open ?? null;
  const inquiries = workspace.inquiries.filter(
    (item) => item.status === "new",
  ).length;
  return (
    <aside className="staff-sidebar staff-sidebar--workspace">
      <nav aria-label="Staff workspace">
        {navigation.map((group) => {
          const Group = group.label === "Developing" ? "details" : "section";
          return <Group key={group.label} className={group.label === "Developing" ? "staff-developing" : undefined}>
            {group.label === "Developing" ? <summary><span aria-hidden="true">＋</span><strong>Developing</strong><small>{group.items.length}</small></summary> : <p>{group.label}</p>}
            {group.items.map((item) => {
              const badge =
                item.badge === "tasks"
                  ? openTasks
                  : item.badge === "inquiries"
                    ? inquiries
                    : 0;
              return (
                <div key={item.id}>
                <button
                  className={view === item.id ? "staff-sidebar__active" : undefined}
                  type="button"
                  aria-current={view === item.id ? "page" : undefined}
                  title={
                    item.badge === "tasks"
                      ? `${openTasks.toLocaleString()} open task${openTasks === 1 ? "" : "s"} assigned to you${
                          institutionOpen !== null
                            ? ` · ${institutionOpen.toLocaleString()} open across the institution`
                            : ""
                        }`
                      : undefined
                  }
                  onClick={() => navigate(item.id)}
                  key={item.id}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <strong>{item.label}</strong>
                  {badge > 0 ? (
                    <i aria-label={item.badge === "tasks" ? `${badge} assigned to you` : undefined}>
                      {badge}
                    </i>
                  ) : null}
                </button>
                {item.id === "tasks" && view === "tasks" ? <ApprovedBoardNavigation onSelect={() => navigate("tasks")} /> : null}
                </div>
              );
            })}
          </Group>;
        })}
      </nav>
      <div className="staff-sidebar__note">
        <strong>Institutional intelligence</strong>
        <p>
          Convert more admitted students with earlier signals and clearer next actions.
        </p>
      </div>
    </aside>
  );
}

function StaffWorkspaceShell({
  workspace,
  refresh,
}: {
  workspace: StaffOperationsWorkspace;
  refresh: () => void;
}) {
  const [view, setView] = useState<StaffView>("morning_brew");
  const [taskBoardContext, setTaskBoardContext] = useState<StaffTaskBoardContext | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [globalQuery, setGlobalQuery] = useState("");
  const [requestedWorkItemId, setRequestedWorkItemId] = useState<string | null>(null);
  const [taskBoardRequest, setTaskBoardRequest] = useState<{
    query: StaffActionCenterQuery;
    key: number;
  } | null>(null);
  const [studentsRequest, setStudentsRequest] = useState<{
    studentId: string | null;
    query: string;
    key: number;
  } | null>(null);
  const [realtimeNotice, setRealtimeNotice] =
    useState<StaffRealtimeNotice | null>(null);
  const realtimeSubscribers = useRef(new Set<() => void>());
  const subscribeToRealtimeInvalidation = useCallback((invalidate: () => void) => {
    realtimeSubscribers.current.add(invalidate);
    return () => realtimeSubscribers.current.delete(invalidate);
  }, []);

  useEffect(
    () =>
      connectStaffRealtime({
        onEvent: (event) => {
          refresh();
          realtimeSubscribers.current.forEach((invalidate) => invalidate());
          if (event.type === "staff.stream.ready") return;
          const notice = realtimeNoticeFor(event);
          if (notice) setRealtimeNotice(notice);
        },
      }),
    [refresh],
  );

  const readHash = useCallback(() => {
    const candidate = window.location.hash.replace(/^#/, "");
    if (viewOrder.includes(candidate as StaffView)) {
      setView(candidate as StaffView);
    } else if (candidate === "student-record") {
      setView("students");
    }
  }, []);

  useEffect(() => {
    const initialHashSync = window.setTimeout(readHash, 0);
    window.addEventListener("hashchange", readHash);
    return () => {
      window.clearTimeout(initialHashSync);
      window.removeEventListener("hashchange", readHash);
    };
  }, [readHash]);

  // The account menu closes on an outside click or Escape, like any menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // ⌘K / Ctrl+K focuses the student search, as the hint on it promises.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
        searchInput.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const showView = (next: StaffView) => {
    setView(next);
    setMobileNavOpen(false);
    setMenuOpen(false);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Open the task board pre-filtered — the deep link Morning Brew, the profile and the student record use. */
  const openTaskBoard = (query: StaffActionCenterQuery) => {
    setRequestedWorkItemId(null);
    setTaskBoardRequest((current) => ({ query, key: (current?.key ?? 0) + 1 }));
    showView("tasks");
  };

  /** Open the Students view on one student — from the profile caseload or a search. */
  const openStudent = (studentId: string) => {
    setStudentsRequest((current) => ({ studentId, query: "", key: (current?.key ?? 0) + 1 }));
    showView("students");
  };

  /** Hand the top-bar search to the server-side student search. */
  const searchStudents = (query: string) => {
    setStudentsRequest((current) => ({ studentId: null, query, key: (current?.key ?? 0) + 1 }));
    showView("students");
  };

  /** Change view; a `boardQuery` opens the task board pre-filtered instead. */
  const navigate = (next: StaffView, boardQuery?: StaffActionCenterQuery | null) => {
    if (boardQuery) {
      openTaskBoard(boardQuery);
      return;
    }
    setRequestedWorkItemId(null);
    if (next !== "tasks") setTaskBoardRequest(null);
    if (next !== "students") setStudentsRequest(null);
    showView(next);
  };

  const signOut = async () => {
    await signOutStaff();
    window.location.reload();
  };

  const openWorkItem = (workItemId: string) => {
    setRequestedWorkItemId(workItemId);
    showView("tasks");
  };

  const initials = workspace.currentStaff.name
    .split(" ")
    .map((part) => part.slice(0, 1))
    .join("")
    .slice(0, 2);

  return (
    <div className="staff-shell staff-shell--workspace">
      <header className="staff-topbar staff-topbar--workspace">
        <button
          className="staff-mobile-menu"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="staff-brand">
          <PortalMark />
          <div>
            <strong>Audentra</strong>
            <span>Higher Education Intelligence</span>
          </div>
        </div>
        <form
          className="staff-global-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            searchStudents(globalQuery);
          }}
        >
          <span aria-hidden="true">⌕</span>
          <label className="sr-only" htmlFor="staff-global-search">
            Search students
          </label>
          <input
            id="staff-global-search"
            ref={searchInput}
            type="search"
            value={globalQuery}
            onChange={(event) => setGlobalQuery(event.target.value)}
            placeholder="Search students by name, ID or program"
          />
          <kbd>⌘ K</kbd>
        </form>
        <div className="staff-topbar__actions">
          <ResetDemo />
          <NotificationCenter
            onOpenWorkItem={openWorkItem}
            subscribeToRealtimeInvalidation={subscribeToRealtimeInvalidation}
          />
          <StatusPill tone="success">Authenticated</StatusPill>
          <button type="button" onClick={refresh}>
            Refresh
          </button>
          <div className="staff-user-menu-wrap" ref={menuRef}>
            <button
              className="staff-user-menu"
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="staff-user-menu-popover"
              aria-label={`Account menu for ${workspace.currentStaff.name}`}
              title="Account menu"
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span>{initials}</span>
              <span>
                <strong>{workspace.currentStaff.name}</strong>
                <small>{workspace.currentStaff.component}</small>
              </span>
            </button>
            {menuOpen ? (
              <div
                id="staff-user-menu-popover"
                className="staff-user-menu__popover"
                role="menu"
                aria-label="Account"
              >
                <button type="button" role="menuitem" onClick={() => navigate("profile")}>
                  Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {realtimeNotice ? (
        <section
          className="staff-realtime-notice"
          role="status"
          aria-live="polite"
          key={realtimeNotice.eventId}
        >
          <div>
            <span className="staff-realtime-notice__signal" aria-hidden="true" />
            <div>
              <strong>{realtimeNotice.title}</strong>
              <p>{realtimeNotice.body}</p>
            </div>
          </div>
          <div className="staff-realtime-notice__actions">
            <button
              type="button"
              onClick={() => {
                refresh();
                realtimeSubscribers.current.forEach((invalidate) => invalidate());
                setRealtimeNotice(null);
              }}
            >
              Refresh
            </button>
            {realtimeNotice.workItemId ? (
              <button
                className="staff-realtime-notice__open"
                type="button"
                onClick={() => {
                  openWorkItem(realtimeNotice.workItemId!);
                  setRealtimeNotice(null);
                }}
              >
                Open
              </button>
            ) : null}
            <button
              className="staff-realtime-notice__dismiss"
              type="button"
              aria-label="Dismiss realtime update"
              onClick={() => setRealtimeNotice(null)}
            >
              ×
            </button>
          </div>
        </section>
      ) : null}
      <div className={mobileNavOpen ? "staff-mobile-nav is-open" : "staff-mobile-nav"}>
        <StaffSidebar view={view} workspace={workspace} navigate={navigate} />
      </div>
      <StaffSidebar view={view} workspace={workspace} navigate={navigate} />
      <main className="staff-main staff-main--workspace">
        {view === "morning_brew" ? (
          <MorningBrewView workspace={workspace} navigate={navigate} />
        ) : view === "overview" ? (
          <><OverviewView workspace={workspace} navigate={navigate} /><UniversityOperationsPanel /></>
        ) : view === "tasks" ? (
          <ApprovedTaskBoard
            key={requestedWorkItemId ?? `task-board-${taskBoardRequest?.key ?? 0}`}
            initialTask={requestedWorkItemId}
            initialQuery={taskBoardRequest?.query}
            onContextChange={setTaskBoardContext}
            demo={workspace.currentStaff.id === "01973261-954a-5019-8e9e-24a699abea7b"}
            onOpenWorkspace={id => { if (id) openStudent(id); else showView("outreach"); }} />
        ) : view === "students" ? (
          <StudentsView
            key={`students-${studentsRequest?.key ?? 0}`}
            refresh={refresh}
            openTaskBoard={openTaskBoard}
            initialStudentId={studentsRequest?.studentId ?? null}
            initialQuery={studentsRequest?.query ?? ""}
          />
        ) : view === "profile" ? (
          <StaffProfileView
            heading={<PageHeading view="profile" />}
            openTaskBoard={openTaskBoard}
            openStudent={openStudent}
            onSignOut={() => void signOut()}
          />
        ) : view === "journeys" ? (
          <JourneysView workspace={workspace} refresh={refresh} />
        ) : view === "knowledge" ? (
          <KnowledgeView workspace={workspace} refresh={refresh} />
        ) : view === "core_plays" ? (
          <CorePlaysView workspace={workspace} refresh={refresh} />
        ) : view === "messages" ? (
          <MessagesView
            workspace={workspace}
            refresh={refresh}
            subscribeToRealtimeInvalidation={subscribeToRealtimeInvalidation}
          />
        ) : view === "campus_life" ? (
          <CampusLifeView workspace={workspace} refresh={refresh} />
        ) : view === "academics" ? (
          <AcademicsView workspace={workspace} refresh={refresh} />
        ) : view === "outreach" ? (
          <OutreachView workspace={workspace} refresh={refresh} openTaskBoard={openTaskBoard} />
        ) : (
          <EdwardView staffName={workspace.currentStaff.name} />
        )}
      </main>
      {view !== "edward" ? (
        <StaffEdwardAssistant staffName={workspace.currentStaff.name}
          pageContext={view === "tasks" ? taskBoardContext ?? {surface:"task_board"} : undefined} />
      ) : null}
    </div>
  );
}

export default function StaffPortal() {
  const loadWorkspace = useCallback(
    (signal: AbortSignal) => getStaffOperationsWorkspace(signal),
    [],
  );
  const workspace = useApiResource(loadWorkspace, {
    refreshOnAmbient: false,
  });
  const refresh = workspace.refresh;

  useEffect(() => {
    if (workspace.status !== "ready") return;
    const interval = window.setInterval(refresh, 10_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [workspace.status, refresh]);

  if (
    workspace.status === "error" &&
    (workspace.errorStatus === 401 || workspace.errorStatus === 403)
  ) {
    return <StaffSignIn onSignedIn={workspace.reload} />;
  }
  if (workspace.status === "loading") {
    return (
      <main className="staff-entry">
        <section className="staff-entry__card" aria-live="polite">
          <PortalMark />
          <p className="eyebrow">Staff workspace</p>
          <h1>Opening operations</h1>
          <p>Loading the latest tasks, student records, and managed content…</p>
          <span className="loader" aria-hidden="true" />
        </section>
      </main>
    );
  }
  if (workspace.status === "error") {
    return (
      <main className="staff-entry">
        <section className="staff-entry__card" role="alert">
          <PortalMark />
          <h1>The staff workspace could not load</h1>
          <p>{workspace.error}</p>
          <button
            className="button button--primary"
            type="button"
            onClick={workspace.reload}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }
  return (
    <StaffWorkspaceShell
      workspace={workspace.data}
      refresh={workspace.refresh}
    />
  );
}
