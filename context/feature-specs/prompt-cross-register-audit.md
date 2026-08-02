# Task: REZ-56 — Cross-register coverage audit + split-evidence duplicate repair

## Boot (required, in order)

1. `git checkout development && git pull` — then `git status`. The working tree MUST be clean before starting (hard rule 11). If dirty, stop and report; do not stash someone else's work without asking.
2. Read `AGENTS.md`, `context/agent-brief.md`, `context/current-state.md`, `context/feature-specs/active.md`, then `context/architecture.md` and `context/code-standards.md` (ETL task).
3. Read Linear issue REZ-56 via the Linear MCP (`get_issue`, id `REZ-56`). Set it to In Progress.
4. Verify each finding below before trusting it (hard rule 12): code claims via `git diff HEAD -- <file>`, data claims via a read-only production query (SSH `root@109.104.153.228`, key `~/.ssh/sourcebd_vps`, run python inside the etl image with `docker compose run --rm --entrypoint python -v /tmp/script:/tmp/script etl /tmp/script`; `SUPABASE_DB_URL` is in the container env).

## What triggered this (verified against production 3 Aug 2026)

The founder reported "Sarada Knit Wear Ltd." shows only BGMEA 5901 and "Sarada Fashions Ltd." is missing BKMEA + EPB, and asked for an extensive audit of missing cert/reg evidence with a root-level, never-again fix.

**Both examples turned out to be correct data, not bugs** — verify this yourself, then treat them as the audit's calibration cases:

- "Sarada Knit Wear Ltd." is genuinely NOT in BKMEA's register (full-register direct fetch, 2,784 rows: the only 'sarada' row is SARADA FASHIONS LTD.). BGMEA-only is a legitimate state — BGMEA covers knit garment makers too.
- SARADA FASHIONS LTD. HAS BKMEA data: list row `2009` + detail row `1835:detail` (scraped 2 Aug), `suppliers.bkmea_reg_number = '2009 - B/2015'`, and the public profile renders it. EPB lists neither Sarada company — and CAN'T be silently hiding them: `epb_web` upserts every register row through `upsert_supplier_with_source`, which creates a supplier on a failed match, so a listed Sarada would be visible as a supplier.

**But the same scan surfaced the real moat defect class: split-evidence duplicates** — the same legal entity existing as 2+ suppliers with DISJOINT Tier 1-3 source sets, so each profile shows a fragment of the truth:

- `FOUR H APPARELS LTD.` [BGMEA,BKMEA,EPB,OEKO_TEX,RSC] vs `Four H Apparels Ltd.` [GOTS]
- `BLUE PLANET KNITWEAR LTD.` [BGMEA,BKMEA,OEKO_TEX,RSC,WRAP] vs `Blue Planet Knitwear Ltd.` [GOTS]
- `LIZ FASHION INDUSTRY LIMITED` [BGMEA,BKMEA,OEKO_TEX,WRAP] vs `Liz Fashion Industry Ltd` [GOTS]
- `Far East Knitting & Dyeing Industries Ltd` [BGMEA,OEKO_TEX,RSC] vs `Far East Knitting and Dyeing Industries PLC.` [GOTS,OEKO_TEX]
- BKMEA's own register contains typos creating near-duplicates: `EURO KNIT CARMENTS LTD` vs `EURO KNIT GARMENTS LTD` (both [BKMEA]).

Scale context (production, 3 Aug 2026): 7,382 published suppliers have exactly ONE Tier 1-3 source (mostly legitimate — a BTMA spinner is only in BTMA); a first-two-normalized-tokens scan returns dozens of multi-supplier clusters dominated by three patterns: (a) genuinely different companies sharing tokens (`A & S Sourcing` vs `A & B Apparels` — correctly separate), (b) RSC extension/building rows (`X (Extension)`, `X (New building)`) — distinct physical sites with separate remediation status, (c) true split-evidence duplicates — the audit's target.

Key mechanics to understand before designing (verify at HEAD):

- Every register row is attached to SOME supplier by construction (`upsert_supplier_with_source` inserts one when matching fails), so "register row linked nowhere" is impossible. The failure modes are exactly two: **split** (row attached to a duplicate supplier — this issue) and **conflation** (row attached to the WRONG supplier — already policed daily by `ops/check_supplier_conflations.py`).
- The matcher is Pass 0 source_ref/alias → Pass 1 slug → Pass 2 email+name-floor → Pass 3 phone+name-floor → Pass 4 trigram-prefiltered fuzzy ≥ 92 + `_names_compatible` (`etl/core/upsert.py`). Guards deliberately err toward duplicates ("a duplicate is visible and mergeable; a conflation silently publishes lies") — splits are the accepted cost. This issue is about finding and healing them, not loosening the guards.
- `make_slug`/`normalize_company_name` (`etl/core/normalize.py`) strip legal suffixes — so `Ltd`/`Limited`/`PLC` distinctions are erased BY DESIGN, which is why the four certain clusters above are slug-equal yet still separate rows: something in the creation path bypassed or predated the match. Finding out WHAT is Phase 2's core question.
- Supplier-merge tooling exists in some form: `ops/spec08_retro_merge.py`, `ops/debug_merge.py`, and the row-level merge logic in `ops/rekey_bkmea_source_refs.py` (FK re-pointing). `ops/unmerge_bkmea_suppliers.py` is the reverse direction. Read them all before writing anything.

