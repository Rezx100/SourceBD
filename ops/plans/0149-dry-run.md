# 0149 dry run (13 Oct 2026, production, rolled back)

Migration `supabase/migrations/0149_supplier_slug_redirects.sql`. **Not applied.** It waits for the
founder's "apply 0149" (AGENTS rule 15).

## What it is for

The two merges of 13 Oct 2026 (`ops/plans/duplicate-suppliers-audit.md`, sections 3 and 5a) deleted
166 duplicate supplier rows: 70, then 96 on the founder's decisions. 152 of them were published (61
and 91), so their web addresses now answer "Page not found": `/suppliers/oishi-fashions` is gone, the
kept profile is `/suppliers/oishi-fashion`. Google and buyers' bookmarks still hold the old addresses.

## What it changes

1. **One small table**, `supplier_slug_redirects`: an old address and the supplier row that was kept.
   Nobody can read it from outside (RLS on, no grant to signed-out or signed-in callers).
2. **One function**, `facility_parent_slug`, answers for an old address as well as for a building. The
   building half is the text of 0096, unchanged. The supplier page, the signed-in record and the
   search's side record already ask this function when a profile is not found and send a permanent
   redirect (308) to what it answers. So **no page code changes and no deploy is needed**: once the
   migration is applied the old addresses redirect, within five minutes (the public page keeps a
   "not found" answer for 300 seconds).
3. **The 152 addresses are filled** from the two merges' own snapshots,
   `_snapshot_dup_merge_20261013_suppliers` and `_snapshot_dup_merge_20261013b_suppliers`. All or
   none: if a published merged row cannot get its redirect (its kept row has gone), the migration
   stops and changes nothing.

Choices made, each one line to change:

- Only the 152 **published** merged rows get a redirect. The other 14 were never public pages.
- A redirect points at the kept **row**, not at its address, so renaming the kept profile is followed.
- An address a live row holds is never redirected, whether that row is published or not.
- If the kept row is unpublished the old address stays "not found". If the kept row later becomes a
  building, the old address goes to the building's mother.
- If the kept row is merged again, both merge scripts carry its old addresses to the new kept row on
  their own (they move every column that points at a supplier). If a kept row is ever deleted
  outright, its redirects go with it.

## What was run

The whole migration inside `do $dry$ … execute $m$ <the migration> $m$; <checks>; raise exception …`,
so everything rolled back by construction. The signed-out checks ran as the `anon` role. Run three
times as the file changed (the first two with the first merge's 61 only, before the second merge's
record reached `development`); the block below is the file as it stands.

