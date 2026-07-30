# Spec — close the Barikoi geocode cache-key leak

Status: **shipped 31 Jul 2026.** Raised 29 Jul during the Firecrawl PR review and
initially deferred; pulled forward on the founder's call because it bills real
money on every run. Kept as the record of what was wrong and why.
Owner: —
Depends on: nothing. Independent of the Firecrawl acquisition work.

## What landed

`_list_pending` no longer filters in SQL. It reads the candidate addresses and the
existing `address_norm` values, then filters through the pure `select_pending`
helper so `normalize_key` is the only thing in the system that computes a cache
key. Covered by `etl/tests/test_barikoi_geocode.py` (12 tests, no database
required), including a guard that fails if the lexicon stops rewriting the place
name the regression test is built on.

## Why this matters

`etl/jobs/barikoi_geocode.py` writes its cache key one way and decides what still
needs geocoding another way. Any address the place lexicon rewrites is therefore
never recognised as already cached, so it is re-selected and re-billed on **every
run, forever**.

Rupantor costs 2 API calls per address, so this is a recurring quota charge for
work already paid for, not a one-off.

## The divergence

Three paths compute the key. Two agree; the third does not.

| Path | Key it computes | Lexicon applied |
| --- | --- | --- |
| Write — `_store`, `barikoi_geocode.py:91` | `normalize_key(address)` | yes |
| App read — `normalizeAddressKey`, `lib/barikoi.ts:50` | same shape as `normalize_key` | yes |
| Pending scan — `_list_pending`, `barikoi_geocode.py:57` | `lower(regexp_replace(trim(address), '\s+', ' ', 'g'))` in SQL | **no** |

So for an address containing `Jessore`, the row is stored under `…jashore…`
while the pending scan looks for `…jessore…`, finds nothing, and reports the
address as ungeocoded.

The app is unaffected — its read path applies the lexicon, so it hits the cache
correctly. This is purely a spend and staleness bug, which is why it has gone
unnoticed.

## Why it is silent

Three things independently hide it:

- `insert … on conflict (address_norm) do nothing` swallows the duplicate write,
  so no error is raised and no log line is emitted.
- The run's own stats count the re-geocode under `resolved`, so the job reports a
  healthy, productive run.
- The negative-cache guarantee in the module docstring — "an unresolvable address
  is billed once, not on every run" — is defeated for exactly this set of
  addresses, and defeated invisibly.

Nothing surfaces except the Barikoi invoice.

## A second, worse consequence found while fixing it

`normalize_key` only gained the lexicon in REZ-28 (`5d71291`, 28 Jul 2026). Before
that it was plain lowercase-and-whitespace. So the cache holds two generations of
key, and they behave differently:

- **Written on or after 28 Jul** — canonical key. The app finds these. The pending
  scan did not, so *these* are the rows that were re-billed every run.
- **Written before 28 Jul** — raw key. The old pending scan matched these, so they
  were never re-billed — but the app's read path applies the lexicon, so it has
  been looking for a canonical key that is not there. **Any supplier in a renamed
  district geocoded before 28 Jul has silently had no map pin since REZ-28
  shipped.** That is a correctness bug, not just a spend one, and it was hidden by
  the map's deliberate fail-closed behaviour: a cache miss yields no pin and no
  error.

The fix resolves both. Legacy raw-keyed rows do not match the canonical key, so
they are geocoded once more, which writes a canonical row and restores the pin.
That is a bounded one-time cost — the next run sees the canonical key and skips
them — and it is the cheapest available repair, since the alternative is a
migration that re-keys rows whose original raw spelling is no longer recoverable
from the key alone.

Expect the first run after this change to do real work. That is the backfill, not
a regression.

### Measured against production, 30 Jul 2026

Read over PostgREST, since the Postgres wire is unreachable from a dev machine on
either pooler port. Of 17,973 cached rows:

| Generation | Rows | Meaning |
| --- | --- | --- |
| Lexicon-irrelevant | 14,568 | Key identical either way; never affected |
| Canonical-keyed | **0** | Would have been re-billed — none existed yet |
| Raw-keyed | **3,405** | Orphaned from the app; all hold real coordinates |

Two corrections to the diagnosis above fall out of this. The re-billing had **not
yet cost anything**: the job had not run since REZ-28, so the bug was armed rather
than firing. And the orphan problem was larger and more concrete than assumed —
3,405 real geocodes, every one of them invisible to the map, none of them negative
cache entries.

### Repaired in place, not by re-geocoding

The spec originally assumed the raw spelling was unrecoverable from the key. It is
not: `address_raw` is a stored column, so the canonical key is recomputable for
every row. `ops/rekey_geocode_cache.py` updated 3,344 rows with 0 failures. The
other 61 cannot be re-keyed and do not need to be — 54 already have a canonical row
serving the app, 7 collapse onto a shared key.

That cost nothing and was instant, where letting the backfill re-resolve the same
addresses would have cost 6,688 Rupantor calls to arrive at identical coordinates.

The post-repair audit is the sharpest evidence for the code fix: pending is now
**0 calls** under the new scan and **6,688** under the old one. Deploying the
repaired data without the code fix would re-bill the whole cache every run.
`ops/audit_geocode_cache.py` reproduces that comparison read-only whenever needed.

## Scope

1. **Make one implementation authoritative.** ✅ Done. The "is it already cached?"
   decision moved out of SQL and into `select_pending`, so `normalize_key` is the
   only thing that ever computes a key. Both sides are short strings in the tens of
   thousands, so holding them in memory is not a concern next to the API calls it
   saves. Deduping by key within a run came free with it: two spellings of one
   address were previously two calls writing a single row.
2. **Quantify the two generations.** ✅ Done — `ops/audit_geocode_cache.py`,
   read-only, no API calls. Numbers above.
3. **Repair the orphans.** ✅ Done — `ops/rekey_geocode_cache.py --apply`, 3,344
   rows re-keyed against production on 30 Jul 2026, 0 failures. No backfill run is
   needed; pending is 0.

### Rejected alternative

Porting the lexicon to a SQL function and calling it from `_list_pending` keeps
the scan set-based, but it creates a **third** copy of the lexicon to hold in
lockstep. Two copies already needed a dedicated parity test to keep honest
(`etl/tests/test_bd_place_lexicon.py`, added 29 Jul 2026). Prefer deleting the
second implementation over adding a third.

## Acceptance

Verified locally with **zero Barikoi API calls**:

- ✅ A unit test proves an address whose key the lexicon rewrites is treated as
  cached once stored under `normalize_key` — the exact key `_store` writes.
  `etl/tests/test_barikoi_geocode.py`, 12 tests.
- ✅ `--limit` counts calls to be made rather than rows examined, so quota control
  still means what it says now that filtering happens after the query.
- ✅ Spelling variants sharing one key are geocoded once per run.

Still to confirm on the VPS, where the database is reachable:

- `python -m etl.cli geocode-addresses --dry-run` twice in a row, with a real run
  in between: the second count must exclude everything the first run geocoded.
  This is the check that would have caught the original bug.
- The app's map behaviour improves rather than changes: pre-REZ-28 orphans regain
  their pins as the backfill re-keys them.

## Notes for whoever picks this up

Do not "fix" this by changing `normalize_key` to stop applying the lexicon. That
would align the two paths by discarding REZ-28, whose entire purpose is that
variant spellings of one place share a single cache key — and it would orphan
every row already written under a canonical key.
