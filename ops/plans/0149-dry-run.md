# 0149 dry run (13 Oct 2026, production, rolled back)

Migration `supabase/migrations/0149_supplier_slug_redirects.sql`. **Not applied.** It waits for the
founder's "apply 0149" (AGENTS rule 15).

## What it is for

The merge of 13 Oct 2026 (`ops/plans/duplicate-suppliers-audit.md`, section 3) deleted 70 duplicate
supplier rows. 61 of them were published, so their web addresses now answer "Page not found":
`/suppliers/oishi-fashions` is gone, the kept profile is `/suppliers/oishi-fashion`. Google and
buyers' bookmarks still hold the old addresses.

## What it changes

1. **One small table**, `supplier_slug_redirects`: an old address and the supplier row that was kept.
   Nobody can read it from outside (RLS on, no grant to signed-out or signed-in callers).
2. **One function**, `facility_parent_slug`, answers for an old address as well as for a building. The
   building half is the text of 0096, unchanged. The supplier page, the signed-in record and the
   search's side record already ask this function when a profile is not found and send a permanent
   redirect (308) to what it answers. So **no page code changes and no deploy is needed**: once the
   migration is applied the old addresses redirect, within five minutes (the public page keeps a
   "not found" answer for 300 seconds).
3. **The 61 addresses are filled** from the merge's own snapshot,
   `_snapshot_dup_merge_20261013_suppliers`.

Choices made, each one line to change:

- Only the 61 **published** merged rows get a redirect. The other 9 were never public pages.
- A redirect points at the kept **row**, not at its address, so renaming the kept profile is followed.
- An address a live row holds is never redirected, whether that row is published or not.
- If the kept row is unpublished the old address stays "not found". If the kept row later becomes a
  building, the old address goes to the building's mother.
- If the kept row is merged again, both merge scripts carry its old addresses to the new kept row on
  their own (they move every column that points at a supplier). If a kept row is ever deleted
  outright, its redirects go with it.

## What was run

The whole migration inside `do $dry$ … execute $m$ <the migration> $m$; <checks>; raise exception …`,
so everything rolled back by construction. The signed-out checks ran as the `anon` role.

```
DRY RUN OK | old addresses recorded 61 | resolve to the kept profile 61 | answer nothing 0 | point at themselves 0
 | oishi-fashions -> oishi-fashion (signed out: oishi-fashion) | oishi-fashion (live) -> null | an unknown slug -> null
 | the 9 unpublished merged rows still answer nothing: 9
 | buildings 744 : answers changed 0, redirecting 730
 | table: RLS t, signed-out read refused, select granted to anon f authenticated f | function callable signed out t
 | 0.06 ms a lookup
aboni-textile -> aboni-textiles
alema-textiles -> alema-textile
amir-shirt -> amir-shirts
ams-international-l-sweater -> ams-international-sweater
apex-shinning-and-knitting-mill -> apex-spinning-and-knitting-mills
apparel-21 -> apparels-21
appolo-fashions -> appollo-fashions
ba-fashionwear -> ba-fashiowear
bedgetex-apparels -> badgetex-apparels
chorka-textile -> chorka
clifton-fashion -> clifton-fashions
clifton-textile-and-apparels -> clifton-textiles-and-apparels
dird-composite-textiles -> dird-composite-textile
dream-wear -> dreamwears
ettadee-jeans -> ettade-jeans
euro-knit-carments -> euro-knit-garments
farzana-fashion-world -> farzana-fashions-world
ftn-insustries -> ftn-industries
gemini-fashion -> gemini-fashions
genesis-fashion -> genesis-fashions
globus-garment -> globus-garments
gold-star-labels-and-accessories -> goldstar-label-and-accessories
goldstar-fashion -> goldstar-fashions
green-house-accessories -> ms-green-house-accessories
greenhouse-accessories -> ms-green-house-accessories
hb-fashion -> hb-fashions
honey-well-garments -> honeywell-garments
hop-lun-apparel -> hoplun-apparels
hornbill-apparel -> hornbill-apparels
ifco-garments-and-textiles -> ifco-garments-and-textile
karooni-fashion -> karooni-fashions
kei-lock-newage-bd -> kei-lock-newage-bangladesh
linktex-sportswear -> link-tex-sportswear
mas-trade-international-l-garments -> mastrade-international-garments
master-cham -> mastercham
mg-shirttex -> mg-shirtex
mid-line-sweater -> midline-sweater
ms-bg-collection -> bg-collection
ms-modern-poly-industries -> modern-poly-industries
ms-mohsin-knitwear -> mohsin-knitwear
ms-multi-style-and-accessories -> multi-style-accessories
ms-northern -> northern
nfz-teri-textiles -> nfz-teri-textile
oishi-fashions -> oishi-fashion
pole-star-knit-composite -> polestar-knit-composite
polo-compositie-knit-industries -> polo-composite-knit-industries
poly-bag-manufacturing -> polybag-manufacturing
radission-garments -> radisson-garments
ramisa-fashion -> ramisa-fashions
s-six-fashion -> s-six-fashions
s2l-fshions -> s2l-fashions
sonnet-fashion -> sonnet-fashions
south-east-sweater -> southeast-sweater
sterling-denims -> sterling-denim
stoffatex-fashion -> stoffa-tex-fashions
that-it-fashion -> that-it-fashions
thats-it-fashions -> that-it-fashions
tosrifa-indutries -> tosrifa-industries
veronica-apparels -> varonica-apparels
yongtai-industries-bd -> yongtai-industries-bangladesh
zeysha-fashion-wear -> zeysha-fashionwear
```

