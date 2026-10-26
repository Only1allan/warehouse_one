import { expect, test } from "@playwright/test";
import { navFor } from "../lib/auth/capabilities";
import { resetAndSignIn, trackExternalRequests } from "./helpers";

test.describe("signed-in shell", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSignIn(page, "amina");
  });

  test("shows the 100% local badge on every operator screen", async ({ page }) => {
    for (const path of ["/home", "/ask", "/safety", "/voice", "/receive", "/count", "/dispatch", "/readiness"]) {
      await page.goto(path);
      await expect(page.getByTestId("local-badge")).toBeVisible();
      await expect(page.getByTestId("local-badge")).toContainText("100% local");
    }
  });

  test("shows the operator's navigation with large touch targets", async ({ page }) => {
    await page.goto("/home");
    const nav = page.getByRole("navigation", { name: "Main" }).first();
    for (const item of navFor("operator")) {
      const link = nav.getByRole("link", { name: item.label });
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${item.href}$`));
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Stock records" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Shipments" })).toHaveCount(0);
  });

  test("the shift choice persists across navigation and reload", async ({ page }) => {
    await page.goto("/home");
    await page.getByLabel("Shift").first().selectOption("s-night");
    await page.getByRole("link", { name: "Count a shelf" }).first().click();
    await expect(page.getByLabel("Shift").first()).toHaveValue("s-night");
    await page.reload();
    await expect(page.getByLabel("Shift").first()).toHaveValue("s-night");
  });

  test("makes no request to an external origin on any operator screen", async ({ page }) => {
    const external = trackExternalRequests(page);
    for (const path of ["/home", "/ask", "/receive", "/count", "/dispatch", "/readiness"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(external).toEqual([]);
  });

  test("defines the status colour tokens and uses the bundled Poppins", async ({ page }) => {
    await page.goto("/home");
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return ["--ok-ink", "--warn-ink", "--bad-ink", "--signal"].map((n) => style.getPropertyValue(n).trim());
    });
    for (const value of tokens) expect(value).not.toBe("");
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((f) => f.family.toLowerCase().includes("poppins") && f.status === "loaded");
    });
    expect(loaded).toBe(true);
  });

  test("works on a phone-sized screen with the bottom navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/home");
    await expect(page.getByTestId("local-badge")).toBeVisible();
    const bottom = page.getByRole("navigation", { name: "Main" }).last();
    await expect(bottom.getByRole("link", { name: "Receive delivery" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
