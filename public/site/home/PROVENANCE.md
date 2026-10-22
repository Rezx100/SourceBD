# Marketing site pictures — provenance

Every file here is drawn by the marketing pages (`components/site/`). Since the founder's videos of 22 Oct 2026 the
site has one photographic world, the buyer's own (a sourcing studio in London, its swatches and sample rail, a northern
European port at night, the studio at dusk, and a factory floor for the suppliers' section), and every picture of the
product is the real app: the tour's recordings, and parts of the app animated in code from real captures. No AI model
drew or changed any part of the app: on 22 Oct 2026 a Higgsfield video model was tried on one part (job
`bcea5ed0-a8e8-452d-8d11-8c5666ed5b3e`, `flux_3_video`) and rewrote the BGAPMEA logo as "BOARMEA", so the founder chose
the code way for all of them. The sources sit outside the repo (gitignored): the photographs in
`.impeccable/paper-assets/home-v5/`, the recordings in `.impeccable/reference/app-recordings/`, the captures and the
kit that animates them in `.impeccable/preview/home-clips/`. ffmpeg 9.0.2 (gyan.dev full build: libwebp, libaom-av1,
libx264, libvpx-vp9) converted them on 22 Oct 2026. sharp is not a dependency; nothing here is resized in the browser.

## Photographs: Higgsfield, 22 Oct 2026

Made on the founder's Higgsfield account with `gpt_image_2_5` (quality high, 4K). No people, faces, text, logos, brand
labels or products of any supplier, so they claim nothing about anyone. Each ships as AVIF (crf 30) and WebP (quality
80) at the widths listed (`scripts/home-assets.mjs`).

| Source | Job | Where it is drawn | Files |
| -- | -- | -- | -- |
| `hf-hero.png` (a London sourcing studio, the laptop facing the camera) | `b7decae1-6a25-4945-9cfe-64169f710e3b` | The home page's opening, zoomed into the laptop's screen | `hero-1600.avif` · `hero-1600.webp` · `hero-2560.avif` · `hero-2560.webp` · `hero-3840.avif` · `hero-3840.webp` |
| `hf-laptop.png` (the hero's laptop and the desk round it, x 1122–2722, y 846–1746 of the 3840 plate, upscaled 2.56× by `bytedance_image_upscale`, job `7b08fe56-14a3-428d-a12a-8660d82267ea`) | `b7decae1-6a25-4945-9cfe-64169f710e3b` | Laid over the hero while the opening zooms, so the laptop's edges stay sharp | `laptop-2560.avif` · `laptop-2560.webp` · `laptop-4096.avif` · `laptop-4096.webp` |
| `hf-swatches.png` (swatch books in soft focus) | `cc4b5835-d424-4a42-a5f6-66316d39d87b` | Behind the product's window: inner heroes, Inside one record | `swatches-1600.avif` · `swatches-1600.webp` · `swatches-2560.avif` · `swatches-2560.webp` |
| `hf-rail.png` (a sample rail in soft focus) | `f6f6e589-c12c-4b2b-86eb-940fa44825ac` | Behind the product's window: the inner pages' feature rows | `rail-1600.avif` · `rail-1600.webp` · `rail-2560.avif` · `rail-2560.webp` |
| `hf-port.png` (a northern European container port at blue hour) | `bc7323e1-d11d-449c-bb7f-bcfe02409707` | Buy with confidence | `port-1600.avif` · `port-1600.webp` · `port-2560.avif` · `port-2560.webp` |
| `hf-dusk.png` (the studio at dusk, the London skyline lit) | `d6c8e04a-dad0-4638-94a0-29c6b896b86b` | The closing band on every page | `dusk-1600.avif` · `dusk-1600.webp` · `dusk-2560.avif` · `dusk-2560.webp` |
| `hf-mill.png` (a garment factory floor before the shift) | `a2a2ae62-7de2-4750-9cc6-d575d9f98d9f` | For suppliers | `mill-1600.avif` · `mill-1600.webp` · `mill-2560.avif` · `mill-2560.webp` |

The laptop's display in `hf-hero.png` was measured from the pixels (the display's flat grey field inside its black
bezel): its corners at (1552, 1068), (2279, 1068), (2287, 1522) and (1546, 1522) of 3840 × 2160 (`DISPLAY` in
`sections/opening.tsx`), so the app is pinned to all four.

## Recordings of the real app (the tour)

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
| `watch` | The Compliance hub: ten certificates that need attention across the saved list | `app-watch.mp4` · `app-watch.webm` · `app-watch.webp` |
| `ask` | Three saved suppliers ticked, then the request opening beside the list | `app-ask.mp4` · `app-ask.webm` · `app-ask.webp` |

