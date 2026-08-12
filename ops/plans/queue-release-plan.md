# Review-queue release plan

Measured 13 Aug 2026 against production. Dry-run only. Not applied.

Open `verification_queue` rows: **1,332**. These are tickets, not 1,332 hidden companies.

## Classifier counts

| Action | N | What a buyer sees |
| --- | ---: | --- |
| keep_separate | 953 | Already a live company on Discover; ticket closes |
| already_attached | 298 | Building already on the mother Facilities section; ticket closes |
| hold_no_register | 48 | Brand-list only, no Bangladesh register; stays hidden (Tier 1–3 gate) |
| label_group | 7 | Sister companies stay separate, labelled Part of Euro/Square/Ananta/Chorka/HAMS/Jinnat/Noman Group |
| attach_brand | 6 | Brand listing moves onto the existing published company |
| attach_facility | 6 | Leftover published buildings attach to the mother (Ilmeeyat New Building 3, Intimate Building 3, Anowara dyeing sheds, Logos Building 4, Libas New building, Azim & Son Unit 1 Extension) |
| merge_into | 6 | Spelling/plural variants become one profile (Bori Garment/Garmaent, Friends Fashion/Fashions, Euro Knitspin, Shah Sharif's, American Efird/Efried, Liz Fashion Valuka Unit) |
| publish | 1 | Section Seven Ltd — already has register evidence |
| needs_human | 7 | 4 buildings attached to a different mother than the ticket names; 3 fuzzy pairs with a missing supplier row |

Fingerprint: `7734c3863b02e95311b8512400b280165ea65b5a73e675ce1ae515850c520c98`

## What was refused

A.H. vs H.H. Textile, Rio vs Reo Fashion, Pretom vs Pritom — distance-1 names that do not share a 6-character stem. Jinnat Apparels & Fashion and other `&` sister listings are not attached as buildings.

## Apply

Review clicking Release uses migration `0102` (must be applied to production first). Bulk path:

```
python ops/release_review_queue.py
python ops/release_review_queue.py --apply --expect-fingerprint 7734c3863b02e95311b8512400b280165ea65b5a73e675ce1ae515850c520c98
```

`--apply` is blocked until the founder authorises this exact fingerprint. Re-run the dry-run immediately before apply; if the fingerprint moved, approval is void.
