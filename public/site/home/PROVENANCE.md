# Home page (Mercury direction) — provenance

Every file here is drawn by the marketing pages (`components/site/`), first built from the Paper page
"32 Home · Mercury direction" in the file "SourceBD v4" (approved by the founder on 10 Oct 2026). The
sources sit outside the repo in `.impeccable/paper-assets/home-mercury/` (gitignored) and were converted once
by `scripts/home-assets.mjs` with ffmpeg 9.0.2 (gyan.dev full build: libwebp, libaom-av1, libx264, libvpx-vp9)
on 10 Oct 2026. sharp is not a dependency; nothing here was resized in the browser.

## Backdrops: Higgsfield stills

Made on the founder's Higgsfield account. No people, faces, text, logos or products: cloth, thread, paper and a
factory floor at night, so they claim nothing about any supplier. Round 1 (9 Oct 2026) made six and the hero
loop; round 2 (10 Oct 2026) made six with `gpt_image_2` at 2k (6.5 credits each). Round 1's job ids and still
model were not recorded. Each is AVIF (crf 30) and WebP (quality 78) at 1600 and 2560 wide. Since 22 Oct 2026
(the marketing critique, S3) the site keeps two cloths, cotton under a hero and weave under every feature row; the
other ten stills were deleted, and the night is drawn rather than photographed.

| Source | Round | Where it is drawn | Files |
| -- | -- | -- | -- |
| `hf-hero-cotton.png` | 1 | Every hero stage, the loop's poster | `hero-cotton-1600.avif` · `hero-cotton-1600.webp` · `hero-cotton-2560.avif` · `hero-cotton-2560.webp` |
| `hf-weave.png` | 1 | Every feature row's stage | `weave-1600.avif` · `weave-1600.webp` · `weave-2560.avif` · `weave-2560.webp` |

## The hero loop

`hf-hero-loop.mp4`: Higgsfield Seedance, 9 Oct 2026, 8 s, 1080p HEVC, 14.5 MB, cotton moving in north light.
Re-encoded silent at 1280×720: `hero-loop-720.mp4` (H.264 high, crf 27, faststart) and `hero-loop-720.webm`
(VP9, crf 38). The poster is the hero still above. The page loads it only after first paint, and never under
reduced motion or Save-Data.

## Screens

The Paper exports of the app as shipped on 9 Oct 2026 (`screen-*.webp`) and the 3 Oct captures under
`public/site/*.png` were deleted on 22 Oct 2026 (the marketing critique, S2): every picture of the product on the
site is now a component demo drawn from the committed snapshot of real records (`components/site/demos`,
`lib/marketing/demo-snapshot.json`), dated by its caption.
