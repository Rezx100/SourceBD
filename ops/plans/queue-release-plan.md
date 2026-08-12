# Review-queue release plan

Measured 13 Aug 2026 against production. Dry-run only. Not applied.

Open `verification_queue` rows: **1,332**. These are tickets, not 1,332 hidden companies.

Fingerprint: `06173cdedba6b422d854d5d89545fb7f29beaf152e39fe3ab131748daea57626`

The previous fingerprint `7734c386…` is void. It labelled token clusters as groups, merged Valuka Unit pages, attached Azim’s extension onto another building, and would have moved Kenpark K5 / Shine Printing / Noman Y/D onto a sister company.

## Classifier counts

| Action | N | What a buyer sees |
| --- | ---: | --- |
| keep_separate | 961 | Already a live company on Discover; ticket closes |
| already_attached | 298 | Building already on the mother Facilities section; ticket closes |
| hold_no_register | 40 | Brand-list only, no Bangladesh register; stays hidden (Tier 1–3 gate) |
| attach_brand | 11 | Brand listing moves onto the existing published company (Ltd/Limited/PLC twins) |
| attach_facility | 8 | Building/unit attaches to the mother (5 leftover RSC sheds + Shafipur Unit, Impress-Newtex Textile Unit, South East Printing Unit) |
| merge_into | 5 | Spelling/plural variants become one profile (Bori Garment/Garmaent, Friends Fashion/Fashions, Euro Knitspin, Shah Sharif's, American Efird/Efried) |
| needs_human | 8 | 4 buildings attached to a different mother; Azim Unit 1 is itself a building; 3 fuzzy pairs with a missing supplier row |
| publish | 1 | Section Seven Ltd — already has register evidence |

Token clusters (euro/square/knit/…) stay separate companies. Review posts `release`, which 0062 rejects until migration `0102` is applied.

## Apply

Review clicking Release uses migration `0102` (must be applied to production first). Bulk path:

```
python ops/release_review_queue.py
python ops/release_review_queue.py --apply --expect-fingerprint 06173cdedba6b422d854d5d89545fb7f29beaf152e39fe3ab131748daea57626
```

`--apply` is blocked until the founder authorises this exact fingerprint. Re-run the dry-run immediately before apply; if the fingerprint moved, approval is void.
