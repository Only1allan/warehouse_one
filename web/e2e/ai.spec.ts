import path from "node:path";
import { expect, test } from "@playwright/test";
import { resetAndSignIn } from "./helpers";

// These tests use the real local models, so they are slow on CPU.
test.describe.configure({ timeout: 300_000 });

const fixtures = path.join(__dirname, "..", "data", "fixtures");

test.describe("AI features with the real models", () => {
  test("asking about stock answers 43 generators from the records", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/ask");
    await page.getByLabel("Your question").fill("How many generators do we have?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByTestId("stock-total")).toHaveText("43", { timeout: 180_000 });
    await expect(page.getByTestId("answer-text").last()).toContainText("43 units of Portable Generator 5kW");
  });

  test("a safety question is answered from the SOP with its source", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/safety");
    await page.getByRole("button", { name: "What PPE is required in Zone C?" }).click();
    const answer = page.getByTestId("assistant-message").last();
    await expect(answer).toHaveAttribute("data-state", "done", { timeout: 240_000 });
    await expect(answer.getByLabel("Sources")).toContainText("Personal Protective Equipment");
  });

  test("a delivery note photo selects the purchase order and shows what the note says", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/receive");
    await page.getByLabel("Delivery note photo").setInputFiles(path.join(fixtures, "images", "delivery-note-4472.png"));
    await expect(page.getByRole("radio", { name: /PO 4472/ })).toHaveAttribute("aria-checked", "true", { timeout: 240_000 });
    await expect(page.getByText(/On note 80/)).toBeVisible();
    await expect(page.getByText(/On note 40/)).toBeVisible();
  });

  test("a shelf photo gives a proposed count that the operator can correct", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/count");
    await page.getByRole("searchbox").fill("hose");
    await page.getByRole("radio", { name: /Hydraulic Hose Kit/ }).click();
    await page.getByLabel("Shelf photo").setInputFiles(path.join(fixtures, "images", "shelf-35.png"));
    await expect(page.getByTestId("proposal")).not.toBeEmpty({ timeout: 240_000 });
    await expect(page.getByRole("img", { name: "The shelf you photographed" })).toBeVisible();
    await page.getByRole("textbox", { name: "Counted Hydraulic Hose Kit" }).fill("35");
    await page.getByRole("button", { name: "Confirm count" }).click();
    await expect(page.getByTestId("count-saved")).toBeVisible();
  });
});

test.describe("hands-free voice with a microphone", () => {
  test.use({
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${path.join(fixtures, "audio", "question-01.wav")}`,
      ],
    },
  });

  test("hold to talk: the question is heard, shown, and answered", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/voice");
    const button = page.getByTestId("push-to-talk");
    await button.hover();
    await page.mouse.down();
    await expect(button).toContainText("Listening");
    await page.waitForTimeout(3500);
    await page.mouse.up();
    await expect(page.getByTestId("heard")).toContainText(/generator/i, { timeout: 120_000 });
    await expect(page.getByTestId("user-message").last()).toContainText(/generator/i, { timeout: 10_000 });
    await expect(page.getByTestId("stock-total")).toHaveText("43", { timeout: 180_000 });
  });

  test("uploading an audio file works as a fallback", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/ask");
    await page.getByTestId("audio-upload").setInputFiles(path.join(fixtures, "audio", "question-03.wav"));
    await expect(page.getByTestId("heard")).toContainText(/minimum/i, { timeout: 120_000 });
  });

  test("keyboard hold-to-talk sends on key up", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/voice");
    const button = page.getByTestId("push-to-talk");
    await button.focus();
    await page.keyboard.down("Space");
    await expect(button).toContainText("Listening");
    await page.waitForTimeout(3500);
    await page.keyboard.up("Space");
    await expect(page.getByTestId("heard")).toContainText(/generator/i, { timeout: 120_000 });
  });

  test("a quick tap does not leave the microphone recording", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/voice");
    const button = page.getByTestId("push-to-talk");
    await button.click();
    await expect(button).not.toContainText("Listening");
  });

  test("spoken PO number is normalized", async ({ page }) => {
    await resetAndSignIn(page, "amina");
    await page.goto("/ask");
    await page.getByTestId("audio-upload").setInputFiles(path.join(fixtures, "audio", "question-10.wav"));
    await expect(page.getByTestId("heard")).toContainText(/4471/, { timeout: 120_000 });
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByTestId("answer-text")).toContainText(/PO 4471/i, { timeout: 180_000 });
  });
});
