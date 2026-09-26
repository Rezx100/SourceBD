# Start here: REZ-C — the company profile, ready for audit cycle 4

Written 25 Sep 2026. Replaces `handoff-rez-c-cycle2.md`. The build is done and
three times repaired; the closed loop is still open. This is the prompt for the
session that closes it.

## 0. Where things stand, verified at the end of this session

- Branch `rez-c-supplier-record`, **11 commits ahead** of `origin/development`
  (`1366220`) once this hand-off is committed. Nothing pushed. No PR.
- `development` = `1366220`, `main` = `64c681c`. Neither has any REZ-C code.
- Last code commit: `3f65c59` (cycle-3 repairs). After it: `cc706d5`
  (CLAUDE.md's measured test count) and this hand-off — both docs only.
- Migration `0105_supplier_record_v32.sql` is **NOT applied**. Unchanged this
  session: sha256 (CRLF) `0edbaf6a0f81a33320cdf4b21757104ef56c1395f591a944b4fa50c8afe769b0`.
  `ops/verify_0105_guards.py` re-run at `3f65c59`: 5/5, rolled back, "0
  mismatches over all 10,266 published records". Founder's command:
  `ops/plans/rez-c-0105-dry-run.md`.
- The untracked `.mp4` in the repo root is the founder's. Every commit excludes
  it: `git add -A ':!*.mp4'`.

## 1. The loop — the important part

`.cursor/rules/sourcebd-closed-loop.mdc` governs. **No Acceptance Judge has
run. The token has not been issued.**

| Cycle | Candidate | Result |
| -- | -- | -- |
| 1 | `b1c33fe` | 4 critics, all REJECT → repaired `427f22c` |
| 2 | `0e50aa9` | 2 of 4 reported (REJECT), 2 died → repaired `07f31b5` |
| 3 | `242d49c` | **all four ran**, all REJECT → repaired `3f65c59` |
| 4 | `cc706d5` | launched, then **stopped by the founder before any verdict**. Not run. |

Cycle 3's four verdicts, in substance, are in
`.claude/rez-c-review-kit/c4/prior/*.md` (one file per role). Headlines:
contact details filed inside register address text reached the page (25
published addresses, five print the exact gated phone number); the link guard
allowed raw anchors per file, so the cycle-1/2 regressions passed it; a failed
EPB read made the line sheet say "not on this record's EPB page"; the product
list was only a count; the overlay's Share navigated instead of copying; the
contact card promised "paid plans" beside a dead "See plans"; notice overlays
were not inert; no dialog focus handling; 320px overflow; tile links lost their
#section; and eleven untested branches (every one proven by a surviving
mutation).

`3f65c59` repairs every BLOCKER and MAJOR. Each repair has a guard, and each
guard was mutation-checked in this session (13/13 killed). **The next session
must not take that on trust** — it is exactly the claim the loop exists to
test, and cycle 2's blockers were defects in cycle 1's repairs.

MINORs deliberately left open (write them into the PR; the Judge decides
whether each is inert):
- "Exporters of HS · N" is a build-time snapshot (`lib/hs-catalogue.ts`,
  21 Sep). Equal to live `discover_suppliers` for 46/46 headings today; no
  drift guard.
- §3.3's intercepting route (`@sheet/(.)suppliers/[slug]`) is not built; the
  page reads `?record=`. Intent met, deviation documented in the page.
- Word drift: photo caption, action-bar caption, read-date range in the bar,
  "Product list" vs "BGMEA product list".
- Certificate issuer link uses only a stored document URL; `resolveCertificateUrl`
  unused (pre-existing at `1366220`).
- `buyer_supplier_profile` does not filter rejected certificates (0 rows today).
- 0105 does not count `supplier_contact_email/phone/name` (empty on every row).
- Opening a line reads the record twice; open/close re-runs the search.
- The 0105 SQL tests skip until the migration is applied.

