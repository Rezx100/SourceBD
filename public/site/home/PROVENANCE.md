# Home page (Mercury direction) — provenance

Every file here is drawn by the home page at `/` (`components/site/home/`), built from the Paper page
"32 Home · Mercury direction" in the file "SourceBD v4" (approved by the founder on 10 Oct 2026). The
sources sit outside the repo in `.impeccable/paper-assets/home-mercury/` (gitignored) and were converted once
by `scripts/home-assets.mjs` with ffmpeg 9.0.2 (gyan.dev full build: libwebp, libaom-av1, libx264, libvpx-vp9)
on 10 Oct 2026. sharp is not a dependency; nothing here was resized in the browser.

## Backdrops: Higgsfield stills

Made on the founder's Higgsfield account. No people, faces, text, logos or products: cloth, thread, paper and a
factory floor at night, so they claim nothing about any supplier. Round 1 (9 Oct 2026) made six and the hero
loop; round 2 (10 Oct 2026) made six with `gpt_image_2` at 2k (6.5 credits each). Round 1's job ids and still
model were not recorded. Each is AVIF (crf 34) and WebP (quality 78) at 1600 and 2560 wide.

| Source | Round | Where it is drawn | Files |
| -- | -- | -- | -- |
| `hf-hero-cotton.png` | 1 | Hero stage, the loop's poster; showcase row 1 | `hero-cotton-1600.avif` · `hero-cotton-1600.webp` · `hero-cotton-2560.avif` · `hero-cotton-2560.webp` |
| `hf-thread-cones.png` | 1 | Showcase row 2 (quotes) | `thread-cones-1600.avif` · `thread-cones-1600.webp` · `thread-cones-2560.avif` · `thread-cones-2560.webp` |
| `hf-weave.png` | 1 | Showcase row 3 (compliance) | `weave-1600.avif` · `weave-1600.webp` · `weave-2560.avif` · `weave-2560.webp` |
| `hf-thread-cone.png` | 2 | Showcase row 4 (record pane) | `thread-cone-1600.avif` · `thread-cone-1600.webp` · `thread-cone-2560.avif` · `thread-cone-2560.webp` |
| `hf-carton.png` | 2 | Showcase row 5 (messages) | `carton-1600.avif` · `carton-1600.webp` · `carton-2560.avif` · `carton-2560.webp` |
| `hf-paper-seal.png` | 1 | Inside one record | `paper-seal-1600.avif` · `paper-seal-1600.webp` · `paper-seal-2560.avif` · `paper-seal-2560.webp` |
| `hf-hangtags-fanned.png` | 2 | Real records, not reviews | `hangtags-fanned-1600.avif` · `hangtags-fanned-1600.webp` · `hangtags-fanned-2560.avif` · `hangtags-fanned-2560.webp` |
| `hf-selvedge.png` | 2 | Platform grid, at 16 % | `selvedge-1600.avif` · `selvedge-1600.webp` · `selvedge-2560.avif` · `selvedge-2560.webp` |
| `hf-night-eyelet.png` | 2 | Buy with confidence | `night-eyelet-1600.avif` · `night-eyelet-1600.webp` · `night-eyelet-2560.avif` · `night-eyelet-2560.webp` |
| `hf-cutting-table.png` | 2 | For suppliers | `cutting-table-1600.avif` · `cutting-table-1600.webp` · `cutting-table-2560.avif` · `cutting-table-2560.webp` |
| `hf-hangtag.png` | 1 | Three things we never do | `hangtag-1600.avif` · `hangtag-1600.webp` · `hangtag-2560.avif` · `hangtag-2560.webp` |
| `hf-night-floor.png` | 1 | Closing split | `night-floor-1600.avif` · `night-floor-1600.webp` · `night-floor-2560.avif` · `night-floor-2560.webp` |

## The hero loop

`hf-hero-loop.mp4`: Higgsfield Seedance, 9 Oct 2026, 8 s, 1080p HEVC, 14.5 MB, cotton moving in north light.
Re-encoded silent at 1280×720: `hero-loop-720.mp4` (H.264 high, crf 27, faststart) and `hero-loop-720.webm`
(VP9, crf 38). The poster is the hero still above. The page loads it only after first paint, and never under
reduced motion or Save-Data.

## Screens: the product as shipped

Paper exports of page "33 App · as shipped 9 Oct (b4b85e8)": the buyer app rendered from commit `b4b85e8`
(production since 9 Oct 2026) over a fixture client, with the search rows and Aboni Knitwear Ltd's record read
from production through the anon RPCs on 10 Oct 2026. The sanctioned record's company is the placeholder
"Example Apparel Ltd"; no real company is shown as sanctioned. `full-certs2` is a Chrome shot of the record
scrolled to its certificates (the layer import overlapped a sticky block). Desktop screens (1440×900 artboards,
exported at 2x) are WebP quality 82 at 1440 and 2880 wide; phone screens (390×844) at 390 and 780 wide, the
tall record cut to its first screen.

| Artboard | Files |
| -- | -- |
| results | `screen-results-1440.webp` · `screen-results-2880.webp` · `screen-results-m-390.webp` · `screen-results-m-780.webp` |
| saved-selected | `screen-saved-selected-1440.webp` · `screen-saved-selected-2880.webp` · `screen-saved-selected-m-390.webp` · `screen-saved-selected-m-780.webp` |
| rfq-detail | `screen-rfq-detail-1440.webp` · `screen-rfq-detail-2880.webp` · `screen-rfq-detail-m-390.webp` · `screen-rfq-detail-m-780.webp` |
| compliance | `screen-compliance-1440.webp` · `screen-compliance-2880.webp` · `screen-compliance-m-390.webp` · `screen-compliance-m-780.webp` |
| record | `screen-record-1440.webp` · `screen-record-2880.webp` |
| messages-thread | `screen-messages-thread-1440.webp` · `screen-messages-thread-2880.webp` · `screen-messages-thread-m-390.webp` · `screen-messages-thread-m-780.webp` |
| full-certs2 | `screen-full-certs2-1440.webp` · `screen-full-certs2-2880.webp` · `screen-full-certs2-m-390.webp` · `screen-full-certs2-m-780.webp` |
| record-sanctioned | `screen-record-sanctioned-1440.webp` · `screen-record-sanctioned-2880.webp` |
| full | `screen-full-1440.webp` · `screen-full-2880.webp` |
| settings-members | `screen-settings-members-1440.webp` · `screen-settings-members-2880.webp` |
| landing | `screen-landing-1440.webp` · `screen-landing-2880.webp` |

The phone exports of `record` and `record-sanctioned` came out of Paper as the search list, so the phone page
draws the search list in those two places, as the approved phone board does. Re-shoot them with the recipe in
the memory note `home-mercury-paper-page` before relying on them.
