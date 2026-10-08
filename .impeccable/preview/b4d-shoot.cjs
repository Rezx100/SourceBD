// Shoots b4d-*.html. node b4d-shoot.cjs [names] [widths]; defaults: pane pages at 1440 and 1280, page screens at 1440, 390 and 320.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
fs.mkdirSync(".impeccable/review/b4d", { recursive: true });
const all = { "page-sites": [1440, 1024, 390, 320], "pane-sites": [1440], "page-sites-ar": [1440, 390], "page-overview": [1440] };
const only = process.argv[2] ? process.argv[2].split(",") : Object.keys(all);
(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  for (const name of only)
    for (const w of process.argv[3] ? process.argv[3].split(",").map(Number) : all[name]) {
      const page = await browser.newPage({ viewport: { width: w, height: w >= 1280 ? 900 : w === 390 ? 844 : 568 } });
      await page.goto(require("url").pathToFileURL(path.resolve(`.impeccable/preview/b4d-${name}.html`)).href);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `.impeccable/review/b4d/${name}-${w}.png` });
      await page.close();
    }
  await browser.close();
})();