Out of this PR, raised separately: the same address leak on the anonymous
public profile and the older pages (a task chip was spawned: "Strip contact
details from addresses on public pages"); the `api_export` rate-limit hole
(pre-existing, CLAUDE.md).

## 2. Founder rulings this session (recorded in `current-state.md`)

"Exporters of 6105 · N" wording kept; 0105's five omitted §4.3 items accepted;
`/app/compare` deferred; the Barikoi map and "Map pin" deferred to the
rebuild; the admin contact reveal moves later to the admin page; §3.5's
10-minute cache is a separate task. They are in the audit kit's `issue.md`.

## 3. What to do, in order

a. **Candidate.** HEAD after this commit. Confirm `git diff 3f65c59 HEAD --stat`
   touches only `CLAUDE.md`, `context/*` — if so the gate output below is
   the candidate's code, and the snapshot must say so; if anything else moved,
   re-run the whole gate.
b. **Evidence bundle.** The kit is `.claude/rez-c-review-kit/c4/` (git-ignored,
   local): `brief.md` (placeholders `{{SHA}}`, `{{BUNDLE}}`, `{{AXIS}}`),
   `axes/*.md`, `prior/*.md`, `issue.md`, and the raw gate output
   (`tsc.txt lint.txt build.txt pnpm-test.txt ruff.txt pytest.txt`, all at
   `3f65c59`). Regenerate `diff.patch`, `diff-stat.txt`, `recent.patch` and
   `snapshot.txt` for the real candidate, **excluding every
   `context/feature-specs/handoff-rez-c-cycle*.md`** from the diffs:
   `git diff 1366220 <SHA> -- . ':!context/feature-specs/handoff-rez-c-cycle*.md'`;
   `recent.patch` = `git diff 242d49c <SHA>` with the same exclusion.
c. **Cycle 4.** Four roles in parallel, each in its own worktree, against the
   one SHA: requirements, invariant (read-only live SELECTs; run every
   published address through `lib/contact-text.ts`), adversarial, test
   adequacy. Each gets the brief, its axis and its own `prior/` file only.
d. **Acceptance Judge.** A fifth agent that gets all four verdicts plus the
   primary evidence, may investigate itself, and alone may emit
   `ACCEPTED_FOR_HUMAN_REVIEW`. On any BLOCKER/MAJOR: repair, re-gate, new
   bundle, re-audit — no iteration cap.
e. **Then the three gates, one at a time** (AGENTS 9a): push the branch and
   open a PR to `development` and ask before merging; then ask for `main`;
   then ask for the deploy. The migration goes before or with the deploy.

## 4. Verification gate at `3f65c59` (raw output in the kit)

| Command | Result |
| -- | -- |
| `pnpm exec tsc --noEmit` | exit 0 |
| `pnpm exec next lint` | 0 errors (one pre-existing warning, `lib/email/templates/welcome.tsx`) |
| `pnpm exec next build` | exit 0 |
| `pnpm test` (Node 25.4.0) | **1,585 tests / 238 suites — 1,584 pass, 1 fail** (the known `api_export` one) |
| `ruff check etl ops --no-cache` | 49 on ruff 0.15.13 — at baseline |
| `python -m pytest -q etl/tests` | 1,009 passed, 42 failed, 6 skipped — the same 42 fail at `1366220` (re-run this session); the 6 skips are 0105's own test |

CLAUDE.md carries these numbers.

## 5. The test server — parked by the founder

`ts.sourcebd.net`, 23.95.72.202, OneProvider Los Angeles, 8 vCPU / 32 GB,
Ubuntu 24.04, billed hourly (~$0.09/h) while it exists; the founder intends to
destroy it after use. **Parked: do not use it unless the founder asks.**
- Its root password sits in `.env` as free text (not `KEY=VALUE`) and was
  printed into this session's chat by mistake — the founder should rotate it.
  Agents must never log in with a password.
- A dedicated key exists at `~/.ssh/sourcebd_test` (.pub:
  `...IOY4HnEPwaXOHSUe11UhlXaGjirEVolgXrkV4vexouFD sourcebd-test-runner`). It is
  **not yet authorised** on the server. The founder was given a one-block root
  command creating an unprivileged `claude` user with that key, capped by
  `systemctl set-property user-<uid>.slice CPUQuota=480% MemoryMax=19G`; it was
  not confirmed as run.
- Creating a VM (`ops/provision_vps.py create`) is blocked for agents by this
  machine's auto-mode classifier as a real-world transaction; the founder runs it.

## 6. Traps this session hit

1. **`\b` written through a Python/bash string becomes BACKSPACE (0x08)** — hit
   again (`lib/contact-text.ts`). Write regexes with Write/Edit only, then scan:
   `grep -rlP '[\x00-\x08\x0b\x0c\x0e-\x1f]' --include=*.ts --include=*.tsx .`
2. In a template literal, `\(` is just `(`: a `new RegExp(`\(…`)` silently
   loses its escapes. Use `String.raw`.
3. **Auditor worktrees under `.claude/worktrees/agent-*` hold `node_modules`
   junctions** into the real one. Never `rm -rf` or `git worktree remove
   --force` them: remove the junction first with `cmd //c rmdir <wt>\node_modules`.
   About 30 of them from earlier sessions are still there.
4. `CLAUDE.md` says `.claude/hooks/guard.py` refuses the dangerous commands. It
   does not exist on this machine; the rules hold by discipline, not a hook.
5. `next/link` renders `<a>` in a server component, so only source-reading
   tests (`components/dashboard/links.test.ts`) can tell client from full
   navigation. It now checks each element's href expression, not each file.

## 7. Hard limits (unchanged)

Never touch `37.49.227.151`; no `ssh`/`rsync` to the production VPS; never write
`.env`; never apply a migration, run `--apply`, merge or deploy — print the
command and stop. Supabase MCP is read-only. Replies five lines or fewer, plain
words. Every Linear issue, PR and SHA carries a plain description on first
mention.

## 8. Prompt for the new session (paste this)

Finish REZ-C — the company profile (supplier record sheet and product line).
The build is done and three times repaired on branch `rez-c-supplier-record`;
the closed loop is open and audit cycle 4 has not run. Read
`context/feature-specs/handoff-rez-c-cycle4.md` first, then `AGENTS.md`, the
lean boot set and `.cursor/rules/sourcebd-closed-loop.mdc`. Freeze the
candidate, build the evidence bundle from `.claude/rez-c-review-kit/c4/`, run
all four audit roles against that one SHA with none of the previous sessions'
reasoning, then a separate Acceptance Judge; repair whatever they find and loop
until the Judge returns `ACCEPTED_FOR_HUMAN_REVIEW`. Treat every repair as
unaudited new code. Leave the test server alone unless I ask. Then ask me for
each of the three gates separately. Never apply the migration, merge or deploy
yourself — print the command for me. Keep every update to five lines or fewer,
in plain words.
