const SESSION_KEY = "audentra:student-demo-session:v1";
const configuredDemoMode = process.env.NEXT_PUBLIC_STUDENT_DEMO_MODE?.trim();
const configuredApiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export const studentDemoEnabled =
  configuredDemoMode === "true" || (!configuredApiOrigin && configuredDemoMode !== "false");

const now = "2026-08-07T13:00:00.000Z";
const studentId = "demo-student-maya";
const offer = {
  id: "demo-offer-1",
  programName: "B.S. Computer Science",
  termName: "Fall 2026",
  campusName: "Main Campus",
  responseDeadline: "2026-08-28T23:59:59.000Z",
  depositAmountCents: 50000,
  status: "accepted",
};
const requirements = [
  {
    id: "demo-requirement-profile",
    code: "profile_verification",
    slug: "profile-verification",
    title: "Confirm your student profile",
    description: "Review your contact details and communication preferences.",
    status: "completed",
    blocking: true,
    priority: 100,
    order: 1,
    dueAt: "2026-08-12T23:59:59.000Z",
    progressPercent: 100,
    reward: { points: 100, earned: true },
    journeyId: "demo-journey-1",
    version: 1,
    submissionType: "form",
    flowKind: "enrollment",
    interactionType: "form",
    inputConfig: { fields: [] },
    documentCategory: null,
    responsibleOffice: "Enrollment Services",
    dependencyCodes: [],
  },
  {
    id: "demo-requirement-transcript",
    code: "official_transcript",
    slug: "transcript-upload",
    title: "Submit your official transcript",
    description: "Upload your final transcript for academic review.",
    status: "ready",
    blocking: true,
    priority: 92,
    order: 2,
    dueAt: "2026-08-18T23:59:59.000Z",
    progressPercent: 20,
    reward: { points: 250, earned: false },
    journeyId: "demo-journey-1",
    version: 2,
    submissionType: "document",
    flowKind: "enrollment",
    interactionType: "upload_file",
    inputConfig: { acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], documentCategories: ["transcript"] },
    documentCategory: "transcript",
    responsibleOffice: "Registrar",
    dependencyCodes: ["profile_verification"],
  },
  {
    id: "demo-requirement-deposit",
    code: "enrollment_deposit",
    slug: "enrollment-deposit",
    title: "Confirm enrollment deposit",
    description: "Review your paid enrollment deposit and receipt.",
    status: "completed",
    blocking: true,
    priority: 86,
    order: 3,
    dueAt: "2026-08-20T23:59:59.000Z",
    progressPercent: 100,
    reward: { points: 500, earned: true },
    journeyId: "demo-journey-1",
    version: 1,
    submissionType: "payment",
    flowKind: "enrollment",
    interactionType: "payment",
    inputConfig: {},
    documentCategory: null,
    responsibleOffice: "Student Accounts",
    dependencyCodes: [],
  },
];

const course = (id: string, code: string, title: string, credits: number) => ({
  id, code, title, credits, level: Number(code.match(/\d+/)?.[0] ?? 100),
  description: `${title} builds practical and analytical foundations for the program.`,
  availabilityLabel: "Fall 2026", instructorNames: ["Dr. Elena Park"],
  meetingPattern: "Mon / Wed · 10:00 AM", prerequisites: [], resources: [],
  source: { label: "Synthetic demo catalog", url: "#", dataStatus: "synthetic_preview" },
});
const cs101 = course("demo-course-1", "CS 101", "Computing Foundations", 4);
const math121 = course("demo-course-2", "MATH 121", "Applied Calculus", 4);

