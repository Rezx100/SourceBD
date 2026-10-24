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
| `find` | “knit GOTS” typed on the search page, the 606 results, Aboni Knitwear pointed at. **Not shipped raw**: the opening's dashboard is composed from its frames (below) | the master only |
| `check` | Aboni Knitwear opened beside the results, then its certificates and checks | `app-check.mp4` · `app-check.webm` · `app-check.webp` |
| `watch` | The Compliance hub: ten certificates that need attention across the saved list | `app-watch.mp4` · `app-watch.webm` · `app-watch.webp` |
| `ask` | Three saved suppliers ticked, then the request opening beside the list | `app-ask.mp4` · `app-ask.webm` · `app-ask.webp` |

## The opening's dashboard (the tour's Find), composed, 22 Oct 2026

The founder's review of 22 Oct 14:18: the dashboard in the opening must come alive, as mercury.com's does, and in
HyperFrames (the local HTML compositions rendered to video, `npx skills add heygen-com/hyperframes`). `clip-find` is a
HyperFrames composition (`.impeccable/preview/home-clips/hf-find/`, `build-find.cjs` writes it; HyperFrames 0.8.185
rendered it frame by frame in Chrome at 2880 × 1800, 30 fps; ffmpeg encoded the frames as the other clips). Every
pixel of the app is cut from four frames of the `find` recording's 4K master (0 s, the landing; 5.4 s, the field
focused with “knit GOTS” typed; 7.4 s and 12.5 s, the results, Aboni Knitwear's row plain and in its hover state),
each scaled to 2880 × 1800 with lanczos once and laid at 1:1, so nothing is resampled twice. The recorder's drawn
pointer was painted out of flat colour where it stood (white page, the row's hover grey); no other pixel of the app
was touched, and no AI model touched any. What the composition draws itself: the page's white, the field's caret, the
glass lift's hairline and shadow on the pointed-at row, the pointer and its click ring.

| Clip | What it shows | Composed from | Files |
| -- | -- | -- | -- |
| `find` | The search landing, complete; the pointer takes the field, “knit GOTS” is typed a letter at a time (the typed field's own pixels uncovered), Search is clicked; the landing's panels leave into a soft blur as the field rises into the bar; the chip row, the table's head, its eleven rows one after another and its foot arrive; the pointer finds Aboni Knitwear, whose row takes its hover and lifts, then its Open control. 10.6 s, so the next recording (the record opening beside the results) starts where this ends | the `find` master at 0, 5.4, 7.4 and 12.5 s, signed in | `clip-find.mp4` · `clip-find.webm` · `clip-find.webp` |

## The opening's tour in the dark theme, 24 Oct 2026

The founder's review of 24 Oct 2026: as the studio falls into the night the opening's light picture turns dark in place,
and beside the list each item plays one of four product flows cut after mercury.com's `flow_1..4`. The flows are the
real app in its dark theme on sourcebd.net, recorded on 24 Oct 2026 (after release #594 softened the dark hairlines)
from the admin account in a headless Chrome on a temporary profile the founder signed in to, at 1440 × 900 drawn at DPR 2
and slowed down. Nothing was written: the RFQ was filled in and never sent, the pointer resting on Send. The compositor (outside the repo, `E:\SourceBD-marketing\flows\rec\comp.py`, run
with `FLOW_WEB=1`) only crops, retimes, eases the view, blurs and fades those frames; it draws the dark window ground
(the app's ink #15181C) and nothing else. Each ships at 2880 × 1800 as H.264 (crf 24) and VP9 (crf 34), with its first
frame as the poster; no AI model touched any pixel.

| Clip | What it shows | Files |
| -- | -- | -- |
| `dark-search` | The search page whole (the picture the opening leaves), the view coming in on the recent searches, knit GOTS opened, the 606 results scrolled, Benchmark Apparels' record beside them | `clip-dark-search.mp4` · `clip-dark-search.webm` · `clip-dark-search.webp` |
| `dark-record` | Aboni Knitwear's export figures, Markets and shipments clicked, scrolled to the latest shipments, then the Saved list resting on Aboni Knitwear | `clip-dark-record.mp4` · `clip-dark-record.webm` · `clip-dark-record.webp` |
| `dark-rfq` | The Saved list, three suppliers ticked, Send one RFQ to 3, the composer read from the top (Men's knitted piqué polo, 220 gsm; 24,000 pieces; US$4.80 a piece; ship by 15 Jan 2027 to the United Kingdom), the pointer resting on Send to 3 suppliers, never clicked | `clip-dark-rfq.mp4` · `clip-dark-rfq.webm` · `clip-dark-rfq.webp` |
| `dark-sort` | The woven shirt WRAP results (160 suppliers), the rows coming into focus from the top (a focus sweep over the real rows), the view moving left to the names, sorted by supplier | `clip-dark-sort.mp4` · `clip-dark-sort.webm` · `clip-dark-sort.webp` |

The laptop's light picture, `clip-light-search.webp`, is `dark-search`'s first frame taken again in the light theme
(the founder's review of 24 Oct 2026: the 22 Oct `clip-find` picture showed the older search page, so it did not line
up with the dark one it turns into). Same day, account, recorder and walk (`rec.py f1` with `THEME=light`, the
`sb-theme` cookie and `prefers-color-scheme` set to light), the woven shirt WRAP search opened first so the recent
searches stand in the same order; the compositor drew its first frame as it drew the dark one's (`FLOW_WEB=1`, the take
read from `takes-light\`) and ffmpeg wrote it as WebP (quality 82). Laid at half strength over the dark frame, every
line meets its twin. No AI model touched any pixel.

## Animations of the real app (the sections), 22 Oct 2026

Each is one part of the app at reading size, after mercury.com's product clips. The pixels of the app are cut from
screenshots of the real pages at 8/3 (3840 px across 1440 CSS px), taken by headless Chrome: signed in on the founder's
temporary admin profile (deleted after the captures), or signed out for the public pages. The record's sections were
captured as the app draws them in a window 430 px wide, where each section is one column and its text stays large
inside a card; the search and the record's head at 1440. A page in the kit (`scene.html`) lays the cuts on the ground
and moves them; headless Chrome draws it frame by frame at 30 fps, and each ships as H.264 (crf 24) and VP9 (crf 34)
with its first frame as the poster. Every letter and number is the app's own; the text was checked against the live
pages on the day. The only things the kit draws are the ground, the lift's hairline and shadow, the pointer and its
click ring. Captures opened a menu and ticked a filter; nothing was typed, saved or sent.

Remade on 22 Oct 2026 after the founder's recording of 13:17: the part of the app is one whole sheet on a ground of the
design system's colours (no grid, no yellow); nothing is cut out, dimmed or blurred; a glass lift (a hairline and a
faint, long shadow, never a black one) travels its rows, laid over the sheet as the same pixels so nothing pops; the
sheet fills its frame and runs off the bottom edge as mercury's cards do; the camera breathes and follows. A public
record's clip ends where it began, so the hand-over between records is one header for another.

| Clip | What it shows | Captured from | Files |
| -- | -- | -- | -- |
| `filters` | The search's Certificates menu: GOTS ticked, 10,048 suppliers narrowing to 587, then unticked | `/app/discover` and `/app/discover?cert=gots:valid`, signed in | `clip-filters.mp4` · `clip-filters.webm` · `clip-filters.webp` |
| `buyers` | Aboni Knitwear's Buyers: the brands' own supplier lists and customs records | `/app/suppliers/aboni-knitwear`, signed in | `clip-buyers.mp4` · `clip-buyers.webm` · `clip-buyers.webp` |
| `shipments` | Aboni Knitwear's markets and its latest customs shipments | `/app/suppliers/aboni-knitwear`, signed in | `clip-shipments.mp4` · `clip-shipments.webm` · `clip-shipments.webp` |
| `certificates` | Aboni Knitwear's certificates with their numbers and dates, and the one that ended | `/app/suppliers/aboni-knitwear`, signed in | `clip-certificates.mp4` · `clip-certificates.webm` · `clip-certificates.webp` |
| `record` | Aboni Knitwear's record as the app draws it, the camera coming in on its head and its export figures and out | `/app/suppliers/aboni-knitwear`, signed in | `clip-record.mp4` · `clip-record.webm` · `clip-record.webp` |
| `keyfacts` | Aboni Knitwear's key facts | `/app/suppliers/aboni-knitwear`, signed in | `clip-keyfacts.mp4` · `clip-keyfacts.webm` · `clip-keyfacts.webp` |
| `memberships` | Aboni Knitwear's four memberships, each lifting in turn | `/app/suppliers/aboni-knitwear`, signed in | `clip-memberships.mp4` · `clip-memberships.webm` · `clip-memberships.webp` |
| `safety` | Aboni Knitwear's RSC safety record | `/app/suppliers/aboni-knitwear`, signed in | `clip-safety.mp4` · `clip-safety.webm` · `clip-safety.webp` |
| `sources` | Aboni Knitwear's sources in trust order | `/app/suppliers/aboni-knitwear`, signed in | `clip-sources.mp4` · `clip-sources.webm` · `clip-sources.webp` |
| `real-mondol` | Mondol Fabrics' public record, scrolled for real to its GOTS certificate, in close and out, back to the top | `/suppliers/mondol-fabrics`, signed out | `clip-real-mondol.mp4` · `clip-real-mondol.webm` · `clip-real-mondol.webp` |
| `real-aboni` | Aboni Knitwear's public record, scrolled to its WRAP certificate and back | `/suppliers/aboni-knitwear`, signed out | `clip-real-aboni.mp4` · `clip-real-aboni.webm` · `clip-real-aboni.webp` |
| `real-liberty` | Liberty Knitwear's public record, scrolled to its RSC safety inspections and back | `/suppliers/liberty-knitwear`, signed out | `clip-real-liberty.mp4` · `clip-real-liberty.webm` · `clip-real-liberty.webp` |

## Stills of the real app (Buy with confidence), 22 Oct 2026

The founder's recording of 22 Oct 13:17: this section needs no animation. Each is one panel cut from the same captures,
alone on the night ground with a light hairline and glow, the page round it hidden; the kit draws it once (1200 × 900)
and it ships as WebP (quality 86).

| Still | What it shows | Captured from | File |
| -- | -- | -- | -- |
| `sanctions` | Aboni Knitwear's sanctions lists: not listed, each list with the day it was read (no supplier is sanctioned today, so no sanctioned record exists to show) | `/app/suppliers/aboni-knitwear`, signed in | `still-sanctions.webp` |
| `uflpa` | The Compliance hub's UFLPA checks on the saved list | `/app/compliance`, signed in | `still-uflpa.webp` |
| `locked` | A public record's contact panel, locked | `/suppliers/aboni-knitwear`, signed out | `still-locked.webp` |
