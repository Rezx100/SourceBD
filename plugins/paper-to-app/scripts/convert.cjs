// Turn a Paper board's Tailwind JSX (from pull.cjs) into a SourceBD-ready TSX skeleton.
// usage: node convert.cjs <in.jsx> <out.tsx> [ComponentName]
//        node convert.cjs --all <pullDir> <outDir>
// What it does: maps Paper tokens to the app's Tailwind classes (the names already match,
// lib/design/tokens.ts), swaps inline Phosphor SVGs for <Icon weight="thin">, rewrites
// Tailwind v4 / off-grid values into v3.4 classes, drops Paper-only noise and the fake
// status bar / home indicator, and prints what it could not map.
// check.cjs requires this file and uses convert()/reference() with trace on.
const fs = require("fs");
const path = require("path");
const ROOT = process.env.SOURCEBD_ROOT || process.cwd();
const ts = require(path.join(ROOT, "node_modules/typescript"));

// ---- icon map: thin-weight path data -> Phosphor component name ----
function iconMap() {
  const cache = path.join(__dirname, "icon-map.json");
  if (fs.existsSync(cache)) return new Map(JSON.parse(fs.readFileSync(cache, "utf8")));
  const map = buildIconMap();
  fs.writeFileSync(cache, JSON.stringify([...map]));
  return map;
}
function buildIconMap() {
  const React = require(path.join(ROOT, "node_modules/react"));
  const { renderToStaticMarkup } = require(path.join(ROOT, "node_modules/react-dom/server"));
  const P = require(path.join(ROOT, "node_modules/@phosphor-icons/react/dist/ssr/index.es.js"));
  const map = new Map();
  for (const [name, C] of Object.entries(P)) {
    if (!/^[A-Z]/.test(name) || name.endsWith("Icon") || typeof C !== "object") continue;
    let svg;
    try { svg = renderToStaticMarkup(React.createElement(C, { weight: "thin" })); } catch { continue; }
    const d = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => norm(m[1])).join("|");
    if (d && !map.has(d)) map.set(d, name);
  }
  return map;
}
// Paper and hand-typed paths differ in trailing zeros ("5.660" vs "5.66"); compare numbers.
const norm = (d) => d.replace(/-?\d*\.?\d+/g, (n) => String(Math.round(parseFloat(n) * 100) / 100));

