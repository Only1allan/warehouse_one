import { expect, test } from "@playwright/test";

test("a local model streams a reply into the browser", async ({ page }) => {
  await page.goto("/spike");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("output")).not.toBeEmpty();
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
});

test("the stop button cancels a long generation", async ({ page }) => {
  await page.goto("/spike");
  await page
    .getByLabel("Prompt")
    .fill("Write a very long story about a warehouse, at least 500 words.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("output")).not.toBeEmpty();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
  const stopped = (await page.getByTestId("output").textContent()) ?? "";
  await page.waitForTimeout(1500);
  expect((await page.getByTestId("output").textContent()) ?? "").toBe(stopped);
});
