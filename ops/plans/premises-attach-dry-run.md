# Attaching sheds and units to their main company: dry run

13 Oct 2026. **Not applied.** Founder's instruction the same day: "must stay: buying house, and
everything else must merge smartly and carefully."

The plan and every row behind it are in `premises-siblings-report.md` section 6, written by
`ops/report_premises_siblings.py`. This file records the rehearsal of the first step.

## What was rehearsed

`premises-attach-dry-run.sql` (written by the script's `--sql` option) sets `facility_of` on the
48 profiles the plan attaches, inside a block whose last statement raises, so nothing commits.
Run on production through the Supabase MCP:

```
DRY RUN OK | pairs 48 | linked 48 | now unpublished 48 | old address redirects 48 | main not usable 0
```

- linked 48: every profile was still published and unlinked, so the update reached all of them.
- now unpublished 48: the publish guard (0092) took each one off the site.
- old address redirects 48: `facility_parent_slug` (0096) returns the main company for each old address.
- main not usable 0: no main profile is unpublished, already a building, or itself in the list.

Read after the rehearsal: 610 linked rows and 10,311 published and unlinked, as before; the Zaheen
sheds profile is still published.

Checked separately on the live record reader (`buyer_supplier_profile`): it already shows a linked
building's memberships, certificates and safety-register entry on the main record, labelled with
the building. 69 of the 610 rows linked earlier hold a membership or certificate and rely on it.

## The apply, when the founder says "apply the attach"

1. Re-run `python ops/report_premises_siblings.py --sql ...` so the list is today's.
2. Snapshot: `create table public._snapshot_premises_attach_<date> as select id, slug, facility_of,
   is_published from public.suppliers where id in (<the 48>)`, with RLS on (see the snapshot-table rule).
3. The same update without the closing `raise`, then the three counts again.
4. Open three old addresses on the site (Zaheen's sheds first) and confirm each lands on the main
   company with the building under Facilities.

Undo: `update public.suppliers set facility_of = null where id in (select id from the snapshot)`,
then publish those rows again; the publish guard re-checks each.

## Not in this step

- **8 merges** (one company filed twice). `ops/merge_duplicate_suppliers.py --pair <main>,<row>`
  per pair; its dry run needs the database port, which this machine cannot reach, so the founder
  or CI runs it. A merge is not undoable; each pair's evidence is in the report.
- **79 rows left for a read**, listed in the report with the reason.
- **72 titles that drop a lone qualifier, 1 that keeps "Buying House".** No data change; needs the
  stored short title (report section 5, option 1) built first.
- **The loader rule.** Until `extension_base_name` knows "shed", "warehouse" and "building-2", a new
  shed in the safety register is published as a company again.
