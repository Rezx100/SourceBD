# REZ-117 — 18 ambiguous BGMEA decisions dry-run (2026-08-12)

Mutation: **none applied yet**. Fingerprint for acceptance:

`8ff592aa21d3987b7b01f1509c710a60b32ccbf7c92a8bf438c1859c1368f913`

Policy: Associate-register companies are buying houses (`entity_type=buying_house`). Take associate numbers off factories that are a different company; create a buying-house profile when needed.

## Plan size

18 items — matches founder table in `ops/plans/bgmea-attribution-decisions.md` §2 exactly (no population drift).

| action | count | refs |
| -- | -- | -- |
| import_move + buying_house | 8 | 953, 330, 1573, 1020, 1129, 296, 528, 1261 |
| move_retag + buying_house | 2 | 1283 → mim-fashion-wear; 331 → **union-fashion** (not plural) |
| stay_retag + buying_house | 1 | 231 on am-fashion |
| stay | 3 | 679, 1398, general:4572 |
| move (general) | 4 | 5756→snowtex-outerwear; 3778→south-end-sweater; 3624→southeast-sweater; 2436→univogue unit-2 |

## Pre-state notes (recomputed 12 Aug)

- `am-fashion`, `mim-fashion-wear`, `union-fashion` still `entity_type=factory` — retag is part of this mutation.
- 953 and 528 both leave `as-knitwear` (factory) onto new buying houses.
- `univogue-garments-co-ltd-unit-2`: unpublished, `facility_of` → published mother `univogue-garments` (in fingerprint).
- Post-apply gate: mother must show BGMEA **2436** with `building_name` (compensate on fail).
- Durable detector is **post-apply strict**: move/import refs must sit only on destination; associate-on-factory fails except allowlist `679`, `1398`. Detector stays red until apply lands.

## Out of scope

158 class-3c associate-on-factory cases — separate issue after this ships.

## Apply command (after ACCEPTED_FOR_HUMAN_REVIEW)

```
PYTHONPATH=. python ops/apply_rez117_ambiguous_decisions.py --apply \
  --expect-fingerprint 8ff592aa21d3987b7b01f1509c710a60b32ccbf7c92a8bf438c1859c1368f913
```
