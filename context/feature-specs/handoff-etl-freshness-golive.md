# Handoff: take the ETL freshness rework live, end to end (written 6 Oct 2026)

For a fresh session. Every slice of `spec-etl-freshness.md` is built and on `development`:

| PR | What it is |
| -- | -- |
| #325 | S1, sanctions daily |
| #328 | C1, past fixes saved |
| #329 | C2 + C4, near-match holds and safety stop |
| #330 | S2, certificates |
| #331 | S3, freshness page and digest |
| #332 | S4, waste off |
| #333 | S5 + C3, registers and spelling list |
| #334 | S6, brands and public counts |

Nothing new is applied, deployed or switched on. This file is the go-live: four steps, in order. **Read the first section, then do one step at a time.** Do not re-ask the founder's settled answers (`handoff-etl-freshness-build.md`, "Settled founder decisions").

## Who does what (hard rules)

The guard hook (`.claude/hooks/guard.py`) and AGENTS 9a / 15 bind every step.

**The agent:**
- reads production and dry-runs (no approval needed);
- applies a migration **only after the founder types "apply NNNN" in chat**, one migration per go-ahead, through the Supabase MCP `apply_migration`;
- opens the `development` → `main` PR with `gh pr merge --auto --merge`;
- reads every first run's numbers and posts them before the founder releases anything.

**The founder:**
- types each "apply NNNN";
- clicks the Deploy Production approval in the GitHub `production` environment;
- runs the server commands over `ssh -i $env:USERPROFILE\.ssh\sourcebd_vps root@109.104.153.228`, then `cd /opt/sourcebd`;
- deletes the Firecrawl monitors;
- switches on schedules in `/admin/sources`;
- types the release commands (`--accept-changes`, `--accept-delistings`).

**The agent never** runs `ssh`, `--apply`, `gh workflow run`, a deploy, or a schedule toggle. When a step needs one, print the exact command for the founder and stop. Never `cd` in Bash (it breaks the guard hook).

Replies to the founder: five lines, plain words. Name PRs with a short description.

## Step 0: check the starting state (agent, read-only)

1. **PR #334 (brand lists, public counts) is merged.** If not, check `gh pr checks 334`, fix any red run (`gh run view --log-failed`), and push.
2. **Production migrations:** MCP `list_migrations` on `stnrfxrxfonwexzcvvpv`. Expect `0120_sanctions_daily_reconcile` applied and none of 0121–0125.
3. **Hash each migration as committed on `origin/development`:**
   ```
   git show origin/development:supabase/migrations/<file>.sql | sha256sum
   ```
   The hashes must equal this table. They are LF, as committed. A Windows checkout has CRLF and a different hash, so always hash the git blob, never the working file.

   | Migration | sha256 (LF) |
   | -- | -- |
   | `0121_etl_hold_review` | `9f122dcdf1bf5bd8b6abd894c5815743a17a9a9285665fe6af786becaf1e80fb` |
   | `0122_certificate_listing` | `45b68e1da3cd2f1ce951a81067c61546fef779ee030f1c9877f481847815cefe` |
   | `0123_source_freshness` | `2fe614a989d67bd300d25434721a347dd443c20a8745da7190ab6c56867845ee` |
   | `0124_register_schedules` | `ad1e7caad995f633e83f75c0e100e4c9685ec1142883ade9d1d1125111a75b82` |
   | `0125_sources_listed_brand_schedules` | `e9b58eb15f0804bc296bd49ab9a26e85bf9fd73e152422296baed44f89b60b2f` |

4. **Drift check.** Three migrations replace a live function, so confirm production still has the body each was written against:

   | Migration | Live function | Expected |
   | -- | -- | -- |
   | 0121 | `admin_queue_release_plan(uuid)` | renames it, so it must exist, and `_admin_queue_release_plan_0102` must not |
   | 0122 | `compliance_expired_certs()` | the live body must still scope by `public.workspace_owner()` (0116) |
   | 0125 | `marketing_facts()` | `md5(pg_get_functiondef(...))` must be `8879c3d76bf30393c61593070549b506` |

   If any differs, stop and re-run that migration's dry run before asking.

## Step 1: apply 0121 → 0125 (agent applies, founder says "apply NNNN")

**Order matters:**
- 0123 needs 0122's certificate column.
- 0125 must be live **before** the deploy that carries S6, or the site says "25 sources listed" beside a list of 21.
- All five are safe before the code deploys: the shipped code fails soft without them.

**Recommendation:** apply all five, then deploy.

**For each migration:**
1. Post a two-line summary to the founder: what it changes, and that the dry run was clean (`ops/plans/<NNNN>-dry-run.md`). Ask for "apply NNNN".
2. On "apply NNNN":
   - re-hash the blob and check it against the table;
   - pass the blob's exact text to `apply_migration`, with the file stem as the name.
