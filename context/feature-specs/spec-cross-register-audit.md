# Spec: Cross-register coverage audit + split-evidence duplicate repair (REZ-56)

Linear: REZ-56 (High). Session prompt: `context/feature-specs/prompt-cross-register-audit.md`.
Status: **code complete** (3 Aug 2026) — validated read-only against
production; pending PR → deploy → founder-approved production apply.

## Problem

The same legal entity can exist as 2+ published suppliers holding disjoint
Tier 1–3 evidence, so each public profile shows a fragment of the truth
("split-evidence duplicates"). Founder examples (Sarada companies) were
verified as correct data, not bugs; the scan behind them surfaced the real
defect class.

## Verified findings (production, 3 Aug 2026 — every number below re-queried)

- Calibration: SARADA FASHIONS LTD. holds BKMEA `2009` + `1835:detail`,
  `bkmea_reg_number = '2009 - B/2015'` (+OEKO_TEX); Sarada Knit Wear Ltd. is
  genuinely BGMEA-only (`general:5901`); EPB register contains zero Sarada
  rows. Scale: 7,382 of 10,213 published suppliers hold exactly one Tier 1–3
  source code — mostly legitimate.
- **26 multi-supplier groups (52 suppliers) exist under the slug that current
  `make_slug(company_name)` computes.** `suppliers.slug` is UNIQUE
  (migration 0001), so this class is invisible in stored columns — it only
  appears on recompute.
- **Root cause A (dominant, ~22 of 26 clusters): normalization drift.** 502
  published suppliers have a stored `slug` / `company_name_norm` that current
  `etl/core/normalize.py` would not produce (500 drifted norms). The 12 May
  generation stripped industry words (`FOUR H APPARELS LTD.` → stored
  `four h`; `BLUE PLANET KNITWEAR LTD.` → `blue planet`); a later generation
  predates the abbrev rules (`LIZ FASHION INDUSTRY LIMITED` → stored
  `liz fashion industry`, current `liz fashion industries`). The duplicate
  twins were created 16–19 May (mostly GOTS/BRAND_NEXT ingests) with correct
  modern norms — Pass 1 (stored slug equality) and Pass 4 (trigram over
  stored norm) both read the drifted columns and could not match. Confirmed
  per-cluster: the 12-May side is the drifted one.
- **Root cause B: unmerge insert path bypasses the matcher.** Several cluster
  members were created 30–31 Jul 2026 by `ops/unmerge_bkmea_suppliers.py`,
  which inserts a fresh supplier with `_unique_slug` suffix-hunting and never
  asks whether a same-name supplier already exists (e.g. WEST KNITWEAR LTD.
  31 Jul vs West Knit Wear Ltd. 14 May).
- **Root cause C: `plc` is not a stripped legal suffix.** `_LEGAL_SUFFIX_RE`
  covers ltd/lts/limited/pvt/private/co/company/corp/corporation/inc/llc/llp
  but not `plc`, so `Far East Knitting & Dyeing Industries Ltd` and `Far East
  Knitting and Dyeing Industries PLC.` normalize differently. 20 published
  suppliers carry PLC names; the matcher-bar pair is `_names_compatible`
  today but not slug-equal.
- **Root cause D: register-typo near-duplicates with shared refs.** BKMEA's
  own register typo created `EURO KNIT CARMENTS LTD.` vs `EURO KNIT GARMENTS
  LTD` — BOTH hold list row `481` (membership `481 - A/2000`). Production has
  16 BKMEA `(source, ref)` pairs attached to >1 published supplier (the
  REZ-36 multi-supplier-membership class) and 1 OEKO_TEX (`oeko-tex-6160`,
  attached to both Far East rows). Shared-ref is the deterministic split
  signal.
- Unit/building rows are a separate, legitimate class: RSC sibling records
  (`(Extension)`, `(New Building)`, `Unit-N`, `- N`; migration 0014
  `public.rsc_extension_base_name`, archive decision 21 May 2026) and their
  OEKO_TEX/BRAND_NEXT cross-source twins (e.g. Liz Fashion Shafipur/Valuka
  units). Never auto-merged.

## Deliverables

### 1. Audit — `ops/audit_cross_register_coverage.py` (read-only, always)

Discovers clusters among published suppliers and reports them with
confidence + exclusion classes. Read-only by construction; no `--apply`
exists.

Discovery (three independent signals, imported ETL normalization only —
`make_slug`, `normalize_company_name`, `_names_compatible`; never
reimplemented):

- **A: recomputed-slug equality.** Group by `make_slug(company_name)`,
  groups >1 → `slug-equal` clusters (certain duplicates).
