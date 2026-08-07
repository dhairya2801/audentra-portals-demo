import type { StaffOperationsWorkspace } from "@vv/contracts";
import type {
  EdwardAnswer,
  MorningBrewBriefing,
  MorningBrewConnector,
  MorningBrewConnectorId,
  MorningBrewTopic,
  MorningBrewTopicId,
} from "./types";

export const MORNING_BREW_TOPICS: MorningBrewTopic[] = [
  { id: "enrollment_admissions", title: "Enrollment & Admissions", description: "Yield, deposits, funnel movement, and emerging segments.", icon: "↗", accent: "blue" },
  { id: "financial_aid", title: "Financial Aid", description: "FAFSA, verification, packaging, and affordability pressure.", icon: "$", accent: "teal" },
  { id: "student_operations", title: "Student Operations & Risks", description: "Blockers, service queues, engagement, and intervention signals.", icon: "◇", accent: "purple" },
  { id: "executive_performance", title: "Executive & Institutional Performance", description: "Plan pace, net tuition outlook, capacity, and cross-functional movement.", icon: "A", accent: "navy" },
  { id: "industry_policy", title: "Industry, Government & Policy", description: "Higher-ed developments translated into institutional relevance.", icon: "◎", accent: "slate" },
];

export const MORNING_BREW_CONNECTORS: MorningBrewConnector[] = [
  { id: "outlook", title: "Email / Outlook", description: "Surface high-priority messages and decision requests.", icon: "O", optional: true },
  { id: "calendar", title: "Calendar", description: "Add today’s agenda, preparation notes, and deadlines.", icon: "31", optional: true },
  { id: "student_crm", title: "Student CRM", description: "Use the staff workspace as briefing context.", icon: "A", optional: false },
];

export const DEFAULT_MORNING_BREW_TOPICS: MorningBrewTopicId[] = [
  "enrollment_admissions",
  "financial_aid",
  "student_operations",
];

const orderByTopics = <T extends { topic: MorningBrewTopicId }>(items: T[], topics: MorningBrewTopicId[]) => {
  const rank = new Map(topics.map((topic, index) => [topic, index]));
  return [...items].sort((a, b) => (rank.get(a.topic) ?? 99) - (rank.get(b.topic) ?? 99));
};

