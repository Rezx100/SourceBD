# C1 — past human decisions into the tables the ETL obeys (dry run, 6 Oct 2026)

Script: `ops/backfill_human_decisions.py`. Spec: `spec-etl-freshness.md` §8.3 C1.
Resolved read-only against production `stnrfxrxfonwexzcvvpv` on 6 Oct 2026
(same resolution as the script: slug, or the single holder of a BGMEA ref).
Before: `resolution_edges` 0 rows, `supplier_field_locks` 0 rows.

## Never-same / same rulings: 83 would be written

| source | rulings | notes |
| -- | -- | -- |
| `ops/seed_resolution_edges.py` (founder) | 2 | sarada-knitwear ≠ sarada-fashions; corny-fashion ≠ crony-fashion. sarada = sarda is already a finished merge (sarda row gone), so nothing is written for it. |
| REZ-116 orphan moves (`bgmea-attribution-decisions.md` §1) | 10 | old holder ≠ rightful owner, e.g. raz-apparels ≠ ar-sourcing, bangladesh-dresses ≠ its Unit-2. The §1 HOLD (ref 1168) is a question, not a ruling: not written. |
| REZ-117 ambiguous decisions (§2) | 36 | 6 moves (old holder ≠ new owner); 8 imports, each ruled apart from the factory it left **and** from every candidate the founder rejected (as-fashion ≠ mas-fashion-bd, sas-fashions; maxim-international ≠ maxtrims / max / maximo-international; …). Stays write nothing. |
| BKMEA unmerge of 31 Jul (`unmerge_bkmea_suppliers.py`) | 35 | No pair log was kept, so pairs were rebuilt: a supplier the unmerge created that shares a phone or mailbox with an older supplier holding a **different** BKMEA membership number (e.g. fair-cotton 415 ≠ cotton-fair 558, crony-apparels 376 ≠ corny-fashion 377). NOOR-A-ALIA / NOOR-A-ALIA FASHION left out: an open duplicate question. |

Resolved import holders: 953 → as-fashion, 330 → ar-fashion, 1573 → bangladesh-apparel,
1020 → jr-international, 1129 → mn-enterprise, 296 → maxim-international,
528 → sa-fashion, 1261 → tex-fashion-bd. Missing sides: 0. Duplicate pairs: 0.

## Field locks: 11 would be written, 1 skipped

- `entity_type = buying_house` on the 11 REZ-117 rows the founder tagged as buying
  houses (am-fashion, mim-fashion-wear, union-fashion and the 8 imports). All 11
  still hold that value. (The ETL only fills `entity_type` when it is `unknown`,
  so this records the decision rather than fixing a live leak.)
- `admin_audit_log` has 3 `admin_supplier_update` rows, all "publish" on
  `utah-fashions-ltd-extension` (21 Aug). That row is unpublished again today (it is
  an attached building), so the lock is **skipped** as no-longer-holds: locking it
  would freeze a value nobody currently wants.

## Pairs the matcher could still confuse (input for C2)

If one row of these pairs were missing, the fuzzy pass would join their names:
corny-fashion / crony-fashion, and maxim-international against maxtrims-, max- and
maximo-international. C2 holds an ambiguous match when the best candidate has a
never-same ruling against another candidate; `--verify` lists these as "at risk".

## Founder commands

Apply (on the server in /opt/sourcebd, after reading this; ops/ is mounted, not baked into the image):

```
docker compose run --rm --entrypoint python -e PYTHONPATH=/app -v /opt/sourcebd/ops:/app/ops:ro etl ops/backfill_human_decisions.py --apply
```

Then the read-only replay (expects 0 failures):

```
docker compose run --rm --entrypoint python -e PYTHONPATH=/app -v /opt/sourcebd/ops:/app/ops:ro etl ops/backfill_human_decisions.py --verify
```

Install the duplicate-company detector (decision 5 in the build handoff):

```
(crontab -l; echo "23 3 * * * /opt/sourcebd/ops/split_check_cron.sh >> /opt/sourcebd/etl/logs/split_check.log 2>&1") | crontab -
```
