# Marketing site pictures — provenance

Every file here is drawn by the marketing pages (`components/site/`). Since the founder's two videos of 22 Oct 2026
the site has one photographic world, the buyer's own (a sourcing studio in London, its swatches and sample rail, a
northern European port at night, the studio at dusk, and a factory floor for the suppliers' section), and every picture
of the product is the real app recorded from the admin account. The sources sit outside the repo (gitignored):
the photographs in `.impeccable/paper-assets/home-v5/`, the recordings in `.impeccable/reference/app-recordings/`.
`scripts/home-assets.mjs` converted them with ffmpeg 9.0.2 (gyan.dev full build: libwebp, libaom-av1, libx264,
libvpx-vp9) on 22 Oct 2026. sharp is not a dependency; nothing here is resized in the browser.

## Photographs: Higgsfield, 22 Oct 2026

Made on the founder's Higgsfield account with `gpt_image_2_5` (quality high; 4K for the photographs, 2K for the three
objects). No people, faces, text, logos, brand labels or products of any supplier, so they claim nothing about anyone.
Each ships as AVIF (crf 30) and WebP (quality 80) at the widths listed.

| Source | Job | Where it is drawn | Files |
| -- | -- | -- | -- |
| `hf-hero.png` (a London sourcing studio, the laptop facing the camera) | `b7decae1-6a25-4945-9cfe-64169f710e3b` | The home page's opening, zoomed into the laptop's screen | `hero-1600.avif` · `hero-1600.webp` · `hero-2560.avif` · `hero-2560.webp` · `hero-3840.avif` · `hero-3840.webp` |
| `hf-swatches.png` (swatch books in soft focus) | `cc4b5835-d424-4a42-a5f6-66316d39d87b` | Behind the product's window: inner heroes, Inside one record | `swatches-1600.avif` · `swatches-1600.webp` · `swatches-2560.avif` · `swatches-2560.webp` |
| `hf-rail.png` (a sample rail in soft focus) | `f6f6e589-c12c-4b2b-86eb-940fa44825ac` | Behind the product's window: the inner pages' feature rows | `rail-1600.avif` · `rail-1600.webp` · `rail-2560.avif` · `rail-2560.webp` |
| `hf-port.png` (a northern European container port at blue hour) | `bc7323e1-d11d-449c-bb7f-bcfe02409707` | Buy with confidence | `port-1600.avif` · `port-1600.webp` · `port-2560.avif` · `port-2560.webp` |
| `hf-dusk.png` (the studio at dusk, the London skyline lit) | `d6c8e04a-dad0-4638-94a0-29c6b896b86b` | The closing band on every page | `dusk-1600.avif` · `dusk-1600.webp` · `dusk-2560.avif` · `dusk-2560.webp` |
| `hf-mill.png` (a garment factory floor before the shift) | `a2a2ae62-7de2-4750-9cc6-d575d9f98d9f` | For suppliers | `mill-1600.avif` · `mill-1600.webp` · `mill-2560.avif` · `mill-2560.webp` |
| `hf-loupe.png` (a brass loupe on cotton twill) | `f924b88c-4d90-4d5e-af70-22593c1575cf` | Buy with confidence: the forced-labour checks | `loupe-1200.avif` · `loupe-1200.webp` |
| `hf-lock.png` (a padlock on linen swatches) | `e485cb9b-3d19-4344-b42d-8558fe5be77e` | Buy with confidence: the locked contacts | `lock-1200.avif` · `lock-1200.webp` |
| `hf-seal.png` (a sealed shipping container) | `6a13c918-5b5a-4fa8-9da0-20064871806d` | Buy with confidence: the sanctions warning | `seal-1200.avif` · `seal-1200.webp` |

The laptop's screen in `hf-hero.png` was measured from the pixels (the dark flat field from its centre): 40.26% from
the left, 49.40% from the top, 19.32% wide, 21.16% high (`SCREEN` in `sections/opening.tsx`).

## Recordings of the real app

Recorded on 22 Oct 2026 from the admin account, in a headless Chrome on a temporary profile the founder signed in to
(deleted after the takes), at 1440 × 900 drawn at 8/3: true 4K masters of 3840 × 2400, kept outside the repo. Each walk
ran eight times slower than life, the page's own animations included, and plays back at speed at 30 frames a second.
A drawn pointer shows what is clicked and, where a part is shown, the rest is dimmed and softly blurred. Nothing was
submitted: the RFQ walk stops when the request opens, with nothing typed in it. Each ships at 2880 × 1800 as H.264
(crf 24) and VP9 (crf 34), with its first frame as the poster.

| Recording | What it shows | Files |
| -- | -- | -- |
| `find` | “knit GOTS” typed on the search page, the 606 results, Aboni Knitwear pointed at | `app-find.mp4` · `app-find.webm` · `app-find.webp` |
| `check` | Aboni Knitwear opened beside the results, then its certificates and checks | `app-check.mp4` · `app-check.webm` · `app-check.webp` |
| `record` | Aboni Knitwear's full record read from the top: exports, key facts, memberships, buyers, markets | `app-record.mp4` · `app-record.webm` · `app-record.webp` |
| `watch` | The Compliance hub: ten certificates that need attention across the saved list | `app-watch.mp4` · `app-watch.webm` · `app-watch.webp` |
| `saved` | The saved list of eighteen suppliers, three ticked, Send one RFQ in the bar | `app-saved.mp4` · `app-saved.webm` · `app-saved.webp` |
| `ask` | Three saved suppliers ticked, then the request opening beside the list | `app-ask.mp4` · `app-ask.webm` · `app-ask.webp` |

## Parts of the app

Single frames of the recordings, cut to one part and kept at 2× (`CROPS` in `scripts/home-assets.mjs`), shown as cards
on the product panel: `crop-exports.webp` (the record's export figures), `crop-memberships.webp` (its EPB, BGMEA,
BKMEA and BGAPMEA entries), `crop-buyers.webp` (the brands it ships to), `crop-shipments.webp` (its latest
shipments), `crop-attention.webp` (the Compliance hub's certificates) and `crop-uflpa.webp` (the UFLPA checks).
