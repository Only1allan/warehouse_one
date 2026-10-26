import { expect, test } from "@playwright/test";
import { resetAndSignIn } from "./helpers";

test.describe("role home dashboards", () => {
  test("operator: deliveries due today and orders to load", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Deliveries due today" })).toBeVisible();
    await expect(page.getByText("PO 4471 · Kenya Packaging Ltd")).toBeVisible();
    await expect(page.getByText("PO 4472 · SafeWorks East Africa")).toBeVisible();
    await expect(page.getByText("Order 5521 · Mombasa Hardware Ltd")).toBeVisible();
  });

  test("supervisor: exceptions, products below minimum and health", async ({ page }) => {
    await resetAndSignIn(page, "daniel");
    await page.goto("/home");
    await expect(page.getByTestId("count-Open exceptions")).toHaveText("4");
    await expect(page.getByTestId("count-Counts waiting for a decision")).toHaveText("1");
    await expect(page.getByTestId("count-Dead stock")).toHaveText("2");
    await page.getByRole("link", { name: /Open exceptions/ }).click();
    await expect(page).toHaveURL(/\/supervisor$/);
  });

  test("inventory controller: reconciliation and count accuracy", async ({ page }) => {
    await resetAndSignIn(page, "esther");
    await page.goto("/home");
    await expect(page.getByTestId("count-Counts waiting for a decision")).toHaveText("1");
    await expect(page.getByText("Count accuracy 50%")).toBeVisible();
  });

  test("logistics manager: open orders and dispatch accuracy", async ({ page }) => {
    await resetAndSignIn(page, "kevin");
    await page.goto("/home");
    await expect(page.getByTestId("count-Orders waiting to go out")).toHaveText("5");
    await expect(page.getByTestId("count-Dispatch accuracy")).toHaveText("50%");
    await expect(page.getByText("2 dispatches, 1 with a shortfall")).toBeVisible();
  });

  test("each role gets a different navigation", async ({ page }) => {
    const expected: Record<string, { has: string[]; hasNot: string[] }> = {
      amina: { has: ["Ask the copilot", "Safety", "Hands-free", "Receive delivery", "Count a shelf", "Check a load"], hasNot: ["Stock records", "Shipments", "Exceptions"] },
      daniel: { has: ["Operations overview", "Exceptions", "Inventory alerts", "Stock approvals", "Shift handover"], hasNot: ["Receive delivery", "Count a shelf", "Stock records", "Shipments"] },
      esther: { has: ["Stock records", "Count plan", "Cycle count", "Reconciliation"], hasNot: ["Receive delivery", "Check a load", "Exceptions", "Shift handover"] },
      kevin: { has: ["Dispatch accuracy", "Check a load", "Shipments", "Compliance", "Shift handover"], hasNot: ["Count a shelf", "Receive delivery", "Stock records", "Exceptions"] },
    };
    for (const [username, want] of Object.entries(expected)) {
      await resetAndSignIn(page, username);
      await page.goto("/home");
      const nav = page.getByRole("navigation", { name: "Main" }).first();
      for (const label of want.has) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
      for (const label of want.hasNot) await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }
  });
});
