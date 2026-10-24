import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const response = await request.post("/api/admin/reseed");
  expect(response.ok()).toBe(true);
});

async function enter(page: import("@playwright/test").Page, name: string, value: string) {
  await page.getByRole("textbox", { name: `Received ${name}` }).fill(value);
}

test.describe("receiving", () => {
  test("the 150 versus 142 case shows missing 8 and saves only on confirm", async ({ page }) => {
    await page.goto("/receive");
    await page.getByRole("radio", { name: /PO 4471/ }).click();
    await expect(page.getByText("Corrugated Carton 40x30x30", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm receipt" })).toHaveCount(0);

    await enter(page, "Corrugated Carton 40x30x30", "142");
    await enter(page, "Stretch Wrap Roll", "60");
    await enter(page, "Packing Tape 48mm", "120");

    await expect(page.getByTestId("report-summary")).toContainText("does not match");
    await expect(page.getByTestId("report-lines")).toContainText("expected 150, received 142 (missing 8)");
    await expect(page.locator('[data-status="discrepancy"]').first()).toContainText("Short");

    await page.getByRole("button", { name: "Confirm receipt" }).click();
    await expect(page.getByTestId("receipt-saved")).toContainText("PO 4471");
    await expect(page.getByRole("status").filter({ hasText: "sent to the supervisor" })).toBeVisible();

    await page.getByRole("button", { name: "Receive another delivery" }).click();
    await expect(page.getByRole("radio", { name: /PO 4471/ })).toHaveCount(0);
  });

  test("a matching delivery says everything matches", async ({ page }) => {
    await page.goto("/receive");
    await page.getByRole("radio", { name: /PO 4472/ }).click();
    await enter(page, "Hi-Vis Safety Vest", "80");
    await enter(page, "Safety Helmet", "40");
    await expect(page.getByTestId("report-summary")).toContainText("Everything matches");
    await page.getByRole("button", { name: "Confirm receipt" }).click();
    await expect(page.getByTestId("receipt-saved")).toBeVisible();
    await expect(page.getByText("sent to the supervisor")).toHaveCount(0);
  });

  test("the quantity buttons step the count", async ({ page }) => {
    await page.goto("/receive");
    await page.getByRole("radio", { name: /PO 4472/ }).click();
    const field = page.getByRole("textbox", { name: "Received Safety Helmet" });
    await page.getByRole("button", { name: "Increase Received Safety Helmet" }).click();
    await page.getByRole("button", { name: "Increase Received Safety Helmet" }).click();
    await expect(field).toHaveValue("2");
    await page.getByRole("button", { name: "Decrease Received Safety Helmet" }).click();
    await expect(field).toHaveValue("1");
  });
});
