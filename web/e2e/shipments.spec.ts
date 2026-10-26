import { expect, test } from "@playwright/test";
import { resetAndSignIn } from "./helpers";

test.describe("logistics manager workspace", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSignIn(page, "kevin");
  });

  test("dispatch accuracy shows the rate and the shortfall behind it", async ({ page }) => {
    await page.goto("/accuracy");
    await expect(page.getByTestId("meter-Dispatches loaded in full")).toContainText("50%");
    await expect(page.getByTestId("meter-Dispatches loaded in full")).toContainText("1 of 2 dispatches matched the order");
    await expect(page.getByTestId("shortfalls")).toContainText("Order 5520 · Machakos Retail");
    await expect(page.getByTestId("shortfalls")).toContainText("loaded 18 of 20, missing 2");
  });

  test("process compliance is computed from the records", async ({ page }) => {
    await page.goto("/compliance");
    await expect(page.getByTestId("meter-Receipts with no discrepancy")).toContainText("1 of 2 receipts");
    await expect(page.getByTestId("meter-Counts with no variance")).toContainText("1 of 2 counts");
    await expect(page.getByTestId("open-exceptions")).toContainText("Equipment");
  });

  test("shipment visibility lists every order with its status", async ({ page }) => {
    await page.goto("/shipments");
    const table = page.getByTestId("shipment-table");
    await expect(table).toContainText("5521");
    await expect(table).toContainText("Waiting to load");
    await expect(table).toContainText("Dispatched, short 2");
    await expect(table).toContainText("Dispatched in full");
  });
});
