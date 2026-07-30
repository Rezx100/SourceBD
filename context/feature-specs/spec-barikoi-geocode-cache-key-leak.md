# Spec — close the Barikoi geocode cache-key leak

Status: **queued** (raised 29 Jul 2026 during the Firecrawl PR review; deliberately
kept out of that PR as pre-existing and unrelated)
Owner: unassigned
Depends on: nothing. Independent of the Firecrawl acquisition work.

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

## Scope

1. **Quantify it first.** A read-only count of how many distinct candidate
   addresses have a lexicon-rewritten key versus a raw one. This needs no API
   calls and decides how urgent the rest is. Until this number exists, the cost
   of the leak is unknown.
2. **Make one implementation authoritative.** Recommended: move the "is it
   already cached?" decision out of SQL and into Python, so `normalize_key` is
   the only thing that ever computes a key. `_list_pending` becomes: select the
   candidate addresses, select the existing `address_norm` values, and filter in
   Python with `normalize_key`. Both sides are short strings in the tens of
   thousands, so holding them in memory is not a concern.
3. **Backfill the orphans.** Rows already written under a canonical key are
   correct and must not be re-geocoded. Verify a pass over existing data
   re-geocodes nothing.

### Rejected alternative

Porting the lexicon to a SQL function and calling it from `_list_pending` keeps
the scan set-based, but it creates a **third** copy of the lexicon to hold in
lockstep. Two copies already needed a dedicated parity test to keep honest
(`etl/tests/test_bd_place_lexicon.py`, added 29 Jul 2026). Prefer deleting the
second implementation over adding a third.

## Acceptance

All of this is verifiable with **zero Barikoi API calls**:

- `python -m etl.cli geocode-addresses --dry-run` reports a pending count that
  excludes every address already present in `address_geocodes`, including
  addresses whose key the lexicon rewrites.
- A unit test proves an address containing a rewritten place name
  (`Jessore`/`Jashore` is the clearest case) is treated as cached once stored.
- Run the dry run, apply nothing, run it again: the count must not include
  previously geocoded addresses.
- The app's map behaviour is unchanged, since its read path was already correct.

## Notes for whoever picks this up

Do not "fix" this by changing `normalize_key` to stop applying the lexicon. That
would align the two paths by discarding REZ-28, whose entire purpose is that
variant spellings of one place share a single cache key — and it would orphan
every row already written under a canonical key.
