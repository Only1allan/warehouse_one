import { expect, test } from "@playwright/test";
import { navFor, ROLE_NAV, type Role } from "../lib/auth/capabilities";
import { resetAndSignIn } from "./helpers";

const PERSONAS: Array<{ username: string; role: Role; needs: string[] }> = [
  { username: "amina", role: "operator", needs: ["Quick access to information", "Voice interaction", "Inventory verification"] },
  { username: "daniel", role: "supervisor", needs: ["Operational visibility", "Exception reporting", "Inventory alerts"] },
  { username: "esther", role: "inventory_controller", needs: ["Accurate stock records", "Faster cycle counts", "Reconciliation support"] },
  { username: "kevin", role: "logistics_manager", needs: ["Dispatch accuracy", "Shipment visibility", "Process compliance"] },
];

for (const persona of PERSONAS) {
  test(`${persona.role}: the sidebar is grouped by the brief's needs and every screen opens`, async ({ page }) => {
    await resetAndSignIn(page, persona.username);
    await page.goto("/home");
    const nav = page.getByTestId("role-nav");
    await expect(nav).toHaveAttribute("data-role", persona.role);
    for (const need of persona.needs) await expect(nav.getByTestId("nav-need").filter({ hasText: need })).toBeVisible();
    expect(ROLE_NAV[persona.role].length).toBeGreaterThan(2);

    for (const entry of navFor(persona.role)) {
      await nav.getByRole("link", { name: entry.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${entry.href}$`));
      await expect(page.getByTestId("not-available")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(page.locator("main [role=alert]")).toHaveCount(0);
    }
  });
}