## Scope (implement in this order; no drive-by refactors)

1. Write `context/feature-specs/spec-cross-register-audit.md` from this prompt; mark it in progress in `context/feature-specs/active.md` and `context/current-state.md`.

2. **Phase 1 — the audit (read-only, dry-run always): `ops/audit_cross_register_coverage.py`.** For every pair/cluster of published suppliers whose names clear the SAME bar the ingest matcher uses — slug equality, OR fuzzy ≥ 92 + `_names_compatible` (import `make_slug`, `normalize_company_name`, `_names_compatible` from the ETL; NEVER reimplement normalization) — and that hold DISJOINT Tier 1-3 source sets, report:
   - both names, slugs, ids, created_at, and the creating source of each supplier (earliest active source_record per supplier);
   - the evidence each side holds (source codes + refs);
   - a confidence class: `slug-equal` (certain duplicate) vs `fuzzy` (review);
   - an exclusion class for the two legitimate patterns: shared-token-different-company (initials/token analysis already in `_names_compatible`) and RSC extension/building rows (name contains `Extension`/`New building`/unit suffix AND the RSC source row's name matches the supplier name — check `context/archive/` for the RSC extension design decision before finalizing the exclusion).
   - summary: cluster counts by confidence class and by creating-source pair (which scraper pairing produces the most splits — the normalization-gap signal).

3. **Phase 2 — root fix (never again).** For each `slug-equal` cluster, determine WHY the match failed: created before the guards existed? A scraper path that bypasses `upsert_supplier_with_source`? A normalization gap (`&` vs `and`, `PLC` vs `Ltd`, punctuation, unit suffixes)? Group clusters by root cause and fix the highest-leverage gap in `etl/core/normalize.py` / `etl/core/upsert.py` with unit tests (follow `etl/tests/test_supplier_dedup_guards.py` patterns; the "must still merge" counterweight set must keep passing — do NOT loosen conflation guards).

4. **Phase 2b — the standing detector: `ops/check_supplier_splits.py`.** The split twin of `ops/check_supplier_conflations.py`: same schedule, same reporting path (read that script and follow its convention), flagging NEW split-evidence candidates so future misses surface within a day instead of by founder inspection.

5. **Phase 3 — repair (dry-run default; founder reviews the list before apply).** `ops/merge_duplicate_suppliers.py` (or reuse/extend the spec08 mechanism if it already does exactly this — do not duplicate machinery): merge each `slug-equal` cluster into ONE supplier — re-point EVERY FK (source_records, evidence_claims/documents, certifications, addresses, rsc_remediation, sanctions_screening, and any other supplier_id-bearing table — enumerate them from the schema, do not hardcode from memory), reconcile supplier columns (registry columns follow the 3 Aug canonical-latest-wins rule; arrays union; never overwrite non-null with null), and tombstone the loser (follow the existing merge/unmerge convention for what "tombstone" means in this schema). Fuzzy-class clusters are REPORTED, never auto-merged.

## Guardrails

- Do NOT merge RSC extension/building rows into parents without an explicit founder decision — they are distinct physical sites with separate remediation status.
- Do NOT merge across genuinely different companies sharing tokens (the `A & S`/`A & B` class). When uncertain: report, don't merge.
- Merges re-point; nothing is deleted. Claim history is append-only.
- No new tools. If you think a schema migration is needed, STOP and ask.
- The audit and merge scripts run on production via the VPS etl image; dry-run output first, apply only after founder approval of the printed list.

## Verify (all must pass)

- `python -m pytest etl/tests -q` (no NEW failures; note pre-existing ones at HEAD and leave them)
- `ruff check` on touched files; `npx tsc --noEmit`; `npm test`
- `python ops/validate_sql_syntax.py` if any SQL migration appears (none expected)
- Production: audit dry-run output reviewed; merge dry-run output reviewed by founder BEFORE `--apply`

## Closeout (in order)

1. `context/current-state.md` → complete with concise architectural decisions; spec note in `active.md` → complete. NEVER commit `context/current-issues.md` or secrets.
2. Commit on `development`, push, open PR → `main` (summary + test plan), merge per repo convention.
3. Deploy: `bash ops/deploy_vps.sh --ref=main --require-git` on the VPS (confirm BOTH image tags rebuild); record rollback from `/opt/sourcebd/.deploy/previous-sha`.
4. Production, in order: audit script (read-only) → merge dry-run → founder review → apply → re-run audit to confirm clusters resolved.
5. Smoke: `curl https://sourcebd.net/api/health` → 200; spot-check 2-3 merged profiles render the combined evidence.
6. Update Linear REZ-56: audit numbers, root causes found, what shipped, PR links.
