# 0124 monthly register schedules: dry run (6 Oct 2026)

Migration: `supabase/migrations/0124_register_schedules.sql`
sha256 (LF, as committed): `ad1e7caad995f633e83f75c0e100e4c9685ec1142883ade9d1d1125111a75b82`
Spec: `context/feature-specs/spec-etl-freshness.md`, slice S5 + C3.

## How it was run

Production `stnrfxrxfonwexzcvvpv`, Supabase MCP `execute_sql`, inside one `DO` block ending in `raise exception`. A read afterwards found 10 schedules (as before) and none from S5.

## Result

```
DRY RUN OK (rolled back) | bgapmea_web, bgmea_web, bkmea_detail, bkmea_web, epb_web:
  disabled, every 30 days, age limit 1080 h (45 days) | rsc: weekly, age limit 336 h (14 days)
```

The register runs are staggered through the Dhaka night: EPB at 01:00, BKMEA list at 02:00, BKMEA detail at 03:00, BGMEA at 04:00, BGAPMEA at 05:00. These are UTC 19–23.

## What the code in the same PR does

- **BGMEA and BGAPMEA are read directly.** Both serve their pages to a browser user agent: tested 6 Oct by fetching list and detail pages and parsing them with our classes, and member 951 parsed as DESH, reg 1. Direct reads cost no Firecrawl credits.
- **BGMEA reads a member's detail page only when its list row changed.** The stored records carry no list fingerprint yet, so the **first** monthly read fetches every detail page once (~4,500 direct requests at 2 a second, about 40 minutes). It will also stop at the change limit, because every record gains the fingerprint. Release it with `--accept-changes` after reading the counts. Later reads fetch only new or changed members.
- **BGAPMEA's list carries member ids only,** so every detail page is read monthly. Direct makes that free.
- **A monitor that sees a register's list page change** queues that register's re-read, at most once a day.
- **Your weekly spelling list (C3):** every Monday the digest lists word pairs that look like two spellings of one place. They come from addresses on one company that name the same plot ("gajipur ↔ gazipur — 2 companies"). The full list is:
  ```
  docker compose run --rm etl place-variants
  ```
  Nothing is folded. Tell me which pairs to approve, and they go into the place lexicon (TypeScript and Python together, with a test). Sreepur/Sripur and Nawabganj/Chapainawabganj are never proposed.

## To apply (founder)

Say "apply 0124". It is applied through the Supabase MCP `apply_migration`, gated on the sha256 above. Then enable the register schedules one at a time in `/admin/sources`.

## Rollback

The REVERSE block is in the migration header.
