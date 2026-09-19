// Screenshots the six screens out of the rendered gallery page.
// Run by scripts/gallery/regen.sh; GALLERY_OUT names the directory.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = process.env.GALLERY_OUT ?? path.join(repoRoot, "_gallery-out");
const shotDir = path.join(outDir, "shots");
const SCREENS = ["results-list", "results-table", "supplier-sheet", "product-sheet", "rfq-composer", "rfq-list"];
/** The width the approved v3.2 renders were drawn at (ds-rebuild-must-stay §9). */
const SCREEN_WIDTH = 1440;

mkdirSync(shotDir, { recursive: true });

const launch = {};
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch(launch);
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto(`file://${path.join(outDir, "gallery.html")}`);
  await page.waitForLoadState("networkidle");
  const wrong = [];
  for (const id of SCREENS) {
    const el = page.locator(`[data-screen="${id}"]`);
    if ((await el.count()) !== 1) throw new Error(`${id} is not on the page — the render is incomplete`);
    await el.screenshot({ path: path.join(shotDir, `${id}.png`) });
    const box = await el.boundingBox();
    const width = Math.round(box.width);
    console.log(id, width, "x", Math.round(box.height));
    if (width !== SCREEN_WIDTH) wrong.push(`${id} rendered at ${width}, not ${SCREEN_WIDTH}`);
  }
  if (wrong.length) throw new Error(wrong.join("; "));
} finally {
  await browser.close();
}
