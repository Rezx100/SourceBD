// Converts the home page's source assets (Higgsfield stills, Paper exports of the as-shipped screens, the hero loop)
// into the web sizes under public/site/home/. Run once by hand when a source changes; the outputs are committed and
// public/site/home/PROVENANCE.md says what each one is. Needs ffmpeg on the PATH (built against libwebp, libaom and
// libx264, libvpx: the gyan.dev full build has all four); sharp is not a dependency of this repo.
//
//   node scripts/home-assets.mjs <source folder>     (the folder is .impeccable/paper-assets/home-mercury, gitignored)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) throw new Error("usage: node scripts/home-assets.mjs <source folder>");
const OUT = join(import.meta.dirname, "..", "public", "site", "home");
mkdirSync(OUT, { recursive: true });

/** The backdrops, by their name in the page (`hf-<name>.png` in the source folder). */
export const STILLS = ["hero-cotton", "thread-cones", "weave", "thread-cone", "carton", "paper-seal", "hangtags-fanned", "selvedge", "night-eyelet", "cutting-table", "hangtag", "night-floor"];
/** The desktop screens (`paper-<name>@2x.png`, 2880×1800). */
export const SCREENS = ["results", "saved-selected", "rfq-detail", "compliance", "record", "messages-thread", "full-certs2", "record-sanctioned", "full", "settings-members", "landing"];
/** The phone screens (`paper-<name>-m@2x.png`, 780 wide; the record at Certificates is cut to one 390×844 screen). */
export const PHONE = ["results", "saved-selected", "rfq-detail", "compliance", "messages-thread", "full-certs2"];

const ff = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`;

for (const name of STILLS) {
  const src = join(SRC, `hf-${name}.png`);
  for (const w of [1600, 2560]) {
    const base = join(OUT, `${name}-${w}`);
    ff("-i", src, "-vf", `scale=${w}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", "78", "-compression_level", "6", `${base}.webp`);
    ff("-i", src, "-vf", `scale=${w}:-2:flags=lanczos,format=yuv420p`, "-c:v", "libaom-av1", "-still-picture", "1", "-crf", "34", "-cpu-used", "4", `${base}.avif`);
    console.log(name, w, kb(`${base}.webp`), kb(`${base}.avif`));
  }
}

for (const name of SCREENS) {
  const src = join(SRC, `paper-${name}@2x.png`);
  for (const w of [1440, 2880]) {
    const out = join(OUT, `screen-${name}-${w}.webp`);
    ff("-i", src, "-vf", `scale=${w}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", "82", "-compression_level", "6", out);
    console.log("screen", name, w, kb(out));
  }
}

for (const name of PHONE) {
  const src = join(SRC, `paper-${name}-m@2x.png`);
  for (const w of [390, 780]) {
    const out = join(OUT, `screen-${name}-m-${w}.webp`);
    ff("-i", src, "-vf", `crop=780:1688:0:0,scale=${w}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", "82", "-compression_level", "6", out);
    console.log("phone", name, w, kb(out));
  }
}

// The loop: 8 s, silent, 1280×720. H.264 for every browser, VP9 for the ones that take it first.
const loop = join(SRC, "hf-hero-loop.mp4");
const mp4 = join(OUT, "hero-loop-720.mp4");
const webm = join(OUT, "hero-loop-720.webm");
ff("-i", loop, "-an", "-vf", "scale=1280:720:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-profile:v", "high", "-movflags", "+faststart", mp4);
ff("-i", loop, "-an", "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libvpx-vp9", "-crf", "38", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", webm);
console.log("loop", kb(mp4), kb(webm));