```
DRY RUN OK | old addresses recorded 152 (first merge 61, second merge 91) | resolve to the kept profile 152 | answer nothing 0 | point at themselves 0
 | oishi-fashions -> oishi-fashion (signed out: oishi-fashion) | oishi-fashion (live) -> null | an unknown slug -> null
 | unpublished merged rows 14, still answering nothing 14
 | buildings 744 : answers changed 0, redirecting 730
 | table: RLS t, signed-out read refused, select granted to anon f authenticated f | function callable signed out t
 | live function before d7acc1e72e04f93d67189f5846f19b11
3a-fashions -> 3-a-fashions
a-and-b-apparels -> ab-apparels
abdullah-fashion -> abdullah-fashions
aboni-textile -> aboni-textiles
aj-fashion -> aj-fashions
al-yusar-textiles -> al-yusra-textile
alema-textiles -> alema-textile
alert-fashions -> alert-fashion
alif-textiles -> alif-textile
amazing-fashion -> amazing-fashions
amir-shirt -> amir-shirts
ams-international-l-sweater -> ams-international-sweater
angel-grace-fashions -> angel-grace-fashion
anika-fashions -> anika-fashion
apex-shinning-and-knitting-mill -> apex-spinning-and-knitting-mills
apparel-21 -> apparels-21
appolo-fashions -> appollo-fashions
ba-fashionwear -> ba-fashiowear
bedgetex-apparels -> badgetex-apparels
biswas-fashions -> biswas-fashion
bonian-knit-fashion -> bonian-knit-fashions
brothers-fashions -> brothers-fashion
cad-tex-garments -> cadtex-garments
chorka-textile -> chorka
clifton-fashion -> clifton-fashions
clifton-textile-and-apparels -> clifton-textiles-and-apparels
corny-fashion -> crony-apparels
crc-textiles-mills -> crc-textile-mills
crony-fashion -> crony-apparels
crony-fashions -> crony-apparels
dharla-fashion -> dharla-fashions
dinatex-international-l -> dinatex-international
dird-composite-textiles -> dird-composite-textile
dream-wear -> dreamwears
ettadee-jeans -> ettade-jeans
euro-knit-carments -> euro-knit-garments
fair-apparels-bd -> fair-apparels
farzana-fashion-world -> farzana-fashions-world
fashion-craft-design -> fashion-crafts-and-design
fashion-trouser -> fashion-trousers
fr-fashions -> fr-fashion
ftn-insustries -> ftn-industries
gemini-fashion -> gemini-fashions
genesis-fashion -> genesis-fashions
genetic-fashion -> genetic-fashions
genius-fashions -> genius-fashion
giant-knit-fashion -> giant-knit-fashions
giant-textile -> giant-textiles
glare-fashion -> glare-fashions
globus-garment -> globus-garments
gold-star-garments -> goldstar-garments
gold-star-labels-and-accessories -> goldstar-label-and-accessories
goldstar-fashion -> goldstar-fashions
gramtech-knit-dye-finishing-and-garments-industries -> gramtech-knit-dyeing-finishing-and-garments-industries
green-house-accessories -> ms-green-house-accessories
greenhouse-accessories -> ms-green-house-accessories
greenlife-knittex -> green-life-knittex
gumti-textile -> gumti-textiles
hannan-fashion -> hannan-fashions
harry-fashions -> harry-fashion
hb-fashion -> hb-fashions
hn-fabrics-knitting-only -> hn-fabrics
honey-well-garments -> honeywell-garments
hop-lun-apparel -> hoplun-apparels
hop-yick-bd -> hop-yick-bangladesh
hornbill-apparel -> hornbill-apparels
ifco-garments-and-textiles -> ifco-garments-and-textile
ka-fashion -> ka-fashions
kap-fashion -> kaps-fashion
karooni-fashion -> karooni-fashions
kds-fashions -> kds-fashion
kds-garment-industries -> kds-garments-industries
kei-lock-newage-bd -> kei-lock-newage-bangladesh
khan-accessories-and-packaging-co-ltd-kapco -> khan-accessories-and-packaging
km-apparels-knit -> km-apparel-knit
knit-moon -> knitmoon
knitmen-composite -> knit-men-composite
kung-keng-textile-bd -> kung-keng-textile-bangladesh
lemond-fashions -> lemond-fashion
lida-textile-and-dying -> lida-textile-and-dyeing
linktex-sportswear -> link-tex-sportswear
lz-textile -> lz-textiles
mactex-industries -> mac-tex-industries
maisha-fashion -> maisha-fashions
mam-apparel-and-textile -> mam-apparel-and-textiles
mas-trade-international-l-garments -> mastrade-international-garments
master-cham -> mastercham
mavis-garment -> mavis-garments
mg-shirttex -> mg-shirtex
mid-line-sweater -> midline-sweater
minar-textiles -> minar-textile
ms-bg-collection -> bg-collection
ms-modern-poly-industries -> modern-poly-industries
ms-mohsin-knitwear -> mohsin-knitwear
ms-multi-style-and-accessories -> multi-style-accessories
ms-northern -> northern
ms-shaikat-knitwear -> shaikat-knitwear
naba-export -> naba-exports
nak-fashion-and-textile -> nak-fashion-and-textiles
nfz-teri-textiles -> nfz-teri-textile
oishi-fashions -> oishi-fashion
old-town-fashion -> old-town-fashions
oli-knittings-fabrics -> oli-knitting-fabrics
ornate-knit-garments-industries -> ornate-knit-garment-industries
perfect-fashion -> perfect-fashions
plastic-man -> the-plastic-man
pole-star-knit-composite -> polestar-knit-composite
polo-compositie-knit-industries -> polo-composite-knit-industries
poly-bag-manufacturing -> polybag-manufacturing
py-garments-manufacturing-bd -> py-garments-manufacturing-bangladesh
radission-garments -> radisson-garments
ramisa-fashion -> ramisa-fashions
rao-fashion-wear -> raz-fashion-wear
reytex-fashion-wear -> rey-tex-fashion-wear
reza-fashion -> reza-fashions
rk-fashions -> rk-fashion
rufa-packaging-and-printing -> rafia-printing-and-packaging
rupashi-fabrics-complex-pvt-ltd-garments-division -> rupashi-fabrics-complex
s-six-fashion -> s-six-fashions
s2l-fshions -> s2l-fashions
sadaf-fashion -> sadaf-fashions
sb-design -> sb-designs
sb-fashion-garments -> sb-fashions-garments
seibu-fashions -> seibu-fashion
shoara-fashion -> ms-shoara-fashion
siam-computerized-elastic-industries -> siam-computerized-elastic-industries-ltd-mumtex
snowtex-outer-wear -> snowtex-outerwear
sns-fashion -> sns-fashions
sonnet-fashion -> sonnet-fashions
south-east-sweater -> southeast-sweater
southend-sweater -> south-end-sweater
sterling-denims -> sterling-denim
stoffatex-fashion -> stoffa-tex-fashions
sungkwang-apparels -> sung-kwang-apparels
tex-trims-accessories -> textrim-accessories
that-it-fashion -> that-it-fashions
thats-it-fashions -> that-it-fashions
the-exclusive-woven-knitwear -> exclusive-woven-knitwear
tm-fashion -> tm-fashions
tosrifa-indutries -> tosrifa-industries
trams-international-l -> trams-international
transworld-sweater -> transworld
ultra-design-and-fashion -> ultra-design-and-fashions
usama-textiles -> usama-textile
veronica-apparels -> varonica-apparels
visual-eco-style-wear -> visual-eco-stylewear
whitex-garments-bangladesh -> whitex-garments-bd
yongtai-industries-bd -> yongtai-industries-bangladesh
young4ever-textiles -> young-4-ever-textiles
zakmars-fashions -> zakmars-fashion
zeysha-fashion-wear -> zeysha-fashionwear
zisa-s-fashion -> zisas-fashion
```

