import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { demoApiBaseUrl } from "../support/demo-session";

/**
 * Staff identity, adviser relationships and person-bound booking, seen through
 * the real portals against the synthetic university (tenant aster-demo).
 *
 * Runs only when the API's default tenant holds the deployed staff side —
 * i.e. after `npm run audentra:tenant -- demo && npm run audentra:deploy` in
 * Audentra-university-explorer. Otherwise every test skips with a reason.
 *
 *   E2E_BASE_URL=http://localhost:3000 E2E_API_BASE_URL=http://localhost:4000 \
 *     npx playwright test tools/browser-e2e/specs/staff-advising.spec.ts
 */

const shotDir = process.env.E2E_SCREENSHOT_DIR?.trim() || resolve("test-results", "staff-advising");
mkdirSync(shotDir, { recursive: true });
const shot = (page: Page, name: string) =>
  page.screenshot({ path: resolve(shotDir, `${name}.png`), fullPage: true });

async function syntheticUniversityDeployed(page: Page) {
  const response = await page.request.get(`${demoApiBaseUrl}/v1/auth/demo/staff/directory?q=Larkspur`);
  if (!response.ok()) return false;
  const body = (await response.json()) as { items: Array<{ name: string; title: string | null }> };
  return body.items.some((entry) => entry.name === "Elena Larkspur" && entry.title !== null);
}

async function openStaffAs(page: Page, query: string, name: string) {
  await page.goto("/staff");
  const panel = page.getByRole("region", { name: "Log in as synthetic staff" });
  await expect(panel).toBeVisible();
  await panel.getByRole("searchbox").fill(query);
  await panel.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole("button", { name: new RegExp(name) }).first()).toBeVisible();
}

async function openMyDesk(page: Page) {
  await page
    .locator("aside.staff-sidebar--workspace:visible")
    .getByRole("navigation", { name: "Staff workspace" })
    .getByRole("button", { name: /My desk/i })
    .click();
  await expect(page.getByRole("heading", { name: "My desk", exact: true })).toBeVisible();
}

async function signOutStaff(page: Page) {
  await page.request.post(`${demoApiBaseUrl}/v1/auth/staff/sign-out`);
  await page.context().clearCookies();
}

async function openStudent(page: Page, ref: string) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  const panel = page.getByRole("region", { name: "Log in as demo student" });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Student ID").fill(ref);
  await panel.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/(dashboard|onboarding|enrollment)/, { timeout: 30_000 });
}

