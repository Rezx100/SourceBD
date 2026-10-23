// Shoots every .art in visuals.html at 2x into ../png and prints the carousel to ../carousel.pdf.
// Run: node .impeccable/linkedin-export-visuals/src/render.cjs   (Playwright from the main checkout's node_modules)
const path = require("path");
const { pathToFileURL } = require("url");
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("E:/SourceBD/node_modules/playwright")); }

const dir = path.resolve(__dirname, "..");
const page = pathToFileURL(path.join(__dirname, "visuals.html")).href;

(async () => {
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1400, height: 1500 } });
  const p = await ctx.newPage();
  await p.goto(page);
  await p.evaluate(() => document.fonts.ready);
  for (const el of await p.$$(".art")) {
    const name = await el.getAttribute("data-name");
    await el.screenshot({ path: path.join(dir, "png", `${name}.png`) });
    console.log("png", name);
  }
  const pdf = await (await browser.newContext()).newPage();
  await pdf.goto(page + "?print=carousel");
  await pdf.evaluate(() => document.fonts.ready);
  await pdf.pdf({ path: path.join(dir, "carousel.pdf"), width: "1080px", height: "1350px", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  console.log("pdf carousel.pdf");
  await browser.close();
})();
