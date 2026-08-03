# Session prompt — Split-evidence follow-ups: Sarada seed merge + variant-class decisions

**4 Aug 2026.** REZ-56 is FULLY COMPLETE in production (37 certain merge groups
applied 3 Aug, detector green, context files current as of development
`3441e14`). This session picks up the queued follow-ons. Work them in order;
several need a founder decision before code — ask, don't invent (AGENTS.md:
"One spec at a time", "If a spec is ambiguous, ask ONE clarifying question").

## Boot

PowerShell: no `&&` — run git steps as separate commands.

1. `git checkout development`; `git pull`; `git status` — tree MUST be clean
   (hard rule 11). If the user has meanwhile merged the development→main PR,
   also `git fetch origin main` and note main's head.
2. Read `AGENTS.md`, `context/agent-brief.md`, `context/current-state.md`
   (REZ-56 section is the fresh state), `context/feature-specs/active.md`,
   and this file. Then only task-relevant files per the lean-context rule.
3. Verify any file fact against HEAD with `git diff` before asserting it
   (hard rule 12).

## State of the world (verified 3 Aug 2026, production)

- main + VPS: `ed84bef` (REZ-56 + both apply hotfixes). development:
  `3441e14` = `ed84bef` + `33d0506` (--pair seed mode) + `3441e14` (docs).
- Production: 10,176 published suppliers (was 10,213); re-audit 0 certain
  merge groups; `ops/check_supplier_splits.py` prints OK; 311 fuzzy pairs and
  10 shared-ref ownership questions stand (report-only, by design).
- RSC extension rows ("X (New Building)", "X - Unit N") are never merged.
- Winner convention: `_pick_winner` = most distinct Tier 1-3 codes → most
  records → earliest created_at; seeded mode uses the explicitly named winner.

## Task 0 — confirm the deploy (user action, verify only)

The user merges + deploys development→main (PR opened from the compare link;
GitHub CLI is NOT authenticated locally, so give them
`https://github.com/Rezx100/SourceBD/compare/main...development?expand=1`).
Verify before any production write:
`git fetch origin main; git log origin/main --oneline -3` shows a merge of
development, and `ssh -i ~/.ssh/sourcebd_vps root@109.104.153.228
"cd /opt/sourcebd && git log --oneline -1"` matches. Do NOT run the seed
merge until the VPS carries `33d0506` — deployed `ops/` lacks `--pair`
before that.

## Task 1 — Sarada Knit Wear seeded merge (founder-confirmed, pre-authorized)

Founder instruction (3 Aug 2026): "merge them smartly and keep the actual
data without guesswork" — evidence gathered, no guesswork remains:

- `Sarada Knit Wear Ltd.` (slug `sarada-knitwear`, BGMEA reg 5901, address
  "56, S.M. Maleh Road, Narayanganj, Tanbazar", director Prasanta Paul)
- `SARDA KNITWEAR LTD` (slug `sarda-knitwear`, BKMEA 1010 - C/2009, detail
  page 1018, address "56, S.M. MALEHA ROAD, NARAYANGANJ", owner MR. PRSANTA
  PAL)
- Same premises + same owner (Paul/Pal = one Bengali surname, two
  romanizations) ⇒ one legal entity. Winner = `sarada-knitwear` (founder's
  spelling, BGMEA side).
- **Do NOT merge `sarada-fashions`** (SARADA FASHIONS LTD., BKMEA+OEKO_TEX):
  same owner family but different premises (South Sasthapur, Fatullah) —
  sister company, correctly separate.

Run (dry-run first, review the plan, then apply):

```
ssh -i ~/.ssh/sourcebd_vps root@109.104.153.228 "cd /opt/sourcebd && docker compose run --rm --entrypoint python -e PYTHONPATH=/app -v /opt/sourcebd/ops:/app/ops:ro etl ops/merge_duplicate_suppliers.py --pair sarada-knitwear,sarda-knitwear"
```

then repeat with `--apply`. Seeded mode skips audit discovery, so the
trigram timeout wrapper is NOT needed. Expected: loser's BKMEA rows
(1010 + 1018:detail) move to the winner, bkmea_reg_number becomes
1010 - C/2009 (canonical newest-valid-detail rule), loser row deleted.
Smoke afterwards: supplier count 10,175; `sarada-knitwear` holds
BGMEA+BKMEA source_tags; `sarda-knitwear` slug gone; detector still OK;
profile renders on https://sourcebd.net (slug `sarada-knitwear`).

## Task 2 — founder decisions (B/C/D). Ask via structured question if unanswered.

Findings canvas (still on disk):
`C:\Users\Hp\.cursor\projects\e-SourceBD\canvases\sarada-findings-variant-audit.canvas.tsx`.

