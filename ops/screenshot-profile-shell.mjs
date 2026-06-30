/**
 * Static profile-shell visual check — renders representative tab markup
 * with the r7-profile-shell CSS classes and screenshots key sections.
 */
import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, mkdirSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const publicDir = join(root, "public");
const outDir = join(root, "ops", "screenshots");
mkdirSync(outDir, { recursive: true });

const mime = {
  ".html": "text/html",
  ".png": "image/png",
};

function productChip(label, slug) {
  return `<span class="product product-chip-flat"><img src="/icons/products/${slug}.png" alt="" aria-hidden class="product-icon-img preview-product-icon" /><span class="product-label">${label}</span></span>`;
}

const css = readFileSync(join(root, "app", "globals.css"), "utf8");
const rootMatch = css.match(/:root\s*\{[\s\S]*?\}/);
const rootVars = rootMatch ? rootMatch[0] : "";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Profile shell preview</title>
<style>
${rootVars}
body { margin: 0; background: var(--bg-l0, #f6f7f8); font-family: system-ui, sans-serif; }
${css}
.preview-wrap { padding: 24px; max-width: 1120px; margin: 0 auto; }
</style>
</head>
<body>
<div class="r7-profile-shell preview-wrap">
  <div class="products-strip">
    <span class="products-label">Principal products</span>
    <div class="product-list">
      ${productChip("T-Shirt", "t-shirt")}
      ${productChip("Jeans", "jeans")}
      <span class="product product-toggle">+ 2 more</span>
    </div>
  </div>
  <div class="proto-tabs" role="tablist">
    <button type="button" class="proto-tab">Overview</button>
    <button type="button" class="proto-tab active" data-state="active">Compliance</button>
    <button type="button" class="proto-tab">Capacity</button>
    <button type="button" class="proto-tab">Provenance <span class="proto-tab-count">6</span></button>
  </div>
  <div class="profile-tab-stack" style="margin-top:20px">
    <section class="proto-card">
      <header class="proto-card-head">
        <h2 class="proto-card-title">Capacity &amp; workforce</h2>
        <span class="proto-card-meta">self-disclosed · registry sources</span>
      </header>
      <div class="profile-kpi-grid">
        <div class="profile-kpi-tile"><p class="profile-kpi-label">Total workforce</p><div class="profile-kpi-value">1,240</div><p class="profile-kpi-sub">workers + staff</p></div>
        <div class="profile-kpi-tile"><p class="profile-kpi-label">Sewing machines</p><div class="profile-kpi-value">420</div></div>
        <div class="profile-kpi-tile"><p class="profile-kpi-label">Daily output</p><div class="profile-kpi-value">12,500</div><p class="profile-kpi-sub">pieces / day</p></div>
        <div class="profile-kpi-tile"><p class="profile-kpi-label">Factory type</p><div class="profile-kpi-value" style="font-size:16px">Knit · Woven</div></div>
      </div>
    </section>
    <section class="proto-card">
      <header class="proto-card-head">
        <h2 class="proto-card-title">Source records</h2>
        <span class="proto-card-meta">6 records · 4 sources</span>
      </header>
      <div class="profile-data-table">
        <div class="profile-data-head"><span>Source</span><span>Authority</span><span>Reference</span><span>Last verified</span><span>Tier</span></div>
        <div class="prov-list">
          <div class="prov-row">
            <span class="prov-source">BGMEA</span><span class="prov-name">BGMEA</span><span class="prov-ref">Member #3110</span><span class="prov-seen">27 Jun 2024</span><span class="tier-badge t2">T2</span>
          </div>
          <div class="prov-row">
            <span class="prov-source">EPB</span><span class="prov-name">Export Promotion Bureau</span><span class="prov-ref">3148</span><span class="prov-seen">12 May 2024</span><span class="tier-badge t1">T1</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</div>
</body>
</html>`;

const server = createServer((req, res) => {
  const url = req.url?.split("?")[0] ?? "/";
  if (url === "/" || url === "/preview") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
    return;
  }
  const filePath = join(publicDir, url);
  try {
    const data = readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": mime[extname(filePath)] ?? "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

await new Promise((resolve) => server.listen(4174, "127.0.0.1", resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
const outPath = join(outDir, "profile-shell-design-pass.png");
await page.locator(".r7-profile-shell").screenshot({ path: outPath });
await browser.close();
server.close();
console.log(outPath);
