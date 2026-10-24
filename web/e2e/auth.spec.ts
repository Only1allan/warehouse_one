import { expect, test } from "@playwright/test";
import { DEMO_ACCOUNTS, FEATURED_USERNAMES } from "../lib/auth/demo-accounts";
import { account, resetAndSignIn, signInAs, trackExternalRequests } from "./helpers";

test.describe("landing page", () => {
  test("explains the product and offers sign in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ask your warehouse");
    await expect(page.getByTestId("local-badge")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Useful on the floor only if you can trust it/ })).toBeVisible();
    for (const title of ["Warehouse Operator", "Warehouse Supervisor", "Inventory Controller", "Logistics Manager"]) {
      await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
    }
    await page.getByTestId("hero-signin").click();
    await expect(page).toHaveURL(/\/signin/);
  });

  test("the product preview shows a real answer, not a screenshot", async ({ page }) => {
    await page.goto("/");
    const preview = page.getByRole("img", { name: "Example of the Ask screen" });
    await expect(preview).toContainText("We currently have 43 units of Portable Generator 5kW in stock.");
    await expect(preview.getByTestId("stock-total")).toHaveText("43");
  });

  test("each role has a try link that fills the sign-in form", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("try-kevin").click();
    await expect(page).toHaveURL(/signin\?as=kevin/);
    await expect(page.getByLabel("Username")).toHaveValue("kevin");
    await expect(page.getByLabel("Password")).toHaveValue(account("kevin").password);
  });

  test("shows 'Open the app' once signed in", async ({ page }) => {
    await signInAs(page, "amina");
    await page.goto("/");
    await expect(page.getByTestId("open-app")).toBeVisible();
    await expect(page.getByTestId("hero-open-app")).toContainText("Amina");
  });

  test("makes no request to an external origin, on any public page", async ({ page }) => {
    const external = trackExternalRequests(page);
    for (const path of ["/", "/signin"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(external).toEqual([]);
  });

  test("works on a phone-sized screen without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/", "/signin"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, path).toBe(false);
    }
  });
});

test.describe("sign in", () => {
  test("lists a demo login for each of the four personas", async ({ page }) => {
    await page.goto("/signin");
    const list = page.getByTestId("demo-logins");
    for (const username of FEATURED_USERNAMES) {
      const a = account(username);
      await expect(list).toContainText(a.name);
      await expect(list).toContainText(a.password);
    }
  });

  for (const username of FEATURED_USERNAMES) {
    test(`signs in as ${username} with one tap and lands on a home made for the role`, async ({ page }) => {
      const a = account(username);
      await page.goto("/signin");
      await page.getByTestId(`use-${username}`).click();
      await expect(page.getByLabel("Username")).toHaveValue(username);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/home$/);
      await expect(page.getByTestId("user-name").first()).toHaveText(a.name);
      await expect(page.getByTestId("home-greeting")).toContainText(a.name);
    });
  }

  test("signs in by typing the credentials", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Username").fill("DANIEL");
    await page.getByLabel("Password").fill("Supervisor@123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId("user-title").first()).toHaveText("Warehouse Supervisor");
  });

  test("a wrong password shows one plain message and stays on the page", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Username").fill("amina");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByTestId("signin-error")).toHaveText("Wrong username or password.");
    await expect(page).toHaveURL(/\/signin/);
    await page.getByLabel("Username").fill("nobody");
    await page.getByLabel("Password").fill("Operator@123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByTestId("signin-error")).toHaveText("Wrong username or password.");
  });

  test("chooses the shift at sign in", async ({ page }) => {
    await page.goto("/signin");
    await page.getByTestId("use-amina").click();
    await page.getByLabel("Shift").selectOption("s-night");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByLabel("Shift").first()).toHaveValue("s-night");
  });

  test("password can be revealed", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Password").fill("secret");
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show" }).click();
    await expect(page.getByLabel("Password")).toHaveAttribute("type", "text");
  });

  test("visiting a protected page while signed out redirects to sign in, then back", async ({ page }) => {
    await page.goto("/ask");
    await expect(page).toHaveURL(/\/signin\?next=%2Fask/);
    await page.getByTestId("use-amina").click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/ask$/);
  });

  test("never redirects to another site through the next parameter", async ({ page }) => {
    await page.goto("/signin?next=//evil.example.com");
    await page.getByTestId("use-amina").click();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/localhost:\d+\/home$/);
  });

  test("signing out ends the session", async ({ page }) => {
    await signInAs(page, "amina");
    await page.goto("/home");
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/signin/);
    const me = await (await page.request.get("/api/auth/me")).json();
    expect(me.user).toBeNull();
    await page.goto("/ask");
    await expect(page).toHaveURL(/\/signin/);
  });
});

