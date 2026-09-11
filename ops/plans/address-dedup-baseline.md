# Address-dedup baseline (recomputed 11 Sep 2026)

Mutation: **none**. Read-only export of published multi-string address groups.
Project: `stnrfxrxfonwexzcvvpv`. Fixture:
`lib/fixtures/v-supplier-addresses-multi-string.json`.

The audit hypothesis is treated as evidence, not truth. Counts below were
recomputed against production on 11 Sep 2026 via `v_supplier_addresses`
joined to `suppliers.is_published = true`.

## Recomputed vs hypothesis

| Measure | Hypothesis | Recomputed | Verdict |
| --- | ---: | ---: | --- |
| Published address rows | 27,732 | **27,732** | MATCHES |
| Published suppliers with ≥1 address | 9,921 | **9,921** | MATCHES |
| Multi-string groups by `(supplier_id, address_kind)` | 3,274 | **3,274** | MATCHES (by-kind, not by-supplier) |
| Multi-string groups by supplier only | — | **5,526** | by-supplier is larger; do not use it as the fixture grain |
| Address rows in the view including unpublished | 27,871 | **27,871** | MATCHES; **139** unpublished (REZ-109 facility rows). Fixture is published only. |

Definition used: published suppliers; a group is `(slug, address_kind)` with
≥2 distinct `trim(address)` strings. That is the 3,274. The 5,526 by-supplier
figure counts a company once if it has two different strings anywhere, even
when each kind is a single string (factory vs mailing). The fixture is by-kind.

## Fixture contents

| Measure | Value |
| --- | ---: |
| Groups written | **3,274** |
| Unique slugs in those groups | 2,463 |
| Distinct `(source_code, address, fetched_at)` rows | 8,987 |
| View-repeated `(source_code, address, fetched_at)` collapsed | 0 |
| Factory groups | 2,349 |
| Mailing groups | 664 |
| Registered groups | 261 |
| Inherited `*_inherited` kinds among published rows | 0 |
| Group fingerprint `md5(slug\|kind newline-joined)` | `d31aaf8a27848cb7bb307f032776c68a` |

Groups sorted by slug, kind. Rows sorted by source_code, fetched_at, address.
Identical `(source_code, address, fetched_at)` would be collapsed if the view
repeated them; none were. Distinct strings are kept, including the same string
from one source at two `fetched_at` values.

The current matcher (HEAD before the premises-merge change) was run on this
fixture on 11 Sep 2026:

| Measure | Value |
| --- | ---: |
| Groups already merged to 1 location | **1,622** |
| Groups still showing 2+ locations | **1,652** |
| Of those, matcher reduced string-count but still multi | 342 |

The audit hypothesis of **~490 duplicate groups** is **not** the remaining-split
count. 1,652 groups still render as 2+ rows; ~490 was a human estimate of how
many of those are the same premises. Named defects on this matcher: Habitus
Fashion factory stays 3 rows; Fakhruddin Textile Mills factory stays 3 rows.
Saved split list: `ops/plans/address-dedup-current-matcher-split.json`.

## Named checks

`habitus-fashion` factory is present (`HABITUS FASHION LIMITED`, 4 rows, 3
distinct strings): BGMEA `Gajaria Para, Kauitis` / Gazipur; BKMEA `GAJARIA
PARA, BHAWAL MIRZAPUR…` at two fetch times; OEKO_TEX `Gojariapara, Vhawal
Mirzapur…`.

`fakhruddin-textile-mills` factory is present (`FAKHRUDDIN TEXTILE MILLS
LTD.`, 4 rows, 3 distinct strings): BGMEA `Kewa, Ghorgaria, Master Bari,
Sreepur`; BKMEA `MOUZA KEWA, SREEPUR, GAZIPUR` at two fetch times; OEKO_TEX
`Ghargaria Master Bari, Kewa, Sreepur, Gazipur - 1740, Bangladesh`.

Both also have a mailing multi-string group; those are separate groups.

## SQL to re-run (do not write a second script)

```sql
select
  (select count(*) from public.v_supplier_addresses) as view_rows_all,
  (select count(*)
     from public.v_supplier_addresses va
     join public.suppliers s on s.id = va.supplier_id and s.is_published = true
  ) as published_address_rows,
  (select count(distinct va.supplier_id)
     from public.v_supplier_addresses va
     join public.suppliers s on s.id = va.supplier_id and s.is_published = true
  ) as published_suppliers_with_address,
  (select count(*) from (
     select va.supplier_id, va.address_kind
     from public.v_supplier_addresses va
     join public.suppliers s on s.id = va.supplier_id and s.is_published = true
     group by va.supplier_id, va.address_kind
     having count(distinct trim(va.address)) >= 2
  ) t) as multi_string_groups_by_kind,
  (select count(*) from (
     select va.supplier_id
     from public.v_supplier_addresses va
     join public.suppliers s on s.id = va.supplier_id and s.is_published = true
     group by va.supplier_id
     having count(distinct trim(va.address)) >= 2
  ) t) as multi_string_groups_by_supplier;
```

If any count differs by even one row, this baseline is stale: stop, list the
row-level identities, and do not leave two numbers for one question.
