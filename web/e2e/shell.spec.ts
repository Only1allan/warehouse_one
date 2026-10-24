import { expect, test } from "@playwright/test";

const destinations = [
  { path: "/ask", label: "Ask" },
  { path: "/receive", label: "Receive" },
  { path: "/count", label: "Count" },
  { path: "/supervisor", label: "Supervisor" },
];

test.describe("app shell", () => {
  test("shows the 100% local badge on every screen", async ({ page }) => {
    for (const d of destinations) {
      await page.goto(d.path);
      await expect(page.getByTestId("local-badge")).toBeVisible();
      await expect(page.getByTestId("local-badge")).toContainText("100% local");
    }
  });

  test("reaches all four destinations with large touch targets", async ({ page }) => {
    await page.goto("/ask");
    const nav = page.getByRole("navigation", { name: "Main" }).first();
    for (const d of destinations) {
      const link = nav.getByRole("link", { name: d.label });
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${d.path}$`));
      await expect(page.getByRole("heading", { level: 1, name: d.label })).toBeVisible();
    }
  });

  test("operator and shift selection persists across navigation and reload", async ({ page }) => {
    await page.goto("/ask");
    const operator = page.getByLabel("Operator").first();
    const shift = page.getByLabel("Shift").first();
    await expect(operator).toBeVisible();
    await operator.selectOption({ label: "Brian Mwangi" });
    await shift.selectOption("s-night");

    await page.getByRole("link", { name: "Count" }).first().click();
    await expect(page.getByLabel("Operator").first()).toHaveValue("o-brian");
    await expect(page.getByLabel("Shift").first()).toHaveValue("s-night");

    await page.reload();
    await expect(page.getByLabel("Operator").first()).toHaveValue("o-brian");
    await expect(page.getByLabel("Shift").first()).toHaveValue("s-night");
  });

  test("makes no request to any external origin", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (!["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol.startsWith("http")) {
        external.push(request.url());
      }
    });
    for (const d of destinations) {
      await page.goto(d.path);
      await page.waitForLoadState("networkidle");
    }
    expect(external).toEqual([]);
  });

  test("defines the status colour tokens and uses the local font", async ({ page }) => {
    await page.goto("/ask");
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return ["--ok-ink", "--warn-ink", "--bad-ink", "--signal"].map((name) =>
        style.getPropertyValue(name).trim(),
      );
    });
    for (const value of tokens) expect(value).not.toBe("");
    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(family.toLowerCase()).toContain("poppins");
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((f) => f.family.toLowerCase().includes("poppins") && f.status === "loaded");
    });
    expect(loaded).toBe(true);
  });

  test("works on a phone-sized screen with the bottom navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ask");
    await expect(page.getByTestId("local-badge")).toBeVisible();
    const bottom = page.getByRole("navigation", { name: "Main" }).last();
    await expect(bottom.getByRole("link", { name: "Receive" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
