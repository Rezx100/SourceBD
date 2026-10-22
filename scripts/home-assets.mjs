// Converts the marketing site's source assets into the web sizes under public/site/home/: the Higgsfield photographs
// (22 Oct 2026, the founder's video critique: one photographic world, the Bangladesh delta at first light, in place of
// the cloth stills) and the screen recordings of the real app. Run once by hand when a source changes; the outputs are
// committed and public/site/home/PROVENANCE.md says what each one is. Needs ffmpeg on the PATH (built against libwebp,
// libaom, libx264 and libvpx: the gyan.dev full build has all four); sharp is not a dependency of this repo.
//
//   node scripts/home-assets.mjs <stills folder> [<recordings folder>]
//   (the stills are .impeccable/paper-assets/home-v5, the recordings .impeccable/reference/app-recordings, both gitignored)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const [SRC, REC] = process.argv.slice(2);
if (!SRC || (SRC !== "-" && !existsSync(SRC))) throw new Error("usage: node scripts/home-assets.mjs <stills folder | -> [<recordings folder>]");
const OUT = join(import.meta.dirname, "..", "public", "site", "home");
mkdirSync(OUT, { recursive: true });

/** Each photograph (`hf-<name>.png` in the source folder) and the widths it ships at. The hero is zoomed into, so it ships wider. */
const STILLS = {
  hero: [1600, 2560, 3840],
  swatches: [1600, 2560],
  rail: [1600, 2560],
  port: [1600, 2560],
  dusk: [1600, 2560],
  mill: [1600, 2560],
  // The three objects on the night ground for Buy with confidence: a loupe, a padlock, a sealed container.
  loupe: [1200],
  lock: [1200],
  seal: [1200],
};

const ff = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`;

for (const [name, widths] of SRC === "-" ? [] : Object.entries(STILLS)) {
  const src = join(SRC, `hf-${name}.png`);
  for (const w of widths) {
    const base = join(OUT, `${name}-${w}`);
    ff("-i", src, "-vf", `scale=${w}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", "80", "-compression_level", "6", `${base}.webp`);
    ff("-i", src, "-vf", `scale=${w}:-2:flags=lanczos,format=yuv420p`, "-c:v", "libaom-av1", "-still-picture", "1", "-crf", "30", "-cpu-used", "4", `${base}.avif`);
    console.log(name, w, kb(`${base}.webp`), kb(`${base}.avif`));
  }
}

// Parts of the app's screens, for the feature cards: one frame of a recording (`at` seconds in, from the end when
// negative), cut to a box in the page's own 1440 × 900 units (the recording's own size is read, so a 4K master cuts
// the same box) and kept at 2× (`crop-<name>.webp`). The sizes are repeated in `Cut` (components/site/sections/browser.tsx).
const CROPS = {
  exports: ["record", 0.5, 232, 166, 872, 226],
  memberships: ["record", 0.5, 232, 600, 872, 228],
  buyers: ["record", 5.2, 232, 214, 872, 318],
  shipments: ["record", -0.3, 232, 286, 872, 420],
  attention: ["watch", -0.3, 244, 84, 810, 510],
  uflpa: ["watch", -0.3, 1068, 84, 352, 216],
};

const widthOf = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width", "-of", "csv=p=0", file]).toString().trim());

if (REC && existsSync(REC)) {
  for (const [name, [video, at, x, y, w, h]] of Object.entries(CROPS)) {
    const src = join(REC, `${video}.mp4`);
    const k = widthOf(src) / 1440;
    const seek = at < 0 ? ["-sseof", String(at)] : ["-ss", String(at)];
    const out = join(OUT, `crop-${name}.webp`);
    const px = (v) => Math.round(v * k);
    ff(...seek, "-i", src, "-frames:v", "1", "-vf", `crop=${px(w)}:${px(h)}:${px(x)}:${px(y)},scale=${w * 2}:${h * 2}:flags=lanczos`, "-c:v", "libwebp", "-quality", "86", out);
    console.log("crop", name, kb(out));
  }
}

// The app's screens: each recording (`<name>.mp4`, a 4K master: 1440 × 900 drawn at 8/3, 3840 × 2400) ships silent at
// 2880 × 1800 as VP9 and H.264, with its first frame as the poster (`<name>.webp`, 2880 × 1800), so the window is
// never empty before it plays and stays sharp when the home page's opening zooms it to the whole screen.
if (REC && existsSync(REC)) {
  for (const file of readdirSync(REC).filter((f) => f.endsWith(".mp4"))) {
    const name = file.replace(/\.mp4$/, "");
    const src = join(REC, file);
    const base = join(OUT, `app-${name}`);
    // A recording that has not changed since it was encoded is not encoded again.
    if (existsSync(`${base}.webm`) && statSync(`${base}.webm`).mtimeMs > statSync(src).mtimeMs) continue;
    ff("-i", src, "-an", "-vf", "scale=2880:1800:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-profile:v", "high", "-movflags", "+faststart", `${base}.mp4`);
    ff("-i", src, "-an", "-vf", "scale=2880:1800:flags=lanczos", "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", `${base}.webm`);
    ff("-i", src, "-frames:v", "1", "-vf", "scale=2880:1800:flags=lanczos", "-c:v", "libwebp", "-quality", "80", `${base}.webp`);
    console.log(name, kb(`${base}.mp4`), kb(`${base}.webm`), kb(`${base}.webp`));
  }
}
