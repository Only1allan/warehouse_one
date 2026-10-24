import { expect, type Page } from "@playwright/test";
import { DEMO_ACCOUNTS } from "../lib/auth/demo-accounts";

export const account = (username: string) => {
  const found = DEMO_ACCOUNTS.find((a) => a.username === username);
  if (!found) throw new Error(`No demo account ${username}`);
  return found;
};

export async function signInAs(page: Page, username: string, shiftId = "s-morning") {
  const a = account(username);
  const response = await page.request.post("/api/auth/signin", {
    data: { username: a.username, password: a.password, shiftId },
  });
  expect(response.ok(), `sign in as ${username}`).toBe(true);
}

/** Resets the demo data (needs a supervisor), then signs in as the user the test wants. */
export async function resetAndSignIn(page: Page, username: string, shiftId = "s-morning") {
  await signInAs(page, "daniel", shiftId);
  const reset = await page.request.post("/api/admin/reseed");
  expect(reset.ok()).toBe(true);
  await signInAs(page, username, shiftId);
}

export function trackExternalRequests(page: Page): string[] {
  const external: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && !["localhost", "127.0.0.1"].includes(url.hostname)) {
      external.push(request.url());
    }
  });
  return external;
}
