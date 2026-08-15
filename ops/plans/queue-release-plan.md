# Review-queue release plan

Applied 14 Aug 2026 against production. Pre-apply live Review plan matched the
13 Aug counts except two already-closed tickets (Dhakarea Ltd Extension,
Uni Gears LTD Extension) — close-only, no buyer-row change. Mutation set
unchanged: 12 attach, 11 brand, 5 merge, 1 publish.

Open `verification_queue` rows before apply: **1,330** (was 1,332). After
apply: **48** held (`needs_human`). Closed this run: 29 mutations via
`admin_queue_decide` + 1,253 close-only tickets.

Fingerprint of the 13 Aug 1,332-row Python plan (historical, now applied
remainder): `000531700f970a9c9a2a2c129cac1d4131f646dcfc457f44f7fe84fe67d171d3`

Re-measured 13 Aug 2026 after Review SQL mother-search and mill-paren repairs.
Python destinations are unchanged from the earlier 00053170 plan. Mid-repair
fingerprint `2e87c4ed…` (Hurricane and South East Printing Unit held because
leftover `(Pvt.)` was treated as a leftover building) is void.

Python dry-run is not Review. Review runs `admin_queue_decide` →
`admin_queue_release_plan` in migration `0102`. That SQL now abbreviates
Industry→Industries and matches slug/norm on mother search (Valuka → Liz
Fashion `liz fashion industries`), refuses a mill paren stacked with another
unit (`(Sw Unit) Unit-2`), and still attaches a mill paren that is the only
suffix (Hurricane Printing Unit, South East Printing Unit). Leftover `(Pvt.)`
after that strip is kept.

Prior fingerprints `7734c386…` and `06173cde…` are void.

## Classifier counts

| Action | N | What a buyer sees |
| --- | ---: | --- |
| keep_separate | 957 | Already a live company on Discover; ticket closes |
| already_attached | 298 | Building already on the mother Facilities section; ticket closes |
| needs_human | 48 | Brand-only with no register mother, plus 4 wrong-parent RSC tickets and 3 missing fuzzy rows. Tickets stay open. |
| attach_facility | 12 | Buildings/units move onto the mother (Valuka + Shafipur → Liz Fashion; Azim Unit 1 + Extension → Azim & Sons; leftover RSC sheds; Printing/Textile units onto their register company) |
| attach_brand | 11 | Brand listing moves onto the existing published company (Ltd/Limited/PLC twins) |
| merge_into | 5 | Spelling/plural variants become one profile. Survivors: Bori **Garment** (not Garmaent), American **Efird** (not Efried), Friends Fashions, Euro Knitspin, Shah Sharifs |
| publish | 1 | Section Seven Ltd — already has register evidence |

Token clusters stay separate companies. Review posts `release` only (not `approve`). Unmigrated 0062 rejects that until `0102` is applied.

## Apply

Review clicking Release uses migration `0102` (must be applied to production first). Bulk path:

```
python ops/release_review_queue.py
python ops/release_review_queue.py --apply --expect-fingerprint 000531700f970a9c9a2a2c129cac1d4131f646dcfc457f44f7fe84fe67d171d3
```

Applied 14 Aug 2026 after founder go-ahead. Snapshots:
`_snapshot_20260814_queue_release_queue` (29 mutation tickets),
`_snapshot_20260814_queue_release_suppliers` (58 supplier rows).
