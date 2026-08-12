import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

process.env.NEXT_PUBLIC_API_BASE_URL ??= "http://localhost:4000";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the branded, accessible portal selector", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Audentra \| Institutional intelligence for what’s next<\/title>/i);
  assert.match(html, /Institutional intelligence/);
  assert.match(html, /Student portal/);
  assert.match(html, /Staff portal/);
  assert.match(html, /href="\/aster\/sign-in"/);
  assert.match(html, /href="\/aster\/staff"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("all student portal routes render and the dynamic requirement route resolves", async () => {
  const routes = [
    "/sign-in",
    "/onboarding",
    "/dashboard",
    "/enrollment",
    "/documents",
    "/messages",
    "/appointments",
    "/payments",
    "/profile",
    "/help",
    "/staff",
    "/enrollment/requirements/transcript-upload",
  ];

  for (const route of routes) {
    const response = await render(route);
    assert.equal(response.status, 200, `${route} should render`);
    const html = await response.text();
    assert.match(html, /Aster University|Aster/);
    assert.doesNotMatch(
      html,
      /<h1[^>]*>\s*404\s*<\/h1>|\bPage not found\b/i,
    );
  }

  const signInResponse = await render("/sign-in");
  const signInHtml = await signInResponse.text();
  assert.match(signInHtml, /Sign in/);
  assert.match(signInHtml, /Create account/);
  assert.match(signInHtml, /Email address/);
  assert.doesNotMatch(signInHtml, /demo student/i);
});

test("tenant routes render and preserve tenant-aware internal destinations", async () => {
  for (const tenant of ["aster", "harvard"]) {
    for (const route of [
      `/${tenant}/sign-in`,
      `/${tenant}/onboarding`,
      `/${tenant}/dashboard`,
      `/${tenant}/campus-life`,
      `/${tenant}/staff`,
      `/${tenant}/enrollment/requirements/transcript-upload`,
    ]) {
      const response = await render(route);
      assert.equal(response.status, 200, `${route} should render`);
      assert.doesNotMatch(
        await response.text(),
        /<h1[^>]*>\s*404\s*<\/h1>|\bPage not found\b/i,
      );
    }
  }

  const source = await readFile(
    new URL("../app/lib/tenant.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const tenant = await import(moduleUrl);

  assert.equal(tenant.tenantHref("/dashboard", "aster"), "/aster/dashboard");
  assert.equal(
    tenant.tenantHref("/campus-life?view=clubs#featured", "harvard"),
    "/harvard/campus-life?view=clubs#featured",
  );
  assert.equal(
    tenant.tenantHref("/offer", "harvard"),
    "/harvard/onboarding",
  );
  assert.equal(
    tenant.tenantCopy("Your place at Aster University", tenant.tenantConfigs.harvard),
    "Your place at Harvard University",
  );
});

test("removes the disposable starter preview", async () => {
  const disposablePreviewFiles = await readdir(
    new URL("../app/_sites-preview", import.meta.url),
  ).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  assert.deepEqual(disposablePreviewFiles, []);

  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
});

test("keeps transcript review and exemption insights in the enrollment workspace", async () => {
  const [requirementPage, extractionReview, exemptionSkill] = await Promise.all([
    readFile(
      new URL("../app/enrollment/requirements/[slug]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/document-extraction-review.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../../docs/agent-skills/course-exemption-skill.md",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(
    requirementPage,
    /Upload your transcript to discover potential course exemptions/,
  );
  assert.match(
    requirementPage,
    /reviewPlacement=\{kind === "transcript" \? "context" : "inline"\}/,
  );
  assert.match(requirementPage, /Your transcript view/);
  assert.match(requirementPage, /Parsed transcript/);
  assert.doesNotMatch(
    requirementPage,
    /Confirm transcript and sync courses/,
  );
  assert.match(extractionReview, /Transcript parsed automatically/);
  assert.match(exemptionSkill, /Student confirmation is not a prerequisite/);
  assert.match(requirementPage, /getStudentAcademics/);
  assert.match(requirementPage, /Prediction only · Registrar approval required/);
  assert.match(exemptionSkill, /course_equivalency_rule/);
  assert.match(exemptionSkill, /database table—not this example and not the model/i);
});

test("keeps housing and deposit actions inside their enrollment tasks", async () => {
  const requirementPage = await readFile(
    new URL("../app/enrollment/requirements/[slug]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(requirementPage, /aster-residence-hall-room\.jpg/);
  assert.match(requirementPage, /onHousingPreviewChange/);
  assert.match(requirementPage, /name="roommateMatching"/);
  assert.match(requirementPage, /name="knownRoommateName"/);
  assert.match(requirementPage, /name="knownRoommateEmail"/);
  assert.match(requirementPage, /housingCompatibilityFields\.map/);
  assert.match(requirementPage, /livingLearningCommunities/);
  assert.match(requirementPage, /ExpandedUpdateStudentHousingPlanInput/);
  assert.match(
    requirementPage,
    /Residence and room details can be[\s\S]*decided later/,
  );
  assert.match(
    requirementPage,
    /On-campus housing selected [^"]* residence not selected yet/,
  );
  assert.doesNotMatch(
    requirementPage,
    /\(preference === "on_campus" && !residenceOption\)/,
  );
  assert.match(requirementPage, /DepositPaymentAction/);
  assert.match(requirementPage, /createDepositPayment/);
  assert.doesNotMatch(requirementPage, /Go to payments/);
});

test("connects business actions and non-blocking tracking to the API", async () => {
  const [client, dashboard, tracking, edward] = await Promise.all([
    readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/student-dashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/hooks/use-activity-tracking.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/edward-assistant.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(client, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(client, /configuredApiBaseUrl \|\| ""/);
  assert.match(client, /Idempotency-Key/);
  assert.match(client, /\/v1\/activity-events\/batch/);
  assert.match(dashboard, /getStudentFinancials/);
  assert.match(dashboard, /getStudentAcademics/);
  assert.match(dashboard, /getCampusLife/);
  assert.match(edward, /createDepositPayment/);
  assert.match(edward, /"dialog" : "region"/);
  assert.match(edward, /role="status"/);
  assert.match(edward, /contextReceipts/);
  assert.match(edward, /ui\.edward_context_receipts_received\.v1/);
  assert.match(edward, /Student record context used for this response/);
  assert.doesNotMatch(edward, /toolsUsed/);
  assert.match(tracking, /propertyAllowlist/);
  assert.match(tracking, /MAX_BATCH_SIZE/);
  assert.match(tracking, /catch \{/);
  assert.doesNotMatch(
    `${client}\n${dashboard}`,
    /mockDashboard|fallbackDashboard|dummyStudent/i,
  );

  await access(new URL("../app/globals.css", import.meta.url));
  await access(new URL("../public/icon.png", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
});

test("dashboard enrollment CTA advances, waits, and completes from requirement state", async () => {
  const source = await readFile(
    new URL("../app/lib/enrollment-dashboard-action.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const {
    prioritizeDashboardRequirements,
    selectDashboardEnrollmentAction,
  } = await import(moduleUrl);
  const requirement = (code, status, blocking = true) => ({
    id: code,
    code,
    title: code.replaceAll("_", " "),
    description: `${code} description`,
    status,
    blocking,
    dueAt: null,
    progressPercent: status === "completed" ? 100 : 0,
  });
  const journey = (requirements) => ({
    id: "journey-1",
    status: "in_progress",
    completionPercent: 50,
    nextAction: {
      code: "legacy_next_action",
      label: "Legacy next action",
      href: "/legacy",
    },
    requirements,
  });

  const nextTask = selectDashboardEnrollmentAction(
    journey([
      requirement("identity_document", "under_review"),
      requirement("official_transcript", "ready"),
    ]),
    (code) => `/requirements/${code}`,
  );
  assert.deepEqual(nextTask, {
    kind: "task",
    code: "official_transcript",
    label: "official transcript",
    href: "/requirements/official_transcript",
  });

  const waiting = selectDashboardEnrollmentAction(
    journey([
      requirement("identity_document", "under_review"),
      requirement("official_transcript", "blocked"),
    ]),
  );
  assert.equal(waiting.kind, "waiting");
  assert.equal(waiting.label, "Enrollment review in progress");

  const completed = selectDashboardEnrollmentAction(
    journey([
      requirement("identity_document", "completed"),
      requirement("official_transcript", "waived"),
    ]),
  );
  assert.deepEqual(completed, {
    kind: "complete",
    code: "enrollment_complete",
    label: "Enrollment complete",
    href: "/enrollment",
  });

  const prioritized = prioritizeDashboardRequirements([
    {
      ...requirement("lower_points", "ready"),
      priority: 25,
      reward: { points: 100, earned: false },
    },
    {
      ...requirement("higher_priority", "ready"),
      priority: 90,
      reward: { points: 10, earned: false },
    },
  ]);
  assert.deepEqual(
    prioritized.map((item) => item.code),
    ["higher_priority", "lower_points"],
  );
});

test("typed client wires every resource route and mutation contract", async () => {
  const source = await readFile(
    new URL("../app/lib/api-client.ts", import.meta.url),
    "utf8",
  );
  const executableSource = source.replace(
    /import\s+\{\s*currentTenantSlug\s*\}\s+from\s+"\.\/tenant";/,
    'const currentTenantSlug = () => "aster";',
  );
  const compiled = ts.transpileModule(executableSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const client = await import(moduleUrl);
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return Response.json({});
  };

  try {
    await client.getStudentBootstrap();
    await client.decideStudentExperienceUpdate("update/1", {
      action: "handle_now",
      expectedVersion: 3,
    });
    await client.deferStudentExperienceUpdates({
      updates: [{ id: "update/2", expectedVersion: 4 }],
    });
    await client.getStudentDashboard();
    await client.getStudentAcademics();
    await client.searchCatalogCourses("calculus");
    await client.getStudentFinancials();
    await client.selectFinancialPaymentPlan(
      "42000000-0000-7000-8000-000000000101",
      "payment-plan-12345678",
    );
    await client.getCampusLife();
    await client.getStudentOnboarding();
    await client.updateStudentOnboarding({
      expectedVersion: 1,
      currentStep: "about_you",
      data: { firstName: "Alex" },
    });
    await client.completeStudentOnboarding(
      { expectedVersion: 2 },
      "complete-12345678",
    );
    await client.getStudentRequirements();
    await client.getStudentRequirement("requirement/1");
    await client.submitStudentRequirementResponse(
      "requirement/1",
      {
        expectedVersion: 4,
        response: { selectedOption: "on_campus" },
      },
      "requirement-response-12345678",
    );
    await client.getStudentMessages();
    await client.markStudentMessageRead("message/1");
    await client.getStudentDocuments();
    await client.createStudentDocument(
      {
        fileName: "transcript.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_048_576,
        category: "transcript",
      },
      "document-12345678",
    );
    await client.uploadStudentDocument(
      new File(["document"], "transcript.pdf", {
        type: "application/pdf",
      }),
      {
        categoryHint: "transcript",
        requirementId: "00000000-0000-7000-8000-000000000604",
      },
      "document-upload-12345678",
    );
    await client.confirmStudentDocumentExtraction(
      "document/1",
      { acceptedFieldKeys: ["student_name"] },
      "document-confirm-12345678",
    );
    await client.retryStudentDocumentExtraction(
      "document/1",
      "document-retry-12345678",
    );
    await client.askEdward({
      message: "What should I do next?",
      pageContext: "/dashboard",
      history: [],
    });
    await client.createAssistantConversation({
      pageContext: { path: "/dashboard", label: "Aster student portal" },
    });
    await client.getAssistantConversationMessages(
      "00000000-0000-7000-8000-000000000801",
    );
    await client.getStudentAppointments();
    await client.createStudentAppointment(
      {
        type: "enrollment_support",
        startsAt: "2027-07-24T12:00:00.000Z",
      },
      "appointment-12345678",
    );
    await client.getStudentPayments();
    await client.createDepositPayment(
      { offerId: "00000000-0000-7000-8000-000000000201" },
      "deposit-12345678",
    );
    await client.getStudentProfile();
    await client.updateStudentProfile({
      expectedVersion: 1,
      preferredName: "Maya",
    });
    await client.getStudentHelp();
    await client.createStudentHelpRequest(
      { topicCode: "documents", message: "Which transcript should I upload?" },
      "help-request-12345678",
    );
    await client.acceptAdmissionOffer("offer/1", "intent-12345678");
    await client.sendActivityEvents([
      {
        eventId: "event-1",
        eventName: "ui.dashboard_viewed.v1",
        occurredAt: "2026-07-24T12:00:00.000Z",
        sessionId: "session-1",
        pageInstanceId: "page-1",
        properties: { projection_version: 1 },
      },
    ]);
    await client.signInStaff({
      email: "priya.shah@aster.example.edu",
      password: "Individual-staff-password-2027",
    });
    await client.signUpStaff({
      email: "priya.shah@aster.example.edu",
      password: "Individual-staff-password-2027",
      institutionAccessCode: "private-institution-access-code-2027",
    });
    await client.getStaffActionCenter();
    await client.getStaffOperationsWorkspace();
    await client.createStaffKnowledgeCard({
      title: "Orientation guide",
      summary: "Arrival guidance.",
      body: "Check in at the student center.",
      category: "Orientation",
      audience: "student",
      status: "draft",
    });
    await client.updateStaffKnowledgeCard(
      "00000000-0000-7000-8000-000000000931",
      {
        expectedVersion: 1,
        title: "Deposit policy",
        summary: "Approved guidance.",
        body: "Review the active offer deadline.",
        category: "Enrollment",
        audience: "internal",
        status: "published",
      },
    );
    await client.updateStaffCorePlay(
      "00000000-0000-7000-8000-000000000941",
      {
        expectedVersion: 1,
        title: "Deposit rescue",
        description: "Deadline follow-up.",
        trigger: "Deposit due soon",
        audience: "Admitted students",
        steps: ["Verify the offer"],
        status: "active",
      },
    );
    await client.createStaffCorePlay({
      title: "Orientation rescue",
      description: "Registration support.",
      trigger: "Registration is overdue",
      audience: "Students without a session",
      steps: ["Verify eligibility"],
      status: "draft",
    });
    await client.updateStaffInquiry(
      "00000000-0000-7000-8000-000000000951",
      {
        expectedVersion: 1,
        status: "open",
        notifyStudent: false,
      },
    );
    await client.updateStaffClub(
      "51000000-0000-7000-8000-000000000101",
      {
        expectedVersion: 1,
        name: "Aster Robotics",
        category: "Engineering",
        description: "Build robots.",
        latestUpdate: "Teams are open.",
        contactName: "Maya Chen",
        contactRole: "President",
        contactChannel: "robotics@aster.edu",
        membershipOpen: true,
      },
    );
    await client.createStaffClub({
      name: "Aster Debate",
      category: "Academic",
      description: "Practice debate.",
      latestUpdate: "New members welcome.",
      contactName: "Taylor Kim",
      contactRole: "President",
      contactChannel: "debate@aster.edu",
      membershipOpen: true,
    });
    await client.simulateStaffOutreach({
      title: "Deposit reminder",
      audience: "Students with incomplete deposits",
      channel: "voice",
      requestedCount: 100,
    });
    await client.previewStaffEdward({
      message: "Show students with incomplete deposits.",
    });
    await client.updateStaffManagedConfiguration("journeys", {
      expectedVersion: 1,
      yaml: "schema_version: 1\nconfiguration: journeys\nflows: []\n",
      changeSummary: "Test request",
    });
    await client.draftStaffConfigurationWithEdward({
      kind: "journeys",
      expectedVersion: 1,
      instruction: "Add a task to enrollment",
    });
    await client.updateStaffWorkItem(
      "00000000-0000-7000-8000-000000000911",
      { expectedVersion: 1, status: "in_progress" },
    );
    await client.getStaffStudentRecord(
      "00000000-0000-7000-8000-000000000101",
    );
    await client.updateStaffStudentPreferences(
      "00000000-0000-7000-8000-000000000101",
      {
        expectedOnboardingVersion: 1,
        expectedProfileVersion: 1,
        communicationPreference: "email",
        housingPreference: "undecided",
        accommodationInterest: "not_now",
        residencyVerificationPath: "home_address_review",
        notifyStudent: false,
      },
    );
    await client.reviewStaffDocument(
      "00000000-0000-7000-8000-000000000601",
      {
        workItemId: "00000000-0000-7000-8000-000000000911",
        expectedWorkItemVersion: 1,
        decision: "accepted",
        note: "Reviewed.",
        notifyStudent: true,
      },
    );
    await client.signOutStaff();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests[0].url, "http://localhost:4000/v1/student/bootstrap");
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.credentials, "include");
  assert.equal(requests[0].init.headers["X-Tenant-Slug"], "aster");
  assert.equal(
    client.getStudentDocumentContentUrl({
      contentUrl:
        "/v1/student/documents/00000000-0000-7000-8000-000000000701/content",
    }),
    "http://localhost:4000/v1/student/documents/00000000-0000-7000-8000-000000000701/content?tenant=aster",
  );
  assert.equal(
    client.getStudentDocumentProfilePhotoUrl(
      "00000000-0000-7000-8000-000000000701",
    ),
    "http://localhost:4000/v1/student/documents/00000000-0000-7000-8000-000000000701/profile-photo?tenant=aster",
  );

  const requestByPath = new Map(
    requests.map((entry) => [new URL(entry.url).pathname, entry]),
  );
  const expectedPaths = [
    "/v1/student/bootstrap",
    "/v1/student/experience-updates/update%2F1/decision",
    "/v1/student/experience-updates/defer",
    "/v1/student/dashboard",
    "/v1/student/academics",
    "/v1/catalog/courses",
    "/v1/student/financials",
    "/v1/student/financials/payment-plan",
    "/v1/student/campus-life",
    "/v1/student/onboarding",
    "/v1/student/onboarding/complete",
    "/v1/student/requirements",
    "/v1/student/requirements/requirement%2F1",
    "/v1/student/requirements/requirement%2F1/responses",
    "/v1/student/messages",
    "/v1/student/messages/message%2F1/read",
    "/v1/student/documents",
    "/v1/student/documents/upload",
    "/v1/student/documents/document%2F1/confirm-extraction",
    "/v1/student/documents/document%2F1/retry-extraction",
    "/v1/student/assistant/messages",
    "/v1/student/assistant/conversations",
    "/v1/student/assistant/conversations/00000000-0000-7000-8000-000000000801/messages",
    "/v1/student/appointments",
    "/v1/student/payments",
    "/v1/student/payments/deposit",
    "/v1/student/profile",
    "/v1/student/help",
    "/v1/demo/help-requests",
    "/v1/admission-offers/offer%2F1/accept",
    "/v1/activity-events/batch",
    "/v1/auth/staff/sign-in",
    "/v1/auth/staff/sign-up",
    "/v1/staff/action-center",
    "/v1/staff/workspace",
    "/v1/staff/knowledge-base",
    "/v1/staff/knowledge-base/00000000-0000-7000-8000-000000000931",
    "/v1/staff/core-plays",
    "/v1/staff/core-plays/00000000-0000-7000-8000-000000000941",
    "/v1/staff/inquiries/00000000-0000-7000-8000-000000000951",
    "/v1/staff/campus-life/clubs/51000000-0000-7000-8000-000000000101",
    "/v1/staff/campus-life/clubs",
    "/v1/staff/outreach/simulate",
    "/v1/staff/edward/preview",
    "/v1/staff/configurations/journeys",
    "/v1/staff/edward/configuration-draft",
    "/v1/staff/work-items/00000000-0000-7000-8000-000000000911",
    "/v1/staff/students/00000000-0000-7000-8000-000000000101",
    "/v1/staff/students/00000000-0000-7000-8000-000000000101/preferences",
    "/v1/staff/documents/00000000-0000-7000-8000-000000000601/decision",
    "/v1/auth/staff/sign-out",
  ];
  for (const path of expectedPaths) {
    assert.ok(requestByPath.has(path), `missing API request for ${path}`);
  }

  const experienceDecision = requestByPath.get(
    "/v1/student/experience-updates/update%2F1/decision",
  );
  assert.equal(experienceDecision.init.method, "POST");
  assert.equal(experienceDecision.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(experienceDecision.init.body), {
    action: "handle_now",
    expectedVersion: 3,
  });
  const experienceDeferral = requestByPath.get(
    "/v1/student/experience-updates/defer",
  );
  assert.equal(experienceDeferral.init.method, "POST");
  assert.equal(experienceDeferral.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(experienceDeferral.init.body), {
    updates: [{ id: "update/2", expectedVersion: 4 }],
  });

  assert.equal(requests[3].init.method, "GET");
  const onboardingUpdate = requests.find(
    (entry) =>
      new URL(entry.url).pathname === "/v1/student/onboarding" &&
      entry.init.method === "PUT",
  );
  assert.deepEqual(JSON.parse(onboardingUpdate.init.body), {
    expectedVersion: 1,
    currentStep: "about_you",
    data: { firstName: "Alex" },
  });

  assert.equal(
    requestByPath.get("/v1/student/onboarding/complete").init.headers[
      "Idempotency-Key"
    ],
    "complete-12345678",
  );
  const requirementResponse = requestByPath.get(
    "/v1/student/requirements/requirement%2F1/responses",
  );
  assert.equal(requirementResponse.init.method, "POST");
  assert.equal(
    requirementResponse.init.headers["Idempotency-Key"],
    "requirement-response-12345678",
  );
  assert.deepEqual(JSON.parse(requirementResponse.init.body), {
    expectedVersion: 4,
    response: { selectedOption: "on_campus" },
  });
  assert.equal(
    requestByPath.get("/v1/student/documents").init.headers["Idempotency-Key"],
    "document-12345678",
  );
  assert.equal(
    requestByPath.get("/v1/student/documents/upload").init.headers[
      "Idempotency-Key"
    ],
    "document-upload-12345678",
  );
  assert.ok(
    requestByPath.get("/v1/student/documents/upload").init.body instanceof
      FormData,
  );
  assert.equal(
    requestByPath
      .get("/v1/student/documents/upload")
      .init.body.get("category"),
    "transcript",
  );
  assert.equal(
    requestByPath
      .get("/v1/student/documents/upload")
      .init.body.get("requirementId"),
    "00000000-0000-7000-8000-000000000604",
  );
  assert.equal(
    requestByPath.get(
      "/v1/student/documents/document%2F1/confirm-extraction",
    ).init.headers["Idempotency-Key"],
    "document-confirm-12345678",
  );
  assert.equal(
    requestByPath.get(
      "/v1/student/documents/document%2F1/retry-extraction",
    ).init.headers["Idempotency-Key"],
    "document-retry-12345678",
  );
  assert.equal(
    requestByPath.get(
      "/v1/student/documents/document%2F1/retry-extraction",
    ).init.headers["Content-Type"],
    "application/json",
  );
  assert.equal(
    requestByPath.get(
      "/v1/student/documents/document%2F1/retry-extraction",
    ).init.body,
    "{}",
  );
  assert.equal(
    requestByPath.get("/v1/student/appointments").init.headers[
      "Idempotency-Key"
    ],
    "appointment-12345678",
  );
  assert.equal(
    requestByPath.get("/v1/student/payments/deposit").init.headers[
      "Idempotency-Key"
    ],
    "deposit-12345678",
  );
  assert.equal(
    requestByPath.get("/v1/admission-offers/offer%2F1/accept").init.headers[
      "Idempotency-Key"
    ],
    "intent-12345678",
  );
  assert.deepEqual(
    JSON.parse(requestByPath.get("/v1/activity-events/batch").init.body),
    {
    events: [
      {
        eventId: "event-1",
        eventName: "ui.dashboard_viewed.v1",
        occurredAt: "2026-07-24T12:00:00.000Z",
        sessionId: "session-1",
        pageInstanceId: "page-1",
        properties: { projection_version: 1 },
      },
    ],
    },
  );
});

test("onboarding preserves the eight-step order and authoritative boundary actions", async () => {
  const [onboarding, acceptanceRoutingSource] = await Promise.all([
    readFile(
      new URL("../app/onboarding/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/onboarding/offer-acceptance.ts", import.meta.url),
      "utf8",
    ),
  ]);
  const expectedOrder = [
    '"offer"',
    '"about_you"',
    '"housing"',
    '"campus_life"',
    '"emergency_contacts"',
    '"family_permissions"',
    '"review_and_sign"',
    '"deposit"',
  ];
  let previous = -1;
  for (const step of expectedOrder) {
    const index = onboarding.indexOf(`key: ${step}`);
    assert.ok(index > previous, `${step} must appear in sequence`);
    previous = index;
  }

  assert.match(onboarding, /completedSteps/);
  assert.match(onboarding, /expectedVersion: onboarding\.version/);
  assert.match(onboarding, /acceptAdmissionOffer/);
  assert.match(onboarding, /getPostAcceptanceRoute\(acceptance\)/);
  assert.match(
    onboarding,
    /if \(postAcceptanceRoute\) \{[\s\S]*window\.location\.replace\([\s\S]*return;/,
  );
  assert.match(onboarding, /createDepositPayment/);
  assert.match(onboarding, /completeStudentOnboarding/);
  assert.match(onboarding, /Reload latest saved progress/);
  assert.match(onboarding, /Why we ask/);
  assert.match(onboarding, /function editableOnboardingData/);
  assert.match(onboarding, /delete editableData\.skippedSteps/);
  assert.doesNotMatch(onboarding, /Confirm your student record/);
  assert.match(onboarding, /emergencyContacts/);
  assert.match(onboarding, /depositChoice/);
  assert.match(onboarding, /key: "deposit"[\s\S]*skippable: true/);
  assert.doesNotMatch(
    onboarding,
    /key: "housing"[\s\S]{0,240}skippable: true/,
  );
  assert.match(onboarding, /No residence ranked yet/);
  assert.match(onboarding, /Clear residence ranking and decide later/);
  assert.match(onboarding, /housingResidencePreferences/);
  assert.match(onboarding, /residencyVerificationPath/);
  assert.match(onboarding, /insuranceInterest/);
  assert.match(onboarding, /accommodationInterest/);
  assert.match(onboarding, /const nextData = editableOnboardingData\(/);
  assert.match(onboarding, /data: editableOnboardingData\(onboarding\.data\)/);
  assert.match(
    onboarding,
    /window\.location\.replace\(tenantRuntime\.href\("\/dashboard"\)\)/,
  );

  const compiledAcceptanceRouting = ts.transpileModule(
    acceptanceRoutingSource,
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const acceptanceRoutingUrl = `data:text/javascript;base64,${Buffer.from(compiledAcceptanceRouting).toString("base64")}`;
  const { getPostAcceptanceRoute } = await import(acceptanceRoutingUrl);

  assert.equal(
    getPostAcceptanceRoute({
      onboardingRequired: false,
      initialRoute: "/dashboard",
    }),
    "/dashboard",
  );
  assert.equal(
    getPostAcceptanceRoute({
      onboardingRequired: false,
      initialRoute: "/onboarding",
    }),
    "/dashboard",
  );
  assert.equal(
    getPostAcceptanceRoute({
      onboardingRequired: true,
      initialRoute: "/onboarding",
    }),
    null,
  );
  assert.equal(
    getPostAcceptanceRoute({}),
    null,
    "older success responses must retain the configured onboarding flow",
  );
});

test("staff authentication never exposes or prefills credentials", async () => {
  const source = await readFile(
    new URL("../app/staff/staff-action-center.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Staff account access/);
  assert.match(source, /Institution access code/);
  assert.match(source, /signUpStaff/);
  assert.doesNotMatch(source, /AsterStaff2027|Local testing account|Password:/);
  assert.doesNotMatch(source, /defaultValue=.*password/i);
  // Every staff actor now authenticates against the platform. The browser-only
  // demo transport and its one-click shortcut are deliberately gone, so no
  // route into the workspace bypasses a real, revocable session.
  assert.doesNotMatch(source, /Explore the Audentra demo/);
  assert.doesNotMatch(source, /demo-staff-transport|staffDemoEnabled/);
});

test("staff authentication forms survive ambient focus refreshes", async () => {
  const [resourceHook, staffPortal, legacyCenter] = await Promise.all([
    readFile(new URL("../app/hooks/use-api-resource.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/staff-portal.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/staff/staff-action-center.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(resourceHook, /refreshOnAmbient\?: boolean/);
  assert.match(
    resourceHook,
    /options\.refreshOnAmbient === false \? 0 : coordinator\.revision/,
  );
  assert.match(
    staffPortal,
    /useApiResource\(loadWorkspace, \{\s*refreshOnAmbient: false/,
  );
  assert.match(
    legacyCenter,
    /useApiResource\(loadCenter, \{\s*refreshOnAmbient: false/,
  );
});

test("Morning Brew is a personalized, persisted staff workspace briefing", async () => {
  const [portal, onboarding, dashboard, edward, data, preferences, styles] = await Promise.all([
    readFile(new URL("../app/staff/staff-portal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/morning-brew/onboarding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/morning-brew/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/morning-brew/edward-panel.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/staff/morning-brew/data.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/staff/morning-brew/preferences.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(portal, /id: "morning_brew", label: "Morning Brew"/);
  assert.match(portal, /<MorningBrewView workspace={workspace} navigate={navigate}/);
  assert.match(onboarding, /What do you want to catch up on each morning\?/);
  assert.match(onboarding, /What should we bring you\?/);
  assert.match(onboarding, /how do you like it\?/);
  assert.match(dashboard, /Customize your Morning Brew/);
  assert.match(dashboard, /Since yesterday/);
  assert.match(dashboard, /Ask for insights/);
  assert.match(dashboard, /Live workspace/);
  assert.match(edward, /Briefing context attached/);
  assert.match(data, /synthetic draft for the demo/);
  assert.match(data, /buildBrewBriefing/);
  assert.match(data, /Live-workspace substitutions/);
  assert.match(preferences, /audentra:morning-brew:v2/);
  assert.match(preferences, /LEGACY_PREFIXES/);
  assert.match(preferences, /BrewPreferenceStore/);
  assert.match(styles, /\.brew-setup/);
  assert.match(styles, /@media \(max-width: 520px\)/);
});

test("coordinates recoverable server state and composes the dashboard calendar", async () => {
  const [
    dashboard,
    brief,
    resourceHook,
    coordinator,
    requirementPage,
    uploader,
  ] = await Promise.all([
    readFile(new URL("../app/student-dashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/dashboard-edward-brief.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/hooks/use-api-resource.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/server-state-provider.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/enrollment/requirements/[slug]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/components/document-upload.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /<StudentCalendar entries=\{calendarEntries\}/);
  assert.match(dashboard, /Priority enrollment to-dos/);
  assert.doesNotMatch(dashboard, /DashboardEdwardBrief/);
  assert.doesNotMatch(dashboard, /Your enrollment is moving/);
  assert.match(brief, /askEdward/);
  assert.match(brief, /Preparing your latest insights/);
  assert.match(brief, /Retry brief/);
  assert.match(brief, /refreshError/);
  assert.match(resourceHook, /current\.data === null \|\| authenticationFailure/);
  assert.match(resourceHook, /status: "ready"[\s\S]*refreshError: message/);
  assert.match(coordinator, /vv:student-record-changed/);
  assert.match(coordinator, /connection_restored/);
  assert.match(coordinator, /visibilitychange/);
  assert.match(requirementPage, /Check now/);
  const restoreGate = requirementPage.indexOf('documents.status === "loading"');
  const gatedUploader = requirementPage.indexOf("<DocumentUpload", restoreGate);
  assert.ok(restoreGate >= 0, "document restore must expose an initial loading gate");
  assert.ok(
    gatedUploader > restoreGate,
    "the uploader must not render before the existing-document lookup resolves",
  );
  assert.match(requirementPage, /Checking for an existing upload/);
  assert.match(requirementPage, /could not restore your existing document record/);
  assert.match(requirementPage, /onRetry=\{documents\.reload\}/);
  assert.match(uploader, /retry automatically/);
  assert.match(uploader, /15_000/);
});

test("reconciles document extraction failure and retry projections", async () => {
  const source = await readFile(
    new URL("../app/lib/document-extraction-ui.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const extractionUi = await import(moduleUrl);
  const processing = {
    id: "document-1",
    createdAt: "2026-08-05T07:16:53.000Z",
    extraction: { status: "processing" },
  };
  const failed = {
    ...processing,
    status: "uploaded",
    extraction: {
      status: "failed",
      failureCode: "unknown",
      retryable: true,
      processedAt: "2026-08-05T07:17:12.000Z",
      summary: "The previous parsing attempt could not be completed.",
    },
  };

  const settled = extractionUi.currentDocumentProjection(processing, failed);
  assert.equal(settled.extraction.status, "failed");
  assert.deepEqual(
    extractionUi.processingDocumentProjections([failed], settled),
    [],
  );

  const retried = extractionUi.currentDocumentProjection(failed, processing);
  assert.equal(retried.extraction.status, "processing");
  assert.deepEqual(
    extractionUi.processingDocumentProjections([failed], retried).map(
      (document) => document.id,
    ),
    ["document-1"],
  );

  const supersededFingerprint =
    extractionUi.terminalDocumentProjectionFingerprint(failed);
  const staleListResult = extractionUi.reconcileProcessingPollProjection(
    retried,
    failed,
    {
      supersededTerminalFingerprint: supersededFingerprint,
      observedCurrentProcessing: false,
    },
  );
  assert.equal(staleListResult.document.extraction.status, "processing");
  assert.equal(staleListResult.observedCurrentProcessing, false);

  const currentListResult = extractionUi.reconcileProcessingPollProjection(
    retried,
    processing,
    {
      supersededTerminalFingerprint: supersededFingerprint,
      observedCurrentProcessing: false,
    },
  );
  assert.equal(currentListResult.observedCurrentProcessing, true);

  const terminalAfterObservedProcessing =
    extractionUi.reconcileProcessingPollProjection(
      currentListResult.document,
      failed,
      {
        supersededTerminalFingerprint: supersededFingerprint,
        observedCurrentProcessing:
          currentListResult.observedCurrentProcessing,
      },
    );
  assert.equal(
    terminalAfterObservedProcessing.document.extraction.status,
    "failed",
  );

  const optimisticRetry = extractionUi.beginDocumentExtractionProjection(
    processing,
    failed,
  );
  const optimisticAfterStaleList =
    extractionUi.reconcileDocumentExtractionProjection(
      optimisticRetry,
      failed,
    );
  assert.equal(
    optimisticAfterStaleList.document.extraction.status,
    "processing",
  );
  const optimisticAfterCurrentList =
    extractionUi.reconcileDocumentExtractionProjection(
      optimisticAfterStaleList,
      processing,
    );
  assert.equal(optimisticAfterCurrentList.observedCurrentProcessing, true);
  const optimisticAfterTerminal =
    extractionUi.reconcileDocumentExtractionProjection(
      optimisticAfterCurrentList,
      failed,
    );
  assert.equal(optimisticAfterTerminal.document.extraction.status, "failed");

  const newerFailure = {
    ...failed,
    extraction: {
      ...failed.extraction,
      processedAt: "2026-08-05T07:18:30.000Z",
    },
  };
  const terminalListResult = extractionUi.reconcileProcessingPollProjection(
    currentListResult.document,
    newerFailure,
    {
      supersededTerminalFingerprint: supersededFingerprint,
      observedCurrentProcessing:
        currentListResult.observedCurrentProcessing,
    },
  );
  assert.equal(terminalListResult.document.extraction.status, "failed");

  const completedProjection = extractionUi.beginDocumentExtractionProjection({
    ...processing,
    status: "needs_review",
    extraction: {
      status: "completed",
      processedAt: "2026-08-05T07:18:30.000Z",
      verifiedAt: null,
      summary: "The retry completed.",
    },
  });
  assert.equal(
    extractionUi.preferredDocumentProjection(failed, completedProjection)
      .extraction.status,
    "completed",
  );
  const newerServerRepresentation = {
    ...completedProjection.document,
    status: "accepted",
  };
  assert.equal(
    extractionUi.preferredDocumentProjection(
      newerServerRepresentation,
      completedProjection,
    ).status,
    "accepted",
  );

  const confirmedProjection = extractionUi.beginDocumentExtractionProjection({
    ...completedProjection.document,
    status: "under_review",
    extraction: {
      ...completedProjection.document.extraction,
      verifiedAt: "2026-08-05T07:19:00.000Z",
      acceptedFieldKeys: ["student_name"],
    },
  });
  assert.equal(
    extractionUi.preferredDocumentProjection(
      completedProjection.document,
      confirmedProjection,
    ).status,
    "under_review",
  );
  const confirmedServerRepresentation = {
    ...confirmedProjection.document,
    status: "accepted",
  };
  assert.equal(
    extractionUi.preferredDocumentProjection(
      confirmedServerRepresentation,
      confirmedProjection,
    ).status,
    "accepted",
  );

  const invalidResponse = extractionUi.documentExtractionFailurePresentation({
    failureCode: "invalid_response",
    retryable: true,
  });
  assert.match(invalidResponse.title, /usable result/i);
  assert.match(invalidResponse.guidance, /without uploading/i);

  const unknown = extractionUi.documentExtractionFailurePresentation({
    failureCode: "unknown",
    retryable: true,
  });
  assert.match(unknown.title, /unexpected problem/i);
  assert.match(unknown.guidance, /clearer PDF, JPEG, or PNG/i);

  assert.deepEqual(
    extractionUi.defaultAcceptedDocumentExtractionFieldKeys({
      fields: [
        { key: "student_name" },
        { key: "date_of_birth" },
      ],
    }),
    ["student_name", "date_of_birth"],
  );
  assert.deepEqual(
    extractionUi.defaultAcceptedDocumentExtractionFieldKeys({ fields: [] }),
    [],
  );

  const latestIdentity = extractionUi.latestDocumentForCategory(
    [
      {
        id: "identity-old",
        category: "identity",
        status: "uploaded",
        createdAt: "2026-08-05T07:10:00.000Z",
      },
      {
        id: "identity-new",
        category: "identity",
        status: "uploaded",
        createdAt: "2026-08-05T07:20:00.000Z",
      },
      {
        id: "transcript-newer",
        category: "transcript",
        status: "uploaded",
        createdAt: "2026-08-05T07:30:00.000Z",
      },
    ],
    "identity",
  );
  assert.equal(latestIdentity.id, "identity-new");
});

test("onboarding restores identity extraction state and bounds upload waits", async () => {
  const [onboarding, uploader, client] = await Promise.all([
    readFile(new URL("../app/onboarding/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/document-upload.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
  ]);

  assert.match(onboarding, /getStudentDocuments\(signal\)/);
  assert.match(
    onboarding,
    /latestDocumentForCategory\(\s*initialDocuments\.items,\s*"identity",?\s*\)/,
  );
  assert.match(onboarding, /activeDocument=\{identityDocument\}/);
  assert.match(onboarding, /DocumentExtractionReview/);
  assert.match(onboarding, /identityQuickUploadEnabled[\s\S]*identityPrefillCandidates/);
  assert.match(onboarding, /document\?\.status === "rejected"/);
  assert.match(onboarding, /reconcileDocumentExtractionProjection/);
  assert.match(onboarding, /rememberIdentityDocument/);
  assert.match(client, /AbortSignal\.timeout\(120_000\)/);
  assert.match(client, /bundleDeadline = AbortSignal\.timeout\(300_000\)/);
  assert.match(client, /AbortSignal\.any\(\[bundleDeadline/);
  assert.match(uploader, /requestController = new AbortController\(\)/);
  assert.match(uploader, /requestController\?\.abort\(\)/);
  assert.match(uploader, /if \(cancelled\) return;[\s\S]*const stillProcessing/);
  assert.match(uploader, /finally \{[\s\S]*setIsUploading\(false\)/);
});

test("document views retain retry authority and expose failed extraction alerts", async () => {
  const [documentsPage, uploader, extractionReview, contextMatches, requirementPage] =
    await Promise.all([
      readFile(new URL("../app/documents/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/components/document-upload.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/components/document-extraction-review.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/components/document-context-matches.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/enrollment/requirements/[slug]/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(documentsPage, /onDocumentChanged: \(document: StudentDocument\)/);
  assert.match(documentsPage, /const changed = await confirm\.run/);
  assert.match(documentsPage, /onDocumentChanged\(changed\)/);
  assert.match(documentsPage, /documentProjections/);
  assert.match(documentsPage, /pendingDocumentKey/);
  assert.match(documentsPage, /beginDocumentExtractionProjection/);
  assert.match(documentsPage, /reconcileDocumentExtractionProjection/);
  assert.match(documentsPage, /useSearchParams/);
  assert.match(documentsPage, /submitted-document--highlighted/);
  assert.match(documentsPage, /scrollIntoView/);
  assert.match(
    documentsPage,
    /key=\{`\$\{document\.id\}:\$\{document\.extraction\?\.status/,
  );
  assert.match(
    documentsPage,
    /extraction-state extraction-state--error" role="alert"/,
  );
  assert.match(
    extractionReview,
    /extraction-state extraction-state--error" role="alert"/,
  );
  assert.match(documentsPage, /DocumentContextMatches/);
  assert.match(contextMatches, /Audentra securely checked that evidence/);
  assert.match(contextMatches, /Your submission is complete for now and is under review/);
  assert.match(contextMatches, /safePortalDestination/);
  assert.match(uploader, /previousActiveDocumentRef/);
  assert.match(
    uploader,
    /terminalDocumentProjectionFingerprint\(previousActiveDocument\)/,
  );
  assert.match(requirementPage, /requirementDocumentOverride/);
  assert.match(requirementPage, /documentOverrideProjection/);
  assert.match(requirementPage, /transcriptDocumentProjection/);
  assert.match(requirementPage, /reconcileTranscriptServerProjection/);
  assert.match(requirementPage, /reconcileDocumentExtractionProjection/);
  assert.match(
    requirementPage,
    /selectedDocument = requirementDocumentOverrideProjection\s*\? serverDocument/,
  );
});

test("DSM feedback surfaces remain connected to portal data and safe fallbacks", async () => {
  const [financials, campusLife, edward, shell, enrollment] =
    await Promise.all([
      readFile(
        new URL("../app/financials/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/campus-life/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/components/edward-assistant.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../app/components/portal-shell.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/enrollment/page.tsx", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(financials, /function FinancialAidDonut/);
  assert.match(financials, /award\.type !== "work_study"/);
  assert.match(financials, /not counted as[\s\S]*accepted aid/);
  assert.match(financials, /How this award works/);
  assert.match(financials, /FinancialDocumentAction/);
  assert.match(financials, /document\.documentId/);
  assert.match(financials, /FinancialPaymentSchedule/);
  assert.match(financials, /Projected from your enrolled plan/);
  assert.match(campusLife, /clubCategory/);
  assert.match(campusLife, /Filter clubs by category/);
  assert.match(edward, /webkitSpeechRecognition/);
  assert.match(edward, /speechSynthesis\.speak/);
  assert.match(edward, /Microphone access was blocked/);
  assert.match(shell, /tenant\.admissionsEmail/);
  assert.match(enrollment, /OptionalSupportChecklist/);
  assert.match(enrollment, /<StudentCalendar/);
  assert.match(enrollment, /title="Enrollment deadlines"/);
  assert.match(enrollment, /Action needed/);
  assert.match(enrollment, /In review/);
  assert.match(enrollment, /Completed/);
  assert.match(enrollment, /requirementPriority\(right\)/);
});

test("student routes enforce bootstrap gating and expose no dead static links", async () => {
  const [guard, shell, bootstrapRouter, signIn, routeFiles] = await Promise.all([
    readFile(
      new URL("../app/components/student-route-guard.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/portal-shell.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/student-entry.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/sign-in/sign-in-client.tsx", import.meta.url),
      "utf8",
    ),
    Promise.all(
      [
        "../app/enrollment/page.tsx",
        "../app/documents/page.tsx",
        "../app/messages/page.tsx",
        "../app/appointments/page.tsx",
        "../app/payments/page.tsx",
        "../app/profile/page.tsx",
        "../app/help/page.tsx",
      ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
    ),
  ]);

  assert.match(guard, /getStudentBootstrap/);
  assert.match(
    guard,
    /window\.location\.replace\(tenantRuntime\.href\("\/onboarding"\)\)/,
  );
  assert.match(
    guard,
    /window\.location\.replace\(tenantRuntime\.href\("\/sign-in"\)\)/,
  );
  assert.match(shell, /onboarding\.required/);
  assert.match(shell, /label: "My Documents"/);
  assert.match(shell, /href: "\/documents"/);
  assert.match(bootstrapRouter, /initialRoute/);
  assert.match(signIn, /getStudentBootstrap/);
  assert.match(signIn, /signInStudent/);
  assert.match(signIn, /signUpStudent/);
  assert.match(signIn, /name="email"/);
  assert.match(signIn, /name="phone"/);
  assert.match(signIn, /name="password"/);
  assert.match(
    signIn,
    /window\.location\.assign\(tenantRuntime\.href\("\/onboarding"\)\)/,
  );
  assert.match(routeFiles.join("\n"), /signOutStudent/);

  const allRoutes = new Set([
    "/",
    "/appointments",
    "/dashboard",
    "/documents",
    "/enrollment",
    "/help",
    "/messages",
    "/onboarding",
    "/payments",
    "/profile",
    "/sign-in",
  ]);
  const source = [shell, signIn, ...routeFiles].join("\n");
  assert.doesNotMatch(source, />Open task</);
  assert.match(source, /Upload transcript/);
  assert.match(source, /Select housing/);
  for (const match of source.matchAll(/href=["'](\/[^"'#?{}]*)["']/g)) {
    assert.ok(allRoutes.has(match[1]), `dead static link: ${match[1]}`);
  }
});

test("tenant points stay visible and enrollment tasks advertise their reward", async () => {
  const [shell, enrollment, apiClient, styles] = await Promise.all([
    readFile(
      new URL("../app/components/portal-shell.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/enrollment/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(shell, /rewards\.lifetimePoints/);
  assert.match(shell, /rewards\.pointName/);
  assert.match(shell, /bookstoreCreditCents/);
  assert.match(enrollment, /item\.reward\.points/);
  assert.match(enrollment, /points earned/);
  assert.match(apiClient, /vv:student-record-changed/);
  assert.match(styles, /\.aster-points-balance/);
  assert.match(styles, /\.aster-sidebar__rewards/);
  assert.match(styles, /\.enrollment-reward--earned/);
});

test("campus event visuals are data-driven, accessible, and backed by local assets", async () => {
  const [campusPage, contracts, styles] =
    await Promise.all([
      readFile(new URL("../app/campus-life/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../../../packages/contracts/src/index.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

  assert.match(contracts, /visualTheme\?: "festival" \| "discovery"/);
  assert.match(campusPage, /data-visual-theme=/);
  assert.match(campusPage, /activeEvent\.imageAlt/);
  assert.match(campusPage, /activeEvent\.imageAttribution/);
  assert.match(campusPage, /Refresh current events/);
  assert.match(campusPage, /campus\.refresh\(\)/);
  assert.match(styles, /\.campus-carousel--theme-festival/);
  assert.match(styles, /\.campus-carousel--theme-discovery/);
  assert.match(styles, /\.campus-carousel--theme-career/);
  assert.match(styles, /\.campus-carousel--theme-community/);

  for (const asset of [
    "welcome-week-block-party.webp",
    "first-year-research-showcase.webp",
    "internship-ready-lab.webp",
  ]) {
    await access(new URL(`../public/media/events/${asset}`, import.meta.url));
  }
});

test("experience updates aggregate once per portal visit with an accessible decision flow", async () => {
  const [contracts, apiClient, shell, session, styles] = await Promise.all([
    readFile(
      new URL("../../../packages/contracts/src/index.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/portal-shell.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/lib/experience-update-session.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(contracts, /interface StudentExperienceUpdate/);
  assert.match(contracts, /experienceUpdates: StudentExperienceUpdate\[\]/);
  assert.match(contracts, /status: "pending" \| "deferred"/);
  assert.match(contracts, /status: "acknowledged" \| "deferred"/);
  assert.match(contracts, /interface DeferStudentExperienceUpdatesInput/);
  assert.match(apiClient, /experience-updates\/\$\{encodeURIComponent\(updateId\)\}\/decision/);
  assert.match(apiClient, /experience-updates\/defer/);
  assert.match(apiClient, /request<StudentExperienceUpdateDecision>/);
  assert.match(apiClient, /request<DeferStudentExperienceUpdatesResult>/);

  assert.match(shell, /role="dialog"/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /aria-labelledby="experience-update-title"/);
  assert.match(shell, /experienceUpdates\.length > 0/);
  assert.match(shell, /update\.kind === "enrollment" \|\| update\.kind === "onboarding"/);
  assert.match(shell, /beginExperienceUpdateVisit\(experienceSessionKey\)/);
  assert.match(shell, /document\.visibilityState === "visible"/);
  assert.match(shell, /deferStudentExperienceUpdates/);
  assert.match(shell, /child\.setAttribute\("inert", ""\)/);
  assert.match(shell, /onHandleNow\(update\)/);
  assert.match(shell, /onDefer\(\)/);
  assert.match(shell, /\/enrollment\/requirements\/\$\{encodeURIComponent/);
  assert.match(shell, /window\.location\.assign\(tenantRuntime\.href\(destination\)\)/);
  assert.match(session, /EXPERIENCE_UPDATE_IDLE_MS = 5 \* 60_000/);
  assert.match(session, /sessionStorage/);
  assert.match(styles, /\.experience-update-dialog/);
  assert.match(styles, /\.experience-update-dialog__actions/);
  assert.match(styles, /\.experience-update-dialog__list/);
});

test("experience update session does not reopen on navigation but resumes after five minutes", async () => {
  const source = await readFile(
    new URL("../app/lib/experience-update-session.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const sessionValues = new Map();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key) => sessionValues.get(key) ?? null,
        setItem: (key, value) => sessionValues.set(key, value),
      },
    },
  });

  try {
    const session = await import(moduleUrl);
    const key = session.studentExperienceUpdateSessionKey("tenant-1", "student-1");
    const expiredKey = session.studentExperienceUpdateSessionKey("tenant-1", "student-2");
    const startedAt = 1_000;

    assert.equal(session.beginExperienceUpdateVisit(key, startedAt), true);
    assert.equal(session.beginExperienceUpdateVisit(key, startedAt + 1_000), false);
    session.touchExperienceUpdateVisit(key, startedAt + 2_000);
    assert.equal(
      session.beginExperienceUpdateVisit(
        key,
        startedAt + 2_000 + session.EXPERIENCE_UPDATE_IDLE_MS - 1,
      ),
      false,
    );
    assert.equal(session.beginExperienceUpdateVisit(expiredKey, startedAt), true);
    session.touchExperienceUpdateVisit(expiredKey, startedAt + 2_000);
    assert.equal(
      session.beginExperienceUpdateVisit(
        expiredKey,
        startedAt + 2_000 + session.EXPERIENCE_UPDATE_IDLE_MS,
      ),
      true,
    );
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      delete globalThis.window;
    }
  }
});

test("staff journeys share a typed, accessible flow builder", async () => {
  const [builder, formBuilder, templateLibrary, onboarding, modelSource, staffPortal, contracts, styles] = await Promise.all([
    readFile(
      new URL("../app/staff/journey-flow-builder.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/staff/onboarding-form-builder.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/staff/journey-template-library.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/onboarding/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/staff/journey-flow-model.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/staff/staff-portal.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../../../packages/contracts/src/index.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(staffPortal, /<JourneyFlowBuilder/);
  assert.match(staffPortal, /kind=\{kind\}/);
  assert.match(staffPortal, /Published changes stay versioned/);
  assert.match(staffPortal, /className="staff-journey-studio"/);
  assert.match(staffPortal, /<details className="staff-journey-copilot">/);
  assert.doesNotMatch(staffPortal, /New journeys use the new version/);

  assert.match(builder, /draggable=\{!busy && !item\.studentStep\}/);
  assert.match(builder, /dataTransfer\.setData\("text\/plain", item\.id\)/);
  assert.match(builder, /Move \$\{item\.title\} up/);
  assert.match(builder, /Move \$\{item\.title\} down/);
  assert.match(builder, /role="switch"/);
  assert.match(builder, /aria-checked=\{item\.active\}/);
  assert.match(builder, /\+ Add step/);
  assert.match(builder, /createJourneyTaskId\(kind, ids\)/);
  assert.match(builder, /createJourneyFlowId\(/);
  assert.match(builder, /noCompatMode: false/);
  assert.match(builder, /workingConfigurationRef = useRef\(configuration\)/);
  assert.match(
    builder,
    /expectedVersion: workingConfigurationRef\.current\.version/,
  );
  assert.match(builder, /workingConfigurationRef\.current = updatedConfiguration/);
  assert.match(builder, /setWorkingConfiguration\(updatedConfiguration\)/);
  assert.match(builder, /setTasks\(parsedTasks\(updatedConfiguration, kind\)\)/);
  assert.match(builder, /configuration=\{workingConfiguration\}/);
  assert.match(builder, /Confirm delete/);
  assert.match(builder, /task\.active = nextActive/);
  assert.match(builder, /className=\"staff-editor-backdrop\"/);
  assert.match(builder, /Built-in onboarding screen/);
  assert.match(builder, /Journey list label/);
  assert.match(builder, /Student page section label/);
  assert.match(builder, /Student page heading/);
  assert.match(builder, /Student page introduction/);
  assert.match(builder, /ResponsibleOfficeSelect/);
  assert.match(builder, /Required system screen/);
  assert.match(builder, /identity_quick_upload/);
  assert.match(builder, /This preview and the student page read the same published configuration/);
  assert.match(builder, /item\.kind === "onboarding" && Boolean\(item\.studentStep\)/);
  assert.match(builder, /item\.studentStep \? "Edit screen" : "Edit step"/);
  assert.match(builder, /disabled=\{busy \|\| Boolean\(item\.studentStep\)\}/);
  assert.match(builder, /Synced to the student checklist/);
  assert.match(builder, /Edit synced item/);
  assert.match(builder, /<JourneyDependencyMap/);
  assert.match(builder, /Build the journey as a connected graph/);
  assert.match(builder, /const \[viewMode, setViewMode\]/);
  assert.match(builder, /Flow map/);
  assert.match(builder, /Step list/);
  assert.match(builder, /focusedGraphTasks/);
  assert.match(builder, /currentKind=\{kind\}/);
  assert.match(builder, /staff-journey-editor__section/);
  assert.match(builder, /journeySuccessorIds/);
  assert.match(builder, /\{task\.points\} pts/);
  assert.match(builder, /name="priority"/);
  assert.match(builder, /name="dueOffsetDays"/);
  assert.match(builder, /className="staff-dependency-picker"/);
  assert.match(builder, /Answer-driven path/);
  assert.match(builder, /\+ Add answer condition/);
  assert.match(builder, /A non-matching branch becomes Not applicable/);
  assert.match(builder, /task\.activation =/);
  assert.match(builder, /source_task: rule\.sourceTaskId/);
  assert.match(builder, /journey-conditional-arrow/);
  assert.match(builder, /Simplify layout/);
  assert.match(builder, /⌖ Pointer/);
  assert.match(builder, /✋ Hand/);
  assert.match(builder, /zoomWithWheel/);
  assert.match(builder, /onPointerDown=\{startPan\}/);
  assert.match(builder, /const middleMouse = event\.button === 1/);
  assert.match(builder, /middle mouse switches to Hand/);
  assert.match(builder, /studentInputPreview/);
  assert.match(builder, /02 Student input/);
  assert.match(builder, /02 Student page/);
  assert.match(builder, /03 System action/);
  assert.match(builder, /System screen basics/);
  assert.match(builder, /hidden=\{activeEditorSection !== "experience"\}/);
  assert.match(builder, /operatorsForRouteField/);
  assert.match(builder, /default \(none of\)/);
  assert.match(builder, /greater_than_or_equal/);
  assert.match(builder, /dedicated[\s\S]*express lane/);
  assert.match(builder, /selectedDependencies/);
  assert.match(builder, /validateJourneyDependencies\(candidateGraph\)/);
  assert.match(builder, /task\.due_days_after_acceptance = dueOffsetDays/);
  assert.match(builder, /depends_on: dependencies/);
  assert.match(builder, /role="dialog"/);
  assert.match(builder, /aria-modal="true"/);
  assert.match(builder, /event\.key === "Escape"/);
  assert.match(builder, /panel\.querySelectorAll<HTMLElement>/);
  assert.match(builder, /editorTriggerRef\.current\?\.focus/);
  assert.match(builder, /flow\.status !== "published"/);
  assert.match(
    builder,
    /candidate\.kind === kind && candidate\.status === "published"/,
  );

  for (const type of [
    "approval",
    "form",
    "single_select",
    "multiple_select",
    "upload_file",
    "signature",
    "payment",
  ]) {
    assert.match(builder, new RegExp(`value: "${type}"`));
  }
  assert.match(builder, /submission_type: submissionTypeForTask\(selectedType\)/);
  assert.match(builder, /name="options"/);
  assert.match(builder, /Selection steps need at least two options/);
  assert.match(builder, /validateFormDefinition\(formDefinition\)/);
  assert.match(builder, /name="maximumSelections"/);
  assert.match(builder, /name="acceptedFileTypes"/);
  assert.match(builder, /name="documentCategories"/);
  assert.match(builder, /task\.docusign_template_id = templateId/);
  assert.match(builder, /task\.accepted_mime_types = acceptedMimeTypes/);
  assert.match(builder, /task\.signature_template_id/);
  assert.match(builder, /task\.accepted_file_types/);
  assert.match(builder, /mimeType\.includes\("\/"\)/);
  assert.match(builder, /DocuSign \(configuration only\)/);
  assert.match(builder, /live DocuSign connection must be configured separately/i);
  assert.match(
    builder,
    /selectedType === "payment" && item\.id !== "enrollment_deposit"/,
  );
  assert.match(
    builder,
    /option\.value === "payment" && item\.id !== "enrollment_deposit"/,
  );
  assert.match(builder, /Payment \(built-in enrollment deposit only\)/);
  assert.match(builder, /id: "response"/);
  assert.match(builder, /title: "Your response"/);
  assert.match(builder, /field_type: "text"/);
  assert.match(builder, /specializedForm = \["profile_verification", "housing_preference"\]/);
  assert.match(builder, /delete existingInput\.form/);
  assert.match(builder, /delete existingInput\.fields/);
  assert.match(builder, /remove its configured form/);
  assert.match(formBuilder, /aria-label="Student form builder"/);
  assert.match(formBuilder, /Live student preview/);
  assert.match(formBuilder, /Browse templates/);
  assert.match(formBuilder, /Form outline/);
  assert.match(formBuilder, /formScaffoldTemplates/);
  assert.match(styles, /staff-journey-graph__canvas-tools/);
  assert.match(styles, /staff-journey-graph__viewport\.is-pan-ready/);
  assert.match(styles, /staff-journey-editor__input-preview/);
  assert.match(formBuilder, /Step \{activePageIndex \+ 1\} of \{form\.pages\.length\}/);
  assert.match(formBuilder, /aria-label="Question field palette"/);
  assert.match(formBuilder, /value: "number"/);
  assert.match(formBuilder, /Minimum \(optional\)/);
  assert.match(formBuilder, /Maximum \(optional\)/);
  assert.match(formBuilder, /Step \(optional\)/);
  assert.match(formBuilder, /duplicateField/);
  assert.match(formBuilder, /staff-form-preview__device/);
  assert.match(formBuilder, /disabled: true/);
  assert.doesNotMatch(formBuilder, /required: field\.required/);
  assert.match(formBuilder, /dataTransfer\.setData\("text\/plain", field\.id\)/);
  assert.match(onboarding, /ConfiguredAboutYouFields/);
  assert.match(onboarding, /configured-about-you-form__progress/);
  assert.match(onboarding, /custom__\$\{field\.id\}/);
  assert.match(onboarding, /label: configured\?\.label \|\| candidate\.label/);
  assert.match(staffPortal, /staff-event-image-dropzone/);
  assert.match(staffPortal, /onDrop=\{dropImage\}/);
  assert.match(staffPortal, /maximum 5 MB/);
  for (const alias of [
    "maximumSelections",
    "signatureProvider",
    "docusignTemplateId",
    "signatureTemplateId",
    "acceptedMimeTypes",
    "acceptedFileTypes",
    "documentCategories",
  ]) {
    assert.match(builder, new RegExp(`delete existingInput\\[key\\]`));
    assert.ok(builder.includes(`"${alias}"`), `${alias} must be scrubbed from task.input`);
  }
  assert.match(contracts, /active\?: boolean/);
  assert.match(contracts, /interface JourneyRouteActivation/);
  assert.match(contracts, /operator: JourneyRouteOperator/);
  assert.match(contracts, /\| "one_of"/);
  assert.match(contracts, /\| "none_of"/);
  assert.match(contracts, /\| "greater_than_or_equal"/);
  assert.match(contracts, /value: string \| number \| boolean \| string\[\]/);
  assert.match(contracts, /interface StudentRequirementFormDefinition/);
  assert.match(contracts, /pages: StudentRequirementFormPage\[\]/);
  assert.match(
    contracts,
    /submissionType: "form" \| "document" \| "payment" \| "appointment" \| "none"/,
  );
  assert.match(styles, /\.staff-journey-list li\.is-inactive/);
  assert.match(styles, /\.staff-journey-list li\.is-drop-target/);
  assert.match(styles, /\.staff-form-builder__workspace/);
  assert.match(styles, /\.staff-journey-commandbar/);
  assert.match(styles, /\.staff-journey-map__viewport/);
  assert.match(styles, /\.staff-journey-graph__node/);
  assert.match(styles, /\.staff-route-builder/);
  assert.match(styles, /\.staff-journey-templates/);
  assert.match(styles, /\.staff-form-pages/);
  assert.match(styles, /\.staff-journey-editor__section/);
  assert.match(styles, /\.staff-form-builder__palette/);
  assert.match(styles, /\.staff-journey-copilot/);
  assert.match(styles, /\.staff-event-image-dropzone\.is-dragging/);
  assert.match(builder, /Use template/);
  assert.match(builder, /onConnect=\{connectNodes\}/);
  assert.match(builder, /editor_position/);
  assert.match(templateLibrary, /Enrollment essentials/);
  assert.match(templateLibrary, /Comprehensive enrollment readiness/);
  assert.match(templateLibrary, /dependsOn: \["identity_verification", "financial_readiness", "financial_documents"\]/);
  assert.match(templateLibrary, /dependsOn: \["academic_evaluation", "financial_clearance", "orientation_registration", "advisor_planning"\]/);
  assert.match(templateLibrary, /International student launch/);
  assert.match(templateLibrary, /Decision-based student onboarding/);
  assert.match(templateLibrary, /sourceKey: "living_decision"/);
  assert.match(templateLibrary, /operator: "one_of"/);
  assert.match(templateLibrary, /operator: "none_of"/);
  assert.match(templateLibrary, /Readiness score pathways/);
  assert.match(templateLibrary, /field_type: "number"/);
  assert.match(templateLibrary, /operator: "greater_than_or_equal"/);
  assert.match(templateLibrary, /dependsOn: \["living_decision", "campus_housing_profile", "commuter_profile", "housing_guidance"\]/);

  const compiledModel = ts.transpileModule(modelSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const modelUrl = `data:text/javascript;base64,${Buffer.from(compiledModel).toString("base64")}`;
  const model = await import(modelUrl);

  assert.equal(model.submissionTypeForTask("approval"), "form");
  assert.equal(model.submissionTypeForTask("single_select"), "form");
  assert.equal(model.submissionTypeForTask("multiple_select"), "form");
  assert.equal(model.submissionTypeForTask("upload_file"), "document");
  assert.equal(model.submissionTypeForTask("signature"), "form");
  assert.equal(model.submissionTypeForTask("payment"), "payment");
  assert.deepEqual(model.moveJourneyTask(["a", "b", "c"], "b", "up"), [
    "b",
    "a",
    "c",
  ]);
  assert.deepEqual(model.dropJourneyTask(["a", "b", "c"], "a", "c"), [
    "b",
    "c",
    "a",
  ]);
  const dependencyGraph = [
    { id: "start", dependsOn: [] },
    { id: "profile", dependsOn: ["start"] },
    { id: "housing", dependsOn: ["start"] },
  ];
  assert.deepEqual(model.journeySuccessorIds(dependencyGraph, "start"), [
    "profile",
    "housing",
  ]);
  assert.deepEqual(model.journeyGraphLevels(dependencyGraph), [
    ["start"],
    ["profile", "housing"],
  ]);
  const crossingGraph = [
    { id: "start", dependsOn: [] },
    { id: "upper", dependsOn: ["start"] },
    { id: "lower", dependsOn: ["start"] },
    { id: "cross_to_upper", dependsOn: ["lower"] },
    { id: "cross_to_lower", dependsOn: ["upper"] },
    { id: "finish", dependsOn: ["cross_to_upper", "cross_to_lower"] },
  ];
  const simplified = model.simplifyJourneyGraphLayout(crossingGraph);
  assert.ok(simplified.lower.x < simplified.cross_to_upper.x);
  assert.ok(simplified.upper.x < simplified.cross_to_lower.x);
  assert.ok(simplified.cross_to_upper.y > simplified.cross_to_lower.y);
  for (const level of model.journeyGraphLevels(crossingGraph)) {
    const positions = level.map((id) => simplified[id]);
    for (let index = 1; index < positions.length; index += 1) {
      assert.ok(Math.abs(positions[index].y - positions[index - 1].y) >= 220);
    }
  }
  assert.equal(model.validateJourneyDependencies(dependencyGraph), null);
  assert.match(
    model.validateJourneyDependencies([{ id: "loop", dependsOn: ["loop"] }]),
    /cannot depend on itself/,
  );
  assert.match(
    model.validateJourneyDependencies([
      { id: "one", dependsOn: ["two"] },
      { id: "two", dependsOn: ["one"] },
    ]),
    /Dependency cycle/,
  );

  const generatedId = model.createJourneyTaskId(
    "onboarding",
    new Set(["new_onboarding_step_aaaaaaaaaaaa"]),
    (() => {
      const values = [
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      ];
      return () => values.shift();
    })(),
  );
  assert.equal(generatedId, "new_onboarding_step_bbbbbbbbbbbb");
  assert.match(generatedId, /^[a-z][a-z0-9_]*$/);
  assert.equal(
    model.createJourneyFlowId("onboarding", new Set(["onboarding_flow"])),
    "onboarding_flow_2",
  );
});

test("generic requirement interactions submit typed, idempotent responses", async () => {
  const [action, responseModelSource, requirementPage, client, contracts, styles] = await Promise.all([
    readFile(
      new URL("../app/components/requirement-response-action.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/requirement-response-model.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/enrollment/requirements/[slug]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../../packages/contracts/src/index.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(client, /requirements\/\$\{encodeURIComponent\(requirementId\)\}\/responses/);
  assert.match(client, /request<SubmitStudentRequirementResponseResult>/);
  assert.match(action, /expectedVersion: requirement\.version/);
  assert.match(action, /Idempotency|idempotencyKey/);
  assert.match(action, /idempotencyKeyRef = useRef/);
  assert.match(action, /submissionInFlightRef\.current/);
  assert.match(action, /idempotencyKeyRef\.current = intentKey/);
  assert.match(action, /\{ acknowledged: true \}/);
  assert.match(action, /\{ approved: true \}/);
  assert.match(action, /\{ values \}/);
  assert.match(action, /\{ selectedOption \}/);
  assert.match(action, /\{ selectedOptions \}/);
  assert.match(action, /signerName/);
  assert.match(action, /signatureMethod/);
  assert.match(action, /\{ appointmentId \}/);
  assert.match(action, /getStudentAppointments/);
  assert.doesNotMatch(action, /Paste.*appointment|appointment UUID/i);
  assert.match(action, /live\s+connection is not configured yet/);
  assert.match(action, /configuredForm\(requirement\)/);
  assert.match(action, /visibleConfiguredFields\(page\?\.fields \?\? \[\], currentValues\)/);
  assert.match(action, /requirement-response__page-progress/);
  assert.match(action, /pageIndex < form\.pages\.length - 1/);
  assert.match(action, /valuesFromForm\([\s\S]{0,100}visibleFields/);
  assert.match(action, /visibleFields\.map/);
  assert.match(requirementPage, /<RequirementResponseAction/);
  assert.match(requirementPage, /getStudentRequirements/);
  assert.match(requirementPage, /terminalRequirementStatuses\.has/);
  assert.match(requirementPage, /What this unlocks/);
  assert.match(requirementPage, /successor\.slug/);
  assert.match(requirementPage, /dependency\.slug/);
  assert.match(
    requirementPage,
    /requirement\.code === "profile_verification"[\s\S]{0,100}kind === "profile"[\s\S]{0,100}requirement\.interactionType === "form"/,
  );
  assert.match(
    requirementPage,
    /requirement\.code === "housing_preference"[\s\S]{0,100}kind === "housing"[\s\S]{0,120}\["form", "selection_flow"\]\.includes\(requirement\.interactionType\)/,
  );
  assert.match(
    requirementPage,
    /requirement\.submissionType === "document"[\s\S]{0,120}requirement\.interactionType === "upload_file"/,
  );
  assert.match(
    requirementPage,
    /requirement\.code === "enrollment_deposit"[\s\S]{0,100}kind === "payment"[\s\S]{0,100}requirement\.interactionType === "payment"/,
  );
  assert.match(contracts, /type StudentRequirementInteractionType/);
  assert.match(contracts, /interface SubmitStudentRequirementResponseInput/);
  assert.match(contracts, /interface StudentRequirementResponseRecord/);
  assert.match(styles, /\.requirement-response-card/);

  const compiledResponseModel = ts.transpileModule(responseModelSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const responseModelUrl = `data:text/javascript;base64,${Buffer.from(compiledResponseModel).toString("base64")}`;
  const responseModel = await import(responseModelUrl);
  const conditionalFields = [
    {
      id: "choice",
      title: "Choice",
      field_type: "single_select",
      required: true,
      options: ["yes", "no"],
    },
    {
      id: "details",
      title: "Details",
      field_type: "text",
      required: true,
      when: { field: "choice", equals: "yes" },
    },
  ];
  assert.deepEqual(
    responseModel.visibleConfiguredFields(conditionalFields, {}).map((field) => field.id),
    ["choice"],
  );
  assert.deepEqual(
    responseModel
      .visibleConfiguredFields(conditionalFields, { choice: "no", details: "stale" })
      .map((field) => field.id),
    ["choice"],
  );
  assert.deepEqual(
    responseModel
      .visibleConfiguredFields(conditionalFields, { choice: "yes" })
      .map((field) => field.id),
    ["choice", "details"],
  );
});

test("the web command wrapper forwards isolated host and port arguments", async () => {
  const buildScript = await readFile(
    new URL("../scripts/build.mjs", import.meta.url),
    "utf8",
  );
  assert.match(buildScript, /process\.argv\.slice\(3\)/);
  assert.match(buildScript, /\[cli, command, \.\.\.commandArguments\]/);
});

test("dynamic portal destinations reject stored script and cross-origin path tricks", async () => {
  const source = await readFile(
    new URL("../app/lib/safe-destination.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const { safePortalDestination } = await import(moduleUrl);

  assert.deepEqual(safePortalDestination("/campus-life", "/dashboard"), {
    href: "/campus-life",
    external: false,
  });
  assert.deepEqual(safePortalDestination("https://events.example.edu/register", "/campus-life"), {
    href: "https://events.example.edu/register",
    external: true,
  });
  for (const unsafe of [
    "javascript:alert(1)",
    "//evil.example/path",
    "/\\evil.example/path",
    "/%5cevil.example/path",
    "https://user:password@evil.example/path",
  ]) {
    assert.deepEqual(safePortalDestination(unsafe, "/campus-life"), {
      href: "/campus-life",
      external: false,
    });
  }
});

test("Edward separates the in-flow conversation workspace from the floating assistant", async () => {
  const [assistant, page, workspaceStyles, globalStyles] = await Promise.all([
    readFile(
      new URL("../app/components/edward-assistant.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/edward/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../app/components/edward-assistant.module.css",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(assistant, /aria-controls="edward-conversation-navigation"/);
  assert.match(assistant, /aria-controls="edward-panel"/);
  assert.match(assistant, /Conversations remain in memory for this tab/);
  assert.match(assistant, /variant === "embedded" \? \(/);
  assert.match(page, /title="Ask Edward"/);
  assert.doesNotMatch(page, /edward-capabilities/);
  assert.match(
    workspaceStyles,
    /:global\(\.edward-panel\)\.embeddedPanel[\s\S]*?position: relative;/,
  );
  assert.match(
    globalStyles,
    /\.edward-panel \{[\s\S]*?position: fixed;/,
  );
});

test("Edward renders structured blocks safely and persists conversations when the platform can", async () => {
  const [assistant, blocks, client, globalStyles, workspaceStyles] =
    await Promise.all([
      readFile(
        new URL("../app/components/edward-assistant.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/assistant-blocks.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../app/components/edward-assistant.module.css",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  // Blocks are typed data, never model-authored markup, and an unknown block
  // type falls back to its own plain-text rendering.
  assert.match(blocks, /case "text":/);
  assert.match(blocks, /case "bullet_list":/);
  assert.match(blocks, /case "numbered_list":/);
  assert.match(blocks, /case "next_steps":/);
  assert.match(blocks, /case "table":/);
  assert.match(blocks, /fallbackText/);
  assert.match(blocks, /assistant-block__table-scroll/);
  assert.doesNotMatch(blocks, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(blocks, /from "(react-markdown|marked|showdown)/);

  // A wide table scrolls inside its own container, never the page.
  assert.match(
    globalStyles,
    /\.assistant-block__table-scroll \{[\s\S]*?overflow-x: auto;/,
  );
  assert.match(
    workspaceStyles,
    /\.embeddedAssistantMessage > :global\(\.assistant-blocks\)/,
  );

  // The assistant message routes through the block renderer only when the
  // platform sent blocks; prose keeps the existing paragraph path.
  assert.match(assistant, /message\.blocks\?\.length \? \(/);
  assert.match(assistant, /<AssistantBlocks/);

  // Conversations persist through the platform when it offers the endpoints,
  // and the panel degrades to in-memory threads when it does not.
  assert.match(assistant, /createAssistantConversation/);
  assert.match(assistant, /getAssistantConversationMessages/);
  assert.match(assistant, /clientMessageId/);
  assert.match(assistant, /"unknown" \| "active" \| "unavailable"/);
  assert.match(assistant, /sessionStorage/);
  assert.match(client, /\/v1\/student\/assistant\/conversations/);
});

test("staff CRM distinguishes canonical students from preview cohort records", async () => {
  const source = await readFile(
    new URL("../app/staff/staff-portal.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /operation\.syntheticSeed \? "preview" : "success"/);
  assert.match(source, /Canonical student record/);
});

test("the Action Center keeps evidence durable while AI and scheduled rules run asynchronously", async () => {
  const [detail, rules, notifications, api, contracts] = await Promise.all([
    readFile(new URL("../app/staff/action-center-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/action-rules-editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/staff/notification-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/contracts/src/index.ts", import.meta.url), "utf8"),
  ]);
  for (const tab of ["Overview", "Next Step", "Outcomes", "Comments", "History"]) {
    assert.match(detail, new RegExp(`label: "${tab}"`));
  }
  for (const status of [
    "todo",
    "in_progress",
    "follow_up_required",
    "blocked",
    "done",
    "cancelled",
  ]) {
    assert.match(contracts, new RegExp(`\\| "${status}"`));
  }

  assert.match(detail, /participants consented to recording and external speech-to-text/);
  assert.match(detail, /original recording is retained even if speech-to-text fails/i);
  assert.match(detail, /Earlier transcript revisions/);
  assert.match(detail, /Regenerate transcript/);
  assert.match(detail, /AI enrichment is running in the background/);
  assert.match(detail, /function meaningfulUpdateReason/);
  assert.match(detail, /AI job transitions and generated projections are read-only/);
  assert.doesNotMatch(detail, /A message, outcome, or AI summary changed/);
  assert.doesNotMatch(detail, /3\. Record the interaction/);
  assert.match(detail, /4\. Conversation signals/);
  assert.match(detail, /aria-label="Refresh AI summaries"/);
  assert.match(detail, /completeFromHeader/);
  assert.match(rules, /deterministic checks run independently from AI/);
  assert.match(notifications, /unreadCount/);

  for (const route of [
    "/v1/staff/action-rules",
    "/v1/staff/notifications",
    "/recordings",
    "/retry",
    "/content",
  ]) {
    assert.match(api, new RegExp(route.replaceAll("/", "\\/")));
  }
});

test("student requirement pages create durable, requirement-linked help requests", async () => {
  const [page, helpWidget, helpStyles, client, contracts] = await Promise.all([
    readFile(
      new URL("../app/enrollment/requirements/[slug]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/requirement-help-request.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/components/requirement-help-request.module.css",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app/lib/api-client.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../../packages/contracts/src/index.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /<RequirementHelpRequest/);
  assert.match(page, /<RequirementHelpRequestedStatus/);
  assert.match(helpWidget, /requirementId: requirement\.id/);
  assert.match(helpWidget, /request\.requirementId/);
  assert.match(helpWidget, /request\.message\.includes\(requirementReference/);
  assert.match(helpWidget, /Requirement code:/);
  assert.match(helpWidget, /Requirement page:/);
  assert.match(helpWidget, /Request help/);
  assert.match(helpWidget, /Try again/);
  assert.match(helpWidget, /role="alert"/);
  assert.match(helpStyles, /var\(--tenant-primary/);
  assert.match(helpStyles, /var\(--tenant-accent/);
  assert.match(contracts, /requirementId\?: string/);
  assert.match(contracts, /workItemId\?: string \| null/);
  assert.match(client, /error\.code !== "VALIDATION_ERROR"/);
  assert.match(client, /const legacyInput = \{ \.\.\.input \}/);
  assert.match(client, /delete legacyInput\.requirementId/);
});

test("document submission only counts newly selected local files", async () => {
  const uploader = await readFile(
    new URL("../app/components/document-upload.tsx", import.meta.url),
    "utf8",
  );

  assert.match(uploader, /const pendingDocuments = documents\.filter/);
  assert.match(uploader, /item\.status !== "uploaded"/);
  assert.match(uploader, /const hasSubmittableFiles = pendingDocuments\.some/);
  assert.match(uploader, /Files ready to submit \(\{pendingDocuments\.length\}\)/);
  assert.match(uploader, /disabled=\{[\s\S]*?!hasSubmittableFiles/);
  assert.match(uploader, /"Submit files"/);
  assert.match(uploader, /"Retry file submission"/);
  assert.doesNotMatch(uploader, /Select a file above to upload/);
  assert.doesNotMatch(uploader, /Upload requirement bundle/);
  assert.doesNotMatch(uploader, /Upload transcript files/);
});

test("student dashboard orders events before a height-balanced working area", async () => {
  const [dashboard, styles] = await Promise.all([
    readFile(new URL("../app/student-dashboard.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../app/components/student-dashboard-experience.module.css",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  const facts = dashboard.indexOf('className="aster-info-strip"');
  const events = dashboard.indexOf("<DashboardCampusEvents");
  const workingArea = dashboard.indexOf("dashboardStyles.workingArea");
  const enrollment = dashboard.indexOf("Enrollment progress", workingArea);
  const financials = dashboard.indexOf("<DashboardFinancialSnapshot", workingArea);
  const classrooms = dashboard.indexOf("My Classrooms", workingArea);
  const calendar = dashboard.indexOf("<StudentCalendar", workingArea);

  assert.ok(facts >= 0 && facts < events, "profile facts must precede events");
  assert.ok(events < workingArea, "events must precede the working area");
  assert.ok(enrollment < financials, "enrollment must precede financials");
  assert.ok(financials < classrooms, "financials must precede classrooms");
  assert.ok(classrooms < calendar, "the left stack must precede the calendar");
  assert.doesNotMatch(dashboard, /My Campus Life/);
  assert.match(styles, /\.workingArea \{[\s\S]*?align-items: stretch/);
  assert.match(styles, /\.workingStack \{[\s\S]*?height: 100%/);
  assert.match(styles, /\.calendarColumn > \* \{[\s\S]*?height: 100%/);
  assert.match(styles, /@media \(max-width: 900px\)/);
});
