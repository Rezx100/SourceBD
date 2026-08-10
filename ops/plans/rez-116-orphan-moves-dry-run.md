# REZ-116 — orphan BGMEA moves dry-run (2026-08-11)

Mutation: **none applied yet**. Fingerprint for acceptance:

`11ed6036f6586e7f831168e9eba08f108ba97a46d9c7688da6f6a66d7363e95d`

## Pre-state recomputed

| check | result |
| -- | -- |
| REZ-115 published identity collisions | **0** |
| published bare identities | **0** |
| member_type general / associate | **4284 / 1686** (unchanged vs report) |
| mother facility-registry render (birds-garments BGMEA 2455 + building_name) | **observed** via `buyer_supplier_profile` RPC + live HTML |
| #10 destination `standard-stitches-ltd-woven-unit`.facility_of | mother `standard-stitches` published |

## Plan size

10 MOVE + 1 HOLD. Population matches decisions table exactly (no drift).

## Founder-knowledge provenance (not register evidence)

* `1604` → `ar-sourcing` (A.R.Z Sourcing BD)
* `1556` → `sunrise-apparels` (Sunrise Apparel BD)

## HOLD

* `1168` remains on `pa-textile`; must not land on `p-fashion`.

## Apply command (after ACCEPTED_FOR_HUMAN_REVIEW)

```
PYTHONPATH=. python ops/move_bgmea_orphan_registrations.py --apply \
  --expect-fingerprint 11ed6036f6586e7f831168e9eba08f108ba97a46d9c7688da6f6a66d7363e95d
```
