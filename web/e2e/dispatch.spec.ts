import { expect, test, type Page } from "@playwright/test";
import { resetAndSignIn, signInAs } from "./helpers";

const load = (page: Page, name: string, value: string) =>
  page.getByRole("textbox", { name: `Loaded ${name}` }).fill(value);

test.describe("dispatch verification", () => {
  test("50 ordered versus 48 loaded alerts: missing 2, and records the shortfall", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/dispatch");
    await page.getByRole("radio", { name: /Order 5521/ }).click();
    await expect(page.getByRole("button", { name: "Confirm dispatch" })).toHaveCount(0);
    await load(page, "Roofing Sheets (pallet of 100)", "48");
    await expect(page.getByTestId("dispatch-summary")).toContainText("Dispatch incomplete");
    await expect(page.getByTestId("dispatch-lines")).toContainText("ordered 50, loaded 48 (missing 2)");
    await page.getByRole("button", { name: "Confirm dispatch" }).click();
    await expect(page.getByTestId("dispatch-saved")).toContainText("Order 5521 dispatched");
    await expect(page.getByRole("status")).toContainText("missing 2");
  });

  test("a complete load matches the order", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/dispatch");
    await page.getByRole("radio", { name: /Order 5521/ }).click();
    await load(page, "Roofing Sheets (pallet of 100)", "50");
    await expect(page.getByTestId("dispatch-summary")).toContainText("matches the order");
    await page.getByRole("button", { name: "Confirm dispatch" }).click();
    await expect(page.getByTestId("dispatch-saved")).toBeVisible();
    await page.getByRole("button", { name: "Check another load" }).click();
    await expect(page.getByRole("radio", { name: /Order 5521/ })).toHaveCount(0);
  });

  test("refuses to load more than the stock on record", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/dispatch");
    await page.getByRole("radio", { name: /Order 5521/ }).click();
    await load(page, "Roofing Sheets (pallet of 100)", "500");
    await page.getByRole("button", { name: "Confirm dispatch" }).click();
    await expect(page.getByRole("alert")).toContainText("Not enough stock");
  });

  test("the logistics manager sees the shortfall in dispatch accuracy", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/dispatch");
    await page.getByRole("radio", { name: /Order 5521/ }).click();
    await load(page, "Roofing Sheets (pallet of 100)", "48");
    await page.getByRole("button", { name: "Confirm dispatch" }).click();
    await expect(page.getByTestId("dispatch-saved")).toBeVisible();

    await signInAs(page, "kevin");
    await page.goto("/shipments");
    await expect(page.getByTestId("shortfalls")).toContainText("Order 5521");
    await expect(page.getByTestId("meter-Dispatches loaded in full")).toContainText("33.3%");
  });

  test("the logistics manager can verify a dispatch too", async ({ page }) => {
    await resetAndSignIn(page, "kevin");
    await page.goto("/dispatch");
    await page.getByRole("radio", { name: /Order 5522/ }).click();
    await load(page, "Cement 50kg (pallet of 40 bags)", "30");
    await load(page, "PVC Pipe 110mm (bundle)", "20");
    await expect(page.getByTestId("dispatch-summary")).toContainText("matches");
  });
});
