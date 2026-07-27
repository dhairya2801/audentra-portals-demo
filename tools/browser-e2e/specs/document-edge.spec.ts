import { expect, test } from "@playwright/test";

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
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

test.describe("document misuse through the enrollment UI", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    if (!baseURL) throw new Error("Playwright baseURL is required");
    const url = new URL(baseURL);
    await context.addCookies([
      {
        name: "vv_demo_session",
        value: "demo-session-v2",
        domain: url.hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: url.protocol === "https:",
      },
    ]);
  });

  test("rejects a restaurant menu, then accepts a FAFSA document without retaining fields", async ({
    page,
  }) => {
    await page.goto(
      "/enrollment/requirements/financial-aid-verification",
    );
    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles({
      name: "restaurant-menu.pdf",
      mimeType: "application/pdf",
      buffer: makeTextPdf([
        "Restaurant Menu",
        "Appetizers",
        "Chef Special",
        "Desserts",
      ]),
    });
    await page
      .getByRole("button", { name: "Upload requirement bundle" })
      .click();

    await expect(
      page.getByText("Identified as Other", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/requirement was not advanced automatically/i),
    ).toBeVisible();
    await expect(page.locator(".requirement-upload__result")).toHaveClass(
      /requirement-upload__result--warning/,
    );
    await expect(
      page.getByRole("button", { name: "Confirm selected fields" }),
    ).toHaveCount(0);
    await expect(
      page.locator(".requirement-workspace__action-heading"),
    ).toContainText(/ready/i);

    await fileInput.setInputFiles({
      name: "fafsa-verification.pdf",
      mimeType: "application/pdf",
      buffer: makeTextPdf([
        "Free Application for Federal Student Aid",
        "FAFSA verification worksheet",
      ]),
    });
    await page
      .getByRole("button", { name: "Upload requirement bundle" })
      .click();

    await expect(
      page.getByText("Identified as Financial Aid", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".requirement-workspace__action-heading"),
    ).toContainText(/under review/i);
    await expect(page.locator(".requirement-upload__result")).toHaveClass(
      /requirement-upload__result--success/,
    );
    await expect(
      page.getByRole("button", { name: "Confirm selected fields" }),
    ).toHaveCount(0);
    await expect(page.getByText("must-be-removed-by-policy")).toHaveCount(0);
    await expect(page.getByText("Synthetic sensitive field")).toHaveCount(0);
  });

  test("blocks unsupported and empty files before an upload request", async ({
    page,
  }) => {
    await page.goto(
      "/enrollment/requirements/financial-aid-verification",
    );
    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a supported upload"),
    });
    await expect(
      page.getByRole("listitem").filter({ hasText: "notes.txt" }),
    ).toContainText("Use PDF, JPEG, or PNG.");
    await expect(
      page.getByRole("button", { name: "Upload requirement bundle" }),
    ).toBeDisabled();

    await fileInput.setInputFiles({
      name: "empty.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(0),
    });
    await expect(
      page.getByRole("listitem").filter({ hasText: "empty.pdf" }),
    ).toContainText("This file is empty.");
    await expect(
      page.getByRole("button", { name: "Upload requirement bundle" }),
    ).toBeDisabled();
  });

  test("rejects a file whose claimed PDF type does not match its bytes", async ({
    page,
  }) => {
    await page.goto(
      "/enrollment/requirements/financial-aid-verification",
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: "spoofed-menu.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("Restaurant menu pretending to be a PDF"),
    });
    await page
      .getByRole("button", { name: "Upload requirement bundle" })
      .click();

    await expect(
      page.getByRole("listitem").filter({ hasText: "spoofed-menu.pdf" }),
    ).toContainText(
      "The file contents do not match the selected PDF, JPEG, or PNG type",
    );
    await expect(
      page.getByRole("button", { name: "Retry files needing attention" }),
    ).toBeEnabled();
  });
});
