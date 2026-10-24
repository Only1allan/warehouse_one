import { expect, test } from "@playwright/test";
import { resetAndSignIn } from "./helpers";

test.describe("stock records and reconciliation", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSignIn(page, "esther");
  });

  test("searches products and shows locations, movements and orders", async ({ page }) => {
    await page.goto("/stock");
    await page.getByRole("searchbox").fill("generator");
    const row = page.getByTestId("stock-list").locator("li").first();
    await expect(row).toContainText("Portable Generator 5kW");
    await expect(row).toContainText("43");
    await row.locator("summary").click();
    const detail = page.getByTestId("stock-detail");
    await expect(detail).toContainText("B-4-2");
    await expect(detail).toContainText("Incoming on PO 4473");
    await expect(detail).toContainText("Order 5523 for Nakuru Power Co");
    await expect(detail.getByRole("heading", { name: "Recent movements" })).toBeVisible();
  });

  test("filters by category", async ({ page }) => {
    await page.goto("/stock");
    await page.getByLabel("Category").selectOption("Chemicals");
    await expect(page.getByTestId("stock-list").locator("li").first()).toContainText(/Cleaner|Degreaser|Oil|Absorbent/);
    await expect(page.getByTestId("stock-list")).not.toContainText("Portable Generator");
  });

  test("approving a variance adjusts stock and resolves the count", async ({ page }) => {
    await page.goto("/stock");
    await page.getByRole("tab", { name: "Reconciliation" }).click();
    const pending = page.getByTestId("pending-list");
    await expect(pending).toContainText("Bearing 6205 at A-3-1");
    await expect(pending).toContainText("Variance −4");
    await page.getByRole("button", { name: "Approve: set stock to 176" }).click();
    await expect(pending).toContainText("Every count with a variance has been reconciled");
    await expect(page.getByText("Stock adjusted")).toBeVisible();

    await page.getByRole("tab", { name: "Stock records" }).click();
    await page.getByRole("searchbox").fill("bearing");
    await expect(page.getByTestId("stock-list").locator("li").first()).toContainText("176");
  });

  test("declining keeps stock and records the reason", async ({ page }) => {
    await page.goto("/stock");
    await page.getByRole("tab", { name: "Reconciliation" }).click();
    await page.getByLabel("Reason for declining").fill("Recount tomorrow");
    await page.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByTestId("pending-list")).toContainText("Every count with a variance has been reconciled");
    await expect(page.getByText("Recount tomorrow")).toBeVisible();
    await page.getByRole("tab", { name: "Stock records" }).click();
    await page.getByRole("searchbox").fill("bearing");
    await expect(page.getByTestId("stock-list").locator("li").first()).toContainText("180");
  });
});
