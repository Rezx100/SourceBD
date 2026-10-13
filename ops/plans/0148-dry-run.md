# 0148 — workforce of a company with buildings: dry run

13 Oct 2026. **Not applied.** Waits for the founder's "apply 0148".

## What it changes

`production_workers_display_batch` returns two more keys for a company that has a figure of its
own and at least one attached building with a figure: `own` and `buildings`. The five keys it
already returns are computed exactly as before. The app turns the two into the range it prints as
"Workforce", on the record and in every list (`familyRange` in `lib/enrich-discover-workers.ts`):
from the larger of the two to their sum, rounded outwards (to 50 from 500 up, to 10 below).

Why a range: a company's filed figure may or may not already count its sheds, and no register says
which. If it does, the whole is the larger figure; if not, it is the sum.

## Dry run on production

One `do` block through the Supabase MCP: read every published supplier's figures, replace the
function, read them again, raise (which rolls everything back).

```
DRY RUN OK | roots before 5767 | after 5767 | old keys identical 5767 | with own+buildings 501
```

| company | own | buildings | shown |
| -- | -- | -- | -- |
| Anowara Fashions | 280 | 822 | 800–1,150 |
| Zaheen Knitwears | 3,944 | 1,634 | 3,900–5,600 |
| Kenpark Bangladesh Apparel (K-3) | 5,192 | 4,618 | 5,150–9,850 |

- 5,767 published suppliers have a figure before and after, and all 5,767 keep their five existing
  keys unchanged.
- 501 companies gain the two new keys, so 501 records and their search rows will show a range.

Live function before: md5 `3954edb26b5595ffd2cbfd8a3fd198fa`.

## Order

Safe either way. Code that does not know the keys ignores them; code that knows them and does not
get them (before the apply) shows the company's own filed figure, with no sentence under it.

## Rollback

Re-create the function without the `family` CTE, its join and the two keys (the body is otherwise
the live one recorded above).