## Animations of the real app (the sections), 22 Oct 2026

Each is one part of the app at reading size, after mercury.com's product clips (one part crisp, the rest of the page
dimmed and blurred by distance, rows lifting in turn, a slow camera, holds between short eased moves). The pixels of
the app are cut from screenshots of the real pages at 8/3 (3840 px across 1440 CSS px), taken by headless Chrome:
signed in on the founder's temporary admin profile (deleted after the captures), or signed out for the public pages.
The record's sections were captured as the app draws them in a window 430 px wide, where each section is one column
and its text stays large inside a card; the search and the record's head at 1440. A page in the kit (`scene.html`)
lays the cuts on the ground and moves them; headless Chrome draws it frame by frame at 30 fps, and each ships as
H.264 (crf 24) and VP9 (crf 34) with its first frame as the poster. Every letter and number is the app's own; the
text was checked against the live pages on the day. The only things the kit draws are the ground, the shadows, the
pointer and its click ring. Captures opened a menu and ticked a filter; nothing was typed, saved or sent.

| Clip | What it shows | Captured from | Files |
| -- | -- | -- | -- |
| `filters` | The search's Certificates menu: GOTS ticked, 10,048 suppliers narrowing to 587, then unticked | `/app/discover` and `/app/discover?cert=gots:valid`, signed in | `clip-filters.mp4` · `clip-filters.webm` · `clip-filters.webp` |
| `buyers` | Aboni Knitwear's Buyers: the brands' own supplier lists and customs records | `/app/suppliers/aboni-knitwear`, signed in | `clip-buyers.mp4` · `clip-buyers.webm` · `clip-buyers.webp` |
| `shipments` | Aboni Knitwear's markets and its latest customs shipments | `/app/suppliers/aboni-knitwear`, signed in | `clip-shipments.mp4` · `clip-shipments.webm` · `clip-shipments.webp` |
| `certificates` | Aboni Knitwear's certificates with their numbers and dates | `/app/suppliers/aboni-knitwear`, signed in | `clip-certificates.mp4` · `clip-certificates.webm` · `clip-certificates.webp` |
| `record` | Aboni Knitwear's record head and export figures, the camera drifting in and out | `/app/suppliers/aboni-knitwear`, signed in | `clip-record.mp4` · `clip-record.webm` · `clip-record.webp` |
| `keyfacts` | Aboni Knitwear's key facts | `/app/suppliers/aboni-knitwear`, signed in | `clip-keyfacts.mp4` · `clip-keyfacts.webm` · `clip-keyfacts.webp` |
| `memberships` | Aboni Knitwear's four memberships, each lifting in turn (the pilot the founder approved) | frame 0.5 s of the `record` master | `clip-memberships.mp4` · `clip-memberships.webm` · `clip-memberships.webp` |
| `safety` | Aboni Knitwear's RSC safety record | `/app/suppliers/aboni-knitwear`, signed in | `clip-safety.mp4` · `clip-safety.webm` · `clip-safety.webp` |
| `sources` | Aboni Knitwear's sources in trust order | `/app/suppliers/aboni-knitwear`, signed in | `clip-sources.mp4` · `clip-sources.webm` · `clip-sources.webp` |
| `sanctions` | Aboni Knitwear's sanctions lists: not listed, each list with the day it was read (no supplier is sanctioned today, so no sanctioned record exists to show) | `/app/suppliers/aboni-knitwear`, signed in | `clip-sanctions.mp4` · `clip-sanctions.webm` · `clip-sanctions.webp` |
| `uflpa` | The Compliance hub's UFLPA checks on the saved list | `/app/compliance`, signed in | `clip-uflpa.mp4` · `clip-uflpa.webm` · `clip-uflpa.webp` |
| `locked` | A public record's contact panel, locked, a pointer resting on Sign up to contact | `/suppliers/aboni-knitwear`, signed out | `clip-locked.mp4` · `clip-locked.webm` · `clip-locked.webp` |
| `real-mondol` | Mondol Fabrics' public record, scrolled for real to its GOTS certificate, zoomed in and out | `/suppliers/mondol-fabrics`, signed out | `clip-real-mondol.mp4` · `clip-real-mondol.webm` · `clip-real-mondol.webp` |
| `real-aboni` | Aboni Knitwear's public record, scrolled to its WRAP certificate | `/suppliers/aboni-knitwear`, signed out | `clip-real-aboni.mp4` · `clip-real-aboni.webm` · `clip-real-aboni.webp` |
| `real-liberty` | Liberty Knitwear's public record, scrolled to its RSC safety inspections | `/suppliers/liberty-knitwear`, signed out | `clip-real-liberty.mp4` · `clip-real-liberty.webm` · `clip-real-liberty.webp` |