test.describe("access control", () => {
  test("the API refuses every request without a session", async ({ request }) => {
    for (const url of ["/api/home", "/api/stock", "/api/health", "/api/shipments", "/api/supervisor/exceptions", "/api/receiving/pos", "/api/dispatch/orders", "/api/readiness"]) {
      const response = await request.get(url);
      expect(response.status(), url).toBe(401);
    }
    expect((await request.post("/api/ask", { data: { message: "hi" } })).status()).toBe(401);
    expect((await request.post("/api/admin/reseed")).status()).toBe(401);
  });

  test("a forged session cookie is refused", async ({ page }) => {
    await page.context().addCookies([
      { name: "wh_session", value: "eyJ1aWQiOiJvLWRhbmllbCIsInNpZCI6InMtbW9ybmluZyIsImV4cCI6OTk5OTk5OTk5OTk5OX0.forged", url: "http://localhost:3101" },
    ]);
    const response = await page.request.get("/api/home");
    expect(response.status()).toBe(401);
  });

  test("an operator cannot open supervisor screens or call their APIs", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/health");
    await expect(page.getByTestId("not-available")).toContainText("Not available for your role");
    await page.goto("/stock");
    await expect(page.getByTestId("not-available")).toBeVisible();
    expect((await page.request.get("/api/health")).status()).toBe(403);
    expect((await page.request.get("/api/stock")).status()).toBe(403);
    expect((await page.request.get("/api/supervisor/exceptions")).status()).toBe(403);
    expect((await page.request.post("/api/admin/reseed")).status()).toBe(403);
    expect((await page.request.post("/api/count/adjust", { data: { countId: 1 } })).status()).toBe(403);
  });

  test("an inventory controller cannot receive or dispatch", async ({ page }) => {
    await resetAndSignIn(page, "esther");
    expect((await page.request.get("/api/receiving/pos")).status()).toBe(403);
    expect((await page.request.get("/api/dispatch/orders")).status()).toBe(403);
    await page.goto("/receive");
    await expect(page.getByTestId("not-available")).toBeVisible();
  });

  test("a logistics manager cannot count or adjust stock", async ({ page }) => {
    await resetAndSignIn(page, "kevin");
    expect((await page.request.get("/api/count/targets")).status()).toBe(403);
    expect((await page.request.post("/api/stock/decline", { data: { countId: 1 } })).status()).toBe(403);
  });

  test("actions are attributed to the signed-in user, whatever the request body says", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    const confirm = await page.request.post("/api/receiving/confirm", {
      data: {
        poNumber: "4471",
        lines: [{ sku: "100201", qty: 142 }, { sku: "100305", qty: 60 }, { sku: "100410", qty: 120 }],
        operatorId: "o-daniel",
        shiftId: "s-night",
      },
    });
    expect(confirm.ok()).toBe(true);
    await signInAs(page, "daniel");
    const rows = await (await page.request.get("/api/supervisor/exceptions?kind=receiving")).json();
    expect(rows[0].operator).toBe("Amina Otieno");
    expect(rows[0].shift).toBe("Morning");
  });

  test("covers every seeded account", async () => {
    expect(DEMO_ACCOUNTS.length).toBeGreaterThanOrEqual(4);
  });
});
