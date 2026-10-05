# From Paper to code: the pull and the translation (PR P1, 4 Oct 2026)

Scripts live in `.impeccable/preview/paper-import/` (gitignored with the rest of the kit).
Output lives in `.impeccable/paper-export/` (as Paper gave it) and `.impeccable/paper-export-34/`
(translated for Tailwind 3.4); both gitignored. Paper desktop must be open with "SourceBD v4".

```
node .impeccable/preview/paper-import/pull-jsx.cjs        # 431 boards + tokens.css, about 2 minutes, reads only
node .impeccable/preview/paper-import/translate.cjs       # writes paper-export-34/; fails on anything unknown
node .impeccable/preview/paper-import/translate.cjs --check   # the self-check alone
```

**Pull.** Pages `02`, `03`, `10`, `11`, `20`, `30`, `31` (13 pages), every artboard through `get_jsx`
(format `tailwind`), plus `get_tokens` to `tokens.css`. Resumable; `FORCE=1` pulls again. File names are
`<board name> [<board id>].tsx`; `index.json` lists them with sizes.

**Translate** (TypeScript parser, not regex). Per class: Paper's `[color:var(--color-x)]` forms become
`text-x`, `border-x`, `border-t-x`, `bg-x`; off-scale spacing becomes exact px (`w-97.5` is
`w-[390px]`); `text-sm/4.5` becomes `text-sm` when that is the token's own leading, else adds
`leading-[Npx]`; `wrap-anywhere`, `basis-[0%] grow`, per-side `border-*-solid/dashed`, `bg-position-*`,
`bg-size-*`, `rounded-[calc(infinity*1px)]` are rewritten; a hex that equals a token becomes the token;
`var(--color-x)` inside an arbitrary value becomes `theme(colors.x)`. Per board: the root's width and
height (the artboard frame) are dropped and noted in a `// notes:` first line; the phone status bar
(the row with `9:41` and the signal glyphs) and the home indicator (the 134 x 5 pill and its wrapper) are
deleted; every inline Phosphor `<svg>` becomes `<Icon size={n} weight=".." className="text-x" aria-hidden />`
(matched by path against `@phosphor-icons/react` 2.1.1, any weight; the first line lists the imports).
Result on 4 Oct: 431 of 431 boards, 0 unknown, 0 parse errors.

**Coverage check (B0, 4 Oct 2026).** `node .impeccable/preview/paper-import/check-config.cjs` compiles every
class in `paper-export-34/` through `tailwind.config.ts` and lists any that make no CSS. After B0: 776 of 776.
The translator now writes `font-[system-ui,sans-serif]` and `w-[round(50%,1px)]` (35 boards) as the arbitrary
properties `[font-family:system-ui,sans-serif]` and `[width:round(50%,1px)]`, which 3.4 compiles. The system-ui
headings are Paper's own (every other heading is Plex); the builder of those screens decides.

**Things B0 and B1 must supply, or the translated boards will not render as drawn** (B0 supplied all of them;
`#C9CDD2` is still unnamed):

- Spacing tokens: `h-touch` (14x), `min-h-touch`, `h-input-touch`, `h-tabbar`, plus `topbar`, `row`,
  `control`, `action-bar` named in section 4c of the hand-off.
- Container widths as **width** utilities, not only max-width: `w-dialog` (112x), `w-prose` (68x), `w-pane`
  (58x), `w-details` (22x), `max-w-pane`. Tailwind's own `max-w-prose` (65ch) must be overridden.
- Font sizes `text-display-1` and `text-display-2` (no line-height in Paper; the translator adds
  `leading-[Npx]` where a board sets one).
- Shadows are written as `[box-shadow:theme(colors.line)_0px_-1px_0px]`-style arbitrary values, so the
  colour tokens must exist as `colors.*` in the config. Paper has no shadow tokens; there are
  four recurring ones (a 1px line, a 2px brand underline inset, a 3px surface ring, a 12px lifted card).
- Two hex values no token names are passed through and should be named or dropped: `#861C16` (the
  pressed danger button) and `#C9CDD2` (text on a dark panel).
- Three icons were drawn from a slightly different Phosphor version than the installed 2.1.1 and are mapped
  by name: `DownloadSimple`, `PaperPlaneTilt`, `CheckCircle` (fill). Each board using them says so in its notes.
- One Paper quirk: `text-sm-line-height/6.5` (a size taken from a line-height token) becomes
  `text-[18px] leading-[26px]`.

**What the translation does not do** (the builder's job, section 2 of the hand-off): turn Paper's boxes
into real elements, put live data where Paper has sample text, merge the 1440 / 390 / 320 boards of one
screen into one responsive page, and add focus, keyboard and the undrawn loading and error states.
