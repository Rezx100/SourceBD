# Hand-off — redesign individual elements of the SourceBD design system

Paste this whole file as the first message of the new session.

## 1. What exists

The SourceBD design system (v3, 18 Sep 2026) lives as a Design System artifact:

    https://claude.ai/artifact/3n9MkVaXgFaFokziwhmP5o

It is the source of truth. Nothing in the repo (`lib/design/tokens.ts`, `app/ds.css`, `/dev/ds`) has been updated to it yet — do not read those for direction; they are the older Inter/blue-grey set.

Read, in this order, with the Artifact tool (`action: "read"`, `url` above, `path`):

1. `project/README.md` — the brand book. Every rule below is expanded there.
2. `project/tokens.json` — colours (light + dark), type styles, spacing, density, radius, shadow, gradient, timing.
3. `project/components/<Name>/README.md` and `preview.html` for each element you touch.
4. `project/components/Homepage/preview.html` — the whole marketing page assembled; shows how pieces sit together.

Reference the system was built from: sourceready.com (screen recording, 18 Sep). Heavily inspired, not a clone.

## 2. Locked — do not reopen

- Brand green `#1B5E20` (`brand`). Only on the app primary button, logo tile, links, active nav. Never a badge fill, never a state.
- Fonts: Geist (300 display / 400 body / 500 headings — never 600+), Instrument Serif italic (one word per marketing headline, `accent-xl` / `accent-lg`, never in the app), Geist Mono (`eyebrow` uppercase for source marks, keys, table headers; `code` for register/certificate numbers, HS codes). Files are in `project/fonts/`.
- Status hues: `positive` (teal, verified/valid), `caution` (contradicted/expiring/expired), `danger` (system errors), `sanction` (reserved, AAA), `quiet` (empty — it is the canvas), `locked` (striped panel, never a blur), `smart` (Smart Match only).
- `signal #3FE374` is icon-size or a glow only. Never text, never a status.
- Hairlines (`line-subtle`) separate; no shadows on cards or rows in lists.
- Source rank = neutral lightness ramp `tier-1`…`tier-5`. No colour.
- Names wrap; nothing truncates. Every fact has room for a source mark.
- Contrast: 4.5:1 text, 3:1 controls/rings, 7:1 sanction — in both themes.

## 3. Elements to redesign

| Element | File | Brief |
|---|---|---|
| SupplierCard | `project/components/SupplierCard/` | The Discover result. Current version is functional but flat. Wanted: more hierarchy between name / type line / facts / sources / locked contact; stronger locked-contact treatment; a hover that feels alive without a shadow; a selected state; the sanctioned variant must stay unmissable. Must survive the 100-char name and the one-source / eleven-source rows. |
| _(add more here)_ | | |

For each element, produce two or three visual directions first (each a full preview.html rendered as PNG, light and dark), let the founder pick, then finish the winner.

## 4. Real records to test with (production, never invent)

- Ordinary name: `Aboni Knitwear Ltd` (11 sources, the most).
- Longest buyer-visible name (100): `Zaheen Knitwear Limited (Shed 3, 4, 5, 10, 11, 12, 13 and Building, Security, ETP and Fire Pump)`.
- Almost no data: `AR Fashion`.
- Many sources + 6 certificates: `SM Knitwear`.
- Sanctioned: none exists; render a variant labelled "sample" only.

Real counts: 10,266 published profiles · 25 sources · 4,275 certificates · 72,796 citations. Contact details are locked for most visitors (design that as the default, not the edge case).

## 5. How to work

1. Copy `project/components/<Name>/` and `project/tokens.json` into one scratch folder as `<dir>/project/...`. Keep tokens.json unchanged unless a redesign truly needs a new token — if so, add it with a usage note and a contrast check, both themes.
2. Previews are plain HTML/CSS, no React. Line 1 is the marker `<!-- @dsCard group="Data display" height=N -->`. Use only `var(--token)` values — no hand-typed hex. Fonts and tokens are preloaded by the page; for local rendering, inject `@font-face` from `project/fonts/` and compile tokens.json to CSS vars (`--<name>`; theme via `<html data-theme="dark">`).
3. Render every option at its card width in light AND dark, look at the PNGs, fix, then show the founder.
4. Publish only the changed files to the artifact URL above (`root` = scratch folder, `file_path` = one changed file's absolute path, `files` = the rest by `project/...` path). Read the artifact once right before publishing or the call is refused as stale. Do not resend `design-system.json` unless an asset or the title changes.
5. Update the element's README.md when its states or props change.

## 6. Out of scope

- Repo changes (`tokens.ts`, Tailwind, components). A separate task will port the system into the codebase.
- Marketing pages, Homepage composition, fonts, palette.

## 7. Founder working style

Terse, directive. Show, don't describe — mockups over prose. Five lines or fewer per reply. Quick pivots; ask one question at most, then build.
