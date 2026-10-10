# 0136 dry run: as-found record entries for existing RFQs

Run 10 Oct 2026 on production (stnrfxrxfonwexzcvvpv) through MCP `execute_sql`, inside a DO block that
ends in `raise exception`, so every write rolled back. Migration file sha256
`eb875e9066873343612cbbbd65a13ea7b14a374c57d3955f09efc21dabf9caeb`.

Before: 7 RFQs (all open, first 18 Jul 2026), 0 quotes, 0 record entries for RFQs or quotes.

Output:

```
DRY RUN OK | first run wrote 7 | second run wrote 0 | as-found rows 7 | RFQs covered 7 of 7
| with buyer, email, sent date 7
```

Five RFQs from the 18 Jul audit buyer account, one from 11 Aug, one from 9 Sep (a SourceBD staff
address). No buyer has a company name on file, so the company column is empty for all seven.

After: `_ledger_as_found_rfqs()` absent and 0 as-found rows, confirmed by a read.

Apply: on "apply 0136", MCP `apply_migration` with the file above (check the sha256 first), then read
back 7 `rfq.sent` entries with `content.as_found = true`.
