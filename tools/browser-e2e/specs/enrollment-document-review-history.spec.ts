import { expect, test, type Browser, type Page } from "@playwright/test";

const studentReference =
  process.env.E2E_DOCUMENT_STUDENT_REFERENCE?.trim() ||
  "11000000-0000-7000-8000-000000000101";
const staffEmail = "priya.shah@aster.example.edu";
const initialUiTimeout = 60_000;

function requiredEnvironment(name: "E2E_STAFF_PASSWORD" | "E2E_STAFF_INVITATION_CODE") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the UI-only document journey`);
  return value;
}

function makeTextPdf(lines: readonly string[]) {
  const textCommands = lines
    .map((line, index) => {
      const escaped = line
        .replaceAll("\\", "\\\\")
        .replaceAll("(", "\\(")
        .replaceAll(")", "\\)");
      return `${index === 0 ? "" : "0 -24 Td\n"}(${escaped}) Tj`;
    })
    .join("\n");
  const stream = `BT\n/F1 18 Tf\n72 720 Td\n${textCommands}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function dismissFirstVisitOnboarding(page: Page, timeout = 8_000) {
  const deferOnboarding = page.getByRole("button", { name: "Remind me later" });
  if (await deferOnboarding.isVisible({ timeout }).catch(() => false)) {
    await deferOnboarding.click();
    await expect(deferOnboarding).toBeHidden();
  }
}

async function clickAfterDeferringOnboarding(
  page: Page,
  button: ReturnType<Page["getByRole"]>,
  responseMatches: (response: import("@playwright/test").Response) => boolean,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await dismissFirstVisitOnboarding(page, 5_000);
    const responsePromise = page.waitForResponse(responseMatches, { timeout: 10_000 });
    try {
      await button.click({ timeout: 7_000 });
      return await responsePromise;
    } catch (error) {
      void responsePromise.catch(() => undefined);
      const reminder = page.getByRole("button", { name: "Remind me later" });
      if (await reminder.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await dismissFirstVisitOnboarding(page, 5_000);
        continue;
      }
      throw error;
    }
  }
  throw new Error("The onboarding reminder kept preventing the visible action.");
}

async function clickVisibleAfterDeferringOnboarding(
  page: Page,
  button: ReturnType<Page["getByRole"]>,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await dismissFirstVisitOnboarding(page, 5_000);
    try {
      await button.click({ timeout: 7_000 });
      return;
    } catch (error) {
      const reminder = page.getByRole("button", { name: "Remind me later" });
      if (await reminder.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await dismissFirstVisitOnboarding(page, 5_000);
        continue;
      }
      throw error;
    }
  }
  throw new Error("The onboarding reminder kept preventing the visible action.");
}

async function createStaffSessionThroughUi(page: Page) {
  const password = requiredEnvironment("E2E_STAFF_PASSWORD");
  const accessCode = requiredEnvironment("E2E_STAFF_INVITATION_CODE");
  await page.goto("/staff");
  await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible({
    timeout: initialUiTimeout,
  });

  const workspaceHeading = page.getByRole("heading", { name: /Today.*enrollment work/ });
  if (process.env.E2E_STAFF_ACCOUNT_EXISTS === "true") {
    const signInForm = page.locator("form.staff-auth-form");
    await signInForm.locator('input[name="email"]').fill(staffEmail);
    await signInForm.locator('input[name="password"]').fill(password);
    const signInResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/v1/auth/staff/sign-in" &&
        response.request().method() === "POST",
    );
    await signInForm.getByRole("button", { name: "Sign in", exact: true }).click();
    expect((await signInResponsePromise).status()).toBe(200);
    await expect(workspaceHeading).toBeVisible({ timeout: initialUiTimeout });
    return;
  }

  const createAccountTab = page.getByRole("tab", { name: "Create account" });
  await expect(createAccountTab).toBeVisible();
  await createAccountTab.click({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Create staff account" })).toBeVisible();
  const createAccountForm = page.locator("form.staff-auth-form");
  await createAccountForm.locator('input[name="email"]').fill(staffEmail);
  await createAccountForm.locator('input[name="password"]').fill(password);
  await createAccountForm.locator('input[name="passwordConfirmation"]').fill(password);
  await createAccountForm.locator('input[name="institutionAccessCode"]').fill(accessCode);
  const signUpResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/v1/auth/staff/sign-up" &&
      response.request().method() === "POST",
  );
  await createAccountForm
    .getByRole("button", { name: "Create staff account", exact: true })
    .click();
  expect((await signUpResponsePromise).status()).toBe(201);
  await expect(workspaceHeading).toBeVisible({
    timeout: initialUiTimeout,
  });
}

