---
name: paper-to-app
description: Build or update a SourceBD app screen from a Paper board (pull the board, convert it to Tailwind TSX in the app's tokens, pixel-check it, wire it to the route). Use when the founder says Paper, a board name or node id, "build it from Paper", or "carry on the phone redesign". Start by reading HANDOFF.md in this plugin when the work is the buyer phone redesign.
---

# Paper → app

SourceBD's colour and type tokens use Paper's names (`text-ink-2`, `bg-sunken`, `bg-danger-tint`,
`text-sm` = 13/18; `lib/design/tokens.ts`, `tailwind.config.ts`), so Paper's own export is close to
code. Three scripts in `plugins/paper-to-app/scripts/` do the mechanical part. Run them from the repo
root (they use `process.cwd()` as the repo; override with `SOURCEBD_ROOT`).

1. **Pull** (needs Paper desktop running on this computer):
   `node plugins/paper-to-app/scripts/pull.cjs <outDir> <nodeId>=<name> ...`
   Talks to `http://127.0.0.1:29979/mcp` (`PAPER_MCP` to override). Per board it writes
   `<name>.jsx` (Tailwind), `<name>.inline.jsx` (exact styles), `<name>.tree.txt` (layer names),
   `<name>.paper.jpg`, plus `tokens.css`. File "SourceBD v4" is `01M3Z77QNSZKYX715Y21B8RKC2`;
   page 37 `p-M-0` (desktop supplier record and search results; desktop only, the reverse of the
   phone rule below, spec `context/feature-specs/spec-desktop-record-page-37.md`), page 36 `p-L-0`
   (buyer phone screens), page 35 `p-K-0` (supplier drawer), page 33 `p-I-0` (what shipped before). **No Paper here?** Pages 35 and 36 are already pulled into
   `plugins/paper-to-app/boards/page-35|page-36` (11 Oct 2026) and converted into `boards/tsx35|tsx36`.
2. **Convert**: `node plugins/paper-to-app/scripts/convert.cjs --all <pullDir> <outDir>` (all boards,
   ~2 s) or `convert.cjs <name>.jsx <name>.tsx <ComponentName>`. Paper `var(--color-x)` becomes
   `text-x`/`bg-x`/`border-x`; inline Phosphor SVGs become `<Icon weight="thin" />`; Tailwind v4 and
   off-grid values become v3.4 classes; layer names become `{/* comments */}` (a renamed text layer
   marks a data slot); the status bar, home indicator and tab bar are dropped (the app's frame draws
   them). It prints a "check by hand" list per board.
3. **Check**: `node plugins/paper-to-app/scripts/check.cjs <pullDir> <name> ...` renders Paper's
   inline export beside the converted TSX in Chrome with the app's real Tailwind config, prints
   PASS/DIFF and writes `<name>.check.png`. Run it, and `node plugins/paper-to-app/scripts/convert.test.cjs`,
   after any edit to `convert.cjs`. All 51 boards measured 0.00–0.01% pixel difference on 11 Oct 2026.
4. **Wire it up** — follow `screen-rules.md` beside this file exactly: phone only (desktop untouched),
   route data replaces sample copy, kit pieces over generated divs, every tap a `next/link` or kit
   button with `active:bg-sunken`, no new tokens or packages (stop and ask if a Paper token has no
   match), no `loading.tsx` on detail routes, a boundary test for any copy an outside caller sees.

Then the repo's own rules apply (AGENTS.md, CLAUDE.md): one `/code-review`, PR to `development` with
`gh pr merge --auto --squash`, the founder clicks the deploy.
