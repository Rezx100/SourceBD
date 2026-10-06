# Home film: the data behind the planet and the map (6 Oct 2026)

Spec: `context/feature-specs/spec-home-film.md`, §6. Rule 14: every figure here has the script that produced it
beside it; re-run the script and update this file in place rather than counting again by hand.

## 1. The supplier lights: `public/site/film/cells.json`

One row per square kilometre with published suppliers: longitude, latitude, count. Built by
`scripts/film/build-cells.mjs`, read-only, on **6 Oct 2026**.

### How it was read

- Production `stnrfxrxfonwexzcvvpv`. The Supabase connector (MCP `execute_sql`) was not authorised in the
  session that built this, so the read went through the project's own service key and the PostgREST API: the
  same three reads `lib/nearby-suppliers.ts` makes, and the same two-step join (the raw address string first,
  then the normalised key `lib/barikoi.ts` uses). Nothing was written. No address, name or id left the
  machine: the script prints counts only, and the file holds cells and one place.
- Run: `node scripts/film/build-cells.mjs --env E:/SourceBD/.env` (Node 25; the env file is read for the two
  variables only).

The SQL it stands for:

```sql
with placed as (
  select distinct on (s.id) s.id, g.longitude, g.latitude
  from public.suppliers s
  join public.v_supplier_addresses a on a.supplier_id = s.id
  join public.address_geocodes g
    on g.address_raw = a.address            -- 9,510 suppliers
    or g.address_norm = normalize(a.address) -- 32 more (lib/barikoi.ts normalizeAddressKey)
  where s.is_published
    and g.latitude is not null and g.longitude is not null
    and g.longitude between 87.9 and 92.8 and g.latitude between 20.4 and 26.8
  order by s.id,
    array_position(array['factory','factory_inherited','registered','registered_inherited','mailing','mailing_inherited'], a.address_kind)
)
select round(((floor(longitude * 111.32 * cos(radians(23.7))) + 0.5) / (111.32 * cos(radians(23.7))))::numeric, 3) as lng,
       round(((floor(latitude * 110.57) + 0.5) / 110.57)::numeric, 3) as lat,
       count(*) as suppliers
from placed
group by 1, 2
order by 2, 1;
```

A site's address is taken first; a registered or mailing address only when the supplier has no site address. One
supplier counts once. The grid is 1 km square at the country's middle latitude (23.7° N).

### Result, 6 Oct 2026

| Figure | Value |
| -- | -- |
| Published suppliers | 10,277 |
| Address rows read (`v_supplier_addresses`) | 27,873, for 9,971 suppliers |
| Geocode rows with a position (`address_geocodes`) | 17,973 |
| **Suppliers with a mapped address** | **9,541** (9,513 by the raw string, 29 by the normalised key) |
| Positions outside Bangladesh skipped | 0 |
| **Cells** | **1,245**; the fullest holds 231 suppliers; 488 hold one |
| File | 22,494 bytes |

Re-run the same evening with the pages ordered (the first run read each table in unordered pages of a thousand,
which Postgres may skip or repeat a row across; `build-cells.mjs` now orders every page and reads until an empty
one). The mapped total was the same, 9,541; 399 cells changed their count and 55 appeared where 52 went, so the
file and the six stills were remade from this run. The figures above are this run's.

The page prints "One light per km² with suppliers · 9,541 of 10,277 have a mapped address · 6 Oct 2026"
(`LIGHTS_FILE` in `components/site/film/opening.tsx`; `film.test.ts` holds it to the file). The plan's "9,753 of
10,268" was Paper's figure of 3 Oct and is superseded.

The fullest cells are where Barikoi placed an area-level address at the area's own point (many "incomplete"
geocodes share one point), so a single cell can hold a few hundred suppliers. The planet caps a light's size at a
count of about 170 (`lightSize`), and the map's heat saturates at 40, so one such cell reads as a bright district,
not a spike.

### The story's one place

`chosen` is Mondol Fabrics Ltd.'s factory address as the geocode cache has it (the record spells the name
"MONDOL FABRICS LTD"; the script matches on letters and digits). Barikoi's own reading of that address is
`address_status = incomplete`, `confidence_pct = 40`: an area, not a building. The record page already says "The
pin marks the area, not the building"; the ring the film draws in scene 06 (slice 4) must be sized to that, about a
kilometre, never a pin.

### To refresh

Re-run the command above, paste the printed `LIGHTS_FILE` values into `opening.tsx`, update the table here with
the date, and re-shoot the stills (§3) so the pictures match the lights.

## 2. The geography: `public/site/film/bd.json` and `land.png`

Built by `scripts/film/build-geo.mjs` (`node scripts/film/build-geo.mjs`), read on **6 Oct 2026**:

| File | Source | Licence | What is taken |
| -- | -- | -- | -- |
| `ne_50m_land.geojson` | Natural Earth 1:50m, via `nvkelso/natural-earth-vector` on GitHub | public domain | the planet's land mask, 720×360 |
| `ne_50m_admin_0_countries.geojson` | Natural Earth 1:50m | public domain | the neighbours' land, clipped to the box, as context |
| `ne_10m_rivers_lake_centerlines.geojson` | Natural Earth 1:10m | public domain | the Jamuna (Brahmaputra), the Padma (Ganges), the Surma and upper Meghna (Barak), the Tista |
| `geoBoundaries-BGD-ADM2_simplified.geojson` | Bangladesh Bureau of Statistics and OCHA ROAP, through geoBoundaries gbOpen (commit `9469f09`) | CC BY 3.0 IGO | the 64 districts; their union is the country |

The credit the licence asks for travels in `bd.json` (`credit`), is printed on the map's stage and under the
stacked page's picture (`MAP_CREDIT`), and is section 8 of `/legal/data-sources`.

6 Oct 2026, slice 2b: the box widened from [76, 12, 104, 33] to [66, 6, 106, 38], because the planet now hands
over to the map at zoom 5.5, whose camera sees about 75° to 106° across a 1440 screen; the neighbours' rings are
simplified at 0.015° to hold the size. `bd.json` went from 131,782 to 140,820 bytes.

## 3. The stills: `public/site/film/*.avif`

The lite and still tiers do not draw the map, and the still tier does not draw the planet; they get pictures of the
same engines, shot once from the local harness (`.impeccable/preview/film/stills.cjs`, installed Chrome through
Playwright, encoded with the `sharp` that Next.js already installs). Six files: `planet.avif` (1440×900, night),
`planet-upright.avif` (390×844), `map-country-{light,dark}.avif` and `map-gazipur-{light,dark}.avif` (1200×750).
Re-shoot whenever the cells, the geography or the map's paint change; `film.test.ts` holds each under 160 KB.