async function createStudentSessionThroughUi(page: Page) {
  await page.goto("/sign-in");
  const demoPanel = page.getByRole("heading", { name: "Log in as demo student" })
    .locator("xpath=ancestor::section[1]");
  await expect(demoPanel).toBeVisible({ timeout: initialUiTimeout });
  await demoPanel.getByLabel("Student ID").fill(studentReference);
  await demoPanel.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/(?:dashboard|enrollment|onboarding)/, {
    timeout: initialUiTimeout,
  });
  await dismissFirstVisitOnboarding(page);
}

async function uploadFromRequirement(page: Page, fileName: string, marker: string) {
  await page.goto("/enrollment/requirements/immunization-upload");
  await expect(page.getByRole("heading", { level: 1, name: /immunization/i })).toBeVisible({
    timeout: initialUiTimeout,
  });
  await dismissFirstVisitOnboarding(page, 10_000);
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeAttached();
  await fileInput.setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: makeTextPdf([
      "Audentra browser acceptance immunization record",
      marker,
      "Synthetic data only",
    ]),
  });
  await dismissFirstVisitOnboarding(page, 2_000);
  const submitFiles = page.getByRole("button", { name: /^(?:Submit files|Send to Aster)$/ });
  await expect(submitFiles).toBeVisible();
  await expect(submitFiles).toBeEnabled();
  const uploadResponse = await clickAfterDeferringOnboarding(
    page,
    submitFiles,
    (response) =>
      new URL(response.url()).pathname === "/v1/student/documents/upload" &&
      response.request().method() === "POST",
  );
  expect(uploadResponse.ok()).toBeTruthy();
  await expect(page.getByText("In review", { exact: true }).first()).toBeVisible();
}

async function openDocumentDecisionFromTaskBoard(page: Page, fileName: string) {
  const realtimeNotice = page.getByRole("status").filter({
    hasText: /document ready for review/i,
  }).first();
  if (await realtimeNotice.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await realtimeNotice.getByRole("button", { name: "Open" }).click();
    const realtimeDialog = page.getByRole("dialog", { name: "Enrollment action details" });
    await expect(realtimeDialog).toBeVisible();
    await realtimeDialog.getByRole("button", { name: "Next Step", exact: true }).click();
    const selector = realtimeDialog.getByLabel("Uploaded file");
    if (await selector.locator("option", { hasText: fileName }).count()) return realtimeDialog;
    await realtimeDialog.getByRole("button", { name: "Close enrollment action details" }).click();
  }

  await page
    .locator("aside.staff-sidebar--workspace:visible")
    .getByRole("navigation", { name: "Staff workspace" })
    .getByRole("button", { name: "Task board" })
    .click();
  await expect(page.getByRole("heading", { name: "Task board" })).toBeVisible();
  await page.getByLabel("Task type").selectOption("document_review");
  await page.getByPlaceholder("Search task, key, student, owner, or team").fill("Jordan Ellis");

  const cards = page.locator(".staff-work-card");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    // The staff workspace polls itself. Wait for that rendered refresh rather
    // than clicking the unrelated global or realtime-notice Refresh buttons.
    await page.waitForTimeout(1_000);
    const count = await cards.count();
    for (let index = 0; index < count; index += 1) {
      await cards.nth(index).click();
      const dialog = page.getByRole("dialog", { name: "Enrollment action details" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Next Step", exact: true }).click();
      const selector = dialog.getByLabel("Uploaded file");
      if (await selector.locator("option", { hasText: fileName }).count()) return dialog;
      await dialog.getByRole("button", { name: "Close enrollment action details" }).click();
    }
  }
  throw new Error(`No visible document-review task contained ${fileName}`);
}

async function selectUploadedFile(dialog: ReturnType<Page["getByRole"]>, fileName: string) {
  const selector = dialog.getByLabel("Uploaded file");
  const option = selector.locator("option").filter({ hasText: fileName }).first();
  await expect(option).toBeAttached();
  const value = await option.getAttribute("value");
  if (!value) throw new Error(`The visible option for ${fileName} has no value`);
  await selector.selectOption(value);
}

async function newPage(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL });
  return { context, page: await context.newPage() };
}