3. Verify with a read, then add a ledger row to `context/current-state.md` that says "applied 6 Oct 2026" (or the actual date) with the MCP version. If the file nears 16 KB, archive a finished section to `context/archive/state-2026-sep.md`; never raise the cap.

| Migration | Verify after applying (expect) |
| -- | -- |
| 0121 | `to_regprocedure('public._admin_queue_release_plan_0102(uuid)') is not null`. `admin_queue_release_plan(<newest fuzzy_match_review id>)` returns the same plan as before. Index `idx_vq_etl_hold_record` exists. |
| 0122 | 4 columns on `certifications`; 0 OEKO-TEX `source_records` left on the old `oeko-tex-{n}` key (2,627 re-keyed); `supplier_cert_checks('abul-kalam-spinning-mills')` returns two certs. |
| 0123 | `select count(*) from etl_source_freshness()` is about 30; 14 `etl_schedules` rows; the four certificate rows `enabled = false`. |
| 0124 | 5 S5 schedule rows (EPB, BKMEA list and detail, BGMEA, BGAPMEA), all off; `rsc` metadata has `max_age_hours = 336`. |
| 0125 | `marketing_facts()->>'sources_listed'` is `21`; `sources.listed = false` on BEPZA, DIFE, RJSC and BRAND_INDITEX; 4 brand schedule rows, all off. |

## Step 2: deploy (agent opens the PR, founder approves)

1. Open the promotion PR and set it to merge itself:
   ```
   gh pr create --base main --head development --title "Promote: ETL freshness rework (S1–S6, C1–C4)" --body-file <file>
   gh pr merge --auto --merge
   ```
   - Use a merge commit, never a squash.
   - The body lists the eight PRs above, each with its short description.
2. When CI passes on `main`, Deploy Production waits in the `production` environment. Tell the founder to approve it, and **never trigger it yourself**.
3. Confirm what shipped: read the run log line "Expected production commit" and check it equals the `main` merge commit.
4. After the deploy, check `/admin/sources` has the Freshness table. Check the public methodology page says 21 sources.

## Step 3: the server (founder runs; agent prints the commands)

Run these from `/opt/sourcebd` after the deploy, because the scripts must be the deployed ones. `ops/` is mounted into the container, not baked in. The source of truth is `ops/plans/c1-human-decisions-dry-run.md`.

1. **Dry run first.** It must say 83 rulings would insert, 11 locks, 0 missing:
   ```
   docker compose run --rm --entrypoint python -e PYTHONPATH=/app -v /opt/sourcebd/ops:/app/ops:ro etl ops/backfill_human_decisions.py
   ```
