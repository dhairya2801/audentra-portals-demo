import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

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

test("server-renders the branded, accessible bootstrap router", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Student Portal \| Aster University<\/title>/i);
  assert.match(html, /Aster University/);
  assert.match(html, /Opening your student portal/);
  assert.match(html, /aria-busy="true"/);
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
    "/enrollment/requirements/transcript-upload",
  ];

  for (const route of routes) {
    const response = await render(route);
    assert.equal(response.status, 200, `${route} should render`);
    const html = await response.text();
    assert.match(html, /Aster University|Aster/);
    assert.doesNotMatch(html, /404|Page not found/i);
  }

  const signInResponse = await render("/sign-in");
  const signInHtml = await signInResponse.text();
  assert.match(signInHtml, /Sign in/);
  assert.match(signInHtml, /Create account/);
  assert.match(signInHtml, /Email address/);
  assert.doesNotMatch(signInHtml, /demo student/i);
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

  assert.match(requirementPage, /aster-residence-hall\.jpg/);
  assert.match(requirementPage, /onHousingPreviewChange/);
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
  assert.match(client, /http:\/\/localhost:4000/);
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
  const { selectDashboardEnrollmentAction } = await import(moduleUrl);
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
});

test("typed client wires every resource route and mutation contract", async () => {
  const source = await readFile(
    new URL("../app/lib/api-client.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
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
      data: { legalNameConfirmed: true },
    });
    await client.completeStudentOnboarding(
      { expectedVersion: 2 },
      "complete-12345678",
    );
    await client.getStudentRequirements();
    await client.getStudentRequirement("requirement/1");
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
    await client.signInDemoStudent();
    await client.startGuidedOnboardingDemo();
    await client.signOutDemoStudent();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests[0].url, "http://localhost:4000/v1/student/bootstrap");
  assert.equal(requests[0].init.method, "GET");
  assert.equal(requests[0].init.credentials, "include");

  const requestByPath = new Map(
    requests.map((entry) => [new URL(entry.url).pathname, entry]),
  );
  const expectedPaths = [
    "/v1/student/bootstrap",
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
    "/v1/student/messages",
    "/v1/student/messages/message%2F1/read",
    "/v1/student/documents",
    "/v1/student/documents/upload",
    "/v1/student/documents/document%2F1/confirm-extraction",
    "/v1/student/documents/document%2F1/retry-extraction",
    "/v1/student/assistant/messages",
    "/v1/student/appointments",
    "/v1/student/payments",
    "/v1/student/payments/deposit",
    "/v1/student/profile",
    "/v1/student/help",
    "/v1/admission-offers/offer%2F1/accept",
    "/v1/activity-events/batch",
    "/v1/auth/demo/sign-in",
    "/v1/auth/demo/start-guided-onboarding",
    "/v1/auth/demo/sign-out",
  ];
  for (const path of expectedPaths) {
    assert.ok(requestByPath.has(path), `missing API request for ${path}`);
  }

  assert.equal(requests[2].init.method, "GET");
  const onboardingUpdate = requests.find(
    (entry) =>
      new URL(entry.url).pathname === "/v1/student/onboarding" &&
      entry.init.method === "PUT",
  );
  assert.deepEqual(JSON.parse(onboardingUpdate.init.body), {
    expectedVersion: 1,
    currentStep: "about_you",
    data: { legalNameConfirmed: true },
  });

  assert.equal(
    requestByPath.get("/v1/student/onboarding/complete").init.headers[
      "Idempotency-Key"
    ],
    "complete-12345678",
  );
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

test("onboarding preserves the nine-step order and authoritative boundary actions", async () => {
  const onboarding = await readFile(
    new URL("../app/onboarding/page.tsx", import.meta.url),
    "utf8",
  );
  const expectedOrder = [
    '"offer"',
    '"about_you"',
    '"housing"',
    '"campus_life"',
    '"emergency_contacts"',
    '"other_records"',
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
  assert.match(onboarding, /createDepositPayment/);
  assert.match(onboarding, /completeStudentOnboarding/);
  assert.match(onboarding, /Reload latest saved progress/);
  assert.match(onboarding, /Why we ask/);
  assert.match(onboarding, /function editableOnboardingData/);
  assert.match(onboarding, /delete editableData\.skippedSteps/);
  assert.match(onboarding, /const nextData = editableOnboardingData\(/);
  assert.match(onboarding, /data: editableOnboardingData\(onboarding\.data\)/);
  assert.match(onboarding, /window\.location\.replace\("\/dashboard"\)/);
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
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
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
  assert.match(guard, /window\.location\.replace\("\/onboarding"\)/);
  assert.match(guard, /window\.location\.replace\("\/sign-in"\)/);
  assert.match(shell, /onboarding\.required/);
  assert.match(bootstrapRouter, /initialRoute/);
  assert.match(signIn, /getStudentBootstrap/);
  assert.match(signIn, /signInStudent/);
  assert.match(signIn, /signUpStudent/);
  assert.match(signIn, /name="email"/);
  assert.match(signIn, /name="phone"/);
  assert.match(signIn, /name="password"/);
  assert.match(signIn, /window\.location\.assign\("\/onboarding"\)/);
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
  for (const match of source.matchAll(/href=["'](\/[^"'#?{}]*)["']/g)) {
    assert.ok(allRoutes.has(match[1]), `dead static link: ${match[1]}`);
  }
});
