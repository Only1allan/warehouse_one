import { expect, test } from "@playwright/test";
import { resetAndSignIn } from "./helpers";

test.describe("shift handover", () => {
  test("offers recent shifts with activity and shows the numbers beside the summary", async ({ page }) => {
    await resetAndSignIn(page, "daniel");
    await page.goto("/handover");
    const windows = page.getByRole("radiogroup", { name: "Recent shifts with activity" });
    await expect(windows.getByRole("radio").first()).toBeVisible();
    await windows.getByRole("radio", { name: /Afternoon/ }).first().click();
    await page.getByRole("button", { name: "Write the handover" }).click();

    const result = page.getByTestId("handover-result");
    await expect(result).toBeVisible({ timeout: 180_000 });
    await expect(page.getByTestId("handover-prose")).not.toBeEmpty();
    const numbers = page.getByTestId("handover-numbers");
    await expect(numbers).toContainText("Deliveries received");
    await expect(numbers).toContainText("Dispatches with a shortfall");
    await expect(result).toContainText("Forklift F03");
    await expect(result).toContainText("missing 8");
  });

  test("is available to a logistics manager and hidden from an operator", async ({ page }) => {
    await resetAndSignIn(page, "kevin");
    await page.goto("/handover");
    await expect(page.getByRole("heading", { name: "Choose the shift" })).toBeVisible();
    await resetAndSignIn(page, "amina");
    await page.goto("/handover");
    await expect(page.getByTestId("not-available")).toBeVisible();
  });
});
