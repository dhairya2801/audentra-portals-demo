import type {
  StaffActionCenter,
  StaffManagedConfiguration,
  StaffOperationsWorkspace,
  StaffStudentOperation,
  StaffStudentRecord,
  StaffWorkItem,
} from "@vv/contracts";

export const STAFF_DEMO_EMAIL = "priya.shah@aster.example.edu";
export const STAFF_DEMO_PASSWORD = "AudentraDemo2026!";

const SESSION_KEY = "audentra:staff-demo-session:v1";
const configuredDemoMode = process.env.NEXT_PUBLIC_STAFF_DEMO_MODE?.trim();
const configuredApiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

/**
 * Staff demo mode is explicit when configured, and is also the safe default
 * when a deployment has no public API origin. Real API deployments preserve
 * the existing credential/session transport by setting NEXT_PUBLIC_API_BASE_URL.
 */
export const staffDemoEnabled =
  configuredDemoMode === "true" || (!configuredApiOrigin && configuredDemoMode !== "false");

const now = "2026-08-07T12:30:00.000Z";
const staff = {
  id: "demo-staff-priya",
  name: "Priya Shah",
  email: STAFF_DEMO_EMAIL,
  component: "Admissions",
};
const colleague = {
  id: "demo-staff-jordan",
  name: "Jordan Reyes",
  email: "jordan.reyes@aster.example.edu",
  component: "Student Finance",
};

const studentSeeds = [
  ["Maya Kim", "Health Sciences", 88, "financial", 2, 8],
  ["Mateo Johnson", "Business Administration", 82, "administrative", 3, 9],
  ["Jordan Garcia", "Computer Science", 76, "engagement", 4, 10],
  ["Amara Okafor", "Nursing", 71, "timing", 5, 9],
  ["Lucas Brown", "Psychology", 63, "financial", 6, 10],
  ["Sofia Martinez", "Biology", 54, "belonging", 7, 10],
  ["Ethan Nguyen", "Engineering", 38, "academic", 8, 10],
  ["Noah Williams", "Communications", 24, "confidence", 9, 10],
] as const;

const cohort: StaffStudentOperation[] = studentSeeds.map(
  ([name, programName, score, category, completedTasks, totalTasks], index) => {
    const band = score >= 85 ? "critical" : score >= 70 ? "high" : score >= 50 ? "medium" : "low";
    const preferredName = name.split(" ")[0];
    return {
      id: `demo-student-${index + 1}`,
      name,
      preferredName,
      programName,
      classYear: 2027,
      assignedStaffId: staff.id,
      syntheticSeed: true,
      journey: {
        stage: completedTasks < 4 ? "Decision & deposit" : "Enrollment readiness",
        completedTasks,
        totalTasks,
        lastActivityAt: `2026-08-0${Math.min(index + 1, 7)}T14:00:00.000Z`,
      },
      risk: {
        score,
        band,
        category,
        meltLikelihoodPercent: score,
        recoveryLikelihoodPercent: Math.max(12, 100 - score + 18),
        reason: score >= 70
          ? "Strong enrollment intent is present, but an operational blocker is slowing the next step."
          : "Progress is within the expected range for this point in the cycle.",
        signals: score >= 70
          ? ["Incomplete next step", "Recent student intent", "Recoverable blocker"]
          : ["Recent activity", "Journey progressing"],
        modelVersion: "demo-risk-v1",
        evaluatedAt: now,
      },
      recommendedAction: {
        title: score >= 70 ? "Resolve the active enrollment blocker" : "Monitor progress",
        rationale: "Prioritized from modeled intent, risk, and journey progression.",
        channel: index % 2 === 0 ? "email" : "voice",
        expectedImpact: score >= 70 ? "High likelihood of restoring momentum" : "Maintain engagement",
        taskId: score >= 50 ? `demo-task-${index + 1}` : null,
        recommendedToday: score >= 50,
      },
      communicationHistory: [],
    };
  },
);

