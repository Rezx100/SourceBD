import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];
if (!file) {
  console.error("usage: node screenshot-concept.mjs <filename.html>");
  process.exit(1);
}
const htmlPath = path.join(dir, file);
const outBase = file.replace(/\.html$/, "");

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

await page.screenshot({ path: path.join(dir, `${outBase}-full.png`), fullPage: true });
console.log("wrote", `${outBase}-full.png`);

await browser.close();
