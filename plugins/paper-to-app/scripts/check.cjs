// Prove a conversion: render Paper's exact board (inline-styles export) and convert.cjs's
// output with the app's real Tailwind config in Chrome, then compare them.
// usage: node check.cjs <dir> <name> ...     (dir holds pull.cjs output)
// Prints per board: % of pixels that differ, and every computed-style mismatch grouped by
// property ("font-size 16px -> 14px  x7  e.g. text-base"). Writes <name>.check.png
// (reference | generated | diff in red) into <dir>. Exit 1 when any board differs.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = process.env.SOURCEBD_ROOT || process.cwd();
const ts = require(path.join(ROOT, "node_modules/typescript"));
const React = require(path.join(ROOT, "node_modules/react"));
const { renderToStaticMarkup } = require(path.join(ROOT, "node_modules/react-dom/server"));
const Phosphor = require(path.join(ROOT, "node_modules/@phosphor-icons/react/dist/ssr/index.es.js"));
const { chromium } = require(path.join(ROOT, "node_modules/playwright"));
const { convert, reference } = require("./convert.cjs");

// Same CSS variables the app's next/font sets, pointed at local copies of the faces.
const FONT_DIR = path.join(ROOT, ".impeccable/preview");
const b64 = (p) => fs.readFileSync(p).toString("base64");
const FONTS = `@font-face{font-family:Geist;src:url(data:font/woff2;base64,${b64(path.join(FONT_DIR, "Geist-Variable.woff2"))})}@font-face{font-family:'Geist Mono';src:url(data:font/woff2;base64,${b64(path.join(FONT_DIR, "GeistMono-Variable.woff2"))})}:root{--font-sans:Geist;--font-mono:'Geist Mono'}`;

