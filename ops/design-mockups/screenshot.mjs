import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(dir, "discover-card-mockup.html");

const ids = [
  "current-mobile",
  "proposed-mobile",
  "current-desktop",
  "proposed-desktop",
  "ring-options",
  "identity-options",
  "save-options",
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1400, height: 2400 },
  deviceScaleFactor: 2,
});
await page.goto("file://" + htmlPath.replace(/\\/g, "/"));
await page.evaluate(async () => {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
});
await page.waitForTimeout(300);

for (const id of ids) {
  const el = page.locator(`#${id}`);
  const outPath = path.join(dir, `${id}.png`);
  await el.screenshot({ path: outPath });
  console.log("wrote", outPath);
}

// Real :hover captures — the interaction states GPT critiques but Playwright
// never actually exercised in the default-state loop above.
for (const id of ["proposed-mobile", "proposed-desktop"]) {
  const article = page.locator(`#${id} article`);
  await article.hover();
  await page.waitForTimeout(250);
  const outPath = path.join(dir, `${id}-hover.png`);
  await page.locator(`#${id}`).screenshot({ path: outPath });
  console.log("wrote", outPath);
  await page.mouse.move(0, 0);
}

await browser.close();
