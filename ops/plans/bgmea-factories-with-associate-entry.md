# Factories that hold a BGMEA buying-house entry

Read from production 13 Oct 2026, after the 519 manufacturers were set back to factory
(`ops/plans/bgmea-entity-type.md`).

The founder's rule, 12 Aug 2026 (`ops/plans/bgmea-attribution-decisions.md`, section 2): a company on
BGMEA's associate register is a buying house and must not keep a factory tag; an associate number
sitting on a factory that is a different company comes off it and goes on the buying house's own
profile, created if missing.

## Correction to the first version of this file

The first version (PR #522, the list of the 77) was wrong on two points, both fixed here:

- It said BGMEA's associate list gives no company name. It does: the names were harvested on 5 Aug 2026
  into `ops/plans/bgmea-names.json`. With them, many entries turn out to be in another company's name.
- It compared each entry's address with the address on our profile. The loader fills an empty address
  from the first record that has one, so on several rows that address *was* the BGMEA entry's. The
  comparison now uses only what another register (BKMEA, RSC, OEKO-TEX, BGAPMEA) says.

It named six rows as likely buying houses. Four stand; two do not (below).

## Applied on production, 13 Oct 2026

Founder: "yes, do both", to six rows named to him. Four of the six hold an associate entry in their own
name, so they were set from factory to buying house, each with a lock on the type so the loader keeps
it. (Mantrust Designer also holds a safety-register entry; it was changed because he approved it by
name and the associate entry is its own.)

| Company | Associate no. | BGMEA's name for the entry |
| -- | -- | -- |
| MGB Metro Group Buying HK Ltd. | 639 | MGB Metro Group Buying HK Ltd. |
| Tekstil Fashion | 845 | Tekstil Fashion |
| Needle Thread Pvt. Limited | 1088 | Needle Thread Pvt. Ltd. |
| Mantrust Designer Limited | 76 | Mantrust Designer Ltd. |

Rehearsed first (`DRY RUN OK | snapshot 4 | set to buying house 4 | locks written 4`), then applied with
the same count guard. Read after: all four are `buying_house`, four live locks, buying houses 1,462 to
1,466. The rows as they were are in `public._snapshot_entity_type_20261013b` (RLS on, nothing granted).

Undo:

```sql
update public.suppliers s set entity_type = t.entity_type
  from public._snapshot_entity_type_20261013b t where t.id = s.id;
update public.supplier_field_locks l set released_at = now()
 where l.column_name = 'entity_type' and l.locked_by = 'ops:bgmea-entity-type' and l.released_at is null;
```

**Held back, not changed:**

- Ags Apparels Ltd: its two entries are in other names (930 Saint Martin Apparels, 1204 AGS Fashion Ltd.).
- Tandem Fashion Ltd: its entry is in the name Tandem Limited.

Both are on the page below. Needle Thread also still carries entry 1463, which BGMEA lists as
WIKITEX - BD; it is not on the page (the page lists factories) and needs the same decision.

## What is left: 73 factories, 95 entries

Written by `ops/report_bgmea_associate_on_factories.py` (read-only). Every row is in
`ops/plans/bgmea-associate-on-factories.json`; the founder's page is
`ops/plans/bgmea-associate-on-factories-review.html`, one row per entry.

```
73 factories, 95 buying-house entries
  Several buying-house entries on one factory: 34 (move 19, tag 0, leave 15)
  The entry is in another company's name: 42 (move 20, tag 0, leave 22)
  The entry is in this company's own name: 19 (move 0, tag 2, leave 17)
```

The three answers on the page:

- **Move out**: another company's entry. It comes off this factory and goes on that buying house's own
  profile (a new one if we have none).
- **Buying house**: this company's own entry, and the company is a buying house. The profile stops
  saying factory.
- **Leave**: this company's own entry, or its group's, and it stays a factory.

How a suggestion is reached:

- BGMEA names another company and no other register ties the entry to the row: move (39 entries).
- BGMEA names another company, but the phone, mailbox or premises on the row's BKMEA, OEKO-TEX or
  BGAPMEA entry matches the entry, or BGMEA's name is close to the row's without being the same
  ("Fashion Tex International" on Fashion Tex Ltd.): leave, for the founder to look at.
- The entry is in the row's own name: buying house if nothing says the row makes garments (no sewing
  machines, under 50 workers, no safety, export or audit register); otherwise leave. The rule of
  12 Aug read strictly would make all 19 of these buying houses; that is the founder's call.

Nothing on the page is applied until the founder pastes his decisions back.

## How this was read

One read of production: suppliers with `entity_type = 'factory'` holding a live BGMEA record with
`bgmea_member_type = 'associate_buying_house'` and no live `general_manufacturer` record, with every
live record on those rows. The tie test is the one `ops/split_bgmea_foreign_records.py` uses. On
13 Oct 2026 the script ran with `--cache` on rows pulled through the Supabase SQL endpoint.