test.describe("staff advising and demo staff login", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !(await syntheticUniversityDeployed(page)),
      "The synthetic university's staff side is not deployed to the API's default tenant",
    );
  });

  test("the overloaded adviser sees her own caseload, calendar and gaps", async ({ page }) => {
    await openStaffAs(page, "Larkspur", "Elena Larkspur");
    await openMyDesk(page);
    const identity = page.getByRole("region", { name: "Who you are" });
    await expect(identity).toContainText("Elena Larkspur");
    await expect(identity).toContainText("Academic Adviser · Academic Advising");
    await expect(identity).toContainText(/over its cap: 126 advisees against 110/);
    await expect(identity).toContainText(/no open appointment slot in the next two weeks/);
    const metrics = page.getByRole("region", { name: "Your numbers" });
    await expect(metrics).toContainText("126");
    await expect(metrics).toContainText("/ 110");
    await expect(page.getByRole("heading", { name: "My caseload" })).toBeVisible();
    await expect(page.locator(".staff-desk-table tbody tr")).toHaveCount(126);
    await shot(page, "01-elena-larkspur-my-desk");
    await signOutStaff(page);
  });

  test("the underutilized adviser has spare slots; the ordinary adviser is unremarkable", async ({ page }) => {
    await openStaffAs(page, "Calderwood", "Ximena Calderwood");
    await openMyDesk(page);
    const metrics = page.getByRole("region", { name: "Your numbers" });
    await expect(metrics.getByText("Open slots · 14 days")).toBeVisible();
    await expect(metrics).toContainText("51");
    await expect(page.getByRole("region", { name: "Who you are" })).not.toContainText("over its cap");
    await shot(page, "02-ximena-calderwood-my-desk");
    await signOutStaff(page);

    await openStaffAs(page, "Dunmire", "Hana Dunmire");
    await openMyDesk(page);
    await expect(page.getByRole("region", { name: "Who you are" })).toContainText("Hana Dunmire");
    await expect(page.getByRole("region", { name: "Your numbers" })).toContainText("90");
    await shot(page, "03-hana-dunmire-my-desk");
    await signOutStaff(page);
  });

  test("the adviser who is falling behind sees stale work and unclosed appointments", async ({ page }) => {
    await openStaffAs(page, "Jessamy", "Vera Jessamy");
    await openMyDesk(page);
    const identity = page.getByRole("region", { name: "Who you are" });
    await expect(identity).toContainText(/past appointments have not been closed out/);
    await expect(page.getByRole("heading", { name: "Needs an outcome" })).toBeVisible();
    await shot(page, "04-vera-jessamy-my-desk");
    await signOutStaff(page);
  });

  test("the director sees the team, the departed adviser's orphaned caseload and the leave gap", async ({ page }) => {
    await openStaffAs(page, "Hartigan", "Leandro Hartigan");
    await openMyDesk(page);
    await expect(page.getByRole("heading", { name: "My team" })).toBeVisible();
    const team = page.getByRole("region", { name: "My team" });
    await expect(team).toContainText(/students are still assigned to an adviser who has left/);
    await expect(team).toContainText(/have an adviser on leave with no cover/);
    await expect(team).toContainText("Quentin Zephyrine");
    await expect(team).toContainText("Departed · students still assigned");
    await expect(team).toContainText("Junia Pemberwell");
    await expect(team).toContainText("On leave · caseload not covered");
    await expect(team).toContainText("Elena Larkspur");
    await expect(team).toContainText("Over caseload cap");
    await shot(page, "05-leandro-hartigan-team");
    await signOutStaff(page);
  });

  test("a person on leave can sign in and is told what it means; a departed person cannot", async ({ page }) => {
    await openStaffAs(page, "Pemberwell", "Junia Pemberwell");
    await openMyDesk(page);
    await expect(page.getByRole("region", { name: "Who you are" })).toContainText(/You are on leave until/);
    await shot(page, "06-junia-pemberwell-on-leave");
    await signOutStaff(page);

    await page.goto("/staff");
    const panel = page.getByRole("region", { name: "Log in as synthetic staff" });
    await panel.getByRole("searchbox").fill("Zephyrine");
    const departed = panel.getByRole("button", { name: /^Quentin Zephyrine/ });
    await expect(departed).toBeDisabled();
    await expect(panel).toContainText("departed");
    await shot(page, "07-departed-cannot-sign-in");
  });

  test("a student sees their adviser and books a real slot, then cancels it", async ({ page }) => {
    // SYN-000013 belongs to Ximena Calderwood, who has open slots.
    await openStudent(page, "SYN-000013");
    await page.goto("/dashboard");
    await expect(page.getByText("Academic adviser", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ximena Calderwood" })).toBeVisible();
    await shot(page, "08-student-dashboard-adviser");

    await page.goto("/appointments");
    const adviser = page.getByRole("region", { name: "Your adviser" }).or(page.locator("section").filter({ has: page.getByRole("heading", { name: "Your adviser" }) }));
    await expect(adviser.first()).toContainText("Ximena Calderwood");
    await page.getByRole("button", { name: /Book time with Ximena/ }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText("Your academic adviser");
    await expect(drawer).toContainText("Ximena Calderwood");
    const firstTime = drawer.getByRole("radio").first();
    await expect(firstTime).toBeVisible();
    await firstTime.click();
    await drawer.getByLabel("What’s it about?").fill("Course plan for the fall");
    await shot(page, "09-student-booking-slots");
    const booking = page.waitForResponse((response) => new URL(response.url()).pathname === "/v1/student/appointments" && response.request().method() === "POST");
    await drawer.getByRole("button", { name: "Book this time" }).click();
    expect((await booking).status()).toBe(201);
    await expect(drawer).toContainText(/Booked ·/);
    await expect(drawer).toContainText("Ximena Calderwood");
    await drawer.getByRole("button", { name: "Done" }).click();

    const row = page.locator(".appointment-row").filter({ hasText: "Course plan for the fall" }).first();
    await expect(row).toContainText("Ximena Calderwood");
    await row.getByRole("button", { name: /Academic advising/ }).click();
    const detail = page.getByRole("dialog");
    await expect(detail).toContainText("Ximena Calderwood");
    await detail.getByRole("button", { name: "Cancel this conversation" }).click();
    const cancel = page.waitForResponse((response) => /\/v1\/student\/appointments\/[^/]+\/cancel$/.test(new URL(response.url()).pathname));
    await detail.getByRole("button", { name: "Yes, cancel it" }).click();
    expect((await cancel).status()).toBe(200);
    await expect(page.locator(".appointment-row").filter({ hasText: "Course plan for the fall" }).first()).toContainText("Cancelled");
    await shot(page, "10-student-cancelled");
  });

  test("students of the overloaded, on-leave and departed advisers are told the truth", async ({ page }) => {
    await openStudent(page, "SYN-000023"); // Elena Larkspur — no open slots
    await page.goto("/appointments");
    await expect(page.getByText(/has no open appointment slots in the next two weeks/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Book time with/ })).toHaveCount(0);
    await shot(page, "11-student-overloaded-adviser");

    await openStudent(page, "SYN-000039"); // Junia Pemberwell — on leave
    await page.goto("/appointments");
    await expect(page.getByText(/is on leave/)).toBeVisible();
    await shot(page, "12-student-adviser-on-leave");

    await openStudent(page, "SYN-000034"); // Quentin Zephyrine — departed (an onboarded student of his)
    await page.goto("/appointments");
    await expect(page.getByText(/is no longer with the university/)).toBeVisible();
    await shot(page, "13-student-adviser-departed");
  });
});
