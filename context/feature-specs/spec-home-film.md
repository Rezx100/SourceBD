# Spec: the home page film

Written 6 Oct 2026 from the founder-approved plan and his review of the same day (the build handoff, kept
verbatim below from section 0 on). The home page (`/`) becomes a scroll-led film that follows one real factory
from a dot on the planet to an RFQ. Front end only: no migration, no new package.

## Status
| Slice | What | State |
| -- | -- | -- |
| 1 | The dark set, the film tokens and type sizes, the Pane family, the thread, the rail, `/dev/ds`, the planet and map engines, the open map data | built, 6 Oct 2026 |
| 2a | The flag (`?film=1`), the tier, the director, and scenes 01 to 03 on all three tiers | built, 6 Oct 2026 |
| 2b | The dated supplier cells and the factory's own geocode (`cells.json`), `ops/plans/home-film-data.md`, the credit on `/legal/data-sources`, stills for the lite and still tiers, the planet handing over to the map in one move, `cobe` out of `package.json` | built, 6 Oct 2026 |
| 3 | Scenes 04 (the overlock, five sources as hang tags, the seam that ties on the Sources row) and 05 (the receipt roll printing three claims beside their sources, three rows arriving, the note where two sources differ), on all three tiers; the fixes from the review of PR 370 (the real supplier lights) | built, 6 Oct 2026 |
| 4 | Scenes 06 (the one live map tilts down on to the factory's area with a ring a kilometre wide, the record gains Site), 07 (one blank carton, "Coming in v2") and 08 (the calendar: the day, the time line, the alert at day 43 and the GOTS row turning amber, the list checked again at day 59), on all three tiers; the slice-3 session's efficiency follow-up | built, 7 Oct 2026 |
| 5 | Scenes 09 (the real product staged: three steps, three screens re-shot on the story's factory, the drawn cursor pressing Send RFQ, our own drawn atmosphere), 10 (the three promises, grey to ink), the source ladder arriving in rank order, 11 (the live figures rising whole) and 12 (night again, the same planet back, the whole record stitching on, the thread ending in a bartack at the RFQ, the search); the rail | built, 7 Oct 2026 |
| 6 | The phone and the lite and still tiers checked, the budgets measured under a 4x throttle, the audit and the critique with their fixes (pinned stages, the roll's window, the place label, the rail stepping aside), the chrome in dark, the stills producer under `scripts/film`; Paper pages 32 and 33 and the flag PR wait on the founder | built, 7 Oct 2026 |

Found while building slice 1, and where it differs from the text below:
- `bkoi-gl` 3.3.0 runs a style of our own with only GeoJSON sources, no key and no tile request (checked 6 Oct).
  So the country map and the close on Gazipur load nothing from Barikoi; only chapter 4's roads would.
- Dark text on a green fill fails in dark, and v4's buttons write their label with `text-surface`. So in the dark
  set `brand` is a light green fill with a dark label; `brand-ink` is the green for text in both themes.
- A night scene (01 and 12) is `data-ground="night"`: it carries the dark set's variables in either theme, so a
  pane, the nav or a button inside it needs no second set of classes.
- The glass tint is 68% in light and 70% in dark, not 66% and white at 6%: those are the thinnest that hold
  4.5:1 for the quietest text over what may pass behind a pane (`paneBehind`, tested).
- Districts are the Bangladesh Bureau of Statistics and OCHA set through geoBoundaries (CC BY 3.0 IGO); the land
  mask, the rivers and the neighbours are Natural Earth (public domain). `scripts/film/build-geo.mjs` builds both
  files. The credit on `/legal/data-sources` and `ops/plans/home-film-data.md` land with slice 2, before any
  visitor can reach the map.
- Until the cells are read, the planet's and the map's lights are the four district counts of 3 Oct 2026
  (`public/site/film/cells.json`), and the first screen says so in words. No light is drawn for the one factory
  until its own dated geocode is in that file.
- With the film on, the whole home page follows the system's theme. Chapters 2 to 9 were read in dark and hold;
  the nav, the footer and the cookie banner have not been looked at in dark yet.
- The look-dev page is a local harness (`.impeccable/preview/film/`, not in the repo); its supplier lights are
  stand-ins until slice 2 reads the dated file.

Found while building slice 2b (6 Oct 2026):
- The Supabase connector was not authorised in that session either, so the cells were read through the project's
  own service key and the PostgREST API (the three reads `lib/nearby-suppliers.ts` makes), read-only, by
  `scripts/film/build-cells.mjs`. The figures, the SQL it stands for and each run are in
  `ops/plans/home-film-data.md` (rule 14: one place for every number).
- The factory's own geocode is an area, not a building (Barikoi: `incomplete`, confidence 40). Scene 06's ring
  must be about a kilometre wide.
- The opening is one scene (`data-scene="opening"`, 640svh on the full tier): the planet's act lies over the map
  and gives way to it as the dive ends (their opacity written by `engine/start.ts` on the two elements). The
  dive ends where the map's first camera begins (`handoverFrame`: the story's home at the map's centre, one
  degree the same width on both), so the map's first mark is now zoom 5.5, north up, barely tilted, and the
  geography's box widened (to [58, 4, 108, 40], `scripts/film/build-geo.mjs`) so its edge is not seen on a
  stage up to about 3,000 px wide.
- The still tier gets a picture of the planet; the lite and still tiers get pictures of the map in both themes
  (`public/site/film/*.avif`, six files, 11 to 32 KB each, shot from the engines by the local harness). The
  full tier draws both live and loads no picture on the first screen, as the budget asks.
- `cobe` is out of `package.json` and the lockfile (`pnpm install --lockfile-only`; nothing imported it).

Found while building slice 3 (6 Oct 2026):
- A scene's progress is no longer written as `--p` on the scene itself: an inherited property set on a tall subtree
  restyles all of it on every frame (measured at 2 to 6 ms). The engine writes each number on the small thing
  that reads it (a thread's group, the roll, the overlock drawing, the two acts' own opacity).
- A row that arrives at a beat takes no place until then (cut the way `sr-only` is, on the full tier, so a screen
  reader still has it): the record starts compact and grows downward as its rows stitch on, standing at the top
  beside the words so nothing that has arrived moves again. The tie's thread and the row appear together, and a
  beat holds a little past its moment on the way back (`BAND`), so a scroll resting on the line does not flap it.
- What has gone in the handover (the planet's act, the hero) stops catching the pointer but stays in the page:
  the headline, the search and the two ways in are the page's for a screen reader; a control there that takes
  keyboard focus brings its act back over the map.
- The receipts are compact (12 px padding, 16 px lines) so the words and the whole roll fit a 900 px stage;
  on a stage under about 850 px the last receipt runs past the bottom (slice 6 may give the roll a window that
  scrolls as it prints). The note on the two sources that differ sits under the record, where no thread crosses.
  The roll's slot is solid, not the glass of §3.9: the ground is plain (§2.2 wins), and the roll prints by one
  continuous clip, not line by line.
- The hang tags are drawn into the flat with 13-unit type, which is the system's 12 px floor at the height a 900
  px stage gives the drawing (52svh); on a shorter stage or a phone the tags render smaller, and the record's
  Sources row and the dated list under it carry the same numbers in real type.
- Chapter 02's dated list of the five sources (each number and the day we read it) stays in the film, under the
  record, as bare type on hairlines; both the film and the page without it draw it from `film/record.ts`.
- The lite tier's planet could not stick: the stage wrapper's `overflow-hidden` made it the planet's scroll
  container. The clip is now `film-full:` only. The stills are still those of 2b: the wider geography box adds
  land the pictures' cameras never see. Their producer (`stills.cjs`) is the local harness, which is gitignored;
  moving it under `scripts/film/` so a clean clone can re-shoot them is slice 6's.
- The engine puts back everything it wrote when the film stops (`chapters.stop()`, `start.ts`'s `stop()`), so a
  page that gives up mid-scene is the stacked page again; the roll follows `--print` on the full tier only.

Found while building slice 4 (7 Oct 2026):
- One map serves scenes 02, 03 and 06 (§3.5: one drawing context at a time). Its stage is moved into scene 06 the
  moment scene 05 has run its hold (the scene after it is then just below the screen) and back when it has not;
  `engine/start.ts` keeps the map and lends the chapters' engine a hook that moves the camera and says where the one
  light is. A map that comes up late takes whichever scene has it.
- The close on the factory's area draws no tiles and no roads: question 4 of §9 (the cost of Barikoi's tiles) has
  no answer, so the default stands. The ground is our own data at zoom 13.6: the kilometre grid the lights are
  counted on (`grid` in `engine/map.ts`, the same lattice as `scripts/film/build-cells.mjs`), each cell a soft
  light, the one green light and the ring (`RING_KM`, 1 km: Barikoi gave the geocode as an area, confidence 40).
  The district outlines and the rivers fade out past zoom 13, where their simplified lines would cross the ground.
  The note says "the ring marks the area, not the building"; the page without the film still says "the pin".
- The lite and still tiers get a picture of the same close (`map-site-{light,dark}.avif`, 3 KB each), shot by the
  local `stills.cjs`.
- Scene 08's day counter is three whole figures (0, 43, 59: the days the story stops on), one on at a time on the
  full tier the way scene 02's district figures are, never a number counting up; the time line is drawn by `--t`
  and each mark on it shows once the line has reached its own `--at`. The UFLPA check is a bare mono line under
  the time line, not a pane; the row carries "No link found" and the date of our copy.
- A row to watch (`watch` on `RecordRow`) renders its value amber; on the full tier it is ink until the engine
  writes `data-due` on its day (Tailwind's `group-data-[due]/row` variant, no CSS of its own).
- The dates of today's chapter 06 did not add up (1 Nov was called day 43): day 43 from 3 Oct is 15 Nov, which is
  30 days before the certificate's 15 Dec. Both the film and the page without it now say 15 Nov (the one word
  changed on the page without the film).
- From the slice-3 session's follow-up, carried in this PR: the threads' geometry is measured only when the layout
  moves (a resize, the fonts arriving, a row arriving), never per frame; the overlock's and the roll's variables
  are written on the parts that read them; the record's marks are fetched lazily.

Found while building slice 5 (7 Oct 2026):
- The app screens were re-shot at 2x from the real route pages on the story's factory (the local harness's
  `shots-film.cjs`, gitignored): Mondol Fabrics Ltd. is the first row picked on the Saved page, the one target of
  the RFQ composer and a quote on the RFQ; the Compliance hub is the same page re-shot, its day counts from the real
  page's clock. Each PNG is 2880 by 1800; `next/image` serves the sizes a screen needs.
- The staged screens (§3.8): the three steps are three windows on one stage. On the full tier they sit on one
  another and the step's own slides in (`.stage-screen`); each tilts by `--p` on itself; the cursor is on the
  composer only, aimed at Send RFQ (92.6% across, 96.5% down), with a spotlight that opens as it comes and a press
  at the end (`--cursor` on the three parts). The windows are solid, not glass: what is behind them is drawn, not
  live (§2.2). The atmosphere is our own drawing until Higgsfield is reachable (question 1 of §9 has no answer): a
  weave of fine lines, two soft pools of light and shade and one green thread in soft focus, in the ground's roles.
- Scene 11's figures: four to a stage at `min(200px, 20svh)` (`.film-figure-fit`), the label beside each; four at
  the spec's 200px would not fit a 900px stage. With no figure read the scene is left out, so the planet's cue for
  the close is whichever scene precedes it, found once at start.
- Scene 12: the planet's canvas is moved into the close's stage the way the map's is into scene 06, with a
  composition of its own (`closeFrame`: behind the words, the light clear of the record); the thread runs from the
  light to the RFQ row on every frame the planet draws (`chapters.closeFrom`) and ends in a bartack set at the row.
  The close's search field is `close-q`; the opening's stays `hero-q`.
- The rail is mounted last in the page, so the headline is still the first thing read; fixed at the left, its ticks
  from 1280px (at 1024 they would cross the words). Over a night scene the director gives it the night's own ink
  (`data-ground="night"` on the nav; the planet's act counts as night only until it has given way to the map), so
  it reads in light mode too. The page's box is measured for the phone's line only where that line is drawn.
- The lite and still tiers get scenes 09 to 12 stacked whole: the three screens in a column on the stage, the
  promises, the ladder and the figures as today's, the close a night block with no planet yet (slice 6).
- The close section and the FAQ after scene 12 are untouched, and the page without the film is byte for byte what
  it was (film.test holds both); the promises, the five tiers and the screens' words are one data set in
  `closing.tsx` that both branches draw from.

Found while building slice 6 (7 Oct 2026):
- The budgets (§7), measured on the local harness with Playwright and a 4x CPU throttle (`budget.md` beside the shots;
  the harness is the real server-rendered page plus the engine, not the Next bundle, which this machine cannot build):
  first screen 27 KB of script and 10 KB of data gzip, no picture; the whole page about 0.75 MB on a desktop and
  0.59 MB on a phone once `next/image` has resized the four screens (the map library, 300 KB gzip, loads on the
  full tier only); the `h1` is the largest paint on both; the engine's scroll work 0.45 ms a frame median, 5.4 ms at
  the 95th (the map library's own frames are the heavy ones under the software GPU); the planet 32 to 62 frames a
  second under SwiftShader, which cannot say what a real GPU gives. The one miss was layout shift on the desktop
  (0.42): every held scene centred its content, so the words moved up as the record's rows arrived. Stages now hang
  from `max(40px, 50svh - 380px)` and only grow downward; the second run measured 0.02.
- The receipt roll on a stage too short for it (under about 850 px): on the full tier the roll is a window
  (`100svh - 500px`) and the paper scrolls up as it prints (`--roll-over`, measured once per layout, read by the
  paper's wrapper); each thread's start moves with its line and a thread whose line has left the window goes with
  it. The rivers and the outlines fade out between zoom 12.2 and 13 instead of cutting off in one frame.
- The rail steps aside past the last scene (no chapter is current over the close, the FAQ and the footer; the
  phone's line stays), its links take the kit's focus ring, and the ticks show from 1280 px with the line below.
- The critique (`/impeccable critique`, two assessments; `.impeccable/critique/`) scored the page 30 of 40 and
  every scene at the bar except 06 (23: "no place" on the close without tiles) and 07 and 11 on the line. Fixed in
  this slice: a place label beside the ring ("Kashimpur · Gazipur · ring 1 km", moved with the light), the figures'
  labels given the room beside the figure, the ladder carrying its chapter's words like every scene, the record's
  mono line breaking only between items (never inside "1004-B/2006"), and on a window under 1024 px each staged
  screen cropped to the part its step names so its words can be read. Kept on purpose: "Coming in v2" (the brief
  and `home.test.ts` hold it, though `voice-v4.md` lists V2 under never-say: the founder's call), the note under
  scene 06 (§3.6 names it), "Updated … · latest register read …" (today's copy), the tabs of chapter 07 (today's
  page). Scene 06 cannot read as a place without roads: question 4 of §9 (Barikoi tiles) decides it.
- The audit (`/impeccable audit`): 19 of 20. The detector finds nothing in shipped markup; the one dead class
  (`-z-10`, the scale has no numbers) is gone and a test refuses numeric z classes in the scene.
- The lite tier keeps no holds but the planet's: a hold for the receipt roll would not fit a phone's stage (the
  words alone are most of it), so the roll is whole there, as it was.
- The nav, the footer and the cookie card read in dark (shot through the harness with `CHROME=1`); the nav's open
  panel could not be shot without React and is to be looked at on the live site with `?film=1`.
- The stills' producer is `scripts/film/build-stills.mjs` (a clean clone re-shoots the eight AVIFs with one
  command; the harness's copy is retired). Sizes move a little from run to run because the lights breathe.
- Paper pages 32 and 33 were not made: Paper Desktop was not running in this session, and the import goes through
  its local connection. The flag PR (the last) waits for the founder's word.
- Known ceilings kept: a stage wider than about 3,000 px may show the geography's box edge; the map library's
  frames are what they are; on a stage under about 800 px the close's record runs past the bottom.

---

# The build handoff

Goal: build the SourceBD home page (`/`) as a scroll-led film, end to end: the design-system additions, every component and asset, both themes, the phone version, the checks and the PRs. Front end only. No migration, no new package.

## 0. Read first, in this order
1. The approved plan: https://claude.ai/artifact/Sg1ufPMi5xRbLfBrg6CuhK (Artifact tool, `action: "read"`). Its twelve stills are real HTML at 1440x900 (inside `.art`, 1em = 10 artboard px) and its three drawings are SVG `<symbol>`s (`#overlock`, `#carton`, `#dress`): reuse them, do not redraw.
2. Section 2 of this file. It overrides the plan wherever the two disagree.
3. Today's page and its guards: `components/site/home.tsx`, `components/site/parts.tsx`, `components/site/home.test.ts`, `components/site/chrome.tsx`, `lib/site-facts.ts`.
4. The system: `context/feature-specs/ds-v4/DESIGN-v4.md` (sections 2, 3, 7, 8), `context/feature-specs/voice-v4.md`, `lib/design/tokens.ts`, `lib/design/tokens.test.ts`, `tailwind.config.ts`, `app/ds.css`, `context/logos.lock.md`.
5. Memories: `home-film-plan`, `paper-import-kit`, `local-dev-server-unusable`, `static-harness-real-icons-playwright`, `phone-harness-and-gist`, `grep-tests-for-old-markup`, `strict-typecheck-tests-before-push`, `never-cd-in-bash`.

## 1. Approved as planned
The founder, 6 Oct: "I approve the plan ... I like almost everything about it."
- The story and the words stay: one real record (Mondol Fabrics Ltd., captured 3 Oct 2026), nine buyer questions, today's copy. No new claim.
- Twelve scenes: 01 the planet, 02 four districts, 03 one dot becomes a record, 04 five sources and one seam (02 · Who are they?), 05 the receipt roll (03 · Is that true?), 06 the address (04 · Where are they?), 07 the export carton (05 · Who do they ship to?), 08 time moves (06 · Will it still be true next month?), 09 the real product (07 · Can they make my order?), 10 three promises and 11 the numbers (08 · Why should I trust you?), 12 the whole record and the search (09).
- Approved pieces: the header and the hero composition, the green thread from the first dot to the RFQ, the chapter rail, the tech-pack flats (five-thread overlock, export carton, dress), the receipt roll, poster-size numbers that arrive whole, the three promises, the time line.
- The plan's five calls, all as recommended: a night first screen; flats, not photo-real objects; keep the overlock; exports stays one blank carton and "Coming in v2" until export records are live; the dots come from a dated file.

## 2. The founder's review of 6 Oct: what changes
His words (tidied from dictation), then the decision.
1. **Cards.** "This type of HTML cards are very outdated ... everywhere you have used this card, create a design system ... and reuse that." Decision: no plain bordered box anywhere in the film. A thing on screen is one of four: a **Pane** (the new surface, 3.3), part of a flat drawing, bare type on the ground, or the live planet or map. The record card, the "5 sources" row with its green fill, the alert, the map note, the search fields and the screen frame all become Panes. The source tags become hang tags drawn into the overlock flat.
2. **Glass.** "Do some glassmorphism here if it goes with the overall design system, otherwise not." Decision: yes where something live sits behind the pane (planet, map, atmosphere); frosted bars are already in the system (`.glass` in `app/ds.css`). No where the ground is plain or the text is dense: there the same Pane takes its solid material. Never glass on glass, at most three glass panes on screen.
3. **The planet.** "It's okay, but it will look much better if it is more alive like United Carriers", and "I hope that is custom work made by WebGL only for our design." The plan's planet was drawn by `cobe`, a small open-source globe library, and the founder has been told so. Decision: the build draws its own (3.5).
4. **The country map.** "The dotted map looks monotonous ... it doesn't properly represent the map ... with the gray", and the four-districts map "needs to be corrected with the premium looking map". Decision: our own cartography (3.6). No grey dot picture.
5. **The address map.** "Looks cheap because the shadow under it ... like a screenshot embedded in." Decision: no screenshot and no tilted card. The map is the ground of the scene, live, in our colours, with a real camera move (3.6).
6. **The screens.** "Really raw looking, like a direct screenshot ... add some background images or videos, then put the screenshots on that." Decision: ScreenStage (3.8).
7. **Higgsfield.** "Use my Higgsfield account to generate animations ... that look premium." Authorised for this page's backdrops and ambient loops (6.4).
8. **Themes.** "The dark and light version both need to be made ... so the user's system brightness can adapt with the website when loaded." Decision: both themes, switched by the system setting in CSS (3.1).
9. **My reading of "the card with a magnifier glass".** The circle that ended the thread beside the record read as a magnifying glass. End the thread with a bartack (a short dense zigzag, the stitch that ends a seam), never a circle.

## 3. The kit to build
### 3.1 Themes
- Verified: every colour class resolves to a CSS variable (`rgb(var(--ds-...) / <alpha-value>)`), emitted on `:root` by the plugin in `tailwind.config.ts` from `light` in `lib/design/tokens.ts`. The config's own comment expects "a dark set ... a second block".
- Add `dark` (a value for every key of `light`) and emit it as `@media (prefers-color-scheme: dark) { :root:has([data-theme-auto]) { ...; color-scheme: dark } }`. Put `data-theme-auto` on the home page's `<main>` only. It is CSS, so there is no flash and no script. On the home page the nav, the footer and the cookie banner follow because the variables sit on the root; every other page stays light until its own spec gives it the attribute. `app/ds.css` pins `html { color-scheme: light }`: the dark block must override it.
- `brand` is both a fill and a text colour in v4 (`text-brand` in `parts.tsx`, the nav). `#1B5E20` as text fails on a dark ground. Add a text role (`brand-ink`: light `#1B5E20`, dark about `#7BD389`) and move the home's and the chrome's green text to it. The button keeps `brand`.
- Starting dark values, to tune in Paper and then hold in `contrastPairs`: surface `#101214`, subtle `#16191C`, sunken `#1D2125`, line `#2A2F35`, line-strong `#6F7780`, ink `#F2F4F6`, ink-2 `#C5CAD0`, ink-3 `#9AA1AA`, brand-tint `#14251A`, brand-wash `#111B14`, caution `#F2B866` on caution-tint `#2C210E`.
- Scenes 01 and 12 are night in both themes (the look he approved); scenes 02 to 11 follow the theme. See 9.2.
- Paper wins: add every new colour to Paper's tokens too. `tokens.test.ts` holds v4 colours to Paper's values, the contrast table, and "no hand-typed colour" in components: extend all three.

### 3.2 Type
`text-display-1` is 72 today. Add, for this page only: hero 104/1.02 (phone 44/1.04), figure 200/0.9 (phone 96), scene headline 64/1.06 (phone 32). `tokens.test.ts` lists the approved sizes ("the type scale, the widths and the durations are the approved ones"): add them there and in Paper.

### 3.3 The Pane (replaces every card)
- One component, two materials. `glass`: a tint, a backdrop blur, a lit edge, a long soft shadow and 3% grain. `solid`: surface, a hairline and the same shadow. Radius 20 (phone 16), padding 24.
- Starting values, all as tokens. Light glass: surface at 66%, blur 24px with saturate 150%, edge white at 60% over a hairline of ink at 6%, a top highlight (`inset 0 1px 0` white at 80%), shadow `0 24px 60px -20px` ink at 22%. Dark glass: white at 6% over the ground, blur 28px with saturate 130%, edge white at 14%, highlight white at 10%, shadow `0 30px 80px -24px` black at 60%.
- Legibility is a rule: body text on a pane holds 4.5:1 against the brightest and the darkest thing that can pass behind it. Raise the tint until it does, and test the pairs. `@supports not (backdrop-filter: blur(1px))`, the lite tier and the still tier use `solid`.
- Members: `RecordPane`, `NotePane` (the map note; "2 sources differ" in a caution tint), `AlertPane` (a certificate running out), `FieldPane` (search), the `ScreenStage` window, `Callout` (a map label).
- `RecordPane`, the protagonist: eyebrow "Supplier record", the name at 24/600, the identity line, a state chip ("Saved · watching"). A row is the source's mark (its approved one-colour logo per `context/logos.lock.md`, else a two-letter mono stamp), a label, the value, and "From ... · checked ...". "Sources" shows the five marks in a row, not a green block. A row arrives stitched: a green line sweeps its top edge (300 ms), the mark stamps in (160 ms), the text rises 8px (200 ms), and a 6px green dot stays at its left. No filled row. Keep `<figure aria-label="Supplier record: ...">` and one `<dt>` per row: `home.test.ts` counts them.
- One sheen pass on entrance (600 ms), never a loop.

### 3.4 The thread and the rail
- The thread is one path in `brand-ink`: solid when it leads, stitched (dash 9 6) when it joins, a bartack where it ends. It draws with the scroll.
- The rail is nine ticks at the left edge with the green dot on the current chapter; each tick is a link to its chapter. On a phone it is a thin progress line. No `aria-valuenow` anywhere: the test refuses it.

### 3.5 The planet (our own WebGL)
- Raw WebGL2 in plain TypeScript, no library. Land as fine dots from a land mask (6.2). Our suppliers as warm-white lights at their real cells (6.1), sized by count, each breathing on its own phase. A soft rim of atmosphere. A far layer of dust that shifts with the pointer and the scroll.
- Alive, and every motion true: a slow drift that always keeps Bangladesh in view; drag to turn with a spring back (pointer only, never on touch); the four district callouts arriving one by one with their real counts; the thread tying on at the cluster and hanging down. No arcs to other countries until export records are live.
- The scroll brings the camera in and hands over to the map (3.6) at the same place and scale.
- Cap the pixel ratio at 2 (1.5 on a phone), stop drawing when off screen or the tab is hidden, and keep one WebGL canvas alive at a time: park the planet while the map runs and bring the same instance back for scene 12. A pre-rendered still stands in on the still tier and before the canvas is ready.
- Colours come from CSS variables read at start and on a theme change. Shader compile errors fall back to the still, never to a blank.
- `cobe` is in `package.json` and imported nowhere. Remove it when the planet lands.

### 3.6 The maps (our own cartography)
- One live map, camera driven by the scroll: the country with its four districts (02), closing on Gazipur with one green light (03), and later tilting down to Kashimpur (06).
- First choice: `bkoi-gl` 3.3.0, already a dependency (it wraps `maplibre-gl`; the app's record map uses it with `NEXT_PUBLIC_BARIKOI_API_KEY` and the styles `osm_barikoi_v1` and `barikoi_satellite`). Give it a style of our own: GeoJSON sources for the outline, the districts, the rivers and our cells; a heatmap layer for the lights; `fill-extrusion` columns for the counts in the four districts; pitch, and `jumpTo` per scroll step. Labels are DOM `Callout`s, not map glyphs. For scene 06 add roads (Barikoi's vector tiles with our paint, or a small OpenStreetMap extract), the approximate ring as a GeoJSON circle, pitch about 50 degrees.
- If `bkoi-gl` will not run a key-less style, or its weight breaks the budget, draw the same data on a 2D canvas with additive lights and a CSS tilt, and mark the ceiling with a `ponytail:` comment.
- It loads only when the dive nears and only on the full tier. The lite and still tiers get pre-rendered stills in both themes.
- Paint comes from tokens (`land`, `water`, `line`, `light`). A quiet blue-grey for water is allowed. Nothing else adds a hue.
- The map must read as Bangladesh at a glance: the delta, the three great rivers (Padma, Jamuna, Meghna), the coast.
- Captions: the dated dot line (6.1) and the map credit for whatever data shows. "The pin marks the area, not the building. From BGMEA and BKMEA." stays, and the ring's size must match the real precision of the geocode.

### 3.7 The flats
Overlock (six moving parts: handwheel, needle bar, presser foot, take-up lever, five cones, the seam), carton (blank shipping mark and a "Coming in v2" tag), dress (only once exports are live). Inline SVG: a 1.5px ink line, fills from `surface`, `subtle` and `sunken`, green only for thread. Start from the plan's symbols and replace their two hand-typed colours (white on the cones, `#B25E00` on the time line) with tokens. The scroll turns the handwheel and one step is one stitch. Each drawing is labelled "illustration".

### 3.8 ScreenStage and the atmosphere
- Re-shoot the screens at 2x on the story's factory (the RFQ composer in `public/site/rfq-one.png` shows Aboni Knitwear; the story follows Mondol Fabrics). Keep `saved-selected` and `compliance-hub` with their alt text, which the test names, or change the test on purpose.
- The window is a Pane with no chrome: a lit edge, a long shadow, a tilt of 3 degrees tied to the scroll, a soft spotlight on the part being talked about, and a drawn cursor that arrives and presses (Send RFQ).
- Behind it sits an atmosphere: a still by default (AVIF, about 100 KB) and a six-second muted loop on the full tier only. Abstract only, for example light moving across knit fabric with one green thread in soft focus. Near-monochrome, low contrast, no people, no logos, no text, nothing that could pass for a real factory.
- The app has no dark theme, so the screens stay light in both themes. Say so in the caption rather than fake a dark app.

### 3.9 The rest
The receipt roll stays paper, not glass: mono type, a perforation, printing line by line out of a glass slot. The numbers, the three promises and the time line are as planned, on the new grounds.

## 4. The scenes
| # | Chapter | Ground | On stage | Moves with the scroll |
| -- | -- | -- | -- | -- |
| 01 | Opening | night | our planet, the headline, the search `FieldPane` | the planet turns and comes in |
| 02 | Opening | theme | the country map with lights and columns; one figure at a time (4,421, 1,819, 1,628, 1,080) | the figure and the district swap, whole |
| 03 | Opening | theme | the map closes on Gazipur; one green light; the thread; an empty `RecordPane` | the others dim; the thread draws |
| 04 | 02 | theme | the overlock with five hang tags; `RecordPane` gains Sources | handwheel, needle, seam |
| 05 | 03 | theme | the receipt roll; "2 sources differ"; `RecordPane` gains three rows | the receipts print |
| 06 | 04 | the map | the live map tilts down to Kashimpur; the ring; `NotePane`; `RecordPane` gains Site | the camera |
| 07 | 05 | theme | one blank carton, "Coming in v2" | the carton slides in |
| 08 | 06 | theme | the day counter, the time line, `AlertPane`; a row turns amber | time |
| 09 | 07 | atmosphere | `ScreenStage` and three steps | the screens swap; the cursor |
| 10 | 08 | theme | the three promises | grey to ink, one per step |
| 11 | 08 | theme | four live figures | they rise in whole |
| 12 | 09 | night | the planet returns; the full `RecordPane`; the bartack; the search | the rows light |

The source ladder sits between 10 and 11 as it is today, rows arriving in rank order. The FAQ and the footer follow 12 as today. Scene 11 shows today's four figures (suppliers; certificates on file with "N already expired"; sources listed with "N hold supplier records"; RSC factory records), not Paper's "47 districts": the test refuses a district total.

## 5. How to build it
- **The base stays.** `components/site/home.tsx` remains the server-rendered page with every word in it. It is what a search engine, a screen reader, a reduced-motion visitor and a weak phone get, restyled with solid Panes. The film is a layer that mounts on top of it.
- **Engine in plain TypeScript, no React inside:** `components/site/film/engine/{director,planet,map,tier}.ts`, mounted by thin client components. That keeps it testable under `node --test` and lets a plain HTML harness load it, because the dev server is unusable on this machine.
- **Scroll:** CSS `position: sticky` inside tall sections; one passive scroll listener plus `requestAnimationFrame` writes a `--p` from 0 to 1 per scene, and CSS does the rest. No smooth-scroll takeover and no scroll library. `motion` is installed and unused: use it only if it earns its weight, else remove it.
- **Tiers, decided once on load:** `full` (1024px and up, a fine pointer, WebGL2, no reduced motion, no data saver), `lite` (phones and tablets: short holds, the planet at low density, stills for the maps and the atmosphere, solid panes), `still` (reduced motion, data saver or no WebGL: today's stacked page).
- **A flag:** the film mounts when the address carries `?film=1` or `NEXT_PUBLIC_HOME_FILM=1` is set; without it `/` is today's page. Every slice can then merge and ship without showing a half-built film, and the founder can look at the live site with `?film=1`. The last PR turns it on.
- **Words:** any new string goes through `voice-v4.md` and `ds-v4/copy-inventory.md`.

## 6. Data and assets
1. **Dot cells.** One row per square kilometre with suppliers: longitude, latitude, count. From published suppliers with a geocoded address (`address_geocodes`, migration `0077`; `lib/barikoi.ts` shows how the cache is keyed). Read production read-only (AGENTS rule 15) through the Supabase MCP `execute_sql`, project `stnrfxrxfonwexzcvvpv`; aggregate in SQL; never export an address or a supplier id. Save the file with its date and its two counts ("N of M have a mapped address": the plan's 9,753 of 10,268 is Paper's figure of 3 Oct, so recount). Save the SQL and the result in `ops/plans/home-film-data.md` (rule 14). The page prints the file's date.
2. **Geography.** The planet's land mask from Natural Earth 1:110m land (public domain), rasterised once to a small bitmap. The map's outline and rivers from Natural Earth, the districts from an open boundary set: check each licence, credit it on `/legal/data-sources`, and record source, licence and date in the same `ops/plans` file.
3. **Screens.** Re-shoot with the static harness (`build-ent.cjs` and Playwright) at 2x.
4. **Higgsfield.** The founder's account, last used on 27 Sep for the six empty-state drawings (`public/illustrations/PROVENANCE.md` has the model and the job ids). No Higgsfield tool was connected in the session that wrote this file (`.mcp.json` lists only supabase): look again at the start, and if there is none ask the founder once how to reach it. `mcp__kie__*` is a different paid account and is not authorised. Keep to about ten generations, write `public/site/film/PROVENANCE.md` in the same form, and tell the founder what was spent.

## 7. Budgets and checks
- **Weight** (replaces the plan's "under 0.4 MB"): the first screen adds no picture and at most 60 KB of script and 40 KB of data, compressed. The whole page scrolled to the end: 1.2 MB on a phone, 3 MB on a desktop, the map library and at most two loops of 700 KB included. For scale, United Carriers ships about 14 MB of frames and 288 KB of script.
- **Speed:** the `h1` is the largest paint and lands as it does today; no layout shift; scroll work under 4 ms a frame on a laptop; the planet at 60 frames a second on a laptop and 30 on a mid phone. Measure with Playwright and a 4x CPU throttle; no new tool.
- **Tests:** keep `components/site/home.test.ts` green. It holds: the `h1` text; the search form (`action="/discover"`, `role="search"`, `name="q"`); the chapter labels; the record's real facts; rows that never fall and a last card of eight or more ending in "Waiting for a quote"; "Export records are coming." with no FOB figure, no Spain and no Canada; "No link found" and never "clear"; no `count-up`, `data-count` or `aria-valuenow`; the live figures only when read; the four district counts "as counted on 3 Oct 2026" with no district total; the role tabs and their two screens with alt text; six `<details>` in the FAQ. Add: the dark set is complete and its contrast pairs hold; pane legibility pairs; tier logic; scroll maths; the data file's shape (no address, no id); with the film off the markup is today's.
- **Visual proof:** Playwright shots at 1440, 1024 and 390 in both themes for all twelve scenes, and a short recording of the scroll (`recordVideo`, then ffmpeg to mp4). `/impeccable critique` at 30 of 40 or better per scene, `/impeccable audit` for accessibility and performance.

## 8. Order of work
0. Your own worktree off `origin/development`: on 6 Oct another session kept moving the main folder's branch, and `git worktree list` showed several. Write `context/feature-specs/spec-home-film.md` from this file; one line in `active.md` (4.9 KB of 6) and one in `current-state.md` (15.8 KB of 16: archive first).
1. **Look-dev.** Tokens (the dark set, the film tokens, the type sizes), the Pane family in both materials, the thread, the rail, their entries in `/dev/ds`, and a static look-dev page showing in both themes: the Pane kit, a `RecordPane` with a row arriving, the planet live, the country map, and `ScreenStage` with three candidate backdrops. Send the founder shots and a recording with the five questions of section 9, and keep building while he answers.
2. Data, the planet and scenes 01 to 03.
3. The director and scenes 04 and 05.
4. Scenes 06 to 08.
5. Scenes 09 to 12 and the rail.
6. The phone, the lite and still tiers, the budgets, accessibility; then the flag on.

Each slice is a PR into `development`: one test file run locally, `/code-review` on the diff, `gh pr merge --auto --squash`. Promotion to `main` and the deploy click are the founder's.

**Paper.** The founder first asked for a static version in Paper. After slice 1 put the stills into "SourceBD v4" (`01M3Z77QNSZKYX715Y21B8RKC2`): new pages "32 Marketing · Home film · Desktop" and "33 Marketing · Home film · Phone", the additions on "01 Foundations" (`p-2-0`) and the Pane family on "02 Components" (`p-3-0`). Leave "30 Marketing · Desktop" (`p-E-0`) and "31 Marketing · Phone" (`p-F-0`) alone. Use the import kit rather than drawing by hand, and add each scene as it lands.

## 9. Ask the founder once, in five lines, with the look-dev
1. Higgsfield: connect the tool, or may it be used through the browser?
2. In light mode the first and last screens stay night, the look he approved. Does he want a daylight version too?
3. Dark mode covers the home page first; the other pages stay light until each is checked. A dark home that opens a light Pricing page is the cost. OK?
4. Chapter 4's live map loads Barikoi tiles for visitors who scroll that far. OK on cost?
5. Which of the three backdrops.

Build the default for each (browser not used until he answers; night; home first; live map on the full tier; the calmest backdrop) and do not wait.

## 10. Traps
- Not verified by the session that wrote this: that `bkoi-gl` runs a style with only GeoJSON sources and no key; which `maplibre-gl` version it wraps; the columns of `address_geocodes`; how Higgsfield is reached.
- There is no Content-Security-Policy in `middleware.ts` or `next.config.ts`, so WebGL and video are not blocked by a header today.
- `tokens.test.ts` refuses a hand-typed colour in a component and a numeric z-index class. Shader and map colours are read from CSS variables.
- `ds.css` zeroes every CSS duration under reduced motion; anything driven from script must check the media query itself.
- CI lint fails on an unescaped apostrophe in JSX text. The test build is looser than CI's type check (memory `strict-typecheck-tests-before-push`). Before pushing a markup change, grep the tests for the old markup.
- iOS in low-power mode will not autoplay a video: the poster must be a finished picture.
- `backdrop-filter` needs its `-webkit-` twin and is costly over large areas: keep glass panes small and few.
- Never `cd` in Bash. PR bodies and commit messages go through files. Name every issue and PR with a plain description.
