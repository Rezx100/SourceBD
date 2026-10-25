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

const ff = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
const kb = (f) => `${Math.round(statSync(f).size / 1024)} KB`;

// The inner pages' clips (25 Oct 2026, components/site/clips.ts): each card the grid kit composed from a walk through
// the real app (`clip-<name>-master.mp4` and its first frame `clip-<name>-first.png`, E:\SourceBD-marketing\grid\rec\
// rollout.py) ships to public/site/<page>/ at the master's size, silent, as H.264 and VP9, the first frame its poster.
//   node scripts/home-assets.mjs --clips <masters folder> <page>
if (process.argv[2] === "--clips") {
  const [, , , MASTERS, PAGE] = process.argv;
  if (!MASTERS || !PAGE || !existsSync(MASTERS)) throw new Error("usage: node scripts/home-assets.mjs --clips <masters folder> <page>");
  const dir = join(import.meta.dirname, "..", "public", "site", PAGE);
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(MASTERS).filter((f) => f.endsWith("-master.mp4"))) {
    const name = file.replace(/-master\.mp4$/, "");
    const src = join(MASTERS, file);
    const base = join(dir, name);
    ff("-i", src, "-an", "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-profile:v", "high", "-movflags", "+faststart", `${base}.mp4`);
    ff("-i", src, "-an", "-vf", "format=yuv420p", "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", `${base}.webm`);
    ff("-i", join(MASTERS, `${name}-first.png`), "-c:v", "libwebp", "-quality", "84", `${base}.webp`);
    console.log(PAGE, name, kb(`${base}.mp4`), kb(`${base}.webm`), kb(`${base}.webp`));
  }
  process.exit(0);
}

const [SRC, REC] = process.argv.slice(2);
if (!SRC || (SRC !== "-" && !existsSync(SRC))) throw new Error("usage: node scripts/home-assets.mjs <stills folder | -> [<recordings folder>]");
const OUT = join(import.meta.dirname, "..", "public", "site", "home");
mkdirSync(OUT, { recursive: true });

/** Each photograph (`hf-<name>.png` in the source folder) and the widths it ships at. The hero is zoomed into, so it ships wider. */
const STILLS = {
  hero: [1600, 2560, 3840],
  // The hero's laptop and the desk round it (x 1122–2722, y 846–1746 of the 3840 plate) upscaled 2.56×, laid over the
  // plate while the opening zooms so the bezel stays sharp (founder's video 3, 22 Oct 2026: "the laptop edges get blurred").
  laptop: [2560, 4096],
};

for (const [name, widths] of SRC === "-" ? [] : Object.entries(STILLS)) {
  const src = join(SRC, `hf-${name}.png`);
  for (const w of widths) {
    const base = join(OUT, `${name}-${w}`);
    ff("-i", src, "-vf", `scale=${w}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", "80", "-compression_level", "6", `${base}.webp`);
    ff("-i", src, "-vf", `scale=${w}:-2:flags=lanczos,format=yuv420p`, "-c:v", "libaom-av1", "-still-picture", "1", "-crf", "30", "-cpu-used", "4", `${base}.avif`);
    console.log(name, w, kb(`${base}.webp`), kb(`${base}.avif`));
  }
}

// The parts of the app the sections show (`clip-<name>.*`) are not made here: they are composed in code from real
// captures, frame by frame, by the kit in .impeccable/preview/home-clips (PROVENANCE.md, "Animations of the real app").
// The tour's screens: each recording (`<name>.mp4`, a 4K master: 1440 × 900 drawn at 8/3, 3840 × 2400) ships silent at
// 2880 × 1800 as VP9 and H.264, with its first frame as the poster (`<name>.webp`, 2880 × 1800), so the window is
// never empty before it plays and stays sharp when the home page's opening zooms it to the whole screen. The search
// (`find.mp4`) is not shipped raw: the opening's dashboard is composed from its frames (`clip-find`, by the kit's
// hf-find project; PROVENANCE.md, "The opening's dashboard").
if (REC && existsSync(REC)) {
  for (const file of readdirSync(REC).filter((f) => ["check.mp4", "ask.mp4", "watch.mp4"].includes(f))) {
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
