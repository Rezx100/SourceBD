# REZ-112 — address near-dup sample note

Date: 2026-08-10  
Mutation: **none** (display merge only)

## Fixture (unit)

`lib/dedup-addresses.test.ts` — Epyllion Bahadurpur short BGMEA + long OEKO
(Bhawal / Vawal + P.O. / Post:) → **one** factory; Nayapara stays separate;
mailing Nina Kabbo stays separate.

## Lexicon

`vawal` → `bhawal` in `lib/bd-place-lexicon.ts` and `etl/lib/bd_place_lexicon.py`
(lockstep). P.O. / Post: normalised to `post` in `normaliseAddressKey`.

No DB address rows changed.