export function buildMorningBrewBriefing(
  workspace: StaffOperationsWorkspace,
  topics: MorningBrewTopicId[],
  connectors: Record<MorningBrewConnectorId, boolean>,
): MorningBrewBriefing {
  const selected = new Set(topics);
  const cohort = workspace.cohort;
  const highRisk = cohort.filter((student) => student.risk.band === "high" || student.risk.band === "critical");
  const financialRisk = cohort.filter((student) => student.risk.category === "financial");
  const recommendedToday = cohort.filter((student) => student.recommendedAction.recommendedToday);
  const openTasks = workspace.actionCenter.items.filter((item) => item.status !== "done");
  const urgentTasks = openTasks.filter((item) => item.priority === "urgent" || item.escalated);
  const newInquiries = workspace.inquiries.filter((item) => item.status === "new");
  const averageCompletion = cohort.length
    ? Math.round(cohort.reduce((sum, student) => sum + (student.journey.totalTasks ? student.journey.completedTasks / student.journey.totalTasks : 0), 0) / cohort.length * 100)
    : 0;

  const stories = [
    {
      id: "conversion", topic: "enrollment_admissions" as const, label: "Enrollment signal",
      title: "Deposit momentum is positive, but conversion is not keeping pace with admits",
      summary: "The modeled deposit rate is 1.7 points behind this point last cycle even as transfer applications remain above plan.",
      takeaway: "Protecting yield now matters more than adding volume. Aid-incomplete and commuter admits explain most of the gap.",
      tone: "watch" as const, source: "modeled" as const, destination: "outreach" as const,
    },
    {
      id: "aid", topic: "financial_aid" as const, label: "Financial aid",
      title: `17 aid files need review; ${financialRisk.length} students also carry a financial-risk signal`,
      summary: "Verification and missing-document cases grew this week, with 12 deadlines inside the next seven days.",
      takeaway: "A focused review block today can prevent avoidable deposit delays and repeat student contacts.",
      tone: "urgent" as const, source: "modeled" as const, destination: "tasks" as const,
    },
    {
      id: "housing", topic: "student_operations" as const, label: "Student operations",
      title: "23 students paid their deposit but are still blocked from housing",
      summary: `${highRisk.length} students in the current workspace are high or critical risk; ${recommendedToday.length} have a recommended action for today.`,
      takeaway: "The housing gap appears operational—not a lack of intent. Resolve access and prerequisite mismatches before sending another reminder.",
      tone: "urgent" as const, source: "modeled" as const, destination: "students" as const,
    },
    {
      id: "outlook", topic: "executive_performance" as const, label: "Executive outlook",
      title: "Net tuition remains above last year, with yield as the swing factor",
      summary: "The modeled outlook is $98.4M, up 5.2% year over year but $11.6M below the planning target.",
      takeaway: "Near-term forecast movement is more sensitive to conversion than new application volume.",
      tone: "watch" as const, source: "modeled" as const,
    },
    {
      id: "policy", topic: "industry_policy" as const, label: "Policy watch",
      title: "Proposed state funding language increases the value of clean workforce-program reporting",
      summary: "A demo policy-monitor signal flags performance-funding language tied to workforce enrollment and completion.",
      takeaway: "Institutional research should validate program mappings now; no immediate student-facing change is recommended.",
      tone: "neutral" as const, source: "connected_demo" as const,
    },
  ];

  const metrics = [
    { id: "applications", topic: "enrollment_admissions" as const, label: "Applications", value: "14,782", delta: "+3.2%", comparison: "vs last week", direction: "up" as const, favorable: true, points: [36,38,37,42,44,43,49,52], source: "modeled" as const },
    { id: "deposits", topic: "enrollment_admissions" as const, label: "Deposits", value: "2,450", delta: "+0.6%", comparison: "vs last week", direction: "up" as const, favorable: true, points: [26,30,29,31,33,32,35,36], source: "modeled" as const },
    { id: "yield", topic: "enrollment_admissions" as const, label: "Yield", value: "23.7%", delta: "−1.7 pts", comparison: "vs last cycle", direction: "down" as const, favorable: false, points: [42,41,39,40,37,36,35,33], source: "modeled" as const },
    { id: "fafsa", topic: "financial_aid" as const, label: "FAFSA complete", value: "68.4%", delta: "+8.0%", comparison: "this week", direction: "up" as const, favorable: true, points: [29,30,32,34,38,42,45,51], source: "modeled" as const },
    { id: "risk", topic: "student_operations" as const, label: "High-risk students", value: String(highRisk.length), delta: `${recommendedToday.length} act today`, comparison: "current cohort", direction: "flat" as const, favorable: highRisk.length < 20, points: [37,35,36,34,32,33,31,30], source: "workspace" as const },
    { id: "progress", topic: "student_operations" as const, label: "Journey complete", value: `${averageCompletion}%`, delta: "+2.1 pts", comparison: "this week", direction: "up" as const, favorable: true, points: [25,27,28,32,34,37,40,44], source: "workspace" as const },
    { id: "work", topic: "executive_performance" as const, label: "Open staff work", value: String(openTasks.length), delta: `${urgentTasks.length} urgent`, comparison: "live workspace", direction: urgentTasks.length ? "up" as const : "flat" as const, favorable: urgentTasks.length === 0, points: [42,39,41,37,36,33,31,29], source: "workspace" as const },
    { id: "tuition", topic: "executive_performance" as const, label: "Net tuition outlook", value: "$98.4M", delta: "+5.2%", comparison: "vs last year", direction: "up" as const, favorable: true, points: [28,31,30,34,36,39,41,45], source: "modeled" as const },
  ];

  const changes = [
    { id: "fafsa", topic: "financial_aid" as const, time: "7:10 AM", title: "FAFSA completion crossed 68%", detail: "First-generation students produced the strongest modeled one-week improvement.", tone: "positive" as const, source: "modeled" as const },
    { id: "risk", topic: "student_operations" as const, time: "6:45 AM", title: `${recommendedToday.length} intervention recommendations are ready`, detail: "The live workspace signals point to narrow, recoverable cases with a clear next action.", tone: "watch" as const, source: "workspace" as const },
    { id: "transfer", topic: "enrollment_admissions" as const, time: "Yesterday · 4:30 PM", title: "Transfer demand moved above target pace", detail: "Business and Health Sciences account for two thirds of the modeled weekly lift.", tone: "positive" as const, source: "modeled" as const },
    { id: "resolved", topic: "executive_performance" as const, time: "Yesterday · 3:15 PM", title: `${workspace.actionCenter.counts.done} work items are resolved`, detail: `${openTasks.length} remain open and ${urgentTasks.length} are urgent or escalated.`, tone: "neutral" as const, source: "workspace" as const },
  ];

  const attention = [
    { id: "housing", topic: "student_operations" as const, count: "23", label: "deposit-ready students", detail: "Cannot complete housing because of access or prerequisite blockers.", urgency: "today" as const, source: "modeled" as const, destination: "students" as const },
    { id: "aid", topic: "financial_aid" as const, count: "12", label: "aid files", detail: "Are missing verification documents with deadlines in the next seven days.", urgency: "this_week" as const, source: "modeled" as const, destination: "tasks" as const },
    { id: "actions", topic: "student_operations" as const, count: String(recommendedToday.length), label: "recommended actions", detail: "Are ready for staff based on current student risk and journey progress.", urgency: "today" as const, source: "workspace" as const, destination: "outreach" as const },
    { id: "inquiries", topic: "executive_performance" as const, count: String(newInquiries.length), label: "new inquiries", detail: "Still need a first response from the enrollment team.", urgency: "today" as const, source: "workspace" as const, destination: "messages" as const },
  ];

  const selectedStories = orderByTopics(stories.filter((item) => selected.has(item.topic)), topics);
  const selectedMetrics = orderByTopics(metrics.filter((item) => selected.has(item.topic)), topics);
  return {
    headline: urgentTasks.length > 4 ? "A focused morning: three decisions can protect this week’s momentum." : "Momentum is healthy. Conversion and completion deserve the closest look.",
    deck: "Audentra connected the latest operational signals into a short, decision-ready read for enrollment leadership.",
    readTimeMinutes: 4,
    updatedAt: workspace.generatedAt,
    stories: selectedStories.slice(0, 5),
    metrics: selectedMetrics.slice(0, 8),
    changes: orderByTopics(changes.filter((item) => selected.has(item.topic)), topics).slice(0, 5),
    attention: orderByTopics(attention.filter((item) => selected.has(item.topic)), topics).slice(0, 4),
    meetings: connectors.calendar ? [
      { id: "leadership", time: "8:30 AM", duration: "45 min", title: "Enrollment leadership huddle", detail: "Prepare: deposit conversion and housing blockers", priority: "high", attendees: ["AM", "JR", "PL", "+5"] },
      { id: "campaign", time: "10:00 AM", duration: "30 min", title: "Commuter outreach review", detail: "Marketing, Admissions, Student Finance", priority: "normal", attendees: ["AM", "KS", "RB"] },
      { id: "aid", time: "1:00 PM", duration: "45 min", title: "Financial aid operations sync", detail: "Decision: verification review capacity", priority: "high", attendees: ["AM", "JT", "SA"] },
    ] : [],
    emails: connectors.outlook ? [
      { id: "provost", time: "6:45 AM", sender: "Office of the Provost", subject: "Scholarship reallocation request", summary: "Approval requested for additional commuter outreach funds before noon.", priority: "high" },
      { id: "board", time: "5:15 AM", sender: "Board Relations", subject: "June enrollment update", summary: "The draft needs a yield-risk paragraph and updated net tuition outlook.", priority: "high" },
      { id: "visit", time: "Yesterday", sender: "Regional Recruitment", subject: "Northview visit briefing", summary: "Schedule and talking points are ready for review.", priority: "normal" },
    ] : [],
    news: selected.has("industry_policy") ? [
      { id: "completion", category: "Industry", sourceName: "Demo higher-ed monitor", published: "This morning", headline: "FAFSA completion gains are uneven across student segments", relevance: "Compare your first-generation completion gains with deposit movement before shifting outreach." },
      { id: "funding", category: "Government & policy", sourceName: "Demo state policy monitor", published: "Yesterday", headline: "Draft performance-funding language emphasizes workforce enrollment", relevance: "Validate program mappings and reporting ownership; no immediate student-facing action." },
      { id: "discount", category: "Industry", sourceName: "Demo enrollment monitor", published: "Yesterday", headline: "Tuition discounting remains elevated despite stabilizing demand", relevance: "Your modeled outlook is healthy, but conversion—not volume—remains the forecast swing factor." },
    ] : [],
  };
}