function workItem(student: StaffStudentOperation, index: number): StaffWorkItem {
  const priorities = ["urgent", "urgent", "high", "high", "medium", "low"] as const;
  const statuses = ["todo", "in_progress", "todo", "in_progress", "todo", "done"] as const;
  return {
    id: `demo-task-${index + 1}`,
    key: `ENR-${120 + index}`,
    title: index === 0 ? "Complete aid verification review" : index === 1 ? "Resolve housing access blocker" : "Follow up on enrollment milestone",
    description: "Review the connected student signals, confirm the blocker, and take the recommended next action.",
    status: statuses[index] ?? "todo",
    priority: priorities[index] ?? "medium",
    type: index === 0 ? "document_review" : "enrollment",
    component: index === 0 ? "Financial aid" : "Enrollment",
    dueAt: `2026-08-${String(8 + index).padStart(2, "0")}T17:00:00.000Z`,
    escalated: index < 2,
    version: 1,
    createdAt: now,
    updatedAt: now,
    assignee: index === 2 ? colleague : staff,
    student: {
      id: student.id,
      name: student.name,
      preferredName: student.preferredName,
      programName: student.programName,
      classYear: student.classYear,
    },
    source: { type: "requirement", id: `demo-requirement-${index + 1}` },
    history: [{ id: `demo-log-${index + 1}`, action: "created", message: "Audentra prioritized this item from the latest student signals.", actorName: "Audentra", occurredAt: now }],
  };
}

const tasks = cohort.slice(0, 6).map(workItem);

function actionCenter(): StaffActionCenter {
  return {
    items: structuredClone(tasks),
    staff: [staff, colleague],
    counts: {
      todo: tasks.filter((item) => item.status === "todo").length,
      inProgress: tasks.filter((item) => item.status === "in_progress").length,
      done: tasks.filter((item) => item.status === "done").length,
      urgent: tasks.filter((item) => item.priority === "urgent").length,
      escalated: tasks.filter((item) => item.escalated).length,
    },
    generatedAt: now,
  };
}

const configurations: StaffOperationsWorkspace["configurations"] = {
  journeys: { kind: "journeys", fileName: "journeys.yaml", version: 3, yaml: "schema_version: 1\nconfiguration: journeys\nflows: []\n", recordCount: 8, updatedAt: now, updatedBy: staff.name, changeSummary: "Demo enrollment journey" },
  campusLife: { kind: "campus_life", fileName: "campus-life.yaml", version: 2, yaml: "schema_version: 1\nconfiguration: campus_life\nevents: []\n", recordCount: 6, updatedAt: now, updatedBy: staff.name },
  academics: { kind: "academics", fileName: "academics.yaml", version: 4, yaml: "schema_version: 1\nconfiguration: academics\ncourses: []\n", recordCount: 18, updatedAt: now, updatedBy: staff.name },
};

function configurationFor(value: string): StaffManagedConfiguration {
  if (value === "campus_life" || value === "campusLife") return configurations.campusLife;
  if (value === "academics") return configurations.academics;
  return configurations.journeys;
}

function studentRecord(operation = cohort[0]): StaffStudentRecord {
  return {
    student: {
      id: operation.id,
      name: operation.name,
      preferredName: operation.preferredName,
      programName: operation.programName,
      classYear: operation.classYear,
    },
    onboarding: { status: "completed", version: 1, data: {} } as StaffStudentRecord["onboarding"],
    profile: { studentId: operation.id, preferredName: operation.preferredName, communicationPreference: "email", pronouns: null, mobilePhone: null, version: 1, updatedAt: now },
    requirements: { items: [], total: 3 } as StaffStudentRecord["requirements"],
    documents: { items: [], total: 0 },
    syntheticTestRecord: true,
    operation,
  };
}