const fixtures: Record<string, unknown> = {
  "/v1/student/bootstrap": {
    authenticated: true,
    student: { id: studentId, preferredName: "Maya", fullName: "Maya Chen" },
    onboarding: { required: false, status: "completed", currentStep: "deposit", version: 8 },
    rewards: { pointName: "Audentra points", pointsPerUsd: 100, lifetimePoints: 850, bookstoreCreditCents: 850 },
    unreadMessageCount: 2, experienceUpdates: [], initialRoute: "/dashboard", generatedAt: now,
  },
  "/v1/student/dashboard": {
    student: { id: studentId, preferredName: "Maya", fullName: "Maya Chen", classYear: 2030 },
    offer,
    journey: {
      id: "demo-journey-1", status: "in_progress", completionPercent: 72,
      nextAction: { code: "official_transcript", label: "Submit your official transcript", href: "/enrollment/requirements/transcript-upload" },
      requirements,
    },
    unreadMessageCount: 2, projectionVersion: 12, generatedAt: now,
  },
  "/v1/student/academics": {
    selectedProgram: { id: "demo-program-1", code: "BSCS", name: "Computer Science", degree: "Bachelor of Science", totalCredits: 120, description: "A rigorous, applied computing program." },
    availablePrograms: [],
    transcriptCredits: [{ id: "demo-credit-1", sourceType: "ap", sourceCode: "AP-CSP", title: "Computer Science Principles", gradeOrScore: "5", credits: 3, institutionName: null, sourceDocumentId: null }],
    exemptionRecommendations: [{ id: "demo-exemption-1", transcriptCreditId: "demo-credit-1", targetCourseCode: "CS 101", targetCourseTitle: "Computing Foundations", ruleCode: "AP-CSP-5", rationale: "Your AP score may satisfy the introductory computing requirement.", confidence: 0.94, status: "suggested", requiresStaffReview: true }],
    plan: [
      { course: cs101, category: "major_core", recommendedTerm: 1, status: "exemption_suggested", satisfiedPrerequisiteCodes: [], missingPrerequisiteCodes: [] },
      { course: math121, category: "math_science", recommendedTerm: 1, status: "required", satisfiedPrerequisiteCodes: [], missingPrerequisiteCodes: [] },
    ],
    progress: { completedCredits: 0, exemptedCredits: 3, requiredCredits: 120, percent: 3 }, catalogVersion: "demo-2026.1", generatedAt: now,
  },
  "/v1/student/financials": {
    academicYear: "2026–27", costOfAttendanceCents: 4280000, acceptedAidCents: 2450000, pendingAidCents: 350000, paymentsCents: 50000, remainingBalanceCents: 1780000,
    awards: [
      { id: "demo-award-1", source: "institutional", name: "Aster Opportunity Scholarship", type: "scholarship", offeredAmountCents: 1500000, acceptedAmountCents: 1500000, status: "accepted", requiresAction: false },
      { id: "demo-award-2", source: "federal", name: "Federal Direct Loan", type: "loan", offeredAmountCents: 950000, acceptedAmountCents: 950000, status: "accepted", requiresAction: false },
    ],
    requiredDocuments: [{ id: "demo-fin-doc-1", code: "aid_verification", title: "Income verification worksheet", description: "Upload the requested worksheet to finish aid verification.", status: "action_required", dueAt: "2026-08-16T23:59:59.000Z", href: "/documents" }],
    paymentPlans: [{ id: "demo-plan-1", name: "Four-payment semester plan", installmentCount: 4, installmentAmountCents: 445000, enrollmentFeeCents: 5000, status: "available" }],
    paymentSchedule: [{ id: "demo-schedule-1", kind: "deposit", label: "Enrollment deposit", amountCents: 50000, enrollmentFeeCents: 0, dueAt: "2026-08-01T23:59:59.000Z", status: "paid", projected: false }],
    sap: { status: "meeting", cumulativeGpa: 3.7, minimumGpa: 2, completionRatePercent: 100, minimumCompletionRatePercent: 67, attemptedCredits: 3, maximumAttemptedCredits: 180 }, generatedAt: now,
  },
  "/v1/student/campus-life": {
    events: [
      { id: "demo-event-1", title: "Welcome Week Block Party", description: "Meet classmates, student organizations, and campus teams.", startsAt: "2026-08-24T21:00:00.000Z", endsAt: "2026-08-25T00:00:00.000Z", location: "University Green", category: "social", featured: true, accent: "blue", visualTheme: "festival", imageUrl: "/media/events/welcome-week-block-party.webp", imageAlt: "Students gathering outdoors during welcome week" },
      { id: "demo-event-2", title: "First-Year Research Showcase", description: "Explore faculty labs and undergraduate research pathways.", startsAt: "2026-08-27T18:00:00.000Z", endsAt: "2026-08-27T20:00:00.000Z", location: "Innovation Hall", category: "academic", featured: true, accent: "navy", visualTheme: "discovery", imageUrl: "/media/events/first-year-research-showcase.webp", imageAlt: "A student research showcase" },
    ],
    clubs: [{ id: "demo-club-1", name: "Code Collective", category: "Academic & professional", description: "Build projects with peers across experience levels.", contactName: "Jordan Lee", contactRole: "President", contactChannel: "code@aster.edu", latestUpdate: "Fall project teams are forming now.", nextActivity: "Open house · August 26", imageUrl: "/media/clubs/code-collective.jpg", imageAlt: "Students collaborating around a laptop", imageAttribution: "Demo media", imageSourceUrl: "#", membershipOpen: true, events: [] }],
    generatedAt: now,
  },
  "/v1/student/requirements": { items: requirements, total: requirements.length },
  "/v1/student/messages": {
    items: [
      { id: "demo-message-1", subject: "Your aid review is almost complete", body: "We received your aid application. One verification worksheet remains before your package is final.", senderName: "Student Financial Services", sentAt: "2026-08-06T14:30:00.000Z", readAt: null },
      { id: "demo-message-2", subject: "Welcome Week registration is open", body: "Build your arrival schedule and save the events you want to attend.", senderName: "Student Life", sentAt: "2026-08-04T16:00:00.000Z", readAt: null },
      { id: "demo-message-3", subject: "Enrollment deposit received", body: "Your $500 enrollment deposit has been received. No further action is needed.", senderName: "Student Accounts", sentAt: "2026-08-01T18:15:00.000Z", readAt: "2026-08-02T12:00:00.000Z" },
    ], unreadCount: 2,
  },
  "/v1/student/documents": { items: [], total: 0 },
  "/v1/student/appointments": { items: [{ id: "demo-appointment-1", type: "enrollment_support", startsAt: "2026-08-11T15:00:00.000Z", notes: "Review remaining enrollment steps", status: "scheduled", createdAt: now }], total: 1 },
  "/v1/student/payments": { items: [{ id: "demo-payment-1", offerId: offer.id, type: "enrollment_deposit", amountCents: 50000, status: "succeeded", processor: "dummy", processorReference: "DEMO-RECEIPT-2026", createdAt: "2026-08-01T18:00:00.000Z" }], total: 1 },
  "/v1/student/profile": { studentId, preferredName: "Maya", firstName: "Maya", lastName: "Chen", email: "maya.chen@example.edu", emailVerified: true, phoneVerified: true, pronouns: "she/her", mobilePhone: "+1 555 014 2026", communicationPreference: "email", version: 3, updatedAt: now },
  "/v1/student/help": { articles: [
    { id: "demo-help-1", category: "getting_started", question: "What should I complete first?", answer: "Start with the priority items on your dashboard. They are ordered by deadline and enrollment impact." },
    { id: "demo-help-2", category: "documents", question: "Which transcript should I upload?", answer: "Upload the most recent official transcript available. The registrar will tell you if a final copy is still needed." },
    { id: "demo-help-3", category: "payments", question: "Where can I find my deposit receipt?", answer: "Open Payments to review your completed deposit and receipt reference." },
  ], support: { email: "enrollment@aster.edu", phone: "+1 (555) 010-2026", hours: "Monday–Friday · 8:30 AM–5:00 PM" } },
  "/v1/student/onboarding": { studentId, status: "completed", currentStep: "deposit", completedSteps: ["offer", "about_you", "housing", "campus_life", "emergency_contacts", "family_permissions", "review_and_sign", "deposit"], data: { firstName: "Maya", lastName: "Chen", preferredName: "Maya", communicationPreference: "email", housingPreference: "on_campus", campusInterests: ["technology", "community_service"] }, version: 8, completedAt: "2026-08-01T18:00:00.000Z", updatedAt: now },
  "/v1/student/housing-plan": { preference: "on_campus", residenceOption: "aster_residence_hall", residencePreferences: ["aster_residence_hall", "student_village"], roomType: "double", residences: [], version: 2, updatedAt: now },
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "x-audentra-demo": "browser-fixture" } });
}

