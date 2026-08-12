# Review-queue release plan

Measured 13 Aug 2026 against production. Dry-run only. Not applied.

Open `verification_queue` rows: **1,332**. These are tickets, not 1,332 hidden companies.

Fingerprint: `000531700f970a9c9a2a2c129cac1d4131f646dcfc457f44f7fe84fe67d171d3`

Python dry-run is unchanged after the Review SQL repair (13 Aug 2026, later
the same day): `(U-2)` was already a building in Python. Migration `0102`
now uses the same extras, attaches only building-shaped ids, requires one
mother across both fuzzy names, and brand tickets use that mother search
(Liz Shafipur Unit → Liz Fashion), so Review matches this fingerprint.

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

`--apply` is blocked until the founder authorises this exact fingerprint. Re-run the dry-run immediately before apply; if the fingerprint moved, approval is void.