Afterwards `to_regclass('public.supplier_slug_redirects')` answered null and the live function's text
was still 0096's (md5 `d7acc1e72e04f93d67189f5846f19b11`, no mention of the new table): nothing was
left behind.

## What it shows

- **All 61 old addresses resolve to the kept profile**, none to nothing, none to itself. Read before the
  run: none of the 70 old slugs is held by a live row, and all 61 kept rows are published and are not
  buildings.
- **Buildings are untouched.** All 744 building rows answer exactly as they do today; 730 redirect to
  a mother, as now.
- **Nothing new is readable.** A signed-out caller can call the function, which returns one slug of a
  published profile, and is refused on the table.
- **A live profile's own address is not redirected**, and an unknown address still answers nothing.

Found on the way: the migration ledger said 0096 (the buildings redirect) was not applied. It is live
on production, text identical to the repo's file. The ledger row is corrected in this change.

## For the founder

1. Say **"apply 0149"**. It is applied through the Supabase connection as the file stands, guarded on
   the live function still being 0096's (the md5 above). If a re-run of the dry run differs from the
   block above, the go-ahead is void and the new output is posted first.
2. Read after, read only: 61 rows in the table; `facility_parent_slug('oishi-fashions')` answers
   `oishi-fashion`; then, after five minutes, `https://sourcebd.net/suppliers/oishi-fashions` answers
   308 to `/suppliers/oishi-fashion`, and two more from the list.

Order does not matter against the code: the pages already call this function, and the code in this
change is tests and the merge scripts only.

## Undo

Run `supabase/migrations/0096_facility_parent_slug.sql` again (the function goes back to buildings
only), then `drop table public.supplier_slug_redirects;`. The old addresses answer "not found" again;
nothing else changes.

## Future merges

`ops/plans/duplicate-suppliers-merge.sql` and its twin `ops/merge_duplicate_suppliers.py` now write a
published losing row's address into the table just before deleting the row, and the rehearsal line
reports it as `old addresses redirected N`. Both need 0149 applied first: without the table they stop
with an error and change nothing.

## Guards left behind

- `supabase/ci/assert-0149.sql` runs the function on a replayed database: a merged slug, a kept row
  that is unpublished, renamed, or now a building, a slug a live row holds, a building, signed out.
- `scripts/test-profile-http-boundary.mjs`: an old slug answers 308 with the kept profile's address,
  on the public page and on the signed-in record.
- `lib/facility-parent-redirect.test.ts` now pins the function's safety rules against 0149's text,
  the definition that will be live, not 0096's.