function render(tsx, exportName) {
  const js = ts.transpileModule(tsx, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const req = (id) => (id.startsWith("@phosphor-icons/react") ? Phosphor : id === "react" ? React : require(id));
  new Function("require", "module", "exports", "React", js)(req, mod, mod.exports, React);
  const err = console.error;
  console.error = () => {}; // React warns about Paper's style quirks; the diff is the judge
  try { return renderToStaticMarkup(React.createElement(mod.exports[exportName])); } finally { console.error = err; }
}

const PROPS = ["font-size", "line-height", "letter-spacing", "font-weight", "font-family", "font-style", "color", "background-color", "opacity", "text-align", "white-space",
  "padding-top", "padding-right", "padding-bottom", "padding-left", "row-gap", "column-gap", "display", "flex-direction", "align-items", "justify-content", "position",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-style", "border-bottom-style", "border-top-color", "border-bottom-color",
  "border-left-color", "border-right-color", "border-top-left-radius", "border-bottom-right-radius", "overflow-x"];

// Runs in the page: computed style and box of every stamped node.
function snapshot(props) {
  const out = {};
  for (const el of document.querySelectorAll("[data-pp]")) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const s = { _box: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 2) / 2).join(","), _cls: el.getAttribute("class") || el.tagName.toLowerCase() };
    for (const p of props) s[p] = cs.getPropertyValue(p);
    s["font-family"] = s["font-family"].split(",")[0].replace(/["']/g, "").trim();
    for (const side of ["top", "right", "bottom", "left"]) if (s[`border-${side}-width`] === "0px") delete s[`border-${side}-color`];
    // Same rendering, different spelling (a pinned bar: absolute on the board, fixed in the app).
    if (s.position === "fixed") s.position = "absolute";
    for (const p of ["align-items", "justify-content"]) s[p] = s[p].replace(/^flex-(start|end)$/, "$1");
    for (const p of ["border-top-left-radius", "border-bottom-right-radius"]) if (parseFloat(s[p]) >= 9999) s[p] = "full";
    const tag = el.tagName.toLowerCase();
    // An inline svg paints with fill; a Phosphor icon paints with currentColor. The pixels judge it.
    if (tag === "svg") for (const p of ["color", "font-size", "line-height", "letter-spacing", "font-weight", "font-family", "white-space", "text-align"]) delete s[p];
    if (el.closest("svg") && tag !== "svg") continue; // an icon's own paths
    // A code (HS, PO, certificate number) broken over two lines is a bug on either side.
    if (s["font-family"] === "Geist Mono" && [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && r.height > parseFloat(cs.lineHeight) * 1.5) s._wrap = el.textContent.trim();
    out[el.getAttribute("data-pp")] = s;
  }
  return out;
}

// Runs in the page: pixel diff of two screenshots, returns the share that differs and a
// composite (reference | generated | diff) as a data URL.
async function pixelDiff([a, b]) {
  const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
  const px = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#f0f"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
  const da = px(ia), db = px(ib);
  const out = document.createElement("canvas"); out.width = w * 3 + 16; out.height = h;
  const ctx = out.getContext("2d"); ctx.fillStyle = "#888"; ctx.fillRect(0, 0, out.width, h);
  ctx.putImageData(da, 0, 0); ctx.putImageData(db, w + 8, 0);
  const diff = ctx.createImageData(w, h);
  let bad = 0;
  for (let i = 0; i < da.data.length; i += 4) {
    const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
    const g = 255 - (255 - (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 3) * 0.25;
    if (d > 40) bad++;
    diff.data.set(d > 40 ? [230, 0, 0, 255] : [g, g, g, 255], i);
  }
  ctx.putImageData(diff, w * 2 + 16, 0);
  return { share: bad / (w * h), size: [ia.width, ia.height, ib.width, ib.height], png: out.toDataURL("image/png") };
}

function compare(ref, gen) {
  const groups = new Map();
  const boxes = [];
  const missing = Object.keys(ref).filter((k) => !gen[k]);
  for (const [k, r] of Object.entries(ref)) {
    const g = gen[k];
    if (!g) continue;
    const [rb, gb] = [r._box.split(",").map(Number), g._box.split(",").map(Number)];
    const rootOk = k === "0" && rb.slice(0, 3).join() === gb.slice(0, 3).join() && gb[3] >= rb[3];
    if (r._box !== g._box && !rootOk) boxes.push(`${k}  ${r._box} -> ${g._box}  ${g._cls.slice(0, 90)}`);
    for (const p of Object.keys(r)) {
      if (p[0] === "_" || r[p] === g[p] || g[p] === undefined) continue;
      const key = `${p}  ${r[p]} -> ${g[p]}`;
      const e = groups.get(key) || { n: 0, eg: g._cls };
      e.n++;
      groups.set(key, e);
    }
  }
  return { groups: [...groups].sort((a, b) => b[1].n - a[1].n), boxes, missing };
}

(async () => {
  const [dir, ...names] = process.argv.slice(2);
  const work = path.join(dir, ".check");
  fs.mkdirSync(work, { recursive: true });
  const tokens = fs.readFileSync(path.join(dir, "tokens.css"), "utf8");
  const pages = [];
  for (const n of names) {
    const inline = fs.readFileSync(path.join(dir, `${n}.inline.jsx`), "utf8");
    const rootStyle = (inline.match(/style=\{\{([^}]*)\}\}/) || [, ""])[1];
    const width = +(rootStyle.match(/width: '(\d+)px'/) || [, 390])[1];
    const height = +(rootStyle.match(/height: '(\d+)px'/) || [, 800])[1];
    const treeFile = path.join(dir, `${n}.tree.txt`);
    const tree = fs.existsSync(treeFile) ? fs.readFileSync(treeFile, "utf8") : null;
    const gen = convert(fs.readFileSync(path.join(dir, `${n}.jsx`), "utf8"), { compName: "Gen", trace: true, tree });
    const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="app.css"><style>${FONTS}${tokens}body{margin:0;background:#fff}</style></head><body>${body}</body></html>`;
    fs.writeFileSync(path.join(work, `${n}.ref.html`), page(render(reference(inline, "Ref", tree), "Ref")));
    fs.writeFileSync(path.join(work, `${n}.gen.html`), page(render(gen.tsx, "Gen")));
    pages.push({ n, width, height, gen });
  }
  // One Tailwind build over the generated pages, with the app's own config and stylesheet.
  execFileSync("node", [path.join(ROOT, "node_modules/tailwindcss/lib/cli.js"), "-c", "tailwind.config.ts", "-i", "app/ds.css", "-o", path.join(work, "app.css").replace(/\\/g, "/"), "--content", path.join(work, "*.gen.html").replace(/\\/g, "/")], { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });

  const browser = await chromium.launch({ channel: "chrome" });
  let failed = 0;
  for (const { n, width, height, gen } of pages) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    let h = height;
    const shoot = async (kind) => {
      await p.goto("file:///" + path.join(work, `${n}.${kind}.html`).replace(/\\/g, "/"));
      await p.evaluate(() => document.fonts.ready);
      if (kind === "ref") {
        h = Math.round(await p.evaluate(() => document.querySelector("body > *").getBoundingClientRect().height));
        await p.setViewportSize({ width, height: h });
      }
      return { shot: await p.screenshot({ clip: { x: 0, y: 0, width, height: h } }), snap: await p.evaluate(snapshot, PROPS) };
    };
    const ref = await shoot("ref");
    const out = await shoot("gen");
    const d = await p.evaluate(pixelDiff, ["data:image/png;base64," + ref.shot.toString("base64"), "data:image/png;base64," + out.shot.toString("base64")]);
    fs.writeFileSync(path.join(dir, `${n}.check.png`), Buffer.from(d.png.split(",")[1], "base64"));
    const c = compare(ref.snap, out.snap);
    const ok = d.share < 0.001 && !c.groups.length && !c.boxes.length;
    if (!ok) failed++;
    console.log(`\n${ok ? "PASS" : "DIFF"} ${n}  pixels ${(d.share * 100).toFixed(2)}%  size ref ${d.size[0]}x${d.size[1]} gen ${d.size[2]}x${d.size[3]}  icons ${gen.used.size}${gen.unknownSvg.length ? ` (+${gen.unknownSvg.length} unmapped svg)` : ""}  arbitrary ${gen.remaining.length}`);
    for (const [k, e] of c.groups.slice(0, 20)) console.log(`  ${k}  x${e.n}  e.g. ${e.eg.slice(0, 80)}`);
    for (const b of c.boxes.slice(0, 6)) console.log(`  box ${b}`);
    if (c.boxes.length > 6) console.log(`  ... ${c.boxes.length - 6} more boxes moved`);
    for (const [side, snap] of [["Paper board", ref.snap], ["generated", out.snap]]) for (const [k, v] of Object.entries(snap)) if (v._wrap) console.log(`  ${side}: code wraps "${v._wrap}" at ${k}`);
    if (c.missing.length) console.log(`  missing in generated: ${c.missing.slice(0, 8).join(" ")}`);
    await ctx.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
