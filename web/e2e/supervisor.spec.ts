import { expect, test } from "@playwright/test";
import { resetAndSignIn, signInAs } from "./helpers";

test.describe("exceptions", () => {
  test("lists exceptions of every kind and filters them", async ({ page }) => {
    await resetAndSignIn(page, "daniel");
    await page.goto("/supervisor");
    const list = page.getByTestId("exception-list");
    await expect(list.locator("li[data-kind]")).toHaveCount(4);
    await page.getByRole("radio", { name: "Equipment" }).click();
    await expect(list.locator("li[data-kind]")).toHaveCount(1);
    await expect(list).toContainText("Forklift F03");
    await page.getByRole("radio", { name: "All" }).click();
    await page.getByLabel("Filter by shift").selectOption("s-afternoon");
    await expect(list.locator("li[data-kind]")).toHaveCount(2);
  });

  test("a row opens to the record behind it", async ({ page }) => {
    await resetAndSignIn(page, "daniel");
    await page.goto("/supervisor");
    await page.getByTestId("exception-list").locator("li", { hasText: "missing 8" }).locator("summary").click();
    await expect(page.getByText("Receipt 2 for PO 4470")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Corrugated Carton 60x40x40 (100202)" })).toBeVisible();
  });

  test("anyone can report an equipment issue and it reaches the list", async ({ page }) => {
    await resetAndSignIn(page, "daniel");
    await page.goto("/supervisor");
    await page.getByTestId("report-issue").getByLabel("Equipment", { exact: true }).fill("Forklift F01");
    await page.getByLabel("What is wrong").fill("Brakes feel soft");
    await page.getByRole("button", { name: "Report issue" }).click();
    await expect(page.getByTestId("exception-list")).toContainText("Forklift F01: Brakes feel soft");
  });

  test("exceptions belong to the supervisor; other roles report through their own screens", async ({ page }) => {
    for (const username of ["esther", "kevin", "amina"]) {
      await resetAndSignIn(page, username);
      await page.goto("/supervisor");
      await expect(page.getByTestId("not-available")).toBeVisible();
    }
  });

  test("an operator reports an equipment issue from their home and the supervisor sees it", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/home");
    const form = page.getByTestId("report-issue");
    await form.getByLabel("Equipment", { exact: true }).fill("Conveyor C02");
    await form.getByLabel("What is wrong").fill("Belt slipping");
    await form.getByRole("button", { name: "Report issue" }).click();
    await expect(form.getByRole("status")).toContainText("Conveyor C02 reported");
    await signInAs(page, "daniel");
    await page.goto("/supervisor");
    await expect(page.getByTestId("exception-list")).toContainText("Conveyor C02: Belt slipping");
  });
});
