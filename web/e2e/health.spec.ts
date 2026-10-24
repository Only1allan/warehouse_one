import { expect, test } from "@playwright/test";
import { resetAndSignIn } from "./helpers";

for (const username of ["daniel", "esther", "kevin"]) {
  test(`inventory health is available to ${username}`, async ({ page }) => {
    await resetAndSignIn(page, username);
    await page.goto("/health");
    await expect(page.getByTestId("health-list")).toBeVisible();
    await expect(page.getByTestId("health-count-all")).not.toHaveText("0");
  });
}

test.describe("inventory health", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSignIn(page, "daniel");
    await page.goto("/health");
  });

  test("shows a finding in every category with a fixed recommendation", async ({ page }) => {
    for (const id of ["stockout", "dead", "slow", "overstock"]) {
      await expect(page.getByTestId(`health-count-${id}`)).not.toHaveText("0");
    }
    await expect(page.getByTestId("health-list")).toContainText("Product P-324 has not moved in");
    await expect(page.getByTestId("health-list")).toContainText("Consider promotion or transfer.");
    await expect(page.getByTestId("health-list")).toContainText("Reorder now.");
  });

  test("filters by category", async ({ page }) => {
    await page.getByRole("radio", { name: /Dead stock/ }).click();
    const items = page.getByTestId("health-list").locator("li");
    await expect(items.first()).toHaveAttribute("data-category", "dead");
    await expect(page.getByTestId("health-list")).not.toContainText("Reorder now.");
    await page.getByRole("radio", { name: /Overstock/ }).click();
    await expect(page.getByTestId("health-list")).toContainText("Stretch Wrap Roll");
  });

  test("notes a delivery that is already on the way", async ({ page }) => {
    await page.getByRole("radio", { name: /Stockout risk/ }).click();
    await expect(page.getByTestId("health-list")).toContainText("expected on PO 4472");
  });
});
