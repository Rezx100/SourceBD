import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(dir, "company-profile-full-overhaul.html");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1200 },
  deviceScaleFactor: 2,
});
await page.goto("file://" + htmlPath.replace(/\\/g, "/"));
await page.evaluate(async () => {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
});
await page.waitForTimeout(300);

await page.screenshot({ path: path.join(dir, "profile-full.png"), fullPage: true });
console.log("wrote profile-full.png");

const sections = await page.locator("main > section").all();
for (let i = 0; i < sections.length; i++) {
  await sections[i].screenshot({ path: path.join(dir, `profile-section-${i}.png`) });
  console.log("wrote", `profile-section-${i}.png`);
}

await browser.close();