export function buildDemoStaffWorkspace(): StaffOperationsWorkspace {
  const center = actionCenter();
  const todayStudents = cohort.filter((student) => student.recommendedAction.recommendedToday);
  return {
    currentStaff: staff,
    actionCenter: center,
    personalActionCenter: {
      staff,
      students: todayStudents,
      tasks: center.items.filter((item) => item.status !== "done"),
      counts: {
        studentsToday: todayStudents.length,
        critical: todayStudents.filter((student) => student.risk.band === "critical").length,
        highRisk: todayStudents.filter((student) => student.risk.band === "high").length,
        inProgress: center.counts.inProgress,
        completed: center.counts.done,
      },
      generatedAt: now,
    },
    cohort: structuredClone(cohort),
    cohortSeed: { synthetic: true, count: cohort.length, purpose: "Browser-only Vercel product demonstration", generatedAt: now, tenantSlug: "aster" },
    student: studentRecord(),
    knowledgeBase: [
      { id: "demo-knowledge-1", title: "Deposit deadline guidance", summary: "Approved guidance for admitted students approaching the deposit deadline.", body: "Confirm the active offer deadline before outreach.", category: "Enrollment", audience: "student", status: "published", owner: staff.name, version: 1, updatedAt: now },
      { id: "demo-knowledge-2", title: "Aid verification playbook", summary: "Internal review steps for incomplete aid files.", body: "Prioritize files with a deposit or housing dependency.", category: "Financial aid", audience: "internal", status: "published", owner: colleague.name, version: 1, updatedAt: now },
    ],
    corePlays: [{ id: "demo-play-1", title: "Recover deposit-ready housing blockers", description: "Coordinate Admissions and Housing when student intent is clear.", trigger: "Deposit paid and housing incomplete", audience: "Deposit-ready admitted students", steps: ["Confirm access state", "Assign an owner", "Contact the student", "Verify completion"], status: "active", owner: staff.name, version: 1, updatedAt: now }],
    inquiries: [{ id: "demo-inquiry-1", student: center.items[2].student, topicCode: "documents", subject: "Which transcript should I upload?", message: "Should I upload my current transcript or wait for the final copy?", status: "new", priority: "medium", assignee: staff, createdAt: now, updatedAt: now, version: 1 }],
    journeyBlueprint: [],
    academicCatalog: { version: "demo-catalog-v1", courses: [] },
    configurations,
    campusLife: { events: [], clubs: [], generatedAt: now },
    portalInventory: [
      { id: "onboarding", label: "Onboarding", description: "Student intake and consent", recordCount: 5, managementState: "partially_editable" },
      { id: "enrollment", label: "Enrollment", description: "Enrollment checklist", recordCount: 9, managementState: "editable" },
      { id: "classrooms", label: "Classrooms", description: "Academic experience", recordCount: 18, managementState: "editable" },
      { id: "campus_life", label: "Campus life", description: "Events and clubs", recordCount: 7, managementState: "editable" },
      { id: "financials", label: "Financials", description: "Student accounts", recordCount: 7, managementState: "planned" },
      { id: "messages", label: "Messages", description: "Student inquiries", recordCount: 1, managementState: "editable" },
      { id: "help", label: "Help", description: "Support guidance", recordCount: 8, managementState: "editable" },
    ],
    outreachRuns: [],
    capabilities: { sharedStudentEdits: true, campusContentEdits: true, knowledgeBaseEdits: true, corePlayEdits: true, inquiryReplies: true, externalOutreach: "simulation_only", staffEdward: "preview_only", managedYaml: true },
    generatedAt: now,
  };
}

function hasSession() {
  try { return window.localStorage.getItem(SESSION_KEY) === "authenticated"; } catch { return false; }
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "x-audentra-demo": "browser-fixture" } });
}

function parseBody(init: RequestInit) {
  try { return typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {}; } catch { return {}; }
}

