// Existing Edward workspace assertions, adapted to the isolated canonical university persona.
// Read-only: never invokes the compact demo reset endpoint.
import { expect, test } from "@playwright/test";

test.describe("Edward conversation workspace", () => {
  test.beforeEach(async ({ context }) => {
    await context.setExtraHTTPHeaders({
      "x-demo-tenant-id": "00000000-0000-7000-8000-000000000003",
      "x-demo-student-id": "ac2fa509-b4e3-402d-900b-ffb8440fc430",
      "x-demo-actor-id": "ac2fa509-b4e3-402d-900b-ffb8440fc430",
      "x-demo-actor-type": "student",
    });
  });

  test("keeps the full Edward workspace in document flow with its own history menu", async ({
    page,
  }) => {
    await page.goto("/edward");

    const workspace = page.getByRole("region", {
      name: "Edward AI student guide",
    });
    await expect(workspace).toBeVisible();
    await expect(page.locator("#edward-panel")).toHaveCount(0);
    await expect(page.locator(".edward-launcher")).toHaveCount(0);
    expect(await workspace.evaluate((element) => getComputedStyle(element).position)).toBe(
      "relative",
    );

    const historyMenu = page.getByRole("button", {
      name: "Open conversation history",
    });
    await expect(historyMenu).toHaveAttribute(
      "aria-controls",
      "edward-conversation-navigation",
    );

    await historyMenu.click();
    await expect(
      page.getByRole("complementary", {
        name: "Edward conversation history",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New conversation", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("This browser tab")).toBeVisible();
  });

  test("preserves the fixed floating assistant on other student pages", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const launcher = page.getByRole("button", { name: "Ask Edward" });
    await expect(launcher).toBeVisible();
    await launcher.click();

    const floatingPanel = page.getByRole("dialog", {
      name: "Edward, your AI assistant",
    });
    await expect(floatingPanel).toBeVisible();
    expect(
      await floatingPanel.evaluate((element) => getComputedStyle(element).position),
    ).toBe("fixed");
    await expect(
      floatingPanel.getByRole("button", { name: "Close Edward" }),
    ).toBeVisible();
    await expect(
      floatingPanel.getByRole("button", { name: "Your conversations" }),
    ).toBeVisible();
  });

  test("keeps the mobile portal menu above the in-flow Edward workspace", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/edward");

    await page
      .getByRole("button", { name: "Open conversation history" })
      .click();
    await page.getByRole("button", { name: "Open navigation" }).click();

    await expect(page.locator("#portal-navigation")).toHaveClass(/open/);
    const stacking = await page.evaluate(() => ({
      portal: Number.parseInt(
        getComputedStyle(document.querySelector("#portal-navigation")!).zIndex,
        10,
      ),
      portalBackdrop: Number.parseInt(
        getComputedStyle(document.querySelector(".nav-scrim")!).zIndex,
        10,
      ),
      workspace: Number.parseInt(
        getComputedStyle(document.querySelector("#edward-workspace")!).zIndex,
        10,
      ),
    }));
    expect(stacking.portal).toBeGreaterThan(stacking.workspace);
    expect(stacking.portalBackdrop).toBeGreaterThan(stacking.workspace);
  });
});

test("floating Edward stops and retries the same request after a transport failure", async ({page,context}) => {
  await context.setExtraHTTPHeaders({"x-demo-tenant-id":"00000000-0000-7000-8000-000000000003","x-demo-student-id":"ac2fa509-b4e3-402d-900b-ffb8440fc430","x-demo-actor-id":"ac2fa509-b4e3-402d-900b-ffb8440fc430","x-demo-actor-type":"student"});
  const requests: {clientMessageId: string}[]=[];
  await page.route("**/v1/student/assistant/messages", async route => {
    requests.push(route.request().postDataJSON());
    if(requests.length===1)await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{code:"TEST_UNAVAILABLE",message:"Test transport interruption"}})});
    else await new Promise(resolve=>setTimeout(resolve,10000)).then(()=>route.abort()).catch(()=>{});
  });
  await page.goto("/dashboard");
  await page.getByRole("button",{name:"Ask Edward",exact:true}).click();
  const panel=page.getByRole("dialog",{name:"Edward, your AI assistant"});
  await panel.getByRole("textbox",{name:"Ask Edward a question"}).fill("Explain my posted balance.");
  await panel.getByRole("button",{name:"Send question"}).click();
  await panel.getByRole("button",{name:"Try again",exact:true}).click();
  await panel.getByRole("button",{name:"Stop waiting",exact:true}).click();
  await expect(panel.getByText(/Stopped waiting/)).toBeVisible();
  expect(requests.length).toBe(2);
  expect(requests[1].clientMessageId).toBe(requests[0].clientMessageId);
});
