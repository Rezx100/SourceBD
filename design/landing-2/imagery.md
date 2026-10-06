# The second landing page: imagery and screens

7 Oct 2026. Every picture on `public/landing-2` is either a real SourceBD screen at 2x or a Higgsfield visual in the
SourceBD palette. This file records how each was made, so any one can be made again. The hand-off was
`.impeccable/handoff-landing-2-imagery.md` (founder, 7 Oct 2026).

## Budget

Higgsfield, the founder's account (never the kie account). Authorised: 800 credits for this page.
Balance 2,040.83 before, 1,863.83 after: **177 credits spent**.

| What | Model | Settings | Credits each | Count |
| --- | --- | --- | --- | --- |
| Still | `gpt_image_2_5` | quality `high`, resolution `2k` | 2.75 | 12 |
| Loop | `seedance_2_5` | mode `omni_reference`, 6 s, 1080p, no audio, the still as `start_image` and `end_image` | 72 | 2 |

The tools return no seed. Each picture is kept on the account under its job id (below), so it can be fetched again
from Higgsfield; to make a new one, send the same prompt and settings.

## Stills (backdrops)

Palette in every prompt: near-black ink `#0F130F` / `#101214`, brand green `#1B5E20`, spring green `#8BE39A`
(`brand-ink-inverse`). No text, logos, people or faces.