test.describe("UI-only enrollment document decision cycle", () => {
  test.setTimeout(420_000);

  test("uploads, rejects with a visible reason, replaces, approves, and retains history", async ({
    browser,
    baseURL,
  }) => {
    const run = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const firstFile = `immunization-${run}.pdf`;
    const replacementFile = `immunization-${run}-replacement.pdf`;
    const rejectionNote = `The student name is cut off in ${firstFile}. Upload a complete page.`;

    const staff = await newPage(browser, baseURL);
    const student = await newPage(browser, baseURL);
    try {
      await createStaffSessionThroughUi(staff.page);
      await createStudentSessionThroughUi(student.page);

      await uploadFromRequirement(student.page, firstFile, `initial-${run}`);
      const rejectionDialog = await openDocumentDecisionFromTaskBoard(staff.page, firstFile);
      await selectUploadedFile(rejectionDialog, firstFile);
      await rejectionDialog.getByLabel("Request changes", { exact: true }).check();
      const reasonSelect = rejectionDialog.getByLabel("Reason for requested changes");
      await reasonSelect.selectOption({ index: 1 });
      const reasonLabel = await reasonSelect.locator("option:checked").textContent();
      expect(reasonLabel?.trim()).toBeTruthy();
      await expect(rejectionDialog.getByLabel(/Internal staff note/)).toHaveCount(0);
      await rejectionDialog.getByLabel("Student-facing decision note").fill(rejectionNote);
      await rejectionDialog.getByLabel("Send the student an inbox notification").check();
      const rejectResponse = staff.page.waitForResponse(
        (response) =>
          /\/v1\/staff\/documents\/[^/]+\/decision$/.test(new URL(response.url()).pathname) &&
          response.request().method() === "POST",
      );
      await rejectionDialog.getByRole("button", { name: "Request changes" }).click();
      expect((await rejectResponse).ok()).toBeTruthy();
      await expect(rejectionDialog.getByText(/reason.*visible to the student/i)).toBeVisible();

      await student.page.goto("/enrollment/requirements/immunization-upload");
      await clickVisibleAfterDeferringOnboarding(
        student.page,
        student.page.getByRole("tab", { name: /History/ }),
      );
      const rejectionHistory = student.page.locator(".requirement-history-list > li").filter({
        hasText: rejectionNote,
      });
      await expect(rejectionHistory).toContainText(reasonLabel!.trim());

      await student.page.goto("/profile?section=documents");
      await clickVisibleAfterDeferringOnboarding(
        student.page,
        student.page.getByRole("button", { name: "See what to fix" }),
      );
      const rejectionPanel = student.page.getByLabel("Why it came back");
      await expect(rejectionPanel.getByText(rejectionNote, { exact: true })).toBeVisible();
      await expect(rejectionPanel.getByText(reasonLabel!.trim(), { exact: true })).toBeVisible();
      await expect(student.page.getByLabel(`Decision history for ${firstFile}`)).toBeVisible();
      await clickVisibleAfterDeferringOnboarding(
        student.page,
        student.page.getByRole("link", { name: /Open the step/ }),
      );

      await uploadFromRequirement(student.page, replacementFile, `replacement-${run}`);
      await rejectionDialog
        .getByRole("button", { name: "Close enrollment action details" })
        .click();
      const approvalDialog = await openDocumentDecisionFromTaskBoard(staff.page, replacementFile);
      await selectUploadedFile(approvalDialog, replacementFile);
      await approvalDialog.getByLabel("Approve document", { exact: true }).check();
      await approvalDialog
        .getByLabel("Student-facing decision note")
        .fill("Replacement is complete and accepted.");
      const approveResponse = staff.page.waitForResponse(
        (response) =>
          /\/v1\/staff\/documents\/[^/]+\/decision$/.test(new URL(response.url()).pathname) &&
          response.request().method() === "POST",
      );
      await approvalDialog.getByRole("button", { name: "Approve document" }).click();
      expect((await approveResponse).ok()).toBeTruthy();
      await expect(approvalDialog.getByText(/Document accepted/)).toBeVisible();

      await student.page.goto("/enrollment/requirements/immunization-upload");
      await clickVisibleAfterDeferringOnboarding(
        student.page,
        student.page.getByRole("tab", { name: /History/ }),
      );
      await expect(
        student.page.locator(".requirement-history-list > li").filter({
          hasText: "Replacement is complete and accepted.",
        }),
      ).toBeVisible();
      await expect(
        student.page.locator(".requirement-history-list > li").filter({ hasText: rejectionNote }),
      ).toBeVisible();

      await student.page.goto("/profile?section=documents");
      const acceptedRow = student.page.getByRole("button", { name: /immunization.*accepted/i }).first();
      await expect(acceptedRow).toBeVisible();
      await clickVisibleAfterDeferringOnboarding(student.page, acceptedRow);
      await expect(student.page.getByLabel(`Decision history for ${firstFile}`)).toContainText(rejectionNote);
      await expect(student.page.getByLabel(`Decision history for ${replacementFile}`)).toContainText(
        "Replacement is complete and accepted.",
      );
    } finally {
      await Promise.all([staff.context.close(), student.context.close()]);
    }
  });
});
