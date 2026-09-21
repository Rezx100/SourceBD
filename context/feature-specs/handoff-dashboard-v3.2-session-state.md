# Buyer dashboard v3.2 — session state hand-off (18 Sep 2026, Cowork session)

Read this after `handoff-dashboard-v3.2-implementation.md`. It records what the
first orchestration session settled so the next session does not re-ask.

## Founder answers (authoritative, do not re-ask)
- Q1 Email RFQs to unclaimed suppliers behind `RFQ_EMAIL_UNCLAIMED`: **yes** (build §4.6 behind the flag).
- Q2 HS photos: **in repo** — 34 PNGs committed as `design/assets/products/hs/hs-<code>.png` (commit `03f91ad`), 12 webp in `aboni-knitwear/`.
- Q3 OpenAI: **yes, gpt-5-mini** default; founder sets `OPENAI_API_KEY` himself in `.env` when REZ-E starts.
- Q4 Storage bucket `rfq-attachments`: **create it for me, dry-run first** — REZ-D ships the bucket + policy as a posted migration the founder applies; attachments stay in REZ-D.
- Q5 `SHIPMENTS_PROVIDER=volza`; `VOLZA_API_KEY` **not in .env yet** (Volza issues tokens only by email; request sent to helpdesk@volza.com on 18 Sep from 10hightech@gmail.com, asking for the token, the 100 free requests, written confirmation that API rows may be shown to SourceBD buyers, and whether the API carries the trial's 6-month lag). §4.13 allowance numbers: **keep**. REZ-G builds on recorded fixtures; unlock route returns 503 "not configured" until the key lands. The stub job never runs against Volza (spec §4.8).
- Q6 Provider terms: **ask in the email** (done, see Q5). No paid call before the written answer.
- Q7 Workspace roles: **owner/member only**.
- Q8 `SUPABASE_DB_URL` in `.env` is **production** (project `stnrfxrxfonwexzcvvpv`, "SourceBD SAAS", no branches on 18 Sep). Decision: **create a Supabase branch `v32-tests`**, seed the named test records (aboni-knitwear, sm-knitwear, adventure-garments, liberty-knitwear, ar-fashion, zaheen-…, indochine-…) from a read-only production export, and point DB tests at it through a separate variable the founder adds to `.env` (never edit `.env` from an agent). Never run DB tests against the production URL.

## Step 0 — done
- `design-rebuild` merged `origin/development` (`e15966c`) as `12cf408`; conflicts in `current-state.md` / `active.md` resolved by keeping the 18 Sep compacted files + one line each for the address-premises merge (11 Sep section archived verbatim in `context/archive/state-2026-jun-aug.md`).
- `development` = `09ec96b` (merge of `design-rebuild`, tree identical), pushed to GitHub 18 Sep. Every PR now branches from `development`.
- Working tree clean at `09ec96b`. Root `*.webm` recordings and `Claude outputs/` are gitignored. `Video.webm` removed.
- `.git/` holds harmless `tmp_obj_*` leftovers and a `_stale-locks/` folder from a shell without delete rights — `git prune` clears them.

## Environment facts found (verify again, they are hypotheses)
- `GITHUB_TOKEN` in `.env` returns 401 — dead. Founder to replace before an agent can push or open PRs; otherwise the founder pushes with `git push origin <branch>`.
- Linear: no connector and `api.linear.app` unreachable from the Cowork shells. Founder to add the Linear connector (or create issues from agent text).
- Node 22 is what the Cowork VM has; `pnpm test` needs Node 20. Claude Code on the founder's machine has the right toolchain and the guard hooks in `.claude/hooks/guard.py`.
- Higgsfield CDN is blocked from every agent shell; only the founder's PowerShell can run `fetch.ps1` (already done).

## Next
Start **REZ-A** (code port of the dashboard kit, spec §7.1) from `development` with a clean tree: `design/src/dash.css` classes → React pieces under `components/dashboard/*` using only Tailwind classes from `lib/design/tokens.ts`; `/dev/ds` gains the six screens from real data; no route changes; no migration. Then the four-command gate, the closed-loop fan-out, PR to `development`, stop at "Ready for human review. Not merged."

## REZ-A session (19 Sep 2026, Cowork)
- **Tokens decision (founder, 19 Sep):** the code port follows the artifact's v3 tokens (Geist / Geist Mono self-hosted from the artifact's `project/fonts/`, warm canvas, radii 6/10/14, `smart` / `signal` / glass roles), not the Inter + 5/6/8 set §9 had locked. `lib/design/tokens.ts` is the truth; §9 carries the amendment.
- **Branch:** `rez-a-dashboard-kit` from `development` `09ec96b`. Q2 confirmed: 46 of 46 headings have a photo; `scripts/build-hs-photos.mjs` (Playwright Chromium, no sharp) writes `public/products/hs/hs-<code>.webp` (512) and `-128.webp`, plus `lib/hs-catalogue.ts`.
- **Attribution in REZ-A:** a fact carries a mark only where the payload attributes it (register numbers → `pills`, certificates → `kind`, brand lists → `source_code`, RSC data and RSC-sourced worker counts, the factory address → `addresses[].source_code`). The profile facts the RPC does not attribute per field (type, established, sewing machines, capacity, parent group, product list) render without a mark and the sheet says "source pending" — the first audit cycle rejected a best-guess register mark as a wrong receipt. Field-level `evidence_claims` (72,796 rows; keys like `bkmea_employees_total`, `rsc_progress_pct`; BGMEA fields largely absent) are REZ-C's FactsPanel work, as is the RSC "no longer covered" state (the RPC returns active rows only). Marks link to the register page the record carries (`pills[].source_url`, `provenance[].source_url`).
- **Gallery query:** `discover_suppliers` is called with text "knitted shirts" + cert kind gots, sort `receipts` (the RPC's "most sources"); on 19 Sep that is 42 suppliers, not the artifact's 320 (HS 6105 + valid-GOTS filters arrive with REZ-B's RPC extension). The frame note says so.
- **Environment facts:** the Cowork VM mounts `E:\SourceBD` but its `node_modules` are pnpm junctions that do not resolve through the mount, and the VM has no registry access — no `tsc`, `pnpm test` or `next build` there. The gate ran in the Cowork cloud container on a source snapshot (`pnpm install --frozen-lockfile`, Node 22; Node 20 cannot expand the `.tests-build/**` glob the test script now uses, so CLAUDE.md's "Node 20 only" is stale since the 18 Sep test-runner fix). Files were written back to `E:\SourceBD` through the Cowork file bridge; git identity in the VM is empty (`-c user.name/user.email` on commit).