Afterwards `to_regclass('public.supplier_slug_redirects')` answered null and the live function's text
was still 0096's (md5 `d7acc1e72e04f93d67189f5846f19b11`): nothing was left behind.

## What it shows

- **All 152 old addresses resolve to the kept profile**, none to nothing, none to itself. Read before
  the run: none of the 166 old slugs is held by a live row, no kept row of one merge was a losing row
  of the other, and all 152 kept rows are published and are not buildings.
- **Buildings are untouched.** All 744 building rows answer exactly as they do today; 730 redirect to
  a mother, as now.
- **Nothing new is readable.** A signed-out caller can call the function, which returns one slug of a
  published profile, and is refused on the table.
- **A live profile's own address is not redirected**, and an unknown address still answers nothing.

**One wording change on screen.** The search's side record asks the same function when a record is
not found, and said "That is a building, not a company record". For a merged duplicate that would be
false, so it now says "That address is filed under another record" and names both cases. This part
ships with the next deploy; until then a saved search link holding a merged slug would show the
building wording, with a working link to the kept record.

Not covered, as for buildings today: an old address of a line sheet
(`/app/suppliers/<old slug>/lines/<code>`) still answers "not found". And a supplier whose address is
renamed rather than merged (the identity clean-up does this) still loses its old address; that is
a separate piece of work.

Found on the way: the migration ledger said 0096 (the buildings redirect) was not applied. It is live
on production, text identical to the repo's file. The ledger row is corrected in this change.

## For the founder

1. Say **"apply 0149"**. It is applied through the Supabase connection as the file stands, guarded on
   the live function still being 0096's (the md5 above). If a re-run of the dry run differs from the
   block above, the go-ahead is void and the new output is posted first.
2. Read after, read only: 152 rows in the table; `facility_parent_slug('oishi-fashions')` answers
   `oishi-fashion`; then, after five minutes, `https://sourcebd.net/suppliers/oishi-fashions` answers
   308 to `/suppliers/oishi-fashion`, and two more from the list (one from the second merge).

Order does not matter against the code: the pages already call this function. The code in this
change is tests, the merge scripts and the one notice above.

Any merge run before 0149 is applied must be added to the fill by hand: the migration reads the two
snapshot tables named above and no other.

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
- `app/(app)/app/record-routes.test.ts`: the side record's notice never calls the address a building.