| File (`assets/img/`) | Used on | Job id | Prompt |
| --- | --- | --- | --- |
| `video/night-poster.*` (the hero loop's first frame; the still itself is not served) | Home hero | `b2f92825-0126-47f3-8c6d-b2572729099b` | Aerial view of Bangladesh at night from very high above, the river delta as soft dark shapes, industrial districts glowing as fine threads and points of light that run along roads like stitching on dark cloth. Palette strictly near-black green ink (#0F130F, #111411), deep forest green (#1B5E20) glow, a few soft spring-green highlights (#8BE39A) and very faint warm amber specks. Calm, quiet, abstract, cinematic, gentle atmospheric haze, large areas of calm dark negative space in the upper half for a product screenshot to sit on. No text, no logos, no people, no city skyline, no clouds in front. (16:9) |
| `bg-weave-*` | Home bento, "Five sources, one factory" | `12be446f-c41f-42bb-bbe9-13ee146e0ba2` | Extreme macro photograph of a tightly woven cotton fabric, warp and weft threads crossing in a calm regular grid, dyed deep forest green (#1B5E20) and near-black ink (#0F130F), lit by a single soft raking light from the left so each thread has a thin pale-green highlight (#8BE39A). Shallow depth of field, the right two thirds falling into soft dark blur. Calm, abstract, tactile, premium. No text, no logos, no people, no hands. (16:9) |
| `bg-loom-*` (and the CTA loop's first frame) | Every page's closing band | `90c81013-6b13-4853-b107-bcc928c30cf4` | Hundreds of fine taut threads stretched in parallel across a dark weaving loom, seen in perspective, catching one thin horizontal line of soft green-white light (#8BE39A) in an otherwise near-black green room (#0F130F). Long-exposure softness, gentle bokeh, deep forest green (#1B5E20) glow at the edges. Minimal, calm, abstract, cinematic, wide negative space on the left. No text, no logos, no people, no hands, no machinery brand marks. (21:9) |
| `bg-cones-*` | Home, "Shortlist. Ask. Compare." | `ec300fbc-ab6e-4673-bc5c-dce372c74b69` | Rows of cotton thread cones on a dark industrial creel, shot close with a long lens, cones in deep forest green (#1B5E20) and charcoal ink, one soft cool green-white rim light (#8BE39A), most of the frame falling into near-black (#101214) shadow and soft bokeh. Calm, abstract, premium, cinematic. No text, no logos, no labels, no people, no hands. (4:3) |
| `bg-warp-*` | Home, "Every source has its rank" | `eb3727c5-df9a-42c4-9654-ab965cd947a4` | Top-down view of thousands of fine warp threads running in parallel across a loom at night, like roads seen from a plane, near-black ink ground (#101214), threads catching faint deep-green (#1B5E20) and soft spring-green (#8BE39A) light in a slow diagonal band through the centre, the rest dark. Minimal, abstract, calm, lots of quiet dark space in the middle. No text, no logos, no people, no machinery brand marks. (16:9) |
| `bg-jersey-*` | Home, Supplier record card | `a6ba5e35-65bb-4c6d-99a7-dd7d4623025b` | Soft folds of heavy dark green cotton jersey fabric (#1B5E20 deep in shadow) lit by a single low raking light, near-black shadows (#101214), shallow depth of field, very calm and minimal, a smooth quiet area on the right. Abstract textile still life. No text, no logos, no people. (16:9) |
| `bg-knit-*` | Home, RFQs and quotes card | `57289cdc-531a-478b-9e6c-d6cece9a69ec` | Extreme macro of knitted cotton loops in charcoal and ink black yarn with a few deep forest green (#1B5E20) loops, soft cool rim light (#8BE39A) along the stitches, heavy shallow depth of field, mostly dark (#101214) and blurred toward the edges. Calm, abstract, premium textile texture. No text, no logos, no people. (16:9) |
| `bg-thread-*` | Home, Compliance card | `178a9525-8cde-4814-a6ce-131e8916862d` | A single taut green thread (#8BE39A glow) crossing a near-black ink void (#101214) from lower left to upper right, with very faint out-of-focus woven texture in deep forest green (#1B5E20) behind it, gentle haze. Minimal, abstract, cinematic, calm. No text, no logos, no people. (16:9) |

## Workshop photographs (no people)

The kit's headshots, team photos and testimonials are gone: generated faces as customers or staff would be
fabricated testimonials. These replace the team photos, and each `alt` says "Illustration".

| File | Used on | Job id | Prompt |
| --- | --- | --- | --- |
| `photo-cutting-*` | Home, Sourcing slide | `2172ae2e-92d8-4b7a-b34d-c79ca58287fb` | Documentary photograph inside a Bangladesh garment factory cutting room: a long cutting table with many stacked layers of cotton fabric and paper markers, a straight-knife cutting machine resting on the stack, overhead fluorescent light, calm and orderly. No people visible at all, no faces, no hands. Natural colours graded cool and slightly desaturated with deep green shadows. No text, no logos, no signage. (4:3) |
| `photo-knitting-*` | Home, Compliance slide | `0c23e6b4-b966-4803-882d-1dd043b6eaf2` | Documentary photograph in a Bangladesh knitting and spinning mill: rows of yarn cones feeding a large circular knitting machine, the knitted tube of fabric coming out underneath, soft daylight from high windows mixed with cool factory light. No people, no faces, no hands. Calm, orderly, natural colours graded cool with deep green shadows. No text, no logos, no signage, no brand names. (4:3) |
| `photo-cartons-*` | Home, Suppliers slide | `8be10b19-bea7-4292-b03e-45a60790bc45` | Documentary photograph at the end of a Bangladesh garment factory line: neat stacks of sealed plain brown export cartons on pallets beside a packing table with folded garments in poly bags, a roller conveyor, warm-neutral factory light. No people, no faces, no hands. Calm and orderly, natural colours graded cool with deep green shadows. Cartons completely blank: no text, no logos, no labels, no barcodes, no signage. (4:3) |
| `photo-rolls-*` | Home, "One factory, followed" | `ed1ef847-d493-44a5-a58e-c59187a5c514` | Documentary photograph of finished knitted fabric rolls stored on steel racks in a Bangladesh knitwear factory warehouse, rolls in muted greens, greys and off-white, soft light from a high window falling across them, quiet and orderly. No people, no faces, no hands. Natural colours graded cool with deep green shadows. No text, no logos, no labels, no signage. (4:5) |

## Loops (`assets/video/`)

Seamless because the still is both the first and the last frame: the first and last frames differ by 1.5 and 1.7
(mean absolute, out of 255). Two loops on the whole site, the hero and the closing band; one plays at a time, and
under `prefers-reduced-motion` or Save-Data only the poster shows (`js/main.js`, `loops`).

| File | Job id | Prompt |
| --- | --- | --- |
| `night.*` | `e795aab2-ef29-4e69-b277-6c68b837f72e` | Locked-off camera, no camera movement. The night lights of the river delta breathe very slowly: thin threads of green light travel along the roads like a needle stitching cloth, small points of light twinkle gently, a faint haze drifts slowly across the land. Calm, quiet, hypnotic, seamless loop, the last frame matches the first. No text, no logos, no people, no flashes, no clouds in front. (16:9, from `bg-night`) |
| `loom.*` | `4a73c813-033a-4f54-af44-edbe4881f070` | Locked-off camera, no camera movement. The thin line of green-white light glides slowly along the taut loom threads from left to right and fades, the threads shimmer very gently, soft dust motes drift in the dark. Calm, quiet, hypnotic, seamless loop, the last frame matches the first. No text, no logos, no people, no hands, no flashes. (21:9, from `bg-loom`; Higgsfield's suggested preset "IN THE DARK" was declined) |

Encoding, 1440 wide, no audio:

```bash
ffmpeg -i loop.mp4 -an -vf "scale=1440:-2:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 20 -profile:v high -tune grain -movflags +faststart night.mp4
ffmpeg -i loop.mp4 -an -vf "scale=1440:-2:flags=lanczos" -c:v libvpx-vp9 -b:v 0 -crf 30 -row-mt 1 -deadline good -cpu-used 2 night.webm
```

The poster is the first frame, as AVIF (quality 60) and JPEG (quality 80). Sizes: `night.mp4` 486 KB, `night.webm`
226 KB, `loom.mp4` 476 KB, `loom.webm` 188 KB.

## Stills, encoded

Every still is served as AVIF (quality 58), WebP (quality 78) and progressive JPEG (quality 80) at two widths, through
`<picture>` and `srcset`: backdrops at 1280 and 2560, photographs at 640 and 1280.

## Real SourceBD screens

Shot on 7 Oct 2026 through the real route pages, light and dark, 1440 × 900 at device scale 2 (2880 × 1800), on the
Mondol Fabrics demo record. The search and record screens are the real `app/(app)/app/discover` page rendered with
Mondol's production record (read-only queries); the RFQ and compliance screens use the film harness's sample data.
The dark screens apply the design system's dark set (`data-theme-auto`); the app itself does not ship dark yet.

| File (`assets/img/`) | Screen | Crop of the 2880 × 1800 shot |
| --- | --- | --- |
| `screen-search-{light,dark}-*` | Search for "mondol", 18 suppliers, the record open beside them (hero) | whole |
| `screen-record-{light,dark}-*` | The record's Sources tab: EPB, RSC, BGMEA, BKMEA, GOTS | x 1600–2880, y 150–1150 |
| `screen-rfq-{light,dark}-*` | An RFQ's 2 quotes side by side | x 456–2056, y 100–1300 |
| `screen-compliance-{light,dark}-*` | The Compliance hub | x 456–2056, y 120–1320 |

Recipe (the slice-5 film harness, patched so the record pane resolves): `l2-render.cjs` renders the page with
React's `prerenderToNodeStream` and a fake Supabase client that answers from a saved production read,
`l2-build.cjs` compiles Tailwind and inlines IBM Plex and the source marks, `l2-shoot.cjs` shoots with Playwright
(Chrome) light then dark. The scripts are gitignored session files; the steps are the same as
`.impeccable/preview/shots-film.cjs` with `real-pages.cjs` in the `home-film-5` worktree.

## Other pictures

- Source marks (`assets/marks/`): the approved one-colour marks from `public/icons/sources` (`context/logos.lock.md`),
  inverted on a dark ground. Brand supplier lists and foreign regulators are named in words, never drawn as logos.
- The Bangladesh map on the contact page: the film's own cartography (`public/site/film/map-country-*.avif`).
- The favicon and the logo square: `public/icons/brand/sourcebd-logo.png`, resized.
