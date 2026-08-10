# REZ-115 — BGMEA register identity (evidence, recomputed 2026-08-10)

Figures below were recomputed against production before implementation.
They match the autonomous brief; none differed.

## Scraper mapping (believe the scraper)

| scraper | `source_ref` | `fields.bgmea_member_type` | `fields.bgmea_reg_number` |
| -- | -- | -- | -- |
| `etl/scrapers/bgmea_web.py` | `general:{N}` (or `member:{id}` if no N) | `general_manufacturer` | bare N |
| `etl/scrapers/bgmea_buying_house.py` | bare N | `associate_buying_house` | bare N |

Active production counts: **4284** general_manufacturer (all `general:N`),
**1686** associate_buying_house (all bare `N`). Missing member_type: **0**.

## Bare-number collisions (published)

| measure | count |
| -- | -- |
| colliding bare numbers | **1185** |
| shared by 2 | **1007** |
| shared by 3 | **178** |
| unique published suppliers in those collisions | **2175** |

Examples: bare `1` DESH (`general:1`) vs Ocean Cross (associate `1`);
bare `10` CONTINENTAL vs Unigarden; bare `1007` Enayet vs RIJ-TEX;
three-way bare `100` Birds Fadrex / Birds Garments / Young Woo Trading.

## Prefixed identity projection

Deriving `general:N` / `associate:N` from `bgmea_member_type` on active BGMEA
source_records for published suppliers: **0** null identities, **0** colliding
prefixed identities across distinct suppliers.

## Dry-run mutation set (storage backfill)

| measure | value |
| -- | -- |
| mutations | **5801** |
| published_touched | **5772** |
| unresolved_records | **0** |
| published_identity_collisions_after | **0** |
| fingerprint (sha256 of `supplier_id:after_ids` ordered) | `1ea498e27b6f9a61089ac2a190d255f43a1feb9018c5652a65bb84bd7f70cb7b` |

Source: MCP `execute_sql` against production project `stnrfxrxfonwexzcvvpv`.
Identities derived only from active BGMEA `source_records.fields->>'bgmea_member_type'`.

### Hand-check sample (proposed display)

| slug | label | value | source_url |
| -- | -- | -- | -- |
| desh-garments | BGMEA General member # | 1 | https://www.bgmea.com.bd/member/951 |
| ocean-cross-international | BGMEA Associate member # | 1 | null (PDF register; no HTML page) |
| continental-garments-industries | BGMEA General member # | 10 | https://www.bgmea.com.bd/member/816 |
| unigarden-incorporate | BGMEA Associate member # | 10 | null |
| enayet-garments | BGMEA General member # | 1007 | https://www.bgmea.com.bd/member/1129 |
| rij-tex-international | BGMEA Associate member # | 1007 | null |
| birds-garments | BGMEA General member # | 100 | https://www.bgmea.com.bd/member/596 |
| young-woo-trading | BGMEA Associate member # | 100 | null |
| birds-fadrex | BGMEA General member # | 2163 | https://www.bgmea.com.bd/member/595 |

Note: birds-fadrex currently holds orphaned bare `100` in the array (REZ-98 already
withholds it from display). Backfill drops it because no live SR on that supplier
vouches for associate:100 or general:100.

## Out of scope (filed separately)

206 name-disagreement registrations (53 wholly foreign / 176 mixed) —
`ops/plans/bgmea-identity-gap.md`; needs REZ-102 premises.

## Post-apply reconciliation (2026-08-10)

| measure | value |
| -- | -- |
| snapshot_rows | **5801** (`_snapshot_bgmea_reg_identities_20260810`) |
| applied mutations | **5801** (fingerprint re-matched before apply) |
| published_bare_remaining | **0** |
| published_identity_collisions | **0** |
| display_collisions (label+value) | **0** |

Hand-check (live BGMEA pages): DESH Reg 1 at `/member/951`; CONTINENTAL at `/member/816`; Enayet at `/member/1129`. Associates Ocean Cross / Unigarden / RIJ-TEX / Young Woo named in `bgmea-names.json` under bare digits matching their associate regs.

Candidate accepted: `fadd0fe` — `ACCEPTED_FOR_HUMAN_REVIEW` (Judge). Autonomy applied migration 0101 + storage backfill.