2. **Apply** (the founder's call):
   ```
   docker compose run --rm --entrypoint python -e PYTHONPATH=/app -v /opt/sourcebd/ops:/app/ops:ro etl ops/backfill_human_decisions.py --apply
   ```
3. **Check.** Expect `0 failures`. Pairs marked "at risk" are fine: C2 holds them for review.
   ```
   docker compose run --rm --entrypoint python -e PYTHONPATH=/app -v /opt/sourcebd/ops:/app/ops:ro etl ops/backfill_human_decisions.py --verify
   ```
4. **Install the duplicate-company detector** (daily 03:23):
   ```
   (crontab -l; echo "23 3 * * * /opt/sourcebd/ops/split_check_cron.sh >> /opt/sourcebd/etl/logs/split_check.log 2>&1") | crontab -
   ```

After the founder runs them, the agent confirms with reads:
- `select verdict, count(*) from resolution_edges where superseded_at is null group by 1` → 83 `different`;
- `select count(*) from supplier_field_locks where released_at is null` → 11.

**Ask once, and take no for an answer:** does the founder want the buyer Monday email cron (`ops/saved_search_alerts_cron.sh`) installed too? Its line is in that script's header.

## Step 4: the 8 noisy Firecrawl monitors (founder)

In the Firecrawl dashboard, delete these 8 monitors. The code no longer plans them, and the refresh job never deletes. Source: `ops/plans/s4-stop-waste.md`.

- `sourcebd:rsc_reports`
- `sourcebd:rsc_updates`
- `sourcebd:sa8000`
- `sourcebd:brand_ms`
- `sourcebd:brand_asos`
- `sourcebd:brand_primark`
- `sourcebd:cbp_wro`
- `sourcebd:oeko_tex`

## Step 5: switch schedules on, one at a time (founder toggles; agent reads each first run)

Toggle each in `/admin/sources`. For every first run, the agent then reads the run:
- `etl_runs`: status, records, `meta.circuit_breaker`, `meta.reconcile`;
- `/admin/queue` for held near-match records (C2).

The agent posts the numbers in plain words. **Only then** does the founder release, with the command below run on the server from `/opt/sourcebd`. A release command re-runs the read with the hold lifted.

### What "held" means

- **`status = 'held'` with `meta.circuit_breaker.tripped`:** the safety stop (C4). The run stopped at 5% of rows changed or 20 new companies. Release:
  ```
  docker compose run --rm etl run <code> --accept-changes
  ```
- **`meta.reconcile.<scheme>.action = 'held'`:** removals are waiting, either because this is a scheme's first reconcile or because more than 2% would be removed. `missing_certificates` lists them. Release:
  ```
  docker compose run --rm etl run <code> --accept-delistings
  ```
- **`action = 'partial'`:** the read was incomplete; nothing was marked. Read the run's `error` and the ETL log to see why before re-running.

### Order and what to expect

**1. Sanctions (daily, 02:00 UTC):** `ofac_sdn`, `uk_ofsi`, `eu_sanctions`, `uflpa`, `ilab_tvpra` (weekly).
- Slack posts at once on any new possible match or delisting.
- UFLPA's first run is likely `partial`: the list grew from 160 to 205. Read `meta.reconcile`, then `run uflpa --accept-delistings`.
- A hit hides the supplier at once; only a human clears it, in `/admin/sanctions`.

**2. Certificates:** `wrap` and `gots` (daily, 03:00 UTC), then `oeko_tex` and `sa8000` (weekly, 04:00).
- The first GOTS and OEKO-TEX reads will **stop at the change limit**: every record gains a list fingerprint, and OEKO-TEX re-keys per standard. Release with `--accept-changes`.
- Every scheme's **first reconcile is held by design**. Post the count of `missing_certificates` with a few examples, then release with `--accept-delistings`.
- Done when each of the 316 certificates that expired after the last read (239 GOTS, 76 WRAP, 1 SA8000) is renewed, expired-and-listed, or no longer listed. Re-measure with the query in `ops/plans/0122-dry-run.md`.

**3. Registers (monthly, staggered 19–23 UTC):** `epb_web`, `bkmea_web`, `bkmea_detail`, `bgmea_web`, `bgapmea_web`. Also `rsc` (weekly).
- BGMEA's first read fetches every detail page once: about 4,500 direct requests, about 40 minutes, no Firecrawl credits. It will stop at the change limit; release with `--accept-changes`.
- New near-match companies wait in `/admin/queue` ("Fuzzy supplier matches"). Release = same company; Reject = a new company, plus a never-same ruling.
- If a register starts blocking direct reads, the run fails loudly. The fix is to set its `transport` back to `"firecrawl"`, in a PR.

**4. Brands (monthly, 00:00 UTC):** `brand_hm`, `brand_next`, `brand_asos`, `brand_ms`.
- Each first read trips the change limit once, because the fingerprint changed. Release with `--accept-changes`.
- Primark stays off.

**5. `verify_evidence`** may run daily: it checks 50 documents, only for overdue sources.

**Keep off:** `sbi_recompute`, `refresh_monitors`, `rsc_documents`. Other runs start them. Run `refresh_monitors` by hand only after a deploy that changes a monitor URL.

## Done when

- [ ] 0121–0125 applied and verified, with ledger rows written.
- [ ] Deployed: the expected production commit equals the `main` merge commit.
- [ ] C1 applied: 83 rulings and 11 locks; `--verify` shows 0 failures; the split-check cron is installed.
- [ ] The 8 monitors are deleted.
- [ ] Every schedule above is on, and every first run has been released or explained.
- [ ] `/admin/sources` Freshness shows no enabled source past its limit.
- [ ] The daily digest has posted at 09:00 Dhaka.
- [ ] The first Monday digest's place-spelling pairs went to the founder. Approved pairs go into `lib/bd-place-lexicon.ts` and `etl/lib/bd_place_lexicon.py` together, with a test, in a PR.
- [ ] Write `context/current-state.md` "ETL freshness: live" in one line. Move the active.md entry to `context/archive/specs-shipped-2026.md`.

## Ready-to-paste prompt

```
Follow context/feature-specs/handoff-etl-freshness-golive.md. Take the ETL freshness rework live end to end: check the starting state, ask me to apply 0121 to 0125 one at a time and apply each through the MCP after I say "apply NNNN", open the development-to-main promotion with auto-merge, give me every server command, the monitor list and the schedule order, and read each first run and tell me its numbers before I release it. Never apply without my word, never deploy, ssh or switch a schedule yourself. Plain words, five-line updates.
```
