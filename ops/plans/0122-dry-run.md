# 0122 certificates read daily: dry run (6 Oct 2026)

Migration: `supabase/migrations/0122_certificate_listing.sql`
sha256 (LF, as committed): `45b68e1da3cd2f1ce951a81067c61546fef779ee030f1c9877f481847815cefe`
Spec: `context/feature-specs/spec-etl-freshness.md`, slice S2.

## How it was run

Production `stnrfxrxfonwexzcvvpv`, Supabase MCP `execute_sql`, in two `DO` blocks
that end in `raise exception`, so both rolled back. A read afterwards found no new
column, no `supplier_cert_checks`, and no re-keyed OEKO-TEX row.

## Result

```
DRY RUN OK (rolled back) | cols=4 | oeko_old_keys=2627 renamed=2627 | dup_keys=0 |
sample abul-kalam-spinning-mills = {"certs": [{"kind": "oeko_tex", "certificate_no": "68672-100",
  "listing_status": "listed", "checked_at": "2026-06-26T22:59:43Z", ...},
  {"kind": "gots", "certificate_no": "GOTS-18455", "expires_on": "2027-03-24", ...}],
  "reads": {"gots": null, "wrap": null, "sa8000": null, "oeko_tex": null}}

DRY RUN OK (rolled back) | live total=15 | 0122 total=15 | same rows apart from 2 new keys=t
```

- Four columns on certificates. Every certificate starts `listed`.
- All 2,627 OEKO-TEX records move to the `oeko-tex-{customer}:{standard}` key, with no clashes.
- The record's check read answers. Until the first scheduled read, each certificate's "checked" date is the stored read (May–July), so the record shows "not re-checked since" in the caution tone. That is true today.
- **0108 is already on production** (applied 5 Oct as `20261005091012`; the ledger said "not applied" and is corrected). Its live body scopes by 0116's `workspace_owner()`, and 0122 keeps that.
- On the buyer with the most expired certificates, today's Compliance list returns the same 15 rows, with `listing_status` and `delisted_on` added.

## What changes for buyers when it is applied

- **Record, Certificates tab:** each row gets a line under its state, for example:
  - "checked with GOTS 6 Oct 2026";
  - "GOTS lists no newer certificate (checked …)";
  - "last shown by WRAP 26 Jun 2026 · not re-checked since" (caution);
  - "GOTS no longer lists it (was valid until …)" (caution, and the chip reads "No longer listed since …").
- **Compliance hub and Saved:** a certificate its body no longer lists sits with the expired ones, as "No longer listed by GOTS since …".
- Nothing is marked "no longer listed" by the migration itself.

## The first reads (after deploy and apply)

1. Enable the GOTS and WRAP schedules (daily) and OEKO-TEX and SA8000 (weekly) in `/admin/sources`. Their schedule rows come with S3; until then run them by hand.
2. Each scheme's first read is **held by design**. It stamps what it saw and lists in `etl_runs.meta.reconcile` the certificates it did not see; Slack says so.
3. Read that list, then release each scheme:
   ```
   docker compose run --rm etl run gots --accept-delistings
   ```
4. The first GOTS and OEKO-TEX reads after deploy will also stop at the change limit. Their records gain a list fingerprint, and OEKO-TEX drops the expiring profile link. Release each with `--accept-changes`, after reading the counts.

Done when every one of the 316 certificates that expired after our last read is renewed, expired-and-listed, or no longer listed. The counts are 239 GOTS, 76 WRAP and 1 SA8000; the spec said 312.

## To apply (founder)

Say "apply 0122". It is applied through the Supabase MCP `apply_migration`, gated on the sha256 above.

## Rollback

The REVERSE block is in the migration header. 0108's body is in 0108, as patched by 0116.
