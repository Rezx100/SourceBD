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

### What suppliers and buyers said, 24 Oct 2026

The home page's three quotes (`sections/voices.tsx`), each over the speaker's setting. People appear, but always from
behind or below the eyes, so no face stands in for the person quoted. Nano Banana Pro (`nano_banana_pro`, the
founder's choice), 2K, 16:9, prompted as candid phone snapshots in flat everyday light: he found a first cinematic set
from `gpt_image_2_5` "super fake", with a dark shadow down its left. WebP quality 80 at 2000 px across. Sources in the
session scratchpad, not the repo.

| Source | Job | Where it is drawn | Files |
| -- | -- | -- | -- |
| `uk1.png` (a London buying office, the buyer at her monitor from behind) | `f7ed9998-eec4-4a31-a5f3-02ae4a24dd97`, its left side dimmed by `12888243-bcf7-448c-b12c-0acaefc2665b` | Slide 1, the UK buyer | `voice-buyer-uk.webp` |
| `s1.png` (a Gazipur sewing floor, the managing director walking the line from behind) | `1cb9c9d8-841c-4d12-80c4-2a010874da50`, its left wall's windows shuttered by `31a579b2-ed15-46ba-903d-6b2a7efa92ab` | Slide 2, the supplier | `voice-supplier.webp` |
| `eu1.png` (a Hamburg sample room, the buyer measuring a sweater, his face out of frame) | `cab6350a-e80c-4489-b872-96e254fe5164`, its left side dimmed by `3cf89131-c9a5-45e8-a80b-09df363aacfc` | Slide 3, the German buyer | `voice-buyer-eu.webp` |

Each was then edited by Nano Banana Pro from its own job (the job as the reference image) so the side the words sit on
falls into the room's own low light, as Mercury's founder's room does behind his quote; the page adds a light, eased
shade and a blur in small steps over that side (`sections/voices.tsx`) for WCAG AAA.

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

## The grids' clips and the checks' stills, remade 25 Oct 2026

The founder's recording of 24 Oct 2026: the eight grid cards made again the way the four dark flows were, every piece
the same size, and the checks' three pictures dark and filling at least 70% of their cards. Each grid clip is a walk
through the real app in its light theme on sourcebd.net, recorded on 25 Oct 2026 from the admin account in a headless
Chrome on a temporary profile the founder signed in to (deleted after the takes), at 1440 × 900 drawn at DPR 2 and
slowed four times (`E:\SourceBD-marketing\grid
ec
ec.py`, the flows' recorder, with `shots.py`). The compositor
(`grid.py`, the flows' `comp.py` set to a card) lays the app at its own pixels, one window from the card's top left
running off its far edges, sharp where it reads and falling into a blur on the right and into the card's ground at the
bottom, every card at the same scale and inset; its camera follows the pointer across a section, as the flows' views
move; each loops by dissolving back into its first frame. Ships at 992 × 662 as H.264 (crf 22) and VP9 (crf 32) with its
first frame as the poster. The compositor draws the card's ground and the window's hairline and nothing else. The search
ticked GOTS in its Certificates menu (the menu item took a DOM click, the pointer already resting on it); nothing was
typed, saved or sent.

| Clip | What it shows | Files |
| -- | -- | -- |
| `filters` | The search's Certificates menu opened and GOTS ticked: 10,048 suppliers narrow to 581 | `clip-filters.mp4` · `clip-filters.webm` · `clip-filters.webp` |
| `buyers` | Aboni Knitwear's Buyers, the pointer on ASOS, H&M and NEXT | `clip-buyers.mp4` · `clip-buyers.webm` · `clip-buyers.webp` |
| `shipments` | Markets and shipments: where Aboni Knitwear's exports go, then scrolled to its latest shipments | `clip-shipments.mp4` · `clip-shipments.webm` · `clip-shipments.webp` |
| `certificates` | Aboni Knitwear's certificates with their numbers and dates, scrolled | `clip-certificates.mp4` · `clip-certificates.webm` · `clip-certificates.webp` |
| `keyfacts` | Aboni Knitwear's key facts, the view moving across to women and men and sewing machines | `clip-keyfacts.mp4` · `clip-keyfacts.webm` · `clip-keyfacts.webp` |
| `memberships` | Aboni Knitwear's four memberships, the view moving across to BGAPMEA and BKMEA | `clip-memberships.mp4` · `clip-memberships.webm` · `clip-memberships.webp` |
| `safety` | Aboni Knitwear's two buildings in the RSC programme, their reports and training | `clip-safety.mp4` · `clip-safety.webm` · `clip-safety.webp` |
| `sources` | Aboni Knitwear's sources in trust order, scrolled | `clip-sources.mp4` · `clip-sources.webm` · `clip-sources.webp` |

`clip-record.mp4` · `clip-record.webm` · `clip-record.webp` (Aboni Knitwear's record, the camera coming in on its head and export figures) is the 22 Oct 2026 kit's
and no longer on the home page.

The checks' stills are the compliance hub, the UFLPA checks and the record as the app draws them 375 px wide in its
dark theme, where each panel is one column (same account and recorder, `THEME=dark`, `VW=375`; the hub taken after the
founder signed in again the same day), cut at one scale (360 CSS px across the card's window) and written 640 × 800 as
WebP (quality 86). Under the hub's Status panel the page is cleared to the app's own ground, so the card holds the four
checks and not the list below them.

| Still | What it shows | File |
| -- | -- | -- |
| `sanctions` | The compliance hub's Status: 2 of 10 certificates expired, no UFLPA link, none of 18 on the UK, EU and US sanctions lists (read 6–8 Oct), a statement ready to draft | `still-sanctions.webp` |
| `uflpa` | The UFLPA checks on the saved list: 0 on the Entity List, 0 possible Xinjiang links, 18 with no link found | `still-uflpa.webp` |
| `locked` | Aboni Knitwear's contact panel, locked, with Send RFQ under it | `still-locked.webp` |

## Brand logos, 25 Oct 2026

The founder's recording of 24 Oct 2026 asked for the brands row to show each brand's real logo in one colour, as
mercury.com's does (context/logos.lock.md §1 records the change). Each logo is the file Wikipedia and Wikimedia Commons
carry for the brand, fetched on 25 Oct 2026; a headless browser drew it at 200 px high, made every pixel that was not
near white solid and every near-white one clear (so a white letter knocked out of a colour block stays a hole), cropped
it to its ink and wrote it 120 px high as lossless WebP. The page uses each only as a mask filled with the ground's ink.

| File | Source |
| -- | -- |
| `brands/hm.webp` | Commons `File:H&M-Logo.svg` |
| `brands/inditex.webp` | Commons `File:Inditex logo black.svg` |
| `brands/next.webp` | Commons `File:Next logo.svg` |
| `brands/walmart.webp` | Commons `File:Walmart logo (2025).svg` |
| `brands/ms.webp` | Commons `File:Marks & Spencer new logo.svg` |
| `brands/tesco.webp` | Commons `File:Tesco 2016 logo.svg` |
| `brands/asos.webp` | English Wikipedia `File:Asos.svg` |
| `brands/bestseller.webp` | Commons `File:Bestseller (Unternehmen) logo.svg` |
| `brands/lpp.webp` | Commons `File:LPP (company) logo.svg` |
| `brands/action.webp` | Commons `File:Action Nederland Logo 2020.svg` |
| `brands/nkd.webp` | Commons `File:NKD Logo 2015.svg` |
| `brands/promod.webp` | Commons `File:Promod logo.svg` |
| `brands/deltagalil.webp` | Commons `File:Delta Galil logo.svg` |
| `brands/lcw.webp` | Commons `File:LC Waikiki logo.svg` |
| `brands/renner.webp` | Commons `File:Logotipo das Lojas Renner.svg` |

## The inner pages' recordings of the real app, 25 Oct 2026

Every marketing page in the home page's design (the founder, 25 Oct 2026): each picture of the product is a walk
through the signed-in app on sourcebd.net, recorded headless at 1440 × 900 drawn at 2× (`E:\SourceBD-marketing\grid\rec`,
`shots.py` h_*/l_* walks, `record.ps1`), cut in home's glass-clip look by `rollout.py` (grid.py's window, inset, blur and
fade; a head card 1024 × 640, a grid card 496 × 331) and encoded by `node scripts/home-assets.mjs --clips <masters> <page>`.
Nothing in a walk was typed into a form that saves or sends; the account has no RFQs or messages, so those cards show
the app's own empty screens. The solutions pages and /suppliers replay these files; no page plays one twice.

| File | First drawn on | What it shows | Walk | Encoding |
| -- | -- | -- | -- | -- |
| `search/clip-hero.mp4` | /product/search | The search in the dark theme: denim is typed, 324 suppliers are listed, and the list is scrolled. | `h_search`, dark, the page head (1024 × 640) | H.264, silent, 1469 KB |
| `search/clip-hero.webm` | /product/search | The search in the dark theme: denim is typed, 324 suppliers are listed, and the list is scrolled. | `h_search`, dark, the page head (1024 × 640) | VP9, silent, 1410 KB |
| `search/clip-hero.webp` | /product/search | The search in the dark theme: denim is typed, 324 suppliers are listed, and the list is scrolled. | `h_search`, dark, the page head (1024 × 640) | poster: the clip's first frame, 79 KB |
| `search/clip-district.mp4` | /product/search | The search's Location menu: Gazipur is ticked and the 10,048 suppliers narrow to the 1,957 there. | `l_district`, light, a grid card (496 × 331) | H.264, silent, 284 KB |
| `search/clip-district.webm` | /product/search | The search's Location menu: Gazipur is ticked and the 10,048 suppliers narrow to the 1,957 there. | `l_district`, light, a grid card (496 × 331) | VP9, silent, 327 KB |
| `search/clip-district.webp` | /product/search | The search's Location menu: Gazipur is ticked and the 10,048 suppliers narrow to the 1,957 there. | `l_district`, light, a grid card (496 × 331) | poster: the clip's first frame, 29 KB |
| `search/clip-workers.mp4` | /product/search | The search's filters: Workers and founding year opens and 1000 is typed as the fewest workers. | `l_workers`, light, a grid card (496 × 331) | H.264, silent, 63 KB |
| `search/clip-workers.webm` | /product/search | The search's filters: Workers and founding year opens and 1000 is typed as the fewest workers. | `l_workers`, light, a grid card (496 × 331) | VP9, silent, 90 KB |
| `search/clip-workers.webp` | /product/search | The search's filters: Workers and founding year opens and 1000 is typed as the fewest workers. | `l_workers`, light, a grid card (496 × 331) | poster: the clip's first frame, 18 KB |
| `search/clip-brands.mp4` | /product/search | The search's filters: Brand supplier lists opens and H&M is ticked, which keeps the 164 suppliers named on H&M's own list. | `l_brands`, light, a grid card (496 × 331) | H.264, silent, 67 KB |
| `search/clip-brands.webm` | /product/search | The search's filters: Brand supplier lists opens and H&M is ticked, which keeps the 164 suppliers named on H&M's own list. | `l_brands`, light, a grid card (496 × 331) | VP9, silent, 86 KB |
| `search/clip-brands.webp` | /product/search | The search's filters: Brand supplier lists opens and H&M is ticked, which keeps the 164 suppliers named on H&M's own list. | `l_brands`, light, a grid card (496 × 331) | poster: the clip's first frame, 17 KB |
| `search/clip-open.mp4` | /product/search | A search for mondol: Mondol Fabrics' row is pointed at and its record opens beside the list, the list still there. | `l_open`, light, a grid card (496 × 331) | H.264, silent, 338 KB |
| `search/clip-open.webm` | /product/search | A search for mondol: Mondol Fabrics' row is pointed at and its record opens beside the list, the list still there. | `l_open`, light, a grid card (496 × 331) | VP9, silent, 358 KB |
| `search/clip-open.webp` | /product/search | A search for mondol: Mondol Fabrics' row is pointed at and its record opens beside the list, the list still there. | `l_open`, light, a grid card (496 × 331) | poster: the clip's first frame, 29 KB |
| `records/clip-hero.mp4` | /product/records | Mondol Fabrics' record in the dark theme, read from the top: a factory in Gazipur, its key facts, then its EPB, BGMEA and BKMEA memberships, each with the day it was read. | `h_record`, dark, the page head (1024 × 640) | H.264, silent, 1104 KB |
| `records/clip-hero.webm` | /product/records | Mondol Fabrics' record in the dark theme, read from the top: a factory in Gazipur, its key facts, then its EPB, BGMEA and BKMEA memberships, each with the day it was read. | `h_record`, dark, the page head (1024 × 640) | VP9, silent, 1180 KB |
| `records/clip-hero.webp` | /product/records | Mondol Fabrics' record in the dark theme, read from the top: a factory in Gazipur, its key facts, then its EPB, BGMEA and BKMEA memberships, each with the day it was read. | `h_record`, dark, the page head (1024 × 640) | poster: the clip's first frame, 55 KB |
| `records/clip-sources.mp4` | /product/records | Mondol Fabrics' five sources, highest trust first: EPB, the government register; RSC; BGMEA and BKMEA; then GOTS, the certification body. | `l_sources`, light, a grid card (496 × 331) | H.264, silent, 310 KB |
| `records/clip-sources.webm` | /product/records | Mondol Fabrics' five sources, highest trust first: EPB, the government register; RSC; BGMEA and BKMEA; then GOTS, the certification body. | `l_sources`, light, a grid card (496 × 331) | VP9, silent, 364 KB |
| `records/clip-sources.webp` | /product/records | Mondol Fabrics' five sources, highest trust first: EPB, the government register; RSC; BGMEA and BKMEA; then GOTS, the certification body. | `l_sources`, light, a grid card (496 × 331) | poster: the clip's first frame, 27 KB |
| `records/clip-certificates.mp4` | /product/records | Tex Town's three certificates, soonest expiry first, each with its listing or certificate number; below them, set apart, a GOTS licence no longer current. | `l_certs`, light, a grid card (496 × 331) | H.264, silent, 246 KB |
| `records/clip-certificates.webm` | /product/records | Tex Town's three certificates, soonest expiry first, each with its listing or certificate number; below them, set apart, a GOTS licence no longer current. | `l_certs`, light, a grid card (496 × 331) | VP9, silent, 284 KB |
| `records/clip-certificates.webp` | /product/records | Tex Town's three certificates, soonest expiry first, each with its listing or certificate number; below them, set apart, a GOTS licence no longer current. | `l_certs`, light, a grid card (496 × 331) | poster: the clip's first frame, 24 KB |
| `records/clip-products.mp4` | /product/records | Mondol Fabrics' products: the 28 product codes on its EPB exporter page, each with its HS heading, then the 13 products it filed as its own. | `l_products`, light, a grid card (496 × 331) | H.264, silent, 352 KB |
| `records/clip-products.webm` | /product/records | Mondol Fabrics' products: the 28 product codes on its EPB exporter page, each with its HS heading, then the 13 products it filed as its own. | `l_products`, light, a grid card (496 × 331) | VP9, silent, 369 KB |
| `records/clip-products.webp` | /product/records | Mondol Fabrics' products: the 28 product codes on its EPB exporter page, each with its HS heading, then the 13 products it filed as its own. | `l_products`, light, a grid card (496 × 331) | poster: the clip's first frame, 28 KB |
| `records/clip-sites.mp4` | /product/records | Mondol Fabrics' two sites, its office and its factory, pinned on a street map, then its one extension building with its 600 workers. | `l_sites`, light, a grid card (496 × 331) | H.264, silent, 415 KB |
| `records/clip-sites.webm` | /product/records | Mondol Fabrics' two sites, its office and its factory, pinned on a street map, then its one extension building with its 600 workers. | `l_sites`, light, a grid card (496 × 331) | VP9, silent, 405 KB |
| `records/clip-sites.webp` | /product/records | Mondol Fabrics' two sites, its office and its factory, pinned on a street map, then its one extension building with its 600 workers. | `l_sites`, light, a grid card (496 × 331) | poster: the clip's first frame, 37 KB |
| `rfqs/clip-hero.mp4` | /product/rfqs | The New RFQ page in the dark theme, read from the top: up to 50 suppliers, the product, its quantity and target price, and what each supplier gets. | `h_rfq`, dark, the page head (1024 × 640) | H.264, silent, 1015 KB |
| `rfqs/clip-hero.webm` | /product/rfqs | The New RFQ page in the dark theme, read from the top: up to 50 suppliers, the product, its quantity and target price, and what each supplier gets. | `h_rfq`, dark, the page head (1024 × 640) | VP9, silent, 847 KB |
| `rfqs/clip-hero.webp` | /product/rfqs | The New RFQ page in the dark theme, read from the top: up to 50 suppliers, the product, its quantity and target price, and what each supplier gets. | `h_rfq`, dark, the page head (1024 × 640) | poster: the clip's first frame, 45 KB |
| `rfqs/clip-quotes.mp4` | /product/rfqs | The RFQs page before any is sent: one RFQ to up to 50 suppliers, their quotes lined up against your target price, each above or under it, an MOQ above your quantity flagged. | `l_quotes`, light, a grid card (496 × 331) | H.264, silent, 188 KB |
| `rfqs/clip-quotes.webm` | /product/rfqs | The RFQs page before any is sent: one RFQ to up to 50 suppliers, their quotes lined up against your target price, each above or under it, an MOQ above your quantity flagged. | `l_quotes`, light, a grid card (496 × 331) | VP9, silent, 161 KB |
| `rfqs/clip-quotes.webp` | /product/rfqs | The RFQs page before any is sent: one RFQ to up to 50 suppliers, their quotes lined up against your target price, each above or under it, an MOQ above your quantity flagged. | `l_quotes`, light, a grid card (496 × 331) | poster: the clip's first frame, 22 KB |
| `rfqs/clip-thread.mp4` | /product/rfqs | The Messages page before any reply: talk to suppliers with their record beside you; send an RFQ, the replies land here, and you check them as you talk. | `l_thread`, light, a grid card (496 × 331) | H.264, silent, 271 KB |
| `rfqs/clip-thread.webm` | /product/rfqs | The Messages page before any reply: talk to suppliers with their record beside you; send an RFQ, the replies land here, and you check them as you talk. | `l_thread`, light, a grid card (496 × 331) | VP9, silent, 278 KB |
| `rfqs/clip-thread.webp` | /product/rfqs | The Messages page before any reply: talk to suppliers with their record beside you; send an RFQ, the replies land here, and you check them as you talk. | `l_thread`, light, a grid card (496 × 331) | poster: the clip's first frame, 28 KB |
| `rfqs/clip-review.mp4` | /product/rfqs | From the saved list, Send one RFQ opens a new request with the three ticked suppliers in its To line, up to 50 allowed, nothing typed or sent. | `l_review`, light, a grid card (496 × 331) | H.264, silent, 43 KB |
| `rfqs/clip-review.webm` | /product/rfqs | From the saved list, Send one RFQ opens a new request with the three ticked suppliers in its To line, up to 50 allowed, nothing typed or sent. | `l_review`, light, a grid card (496 × 331) | VP9, silent, 72 KB |
| `rfqs/clip-review.webp` | /product/rfqs | From the saved list, Send one RFQ opens a new request with the three ticked suppliers in its To line, up to 50 allowed, nothing typed or sent. | `l_review`, light, a grid card (496 × 331) | poster: the clip's first frame, 24 KB |
| `rfqs/clip-contact.mp4` | /product/rfqs | Mondol Fabrics' contact panel: the details are locked; send an RFQ and the supplier replies in Messages. | `l_contact`, light, a grid card (496 × 331) | H.264, silent, 90 KB |
| `rfqs/clip-contact.webm` | /product/rfqs | Mondol Fabrics' contact panel: the details are locked; send an RFQ and the supplier replies in Messages. | `l_contact`, light, a grid card (496 × 331) | VP9, silent, 76 KB |
| `rfqs/clip-contact.webp` | /product/rfqs | Mondol Fabrics' contact panel: the details are locked; send an RFQ and the supplier replies in Messages. | `l_contact`, light, a grid card (496 × 331) | poster: the clip's first frame, 14 KB |
| `compliance/clip-hero.mp4` | /product/compliance | Certificate expiry across the saved suppliers in the dark theme: two expired, four within 30 days, four in 31 to 90 days, each with its ask for a renewal; then the expired two alone. | `h_expiry`, dark, the page head (1024 × 640) | H.264, silent, 1266 KB |
| `compliance/clip-hero.webm` | /product/compliance | Certificate expiry across the saved suppliers in the dark theme: two expired, four within 30 days, four in 31 to 90 days, each with its ask for a renewal; then the expired two alone. | `h_expiry`, dark, the page head (1024 × 640) | VP9, silent, 1110 KB |
| `compliance/clip-hero.webp` | /product/compliance | Certificate expiry across the saved suppliers in the dark theme: two expired, four within 30 days, four in 31 to 90 days, each with its ask for a renewal; then the expired two alone. | `h_expiry`, dark, the page head (1024 × 640) | poster: the clip's first frame, 91 KB |
| `compliance/clip-uflpa.mp4` | /product/compliance | The UFLPA checks on the 18 saved suppliers: none on the UFLPA Entity List, none with a possible Xinjiang link, no link found for 18, entries added since the last read said to be unchecked; then the suppliers, A to Z. | `l_uflpa`, light, a grid card (496 × 331) | H.264, silent, 387 KB |
| `compliance/clip-uflpa.webm` | /product/compliance | The UFLPA checks on the 18 saved suppliers: none on the UFLPA Entity List, none with a possible Xinjiang link, no link found for 18, entries added since the last read said to be unchecked; then the suppliers, A to Z. | `l_uflpa`, light, a grid card (496 × 331) | VP9, silent, 244 KB |
| `compliance/clip-uflpa.webp` | /product/compliance | The UFLPA checks on the 18 saved suppliers: none on the UFLPA Entity List, none with a possible Xinjiang link, no link found for 18, entries added since the last read said to be unchecked; then the suppliers, A to Z. | `l_uflpa`, light, a grid card (496 × 331) | poster: the clip's first frame, 18 KB |
| `compliance/clip-sanctions.mp4` | /product/compliance | Modele De Capital's sanctions panel: not listed, and each list it was checked against, US Treasury (OFAC), US Labor (ILAB), the European Union and UK (OFSI), with the day it was last read. | `l_sanctions`, light, a grid card (496 × 331) | H.264, silent, 192 KB |
| `compliance/clip-sanctions.webm` | /product/compliance | Modele De Capital's sanctions panel: not listed, and each list it was checked against, US Treasury (OFAC), US Labor (ILAB), the European Union and UK (OFSI), with the day it was last read. | `l_sanctions`, light, a grid card (496 × 331) | VP9, silent, 220 KB |
| `compliance/clip-sanctions.webp` | /product/compliance | Modele De Capital's sanctions panel: not listed, and each list it was checked against, US Treasury (OFAC), US Labor (ILAB), the European Union and UK (OFSI), with the day it was last read. | `l_sanctions`, light, a grid card (496 × 331) | poster: the clip's first frame, 25 KB |
| `compliance/clip-statement.mp4` | /product/compliance | The modern slavery statement drafted from the 18 saved suppliers under section 54 of the UK Modern Slavery Act: each section's claims to confirm counted, each marked Confirm in the draft, ten to confirm before it can be downloaded. | `l_statement`, light, a grid card (496 × 331) | H.264, silent, 910 KB |
| `compliance/clip-statement.webm` | /product/compliance | The modern slavery statement drafted from the 18 saved suppliers under section 54 of the UK Modern Slavery Act: each section's claims to confirm counted, each marked Confirm in the draft, ten to confirm before it can be downloaded. | `l_statement`, light, a grid card (496 × 331) | VP9, silent, 701 KB |
| `compliance/clip-statement.webp` | /product/compliance | The modern slavery statement drafted from the 18 saved suppliers under section 54 of the UK Modern Slavery Act: each section's claims to confirm counted, each marked Confirm in the draft, ten to confirm before it can be downloaded. | `l_statement`, light, a grid card (496 × 331) | poster: the clip's first frame, 32 KB |
| `compliance/clip-checks.mp4` | /product/compliance | Tex Town's checks: one building behind on its RSC repairs at 91% of issues fixed, three certificates on file with none expiring, and not listed on any sanctions list. | `l_checks`, light, a grid card (496 × 331) | H.264, silent, 162 KB |
| `compliance/clip-checks.webm` | /product/compliance | Tex Town's checks: one building behind on its RSC repairs at 91% of issues fixed, three certificates on file with none expiring, and not listed on any sanctions list. | `l_checks`, light, a grid card (496 × 331) | VP9, silent, 164 KB |
| `compliance/clip-checks.webp` | /product/compliance | Tex Town's checks: one building behind on its RSC repairs at 91% of issues fixed, three certificates on file with none expiring, and not listed on any sanctions list. | `l_checks`, light, a grid card (496 × 331) | poster: the clip's first frame, 20 KB |