- **B: fuzzy bar.** SQL trigram prefilter on stored `company_name_norm`
  (mirrors the matcher's candidate generation), rescore in Python against
  **recomputed** norms with `token_sort_ratio >= 92` **and**
  `_names_compatible` — the same bar `_find_existing` Pass 4 uses, computed
  on the names as current code sees them. Class `fuzzy` (review; never
  auto-merged).
- **C: shared source ref.** One `(source_id, source_ref)` attached to >1
  published supplier → `shared-ref` cluster (deterministic split signal).

Merge eligibility is computed PER MEMBER PAIR over "certain edges"
(`certain_merge_groups`), not per cluster:

- signal A (recomputed-slug equality), or
- signal C + signal B (names clear the matcher bar) + sharing mechanics that
  prove one entity: a non-BKMEA ref (cert-body customer profile), or a BKMEA
  shadow — one side's entire active ref set is a subset of the other's
  (register-typo row with zero independent evidence).

A BKMEA membership number on two substantive suppliers (CORNY/CRONY) is an
ownership question for a human — reported, never merged. Multi-member
clusters can mix certain and fuzzy-only links: only the certain-linked
members form merge groups (Eon Fashion is reported inside the EMON cluster
but excluded from its merge group; Four R likewise inside FOUR H).
`--explain NAME` dumps pairwise signals + certainty verdicts for ops
debugging.

Per cluster report: both names, stored + recomputed slugs/norms, ids,
created_at, probable creating source (`source_tags[0]`, insertion-ordered at
insert), Tier 1–3 evidence per side (codes + refs), set relationship
(disjoint / overlapping / subset — note: Far East shares one OEKO_TEX ref on
both sides, so full disjointness is not required; the fragmentation
predicate is "each side holds ≥1 Tier 1–3 source the other lacks"), a
confidence class, an exclusion class, and a root-cause attribution
(drift-side creation date, unmerge-window creation, shared-ref, plc).

Exclusions (reported separately, never merge-eligible):

- **RSC extension/building/unit rows** — name carries an extension suffix
  (`public.rsc_extension_base_name(company_name) is not null`, reused from
  migration 0014 — not reimplemented) **and** the supplier holds an active
  RSC source_record whose `fields->>'rsc_factory_name'` matches the supplier
  name. Cross-source unit twins are still listed as fuzzy candidates for
  visibility.
- **Shared-token different companies** — handled structurally: pairs only
  enter class B/C when `_names_compatible` accepts them (the initials/order
  analysis that rejects the `A & S` / `A & B` class).

Summary: cluster counts by class, by root cause, and by creating-source
pair (the normalization-gap signal).

### 2. Root fixes (never again)

- **`etl/core/normalize.py`: add `plc` to `_LEGAL_SUFFIX_RE`** (root cause C,
  the one current-code gap). Unit tests follow
  `etl/tests/test_supplier_dedup_guards.py`: the Far East pair joins the
  "must still merge" set; conflation counterweights unchanged.
- **Normalization-drift backfill: `ops/backfill_supplier_identity.py`**
  (dry-run default). Recomputes `slug` + `company_name_norm` for every
  supplier whose stored value differs; collision-safe (skips the slug but
  still heals the norm when the target slug is taken — those pairs are
  Phase 3 merge candidates). Multi-pass (max 5, stop at fixpoint): collision
  chains where the holder itself vacates (T & T Fashion → `t-and-t-fashion`,
  freeing `t-and-t` for T & T Company) resolve across passes. Public profile
  slugs change for drifted rows — accepted pre-launch; correctness of
  Pass 1/Pass 4 depends on stored columns meaning what current code says
  they mean. Runs AFTER the merge (losers deleted free their slugs), then
  re-run until the blocked list is empty.
- **Unmerge matcher guard** in `ops/unmerge_bkmea_suppliers.py`: before
  inserting a split-off supplier, look up existing suppliers by recomputed
  slug / `_names_compatible` and attach to a true match instead of inserting
  a duplicate (root cause B).
- **Standing detector (Phase 2b): `ops/check_supplier_splits.py`** +
  `ops/split_check_cron.sh`, twin of the conflation check (same Slack path,
  daily cadence, exit 0/1/2 + `--quiet`). FAILs on ANY certain merge group
  among published suppliers — after the repair run the baseline is zero, so
  any group is by definition NEW (the same model the conflation check uses;
  no novelty window needed). Skips the audit's trigram self-join: signal B
  is evaluated directly, only where a shared-ref pair needs it for the
  certainty rule, so the daily run takes ~60s. Ownership-dispute shared refs
  (CORNY/CRONY class) and the drift count print as informational without
  failing the run, so a check that cries wolf never gets switched off.

### 3. Repair — `ops/merge_duplicate_suppliers.py` (dry-run default)

Merges each `slug-equal` cluster (and shared-ref clusters with compatible
names) into ONE supplier. Fuzzy-class clusters are reported, never merged.
RSC extension/unit rows are excluded. Founder reviews the printed plan
before `--apply`.

- Discovery imported from `ops.audit_cross_register_coverage` (one
  implementation of "what is a split cluster").
- Winner: the member with the most distinct active Tier 1–3 source codes
  (tie: most active records, then earliest created_at). Winner keeps its row
  and slug.
- **FK re-point list is enumerated from `information_schema` at run time**,
  never hardcoded: 18 FK relations today (source_records, certifications,
  evidence_claims, compliance_documents, rsc_remediation,
  sanctions_screening, saved_suppliers, message_threads, orders,
  rfq_quotes, claim_requests, sbi_scores, score_recalc_jobs,
  partner_factories.{buying_house_id,factory_id},
  supplier_relationships.{buying_house_id,factory_id},
  verification_queue.supplier_a_id) plus `evidence_claims.subject_id` where
  `subject_table='suppliers'` (not FK-enforced). Views
  (`v_supplier_addresses*`, `v_supplier_registry_ids*`) are filtered out via
  `table_type='BASE TABLE'` — they cannot be updated and their rows follow
  the base-table re-point automatically. Every enumerated relation re-points
  generically; schema drift is caught by the zero-reference check before the
  loser is deleted — a new table can never silently leak rows onto a deleted
  supplier.
- Collision conventions: `source_records` unique (supplier, source, ref) —
  keep the NEWEST fetched row (last-scraped-wins), re-point
  `evidence_claims` subjects and the `source_record_id` FKs (certifications,
  rsc_remediation, sanctions_screening, partner_factories) to it, then
  delete the redundant copy (the `rekey_bkmea_source_refs.py` convention:
  citations survive on the kept row; only the duplicate row identity goes).
  Every other table is handled generically through its unique constraints
  spanning the supplier column (certifications, saved_suppliers,
  supplier_aliases…): the winner already holds the equivalent row, so the
  loser's byte-equivalent duplicate is dropped and counted; everything else
  re-points.
- Supplier column reconciliation: arrays union (`source_tags`,
  `bgmea_reg_numbers`, `phones`); scalars `coalesce(winner, loser)` — never
  overwrite non-null with null; `bkmea_reg_number` follows the 3 Aug
  canonical-latest-wins rule (side with the newest BKMEA `:detail` fetch
  wins; neither has detail → winner's); verified flags OR; entity_type
  prefers non-unknown; `is_published` OR; `claimed_by` coalesce;
  `completeness_pct` recomputed.
- Tombstone: loser supplier row is DELETED after re-pointing — the spec08
  merge convention. No evidence/claim/cert history is deleted; buyer-facing
  rows move to the winner (a true duplicate is one company — buyer intent is
  unambiguous, the exact opposite of the unmerge direction). Merges re-point;
  claim history is append-only. One transaction for the whole apply, like
  the sibling scripts.
- Post-apply note: run `ops/backfill_profile_columns.py` (derived numeric
  columns), then `ops/backfill_supplier_identity.py`.

## Guardrails (carried from the prompt)

- RSC extension/building rows are never merged into parents without an
  explicit founder decision.
- Genuinely different companies sharing tokens are never merged; when
  uncertain: report, don't merge.
- No schema migration. No new tools.
- Audit and merge run on production via the VPS etl image; dry-run output
  first, apply only after founder approval of the printed list.

## Verification

- `python -m pytest etl/tests -q` (no new failures), `ruff check` on touched
  files, `npx tsc --noEmit`, `npm test`.
- Production: audit output reviewed; merge dry-run reviewed by founder
  BEFORE `--apply`; re-run audit post-merge to confirm clusters resolved.

## Order of operations (production)

1. Deploy code (audit, detector, merge, normalize fix, backfill, unmerge
   guard).
2. Run audit (read-only) → founder review.
3. `merge_duplicate_suppliers.py` dry-run → founder review → `--apply`.
4. `backfill_supplier_identity.py` dry-run → `--apply` (heals drift;
   plc-strip lands on stored columns here).
5. `backfill_profile_columns.py` (derived columns post-merge).
6. Re-run audit → clusters resolved; install `split_check_cron.sh` daily.
7. Smoke: `/api/health` 200; spot-check merged profiles render combined
   evidence.