export const EDWARD_SUGGESTIONS = [
  "What should I pay attention to today?",
  "What are our biggest enrollment risks?",
  "What changed since yesterday?",
  "Summarize today’s important emails.",
  "Are there any policy changes we should care about?",
] as const;

export function answerEdward(question: string, briefing: MorningBrewBriefing): EdwardAnswer {
  const normalized = question.toLowerCase();
  if (normalized.includes("email")) {
    return briefing.emails.length
      ? { question, answer: "Two messages deserve executive attention before noon.", bullets: briefing.emails.slice(0, 2).map((email) => `${email.sender}: ${email.summary}`), followUp: "I’d handle the scholarship decision first; it is tied to today’s commuter strategy." }
      : { question, answer: "Outlook is not connected, so I can’t summarize your inbox in this demo.", followUp: "Use Manage Connections to turn on the polished mock Outlook integration." };
  }
  if (normalized.includes("policy")) {
    return { question, answer: "One modeled policy signal is worth monitoring, but it does not require a student-facing change today.", bullets: ["Draft state language links funding to workforce enrollment and completion.", "Ask Institutional Research to validate program mappings and reporting ownership."], followUp: "This is synthetic demonstration content, not legal or regulatory guidance." };
  }
  if (normalized.includes("changed") || normalized.includes("yesterday")) {
    return { question, answer: "The clearest movement is positive FAFSA completion paired with a concentrated set of new interventions.", bullets: briefing.changes.slice(0, 3).map((change) => change.title), followUp: "The overall story is progress with a few operational exceptions—not a broad deterioration." };
  }
  if (normalized.includes("risk")) {
    return { question, answer: "The biggest enrollment risk is friction after students have already shown intent.", bullets: ["23 deposit-ready students remain blocked from housing.", "12 aid files have verification deadlines inside seven days.", "Yield is modeled 1.7 points behind last cycle."], followUp: "Resolve operational blockers before launching more general outreach." };
  }
  return { question, answer: "Start with the students whose intent is already visible but whose next step is blocked.", bullets: briefing.attention.slice(0, 3).map((item) => `${item.count} ${item.label}: ${item.detail}`), followUp: "Then use the 8:30 leadership huddle to assign owners and protect today’s service window." };
}
