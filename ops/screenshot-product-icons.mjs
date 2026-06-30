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

const products = [
  ["Printed Label", "printed-label"],
  ["Neck Board", "neck-board"],
  ["Collar Bone", "neck-board"],
  ["Back Board", "back-board"],
  ["Black Board", "back-board"],
  ["Tissue Paper", "tissue-paper"],
  ["Hang Tag", "price-tag"],
  ["Price Tag", "price-tag"],
  ["Barcode", "barcode"],
  ["T-Shirt", "t-shirt"],
  ["Poly Bag", "poly-bag"],
  ["Carton Box", "carton"],
  ["Pajama", "pajamas"],
];

const chips = products
  .map(
    ([label, slug]) => `
      <span class="product product-chip-flat">
        <img src="/icons/products/${slug}.png" alt="" class="product-icon-img preview-product-icon" />
        <span class="product-label">${label}</span>
      </span>`,
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Principal products preview</title>
  <style>
    body { margin: 0; padding: 32px; background: #f5f5f4; font-family: system-ui, sans-serif; }
    .products-strip {
      display: flex; align-items: center; gap: 14px; padding: 14px 16px;
      background: #fff; border: 1px solid #e5e5e5; border-radius: 12px;
      box-shadow: 0 1px 2px rgba(15,15,20,0.04); flex-wrap: wrap; max-width: 920px;
    }
    .products-label {
      display: inline-flex; min-height: 34px; align-items: center;
      font-size: 12px; font-weight: 600; color: #737373;
    }
    .product-list { display: flex; gap: 8px; flex: 1 1 420px; flex-wrap: wrap; row-gap: 8px; }
    .product {
      display: inline-flex; align-items: center; gap: 8px; min-height: 32px;
      padding: 4px 10px 4px 6px; background: #fafafa; border: 1px solid #e5e5e5;
      border-radius: 999px; font-size: 12px; font-weight: 600; color: #171717;
    }
    .product-icon-img { width: 20px; height: 20px; object-fit: contain; display: block; }
    h1 { font-size: 14px; color: #525252; margin: 0 0 16px; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Principal products — icon preview</h1>
  <div class="products-strip">
    <span class="products-label">Principal products</span>
    <div class="product-list">${chips}</div>
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
    res.writeHead(200, { "Content-Type": mime[extname(filePath)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 980, height: 220 } });
await page.goto("http://127.0.0.1:4173/preview", { waitUntil: "networkidle" });
const outPath = join(outDir, "principal-products-icons.png");
await page.locator(".products-strip").screenshot({ path: outPath });
await browser.close();
server.close();
console.log(outPath);
