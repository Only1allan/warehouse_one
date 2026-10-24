import { expect, test } from "@playwright/test";
import { resetAndSignIn } from "./helpers";

test.describe("readiness", () => {
  test("lists every model with its state", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/readiness");
    const list = page.getByTestId("model-list");
    await expect(list.locator("li")).toHaveCount(6);
    for (const title of ["Assistant", "Procedure search", "Voice", "Reading documents", "Photo counting"]) {
      await expect(list).toContainText(title);
    }
    await expect(page.getByTestId("prepare-offline")).toBeVisible();
  });

  test("shows the AI status in the header on every screen", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/home");
    await expect(page.getByTestId("ai-status")).toBeVisible();
    await page.getByTestId("ai-status").click();
    await expect(page).toHaveURL(/\/readiness$/);
  });

  test("resetting demo data needs a confirmation, and operators cannot do it", async ({ page }) => {
    await resetAndSignIn(page, "daniel");
    await page.goto("/readiness");
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await expect(page.getByText("Reset all demo data?")).toBeVisible();
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByText("Reset all demo data?")).toHaveCount(0);
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await page.getByRole("button", { name: "Yes, reset" }).click();
    await expect(page.getByTestId("readiness-message")).toContainText("reset to its starting state");

    await resetAndSignIn(page, "amina");
    await page.goto("/readiness");
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await page.getByRole("button", { name: "Yes, reset" }).click();
    await expect(page.getByTestId("readiness-message")).toContainText("Could not reset");
  });
});