// ---- class rewriting ----
const V3_SPACING = new Set(["0", "px", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", ...Array.from({ length: 9 }, (_, i) => String(i + 4)), "14", "16", "20", "24", "28", "32", "36", "40", "44", "48", "52", "56", "60", "64", "72", "80", "96", "full", "fit", "auto", "screen", "min", "max"]);
const SPACING_PREFIX = /^(-?)(p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|w|h|min-w|min-h|max-w|max-h|size|top|left|right|bottom|inset(?:-[xy])?|basis)-(.+)$/;
const DROP = new Set(["antialiased", "box-border", "[font-synthesis:none]", "[font-synthesis-weight:none]", "[font-synthesis-style:none]", "[font-synthesis-small-caps:none]"]);
const PROP = { padding: "p", "padding-top": "pt", "padding-bottom": "pb", "padding-left": "pl", "padding-right": "pr", "padding-inline": "px", "padding-block": "py", "margin-inline": "mx", "margin-block": "my", "min-height": "min-h", "min-width": "min-w", "max-width": "max-w", "max-height": "max-h", width: "w", height: "h", gap: "gap", "row-gap": "gap-y", "column-gap": "gap-x", top: "top", left: "left", right: "right", bottom: "bottom" };
const COLOR_PROP = { color: "text", "background-color": "bg", "border-color": "border", "border-top-color": "border-t", "border-bottom-color": "border-b", "border-left-color": "border-l", "border-right-color": "border-r", fill: "fill", stroke: "stroke" };
const DEFAULT_LH = { xs: 16, sm: 18, base: 20, md: 24, lg: 28, xl: 32, "2xl": 40, "3xl": 48 };
const SIDE = { t: "top", b: "bottom", l: "left", r: "right", x: "inline", y: "block" };
const pxToClass = (prefix, px) => {
  const n = parseFloat(px) / 4;
  return V3_SPACING.has(String(n)) ? `${prefix}-${n}` : `${prefix}-[${px}]`;
};

function rewriteClass(cls, notes) {
  if (DROP.has(cls)) return null;
  if (/^font-\['Geist',/.test(cls) || cls === "font-[system-ui,sans-serif]") return null;
  if (/^font-\['Geist_Mono'/.test(cls)) return "font-mono";
  if (cls === "font-features-['tnum']") return "tabular-nums"; // v3 has no font-features-*
  if (cls === "wrap-anywhere") return "[overflow-wrap:anywhere]"; // Paper lays every board out with it
  let m;
  if ((m = cls.match(/^\[([a-z-]+):var\(--color-([\w-]+)\)\]$/)) && COLOR_PROP[m[1]]) return `${COLOR_PROP[m[1]]}-${m[2]}`;
  if ((m = cls.match(/^\[([a-z-]+):(-?\d+(?:\.\d+)?)px\]$/)) && PROP[m[1]]) return pxToClass(PROP[m[1]], `${m[2]}px`);
  // v4 per-side border style; v3 preflight already makes every border solid
  if ((m = cls.match(/^border-([tblrxy])-solid$/))) return null;
  if ((m = cls.match(/^border-([tblrxy])-(dashed|dotted|double|none)$/))) return `[border-${SIDE[m[1]]}-style:${m[2]}]`;
  if ((m = cls.match(/^text-([\w]+)-line-height(?:\/(\d+(?:\.\d+)?))?$/)) && DEFAULT_LH[m[1]]) return `text-[${DEFAULT_LH[m[1]]}px]${m[2] ? `/[${parseFloat(m[2]) * 4}px]` : ""}`;
  if ((m = cls.match(/^text-(.+)\/(\d+(?:\.\d+)?)$/))) { const lh = parseFloat(m[2]) * 4; return DEFAULT_LH[m[1]] === lh ? `text-${m[1]}` : `text-${m[1]}/[${lh}px]`; }
  if ((m = cls.match(SPACING_PREFIX)) && /^\d+(\.\d+)?$/.test(m[3]) && !V3_SPACING.has(m[3])) return `${m[1]}${m[2]}-[${parseFloat(m[3]) * 4}px]`;
  if (cls === "basis-[0%]") return "basis-0";
  if (cls === "rounded-[calc(infinity*1px)]") return "rounded-full";
  if ((m = cls.match(/^\[align-self:(start|end|center|stretch|baseline)\]$/))) return `self-${m[1]}`;
  if ((m = cls.match(/^text-(xs|sm|base|md|lg|xl|2xl)\/\[(\d+)px\]$/)) && DEFAULT_LH[m[1]] === +m[2]) return `text-${m[1]}`;
  if (cls === "h-fit" || cls === "w-fit") return cls;
  if (/^\[/.test(cls) || /#[0-9a-f]{3,8}/i.test(cls)) notes.add(cls);
  return cls;
}
const rewriteClassName = (value, notes) => value.split(/\s+/).filter(Boolean).map((c) => rewriteClass(c, notes)).filter(Boolean).join(" ");

// ---- JSX helpers ----
const isEl = (n) => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n);
const opening = (n) => (ts.isJsxElement(n) ? n.openingElement : n);
const tagName = (n) => opening(n).tagName.getText();
const attrs = (n) => opening(n).attributes.properties;
const attr = (n, name) => attrs(n).find((a) => ts.isJsxAttribute(a) && a.name.getText() === name);
const strAttr = (n, name) => { const a = attr(n, name); return a && a.initializer && ts.isStringLiteral(a.initializer) ? a.initializer.text : null; };
// A literal from style={{ width: '22px' }}; Paper sizes some icons there, over the width attribute.
const styleOf = (n, prop) => {
  const a = attr(n, "style");
  const o = a && a.initializer && ts.isJsxExpression(a.initializer) && a.initializer.expression;
  const p = o && ts.isObjectLiteralExpression(o) && o.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText() === prop);
  return p && ts.isStringLiteral(p.initializer) ? p.initializer.text : null;
};
const textOf = (n) => (ts.isJsxText(n) ? n.text : ts.isJsxElement(n) ? n.children.map(textOf).join("") : "");

const parse = (src) => ts.createSourceFile("board.tsx", `const __board = ${src.trim().replace(/;$/, "")};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// Tree path of every element ("0", "0.3", "0.3.1"), so check.cjs can pair the reference
// render with the generated one node for node.
function paths(sf) {
  const map = new Map();
  const walk = (n, p) => {
    if (isEl(n)) {
      map.set(n, p);
      let i = 0;
      if (ts.isJsxElement(n)) for (const c of n.children) if (isEl(c)) walk(c, `${p}.${i++}`);
      return;
    }
    ts.forEachChild(n, (c) => walk(c, p));
  };
  walk(sf, "0");
  return map;
}

// Layer names from pull.cjs's <name>.tree.txt, by element path. Generic names ("Frame",
// text content) are skipped. Returns an empty map when the tree and the JSX disagree.
const GENERIC = /^(Frame|SVG|Path|Rectangle|Ellipse|Group|Image|Line|Vector)$/;
function layerNames(tree, pp) {
  const names = new Map();
  if (!tree) return names;
  const byPath = new Map([...pp].map(([n, p]) => [p, n]));
  const counters = [];
  for (const line of tree.split("\n")) {
    const m = line.match(/^( *)(\w+) "(.*)" \([\w-]+\)/);
    if (!m) continue;
    const depth = m[1].length / 2;
    counters.length = depth + 1;
    counters[depth] = depth === 0 ? 0 : (counters[depth] ?? -1) + 1;
    const p = counters.join(".");
    const el = byPath.get(p);
    if (!el) { if (process.env.DEBUG_LAYERS) console.error("no element at", p, line.trim()); return new Map(); } // tree and JSX disagree: label nothing rather than mislabel
    if (m[2] === "Text") {
      // A text layer named after its own words is unnamed; one renamed ("Name", "Price") marks
      // where route data goes, so it is kept as a label. A text layer with no text is a misalignment.
      const key = (t) => t.replace(/…$/, "").replace(/[^\p{L}\p{N}]/gu, ""); // quotes and spaces export differently
      const own = key(textOf(el));
      if (!own) { if (process.env.DEBUG_LAYERS) console.error("no text at", p, line.trim()); return new Map(); }
      if (!own.startsWith(key(m[3]))) names.set(p, m[3]);
      continue;
    }
    if (!GENERIC.test(m[3]) && m[2] !== "SVG" && m[2] !== "SVGVisualElement") names.set(p, m[3]);
  }
  return names;
}

// Parts the app draws itself: the phone's status bar and home indicator, and the frame's
// tab bar (PhoneTabs in components/frame/phone.tsx).
const FRAME_OWNED = new Set(["Status bar", "Tab bar", "Home indicator"]);

// The phone's own chrome, not ours: the status bar (text "9:41") and the home indicator
// (an empty 134px pill). Works on both the tailwind and the inline-styles export.
function isPhoneChrome(node) {
  if (!ts.isJsxElement(node) || tagName(node) !== "div") return false;
  const t = textOf(node).replace(/\s+/g, "");
  const src = node.getText();
  return t === "9:41" || (t === "" && src.length < 400 && /w-33\.5|w-\[134px\]|width: '134px'/.test(src));
}

const f = ts.factory;
const withAttr = (node, name, value, first = false) => {
  const a = f.createJsxAttribute(f.createIdentifier(name), f.createStringLiteral(value));
  const add = (props) => (first ? [a, ...props] : [...props, a]);
  if (ts.isJsxSelfClosingElement(node)) return f.updateJsxSelfClosingElement(node, node.tagName, node.typeArguments, f.updateJsxAttributes(node.attributes, add(node.attributes.properties)));
  const o = node.openingElement;
  return f.updateJsxElement(node, f.updateJsxOpeningElement(o, o.tagName, o.typeArguments, f.updateJsxAttributes(o.attributes, add(o.attributes.properties))), node.children, node.closingElement);
};
// data-layer="Compact head" (placed first) becomes a {/* Compact head */} line above the element.
const layerComments = (code) => code.replace(/\n( *)<([\w.]+) data-layer="([^"]+)"/g, "\n$1{/* $3 */}\n$1<$2");

function print(sf, transformer) {
  const out = ts.transform(sf, [transformer]).transformed[0];
  return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(out).replace(/^const __board = /, "").replace(/;\s*$/, "");
}

// Paper's Tailwind JSX -> app TSX. trace stamps data-pp paths for check.cjs.
function convert(src, { compName = "Board", trace = false, tree = null } = {}) {
  const sf = parse(src);
  const pp = paths(sf);
  const names = layerNames(tree, pp);
  const dropped = new Set();
  const icons = iconMap();
  const used = new Set();
  const notes = new Set();
  const unknownSvg = [];
  let root = true;
  let cur = "0"; // path of the element whose attributes are being visited

  const transformer = (ctx) => {
    const visit = (node) => {
      const layer = isEl(node) ? names.get(pp.get(node)) : null;
      if (FRAME_OWNED.has(layer)) { dropped.add(layer); return f.createJsxText("", false); }
      if (isPhoneChrome(node)) return f.createJsxText("", false);
      if (isEl(node) && tagName(node) === "svg") {
        const ds = [];
        const fills = [];
        const walk = (c) => { if (isEl(c) && tagName(c) === "path") { ds.push(norm(strAttr(c, "d") || "")); fills.push(strAttr(c, "fill") || ""); } ts.forEachChild(c, walk); };
        ts.forEachChild(node, walk);
        const name = icons.get(ds.join("|"));
        if (name) {
          used.add(name);
          const fm = (fills[0] || "").match(/var\(--color-([\w-]+)\)/);
          const props = [
            f.createJsxAttribute(f.createIdentifier("size"), f.createJsxExpression(undefined, f.createNumericLiteral(String(parseFloat(styleOf(node, "width") || strAttr(node, "width") || "16"))))),
            f.createJsxAttribute(f.createIdentifier("weight"), f.createStringLiteral("thin")),
            f.createJsxAttribute(f.createIdentifier("className"), f.createStringLiteral(["shrink-0", fm ? `text-${fm[1]}` : null].filter(Boolean).join(" "))),
            f.createJsxAttribute(f.createIdentifier("aria-hidden"), undefined),
          ];
          if (trace) props.push(f.createJsxAttribute(f.createIdentifier("data-pp"), f.createStringLiteral(pp.get(node))));
          return f.createJsxSelfClosingElement(f.createIdentifier(name), undefined, f.createJsxAttributes(props));
        }
        if (strAttr(node, "viewBox") === "0 0 256 256") unknownSvg.push(ds[0].slice(0, 40));
        return trace ? withAttr(node, "data-pp", pp.get(node)) : node;
      }
      if (ts.isJsxAttribute(node) && node.name.getText() === "className" && node.initializer && ts.isStringLiteral(node.initializer)) {
        let cls = rewriteClassName(node.initializer.text, notes);
        // The board's fixed 390px width is the phone; in the app the screen fills it.
        // A fixed board height is one phone screen: in the app that is "at least the viewport",
        // which keeps bottom-pinned bars and growing threads where Paper put them.
        // A bar pinned to the board's foot is pinned to the screen's in the app.
        if (/^0\.\d+$/.test(cur) && / absolute /.test(` ${cls} `) && / bottom-0 /.test(` ${cls} `)) { cls = cls.replace(/(^| )absolute( |$)/, "$1fixed$2"); notes.add("bottom bar pinned with fixed; the app's other bars use sticky bottom-0 + safe-area padding, swap if the route scrolls in a container"); }
        if (root) { root = false; cls = cls.replace(/(^| )w-\[(390|320)px\]( |$)/, "$1w-full$3").replace(/(^| )h-fit(?= |$)/, "").replace(/(^| )h-\[\d+px\](?= |$)/, "$1min-h-dvh"); }
        return f.updateJsxAttribute(node, node.name, f.createStringLiteral(cls));
      }
      // react/no-unescaped-entities fails CI on a straight quote in copy; the entity renders the same.
      if (ts.isJsxText(node) && /['">}]/.test(node.text)) return f.createJsxText(node.text.replace(/'/g, "&apos;").replace(/"/g, "&quot;").replace(/>/g, "&gt;").replace(/\}/g, "&#125;"), node.containsOnlyTriviaWhiteSpaces);
      if (isEl(node)) cur = pp.get(node);
      let out = ts.visitEachChild(node, visit, ctx);
      if (trace && isEl(node)) out = withAttr(out, "data-pp", pp.get(node));
      if (layer && pp.get(node) !== "0") out = withAttr(out, "data-layer", layer, true);
      return out;
    };
    return (n) => ts.visitNode(n, visit);
  };

  const body = layerComments(print(sf, transformer));
  if ([...names.values()].includes("Page head")) notes.add("page head kept: on tab screens the app frame's PhoneBar draws a title bar too; keep one");
  if (dropped.has("Tab bar")) notes.add("tab bar dropped: the app frame draws it (PhoneTabs); keep the body's bottom padding only if the route's layout lacks it");
  if (names.size === 0 && tree) notes.add("layer tree did not match the JSX; no section labels");
  const imports = used.size ? `import { ${[...used].sort().join(", ")} } from "@phosphor-icons/react/dist/ssr";\n\n` : "";
  const tsx = `${imports}// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.\nexport function ${compName}() {\n  return ${body};\n}\n`;
  const remaining = (tsx.match(/className="[^"]*"/g) || []).join(" ").match(/\S*\[[^\]]+\]\S*/g) || [];
  return { tsx, used, notes, unknownSvg, remaining };
}

// Paper's inline-styles JSX with only the phone chrome removed and paths stamped:
// the ground truth check.cjs renders next to the generated screen.
function reference(src, compName = "Reference", tree = null) {
  const sf = parse(src);
  const pp = paths(sf);
  const names = layerNames(tree, pp);
  const transformer = (ctx) => {
    const visit = (node) => {
      if (isEl(node) && FRAME_OWNED.has(names.get(pp.get(node)))) return f.createJsxText("", false);
      if (isPhoneChrome(node)) return f.createJsxText("", false);
      const out = ts.visitEachChild(node, visit, ctx);
      return isEl(node) ? withAttr(out, "data-pp", pp.get(node)) : out;
    };
    return (n) => ts.visitNode(n, visit);
  };
  return `export function ${compName}() {\n  return ${print(sf, transformer)};\n}\n`;
}

module.exports = { convert, reference, rewriteClass };

function run(inFile, outFile, compName) {
  const treeFile = inFile.replace(/\.jsx$/, ".tree.txt");
  const r = convert(fs.readFileSync(inFile, "utf8"), { compName, tree: fs.existsSync(treeFile) ? fs.readFileSync(treeFile, "utf8") : null });
  fs.writeFileSync(outFile, r.tsx);
  console.log(`${path.basename(outFile)}: ${r.used.size} icons${r.unknownSvg.length ? `, ${r.unknownSvg.length} UNMAPPED svg` : ""}, ${r.remaining.length} arbitrary values`);
  if (r.notes.size) console.log(`  check by hand:\n    ${[...r.notes].join("\n    ")}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "--all") {
    // node convert.cjs --all <pullDir> <outDir>: every board, named after its file ("order-detail" -> OrderDetailPhone).
    const [, inDir, outDir] = args;
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of fs.readdirSync(inDir).filter((x) => /^[\w-]+\.jsx$/.test(x))) {
      const n = f.slice(0, -4);
      run(path.join(inDir, f), path.join(outDir, `${n}.tsx`), n.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase()) + "Phone");
    }
  } else {
    const [inFile, outFile, compName = "Board"] = args;
    run(inFile, outFile, compName);
  }
}
