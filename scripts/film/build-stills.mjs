// Shoots the home film's still pictures (spec-home-film §3.5, v2): what the lite and still tiers show instead of
// the live WebGL planet and the live city. They come from the same engines, data and tokens the page uses, drawn
// in the installed Chrome and encoded as AVIF with the sharp that Next.js installs, into public/site/film/:
//
//   planet.avif                       1440x900, night: the still tier's first screen
//   planet-upright.avif               390x844, night: the same on an upright screen
//   city-belt.avif                    1200x750, night: the belt from straight above, its blocks still lights
//   city-site.avif                    1200x750, night: the close on the story's block in Kashimpur, its beam on
//
// Usage: node scripts/film/build-stills.mjs   (after pnpm install; Chrome must be installed, nothing is downloaded)
// The engine is transpiled and the stylesheet built into a temporary folder that is removed at the end. The four
// files must each stay under 160,000 bytes (components/site/film/film.test.ts).

import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
// sharp is Next.js's own dependency, not ours: it lives only in pnpm's store.
const sharpDir = readdirSync(path.join(root, "node_modules/.pnpm")).find((d) => d.startsWith("sharp@"));
if (!sharpDir) throw new Error("sharp not found under node_modules/.pnpm (does pnpm install bring Next.js?)");
const sharp = require(path.join(root, "node_modules/.pnpm", sharpDir, "node_modules/sharp"));
const out = path.join(root, "public/site/film");
const tmp = mkdtempSync(path.join(tmpdir(), "sourcebd-film-stills-"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };

try {
  // The engine as ES modules, the relative imports pointed at the .js files.
  mkdirSync(path.join(tmp, "engine"));
  for (const name of ["planet", "city"]) {
    const src = readFileSync(path.join(root, `components/site/film/engine/${name}.ts`), "utf8");
    const js = ts.transpileModule(src, { compilerOptions: { module: "esnext", target: "es2022" } }).outputText.replace(/from "(\.\/[a-z]+)"/g, 'from "$1.js"');
    writeFileSync(path.join(tmp, "engine", `${name}.js`), js);
  }

  // A bare stage: the page's CSS and theme opt-in, and the planet's and the city's canvases in a night scope.
  writeFileSync(
    path.join(tmp, "stills.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>stills</title><link rel="stylesheet" href="film.css">
<style>body{margin:0} #planet{position:relative;width:100vw;height:100vh;background:rgb(var(--ds-surface))} #planet canvas{position:absolute;inset:0;width:100%;height:100%} #city{position:relative;width:1200px;height:750px;background:rgb(var(--ds-surface))} #city canvas{position:absolute;inset:0;width:100%;height:100%}</style></head>
<body><main data-film data-theme-auto class="font-sans text-ink">
<div id="planet" data-ground="night"><canvas data-planet></canvas></div>
<div id="city" data-ground="night"><canvas data-city></canvas></div>
</main>
<script type="module">
import { createPlanet } from "./engine/planet.js";
import { createCity } from "./engine/city.js";
const cells = await (await fetch("/site/film/cells.json")).json();
const img = new Image(); img.src = "/site/film/land.png"; await img.decode();
const c = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
c.getContext("2d").drawImage(img, 0, 0);
const mask = c.getContext("2d").getImageData(0, 0, img.width, img.height);
window.planet = createPlanet(document.querySelector("canvas[data-planet]"), { mask, cells: cells.cells, samples: 60000, maxDpr: 1 });
const bd = await (await fetch("/site/film/bd.json")).json();
window.city = createCity(document.querySelector("canvas[data-city]"), { bd, cells: cells.cells, chosen: cells.chosen, maxDpr: 1, centred: true });
document.documentElement.dataset.ready = "1";
</script></body></html>`,
  );

  // The page's stylesheet (tokens, themes, the few utilities the stage names), built by the Tailwind CLI.
  execFileSync(process.execPath, [path.join(root, "node_modules/tailwindcss/lib/cli.js"), "-c", "tailwind.config.ts", "-i", "app/ds.css", "-o", path.join(tmp, "film.css"), "--content", path.join(tmp, "stills.html")], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });

  // The stage first, then the worktree, then public/ (for the film's data).
  const roots = [tmp, root, path.join(root, "public")];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/favicon.ico") return res.writeHead(204).end(); // Chrome asks; nothing to say and no error to log
    const file = roots.map((r) => path.join(r, url)).find((f, i) => f.startsWith(roots[i]) && existsSync(f) && statSync(f).isFile());
    if (!file) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/stills.html`;

  const encode = async (png, name, quality) => {
    const buf = await sharp(png).avif({ quality, effort: 6 }).toBuffer();
    writeFileSync(path.join(out, `${name}.avif`), buf);
    console.log(`${name}.avif ${buf.length} bytes`);
  };

  const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
  const open = async (scheme, viewport) => {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && console.log(`console: ${m.text().slice(0, 200)}`));
    await page.goto(url);
    await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 30000 });
    return { ctx, page };
  };

  // The planet at rest, as the first screen shows it, at the two shapes of screen.
  for (const [name, viewport] of [["planet", { width: 1440, height: 900 }], ["planet-upright", { width: 390, height: 844 }]]) {
    const { ctx, page } = await open("dark", viewport);
    await page.waitForTimeout(2500);
    await encode(await page.locator("canvas[data-planet]").screenshot({ omitBackground: false }), name, 60);
    await ctx.close();
  }

  // The city, night in either theme: over Dhaka with the towers risen, and the close on the story's block.
  {
    const { ctx, page } = await open("dark", { width: 1200, height: 900 });
    for (const [name, p] of [["city-belt", 0.12], ["city-site", 1]]) {
      await page.evaluate((p) => window.city.setProgress(p), p);
      await page.waitForTimeout(2500);
      await encode(await page.locator("#city").screenshot(), name, 55);
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log("done →", out);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