export async function demoStaffFetch(path: string, init: RequestInit): Promise<Response | null> {
  if (!staffDemoEnabled || typeof window === "undefined") return null;
  if (!path.startsWith("/v1/staff/") && !path.startsWith("/v1/auth/staff/")) return null;
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  const method = (init.method ?? "GET").toUpperCase();

  if (path === "/v1/auth/staff/sign-out") {
    window.localStorage.removeItem(SESSION_KEY);
    return json({ authenticated: false, mode: "credentials", actorType: "staff" });
  }
  if (path === "/v1/auth/staff/sign-in" || path === "/v1/auth/staff/sign-up") {
    const body = parseBody(init);
    const acceptedDemoPasswords = new Set([
      STAFF_DEMO_PASSWORD,
      "MorningBrewDemo2026!",
      "Individual-staff-password-2027",
    ]);
    if (
      path.endsWith("sign-in") &&
      (String(body.email).trim().toLowerCase() !== STAFF_DEMO_EMAIL ||
        !acceptedDemoPasswords.has(String(body.password)))
    ) {
      return json({ error: { code: "invalid_credentials", message: "Use the existing demo staff credentials or choose Explore the Audentra demo." } }, 401);
    }
    window.localStorage.setItem(SESSION_KEY, "authenticated");
    return json({ authenticated: true, mode: "credentials", actorType: "staff", staff, notice: "Browser-only Audentra demo session" });
  }
  if (!hasSession()) {
    return json({ error: { code: "staff_session_required", message: "Sign in to open the staff workspace." } }, 401);
  }

  const workspace = buildDemoStaffWorkspace();
  if (method === "GET" && path === "/v1/staff/workspace") return json(workspace);
  if (method === "GET" && path === "/v1/staff/action-center") return json(workspace.actionCenter);
  if (method === "GET" && path.startsWith("/v1/staff/students/")) {
    const id = decodeURIComponent(path.split("/").at(-1) ?? "");
    return json(studentRecord(workspace.cohort.find((item) => item.id === id) ?? workspace.cohort[0]));
  }
  if (method === "GET" && path.startsWith("/v1/staff/configurations/")) {
    return json(configurationFor(path.split("/").at(-1) ?? "journeys"));
  }
  if (path.startsWith("/v1/staff/work-items/")) {
    const id = decodeURIComponent(path.split("/").at(-1) ?? "");
    const item = workspace.actionCenter.items.find((candidate) => candidate.id === id) ?? workspace.actionCenter.items[0];
    return json({ ...item, ...parseBody(init), version: item.version + 1, updatedAt: new Date().toISOString() });
  }
  if (path.includes("/preferences")) return json(workspace.student);
  if (path.startsWith("/v1/staff/configurations/") && method === "PUT") {
    const kind = path.split("/").at(-1) ?? "journeys";
    const current = configurationFor(kind);
    return json({ ...current, ...parseBody(init), version: current.version + 1, updatedAt: new Date().toISOString() });
  }
  if (path === "/v1/staff/edward/configuration-draft") {
    const body = parseBody(init);
    return json({ kind: body.kind, expectedVersion: body.expectedVersion, yaml: configurationFor(String(body.kind)).yaml, summary: "Edward prepared a safe demo draft for review.", changes: ["Added the requested demonstration step"], warnings: [], executionMode: "draft_requires_confirmation" });
  }
  if (path === "/v1/staff/edward/preview") {
    return json({ message: "I can review student signals, draft outreach, and prepare a plan. This browser demo will not execute external actions.", plan: [{ label: "Review today’s priority students", capability: "read_student_data", status: "available" }], dataSources: ["Synthetic staff workspace", "Morning Brew briefing"], executionMode: "preview_only" });
  }
  if (path === "/v1/staff/outreach/simulate") {
    const body = parseBody(init);
    return json({ id: crypto.randomUUID(), title: body.title, audience: body.audience, channel: body.channel, requestedCount: body.requestedCount, status: "simulation_only", createdBy: staff.name, createdAt: new Date().toISOString() });
  }
  if (path.includes("/knowledge-base")) return json(workspace.knowledgeBase[0]);
  if (path.includes("/core-plays")) return json(workspace.corePlays[0]);
  if (path.includes("/inquiries/")) return json({ ...workspace.inquiries[0], ...parseBody(init), version: 2 });
  if (path.includes("/campus-life/clubs")) return json(workspace.campusLife.clubs[0] ?? {});
  if (path === "/v1/staff/media") return json({ fileName: "demo-image.webp", mimeType: "image/webp", sizeBytes: 0, sha256: "demo", publicPath: "/media/demo-image.webp", publicUrl: "/media/demo-image.webp" });
  if (path.includes("/documents/") && path.endsWith("/decision")) return json({ document: workspace.student.documents.items[0] ?? {}, workItem: workspace.actionCenter.items[0], notification: null });

  return json({ error: { code: "demo_operation_unavailable", message: "This operation is read-only in the browser demo." } }, 409);
}
