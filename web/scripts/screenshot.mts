import { chromium } from "@playwright/test";

const [, , route = "/ask", name = "shot", width = "1280", height = "800"] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
await page.goto(`http://localhost:3100${route}`);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(400);
await page.screenshot({ path: `/tmp/opencode/${name}.png` });
await browser.close();