function hasSession() {
  return window.sessionStorage.getItem(SESSION_KEY) === "active";
}

export async function demoStudentFetch(path: string, init: RequestInit): Promise<Response | null> {
  if (!studentDemoEnabled || typeof window === "undefined") return null;
  const method = (init.method ?? "GET").toUpperCase();
  const pathname = path.split("?", 1)[0];

  if (pathname === "/v1/auth/demo/sign-in" && method === "POST") {
    window.sessionStorage.setItem(SESSION_KEY, "active");
    return json({ authenticated: true, mode: "demo", actorType: "student", student: { id: studentId, preferredName: "Maya" }, notice: "Browser-only Audentra demo session" });
  }
  if (pathname === "/v1/auth/demo/sign-out" && method === "POST") {
    window.sessionStorage.removeItem(SESSION_KEY);
    return json({ authenticated: false, mode: "demo" });
  }
  if (!hasSession() || pathname.startsWith("/v1/staff/")) return null;

  if (method === "GET" && pathname.startsWith("/v1/student/requirements/")) {
    const id = decodeURIComponent(pathname.slice("/v1/student/requirements/".length));
    return json(requirements.find((item) => item.id === id || item.slug === id || item.code === id) ?? requirements[1]);
  }
  if (method === "GET" && pathname === "/v1/catalog/courses") {
    return json({ items: [cs101, math121], total: 2, catalogVersion: "demo-2026.1" });
  }
  if (method === "GET" && pathname.startsWith("/v1/student/campus-life/clubs/")) {
    return json((fixtures["/v1/student/campus-life"] as { clubs: unknown[] }).clubs[0]);
  }
  if (method === "GET" && fixtures[pathname] !== undefined) return json(fixtures[pathname]);
  if (pathname === "/v1/activity-events/batch") return json({ accepted: true });

  return json({ error: { code: "demo_operation_unavailable", message: "This action needs a connected backend or API. You can continue exploring every read-only part of the demo.", requestId: "student-browser-demo" } }, 409);
}
