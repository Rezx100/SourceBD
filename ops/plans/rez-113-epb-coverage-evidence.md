# REZ-113 — EPB coverage evidence gate

Date: 2026-08-10  
Mutation: **none**

## Recomputed production figures

| metric | value |
| -- | -- |
| Active EPB `source_records` | **539** |
| Distinct suppliers with EPB | **531** |
| Published mothers | **10272** |
| Published mothers with BGMEA or BKMEA | **7685** |
| Of those, **no** EPB SR | **7181** |
| `epyllion-style` has EPB | **false** |

## Vs saved state (current-state.md ~978)

Saved claim: flagged EPB exporters ~**541**, DB holds **539** = near-full **flagged** coverage.  
Recomputed: still **539** active EPB SRs / **531** suppliers — matches the saved SR count; no unexplained drift on that figure.

The founder complaint (“a lot of companies missing EPB”) matches the **7181** published mothers that have BGMEA/BKMEA but no EPB pill — that is the category-attach / unflagged population, not a failure of the flagged association pass.

## Law

- `epb_web` association pass: BGMEA/BKMEA-flagged exporters (create/upsert).
- Category pass: `enrich_only=True` — attach to existing suppliers only; never mint single-source EPB-only rows.
- Do **not** `--apply` from this gate. Founder decides whether to re-run category attach dry-run next.

## Decision needed

1. Accept 539 flagged coverage as complete and leave 7181 without EPB until category matching improves, or  
2. Authorise an `epb_web` category-pass dry-run (fingerprint + closed-loop) before any apply.

Evidence gate complete. Waiting for your decision.
