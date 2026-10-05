# Gap 8 — Evidence packs (data and access)

Paper gap list row 8. Board: `10-App-Desktop-Products-settings/Evidence-pack-download-dialog-…[KON-0]`; the count
"Evidence packs downloaded" on Plan and usage `[KD6-0]` (row 7) and the audit log line `[KK8-0]` (row 5) read the
same download record. Status: **migration written and dry-run, not applied** (`0114_evidence_packs.sql`,
`ops/plans/0114-dry-run.md`).

## What is stored

- `evidence_pack_downloads(owner_id, sections, format, supplier_count, row_count, created_at)`: one row per pack.
  A buyer reads their own rows (`select`); nobody writes them except `evidence_pack()`.

## The call

`evidence_pack(sections[], format)` — `sections` one or more of `cert_expiry`, `uflpa`, `sources`; `format` `csv` or
`pdf` (recorded only; the file is built by the route). Calling it is the download: it writes the record. At most 50
a day. Returns `{generated_at, sections, format, supplier_count, row_count, rows}`; every row has the same keys:

| Key | cert_expiry | uflpa | sources |
| --- | --- | --- | --- |
| `supplier`, `supplier_slug` | the saved, published supplier | same | same |
| `item` | "WRAP 7865" | the matched list name, or null | "BKMEA · 1234" |
| `state` | `expired`, `expiring` (90 days), `valid`, `no_expiry_date` | `on_the_list`, `possible_xinjiang_link`, `no_link_found` | the tier (`tier1_gov` …) |
| `date` | expiry date | date listed | null |
| `source` | where the certificate came from (else its issuer, else the scheme) | "UFLPA Entity List" | the source's name |
| `checked_on` | when that source was read | the screening, else when our copy of the list was read | when the record was read |
| `address` | null | null | the factory address the record holds |

Errors: `42501` signed out, `22023` bad sections or format, `54000` the daily cap.

## For Sonnet (the screens)

1. The "Download an evidence pack" dialog on Compliance (Paper's three checkboxes, "Saved suppliers · N", CSV / PDF,
   the first rows preview, Cancel, Download pack). Download pack → a route that calls `evidence_pack` under the
   session and streams the file: CSV with the row keys as columns (dates as written in the product, "From WRAP"),
   PDF with one table per section. The preview can show the first rows from the same response.
2. Plan and usage "This month": "Evidence packs downloaded" = count of `evidence_pack_downloads` since the 1st.
3. Remove "Evidence packs for auditors" from the Enterprise list once this ships, or keep it as the team version (4b).

Not here: packs for a team's shared saved list (gap 4b), and the audit log screen (row 5), which will read this table.
