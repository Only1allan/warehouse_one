import { expect, test, type Page } from "@playwright/test";
import { resetAndSignIn, signInAs } from "./helpers";

async function pickHoseKit(page: Page) {
  await page.goto("/count");
  await page.getByRole("searchbox").fill("hose");
  await page.getByRole("radio", { name: /Hydraulic Hose Kit/ }).click();
}

test.describe("counting", () => {
  test("hides the expected quantity until a count is entered", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await pickHoseKit(page);
    await expect(page.getByTestId("variance-banner")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Counted Hydraulic Hose Kit" }).fill("31");
    await expect(page.getByTestId("variance-banner")).toContainText("Expected 35");
  });

  test("35 expected versus 31 counted shows variance -4 and waits for a decision", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await pickHoseKit(page);
    await page.getByRole("textbox", { name: "Counted Hydraulic Hose Kit" }).fill("31");
    await expect(page.getByTestId("variance-value")).toContainText("Variance −4");
    await page.getByRole("button", { name: "Confirm count" }).click();
    await expect(page.getByTestId("count-saved")).toContainText("A-2-1");
    await expect(page.getByText("Stock has not changed")).toBeVisible();
    await expect(page.getByText("A supervisor or inventory controller must approve any stock adjustment.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Adjust stock/ })).toHaveCount(0);
  });

  test("an inventory controller can adjust stock right after counting", async ({ page }) => {
    await resetAndSignIn(page, "esther");
    await pickHoseKit(page);
    await page.getByRole("textbox", { name: "Counted Hydraulic Hose Kit" }).fill("31");
    await page.getByRole("button", { name: "Confirm count" }).click();
    await page.getByRole("button", { name: "Adjust stock to 31" }).click();
    await expect(page.getByText("Stock adjusted to 31")).toBeVisible();
  });

  test("a supervisor can adjust stock after the count", async ({ page }) => {
    await resetAndSignIn(page, "daniel");
    await pickHoseKit(page);
    await page.getByRole("textbox", { name: "Counted Hydraulic Hose Kit" }).fill("31");
    await page.getByRole("button", { name: "Confirm count" }).click();
    await page.getByRole("button", { name: "Adjust stock to 31" }).click();
    await expect(page.getByText("Stock adjusted to 31")).toBeVisible();
  });

  test("a matching count needs no adjustment", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await pickHoseKit(page);
    await page.getByRole("textbox", { name: "Counted Hydraulic Hose Kit" }).fill("35");
    await expect(page.getByTestId("variance-value")).toContainText("No variance");
    await page.getByRole("button", { name: "Confirm count" }).click();
    await expect(page.getByTestId("count-saved")).toBeVisible();
    await expect(page.getByText("sent to the supervisor")).toHaveCount(0);
  });

  test("the variance reaches the inventory controller's reconciliation list", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await pickHoseKit(page);
    await page.getByRole("textbox", { name: "Counted Hydraulic Hose Kit" }).fill("31");
    await page.getByRole("button", { name: "Confirm count" }).click();
    await expect(page.getByTestId("count-saved")).toBeVisible();
    await signInAs(page, "esther");
    await page.goto("/stock");
    await page.getByRole("tab", { name: "Reconciliation" }).click();
    await expect(page.getByTestId("pending-list")).toContainText("Hydraulic Hose Kit at A-2-1");
  });
});