- **B — audit v2 variant signal.** Fold the name-variant scan into
  `ops/audit_cross_register_coverage.py` as a REPORT class (never auto-merge)
  and into the standing detector. Method proven 3 Aug (917 candidate pairs,
  top band ≥96 ≈ 50 near-certain, several already healed by the 37-group
  apply — re-scan first): 4-gram index over space-stripped
  `normalize_company_name` output (drop grams shared by >40 suppliers);
  candidate pairs share ≥1 rare gram; keep char `fuzz.ratio` ≥ 86 with
  min squashed length 10; require fragmented Tier 1-3 sets (each side holds
  ≥1 code the other lacks); corroborate with address-token overlap (require
  street-number agreement for a strong score; exclude city tokens).
  Noise floor below ~94 is real: `DK KNIT WEAR` vs `YK KNITWEAR` and
  `MALEK SPINNING` vs `EK SPINNING` are different companies; `Univogue
  Unit-III` vs `(Unit-2)` is the extension class. The certain band goes to
  the founder as a seeded-merge review list (`--pair`), not into
  `certain_merge_groups`.
- **C — matcher squash-equality pass.** Add to `_find_existing` in
  `etl/core/upsert.py` after Pass 1: match on
  `replace(company_name_norm, ' ', '')` equality so future `WEST
  KNITWEAR`-class spellings attach instead of minting twins. Unit tests in
  `etl/tests/test_supplier_dedup_guards.py` mirroring the PLC tests. A
  functional index is a schema migration — hard rule: STOP and ask before
  migrating; the per-record seq scan at ~10k rows is acceptable meanwhile.
- **D — EPB coverage widening.** Live-verified facts: EPB register totals
  5,939 approved exporters; BGMEA-flagged 389, BKMEA-flagged 157, either
  541 (we hold 539 = full flagged coverage). `SARADA FASHIONS LIMITED.` IS
  exporter 4083 (reg BD05918, South Sastapur, categories Knit + (NB),
  **no association flags** — hence invisible to `epb_web`, which enumerates
  only flagged exporters). Red Dot Apparels is exporter 5172 (BD06653, West
  Masdair) — different company; the founder's pasted URL slug was stale.
  EPB's category taxonomy (818 categories embedded in the home page)
  separates RMG (Knit=2, Woven=3, Knit & Woven=8, Sweater=24, Garments
  stock lot=16/23/30) from jute/fish/rice/leather. Proposal: enumerate by
  RMG categories instead of association flags (same
  `/api/exporters-search` + XSRF mechanics already in
  `etl/scrapers/epb_web.py`). **Policy decision the founder must make**:
  attach-only (enrich existing suppliers, never create from the widened
  pass — recommended; needs an enrich-only mode in the pipeline) vs
  full-create (consistent with other register scrapes, but creates
  single-source EPB profiles). Until D lands, Sarada Fashions correctly
  shows no EPB row.

## Task 3 — residuals

- 6 slug-blocked pairs from the identity backfill (`/tmp/step3.out` on the
  VPS, also in current-state.md): GLITTER FASHION, CHORKA TEXTILE, NAFISA
  APPARELS + Paramount Textile PLC, SHASHA DENIMS PLC, SHEPHERD INDUSTRIES
  PLC. Each is blocked by an UNPUBLISHED holder; `--pair` loads published
  suppliers only (audit `_fetch` scope), so handling them means extending
  seed mode to unpublished losers or unpublishing/merging by hand — founder
  decision.
- Linear REZ-56: closeout comment was NOT posted (Linear MCP unavailable
  3 Aug). Post the completion summary from current-state.md and move the
  issue to Done.
- Firecrawl CLI on the dev machine: installed (`npm i -g firecrawl-cli`)
  but browser auth was abandoned — unneeded for everything above (the EPB
  probes used plain `requests` with XSRF bootstrap, no credits).

## Ops reference

- VPS: `ssh -i ~/.ssh/sourcebd_vps root@109.104.153.228`; app at
  `/opt/sourcebd`; run ops scripts via
  `docker compose run --rm --entrypoint python -e PYTHONPATH=/app -v /opt/sourcebd/ops:/app/ops:ro etl <script>`.
  `SUPABASE_DB_URL` lives in the container env — never echo/print it.
- Long audit/detector queries die at the session `statement_timeout` under
  evening load, and **psycopg3 ignores PGOPTIONS**. Recreate the in-process
  wrapper if `/tmp/_run_merge.py` is gone: monkeypatch `psycopg.connect` to
  `set statement_timeout = 900000` (+ `conn.commit()`) before
  `runpy.run_path(f"/app/{script}", run_name="__main__")`, mount it with
  `-v /tmp/_run_merge.py:/tmp/_run_merge.py:ro`, argv = script path + args.
- ssh sessions sometimes hang after the remote command finishes — use
  `ssh -n` and redirect remote output to a file, then `cat` the file.
- PowerShell interpolates `$?` in double quotes (remote `EXIT=$?` prints
  `EXIT=True`) — judge remote exit codes by the script's own printed verdict.
- GitHub CLI is not authenticated locally — PRs via compare-link; never push
  to main directly (hard rule 9).
- Merge apply is one transaction: any failure rolls back fully. Two hotfixes
  already shipped this way (sbi_scores singleton PK `6d0790c`; subject-citation
  dedupe `a2f57f0`) — if a NEW unique-constraint class surfaces, the pattern
  is: dry-run surfaces it → dedupe/drop rule → hotfix → re-apply.
