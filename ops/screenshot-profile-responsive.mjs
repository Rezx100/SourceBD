/**
 * Multi-viewport profile shell screenshots — app vs marketing parity check.
 * Uses static HTML with full globals.css; no live Next server required.
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
  ".css": "text/css",
};

function productChip(label, slug) {
  return `<span class="product product-chip-flat"><img src="/icons/products/${slug}.png" alt="" aria-hidden class="product-icon-img preview-product-icon" /><span class="product-label">${label}</span></span>`;
}

const css = readFileSync(join(root, "app", "globals.css"), "utf8");
const rootMatch = css.match(/:root\s*\{[\s\S]*?\}/);
const rootVars = rootMatch ? rootMatch[0] : "";

function shellHtml(variant) {
  const actions =
    variant === "app"
      ? `<div class="header-action-row">
           <button type="button" class="header-action-btn">Saved</button>
           <button type="button" class="header-action-btn header-action-btn-primary">Contact</button>
         </div>`
      : `<div class="header-action-row">
           <a class="header-action-btn" href="#">Log in</a>
           <a class="header-action-btn header-action-btn-primary" href="#">Sign up free</a>
         </div>`;

  const contactMeta =
    variant === "app"
      ? "Free tier · contact gated"
      : "Sign up free to unlock";

  const contactCta =
    variant === "app"
      ? `<a class="btn-proto primary" href="#">See plans →</a>`
      : `<a class="btn-proto primary" href="#">Sign up free →</a>`;

  return `<!DOCTYPE html>
<html lang="en"${variant === "marketing" ? ' data-surface="marketing"' : ""}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Profile ${variant}</title>
<style>
${rootVars}
body { margin: 0; background: var(--bg-l0, #f6f7f8); font-family: system-ui, sans-serif; }
${css}
</style>
</head>
<body>
<div class="r7-profile-shell mx-auto flex max-w-[1280px] flex-col gap-4 overflow-x-clip px-4 py-5 sm:px-6 sm:py-8">
  <section class="header-card">
    <div class="header-glyph-col"><div style="width:64px;height:64px;border-radius:50%;background:var(--brand-forest-soft)"></div></div>
    <div class="header-main min-w-0">
      <div class="breadcrumb">Discover › Garment manufacturer</div>
      <h1 class="header-name">Naafco Fashion Wear Industries Limited Partnership Company</h1>
      <p class="header-classification">
        <span class="header-classification-item">Garment manufacturer</span>
        <span class="header-classification-item">Knit</span>
        <span class="header-classification-item">Woven</span>
        <span class="header-classification-item">+1 more</span>
      </p>
      <div class="header-trust-row">
        <div class="verified-by-badge">
          <span class="verified-by-badge-label">Company verified by</span>
          <span class="verified-by-badge-sources"><span class="verified-source-pill">BGMEA</span><span class="verified-source-pill">EPB</span></span>
        </div>
      </div>
      <dl class="header-meta-row">
        <div class="header-meta-cell"><dt class="header-meta-label">Address</dt><dd class="header-meta-value"><span class="header-meta-address">Plot 12, Export Processing Zone</span></dd></div>
        <div class="header-meta-cell"><dt class="header-meta-label">Established</dt><dd class="header-meta-value">2001 <span class="mono">24 yrs</span></dd></div>
      </dl>
    </div>
    <div class="header-side">${actions}</div>
  </section>

  <div class="products-strip">
    <span class="products-label">Principal products</span>
    <div class="product-list">
      ${productChip("T-Shirt", "t-shirt")}
      ${productChip("Jeans", "jeans")}
      ${productChip("Pajamas", "pajamas")}
      <span class="product product-toggle">+ 3 more</span>
    </div>
  </div>

  <div class="profile-tabs-shell flex flex-col gap-0">
    <div class="proto-tabs" role="tablist">
      <button type="button" class="proto-tab">Overview</button>
      <button type="button" class="proto-tab active" data-state="active">Compliance</button>
      <button type="button" class="proto-tab">Capacity</button>
      <button type="button" class="proto-tab">Contact</button>
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
          <div class="profile-kpi-tile"><p class="profile-kpi-label">Factory type</p><div class="profile-kpi-value" style="font-size:16px">Knit · Woven · Denim</div></div>
        </div>
      </section>

      <section class="proto-card">
        <header class="proto-card-head">
          <h2 class="proto-card-title">Contact</h2>
          <span class="proto-card-meta">${contactMeta}</span>
        </header>
        <dl class="contact-list">
          <dt>Phone</dt><dd class="masked">+880-2-XXXXXXXX</dd>
          <dt>Email</dt><dd class="masked">XXXXXX@XXXXX.com</dd>
        </dl>
        <div class="gated-cta">
          <p class="gated-cta-title">Unlock verified contacts</p>
          <p class="gated-cta-body">Direct-dial phone and decision-maker email for every supplier.</p>
          ${contactCta}
        </div>
      </section>

      <section class="proto-card">
        <header class="proto-card-head">
          <h2 class="proto-card-title">Brand attribution</h2>
          <span class="proto-card-meta">2 brands · per-factory authenticity</span>
        </header>
        <div class="brand-list">
          <div class="brand-row">
            <div class="brand-id"><div class="brand-mark">HM</div><div class="brand-text"><span class="brand-name">H&amp;M</span><span class="brand-since">Last verified 27 Jun 2024</span></div></div>
            <p class="brand-desc">Named on <strong>H&amp;M's published BD supplier list</strong>.</p>
            <span class="brand-meta">27 Jun 2024</span>
            <div class="brand-actions"><a class="doc-action" href="#">Brand source ↗</a></div>
          </div>
        </div>
      </section>
    </div>
  </div>

  <p class="affiliation-disclaimer">Authority logos identify the data sources we aggregate from. SourceBD is not affiliated with or endorsed by BGMEA, BKMEA, or any brands named on this page.</p>
</div>
</body>
</html>`;
}

const viewports = [
  { w: 1440, suffix: "1440" },
  { w: 768, suffix: "768" },
  { w: 390, suffix: "390" },
];

const variants = ["app", "marketing"];
const outputs = [];

for (const variant of variants) {
  const html = shellHtml(variant);
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
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 4175;
  const url = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch();
  for (const { w, suffix } of viewports) {
    const page = await browser.newPage({
      viewport: { width: w, height: suffix === "390" ? 1400 : 900 },
    });
    await page.goto(url, { waitUntil: "networkidle" });
    const outPath = join(outDir, `profile-${variant}-${suffix}.png`);
    await page.locator(".r7-profile-shell").screenshot({ path: outPath, fullPage: true });
    outputs.push(outPath);
    await page.close();
  }
  await browser.close();
  server.close();
}

for (const p of outputs) console.log(p);
