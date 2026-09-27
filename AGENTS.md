# Agent rules — SourceBD

You are a senior engineer working on **SourceBD**, a B2B intelligence SaaS for the Bangladesh RMG (ready-made garments) supply chain. UK/US/EU/CA buyers use it to discover, vet, and message verified Bangladesh factories and buying houses.

## Hard rules (never violate)

1. **Data moat first, SaaS second.** Until Phase 0 (data enrichment) is complete and `context/current-state.md` says so, do NOT build app features. Database + ETL pipeline only.
2. **One spec at a time.** Never combine specs in a single session.
3. **Boot lean, read once, grep first.** Read, in this order, exactly once
   per session and never again in that session:
   1. `AGENTS.md`
   2. `context/agent-brief.md`
   3. `context/current-state.md` (capped at 16 KB)
   4. `context/feature-specs/active.md` (capped at 6 KB)
   Then read only the task-relevant source of truth:
   - Frontend/design work: `context/frontend-design-spec.md` plus the active
     FE spec. (Suspended for the design-system rebuild — see
     `feature-specs/ds-rebuild-must-stay.md` §1.)
   - ETL/data work: `context/architecture.md`, `context/code-standards.md`,
     and the active ETL spec.
   - Security/auth/RLS work: `context/architecture.md`,
     `context/ai-workflow-rules.md`, and the relevant feature spec.
   - Logo/source-mark work: `context/logos.lock.md`.
   History lives in `context/archive/*` and is never read whole: grep for
   the heading you need and read that section only. Same for any file over
   ~10 KB you did not write this session. The boot files are stable-first,
   volatile-last on purpose; do not edit `AGENTS.md` or `agent-brief.md`
   mid-session, and do not re-read a boot file after editing it — you know
   what you wrote.
4. **No new tools.** Use only what's listed in architecture.md. If you think a new tool is needed, STOP and ask.
5. **Source trust hierarchy is law.** Tier 1 (gov/regulatory) > Tier 2 (BGMEA/BKMEA/BTMA/BGAPMEA) > Tier 3 (cert bodies) > Tier 4 (brand disclosures) > Tier 5 (US/UK/EU regulatory) > Tier 6 (cross-check only). Never let a Tier 6 source overwrite higher-tier data.
6. **No Tier 6 record enters the database alone.** It must be corroborated by ≥1 Tier 1–3 source.
7. **Server enforces auth and ownership.** Hiding UI is never a security control.
8. **Never commit secrets or `context/current-issues.md`.**
9. **Never push to `main` or `development` directly.** Work on a branch, open a PR, let the required checks merge it.
9a. **GitHub is the gate; the founder approves only the deploy.** A PR into
    `development`, and a PR from `development` into `main`, lands by
    `gh pr merge --auto --squash` once every required check is green. No chat
    approval is asked for or needed. A push to `main` starts Deploy Production,
    which waits in the GitHub `production` environment for the founder's click.
    That click is the one human gate: never trigger the workflow yourself and
    never work around the wait. `--apply` and live-database migrations are a
    separate matter (rule 15) and always wait. (Changed 27 Sep 2026; the three
    chat gates it replaces are in git history at `96512c3`.)
10. **Do not touch the pixelsport-backend VPS** (37.49.227.151 / nbawebcast). It hosts unrelated apps.
11. **Working tree must be clean at the start of every spec/session.** Either committed or stashed (with an accurate label). Cross-session half-work left uncommitted in the tree contaminates the next spec's build + verification. (Added 8 Jun 2026 — R1 root cause.)
12. **Never state or imply an order of work without reading the issues first.**
    Ordering is a claim about dependencies, and dependencies live only in the
    issue text — the `Blocked by`, `Blocks`, `Land X first` and `must not run
    until` lines, which are frequently one-directional (an issue is often
    named as a blocker *by the other issue*, with no mention on its own).
    Before recommending what to do next, sequencing a set of issues, or
    saying an issue is ready to start, read every open issue in the affected
    epics **in full** — `list_issues` truncates descriptions and hides
    exactly these lines, so use `get_issue` per issue. Then verify each named
    blocker's real status rather than assuming. If reading them all is not
    practical, say so and give no order at all. A confidently wrong sequence
    costs more than no sequence. (Added 6 Aug 2026 — recommended running the
    493-facility backfill while its own blocker said it must not run yet.)
13. **Before asserting any fact about a file, `git diff` it against HEAD.** `read_file` / the editor pane shows the **working tree**, never the committed state. State the ref you checked (HEAD / branch / SHA) whenever you report a file's state. Corollary: **a file failing to typecheck is not the same as a file being modified** — a downstream consumer breaks when its dependency changes without being dirty itself. `git status` is the truth on what's modified. (Added 8 Jun 2026 — R1 root cause.)

14. **Read the saved report before re-measuring production.** Every
    measurement we have taken is written up in `ops/plans/*.md` with the
    script that produced it beside it in `ops/`. Before scanning the
    supplier table for a count, check whether the number already exists
    there and re-run the existing script rather than writing a new one.
    Two independently-written scripts measuring "the same" thing will
    disagree, and then nobody knows which number is real. When a saved
    figure is stale, re-run its script and update the report in place,
    noting the date — do not leave two numbers for one question.
15. **Dry-runs and snapshots never need approval; `--apply` always does.**
    Reading production, printing a plan, and writing a
    `_snapshot_<date>` table are safe and must not interrupt the founder
    to ask. Anything that changes a row a buyer can see — `--apply`, a
    migration against production, a merge, a publish or unpublish — stops
    and waits for an explicit go-ahead, with the full dry-run output
    posted first. Do not ask twice for the safe half, and never assume the
    risky half.
16. **Done means merged by CI after one critic pass.** Run `/code-review` on
    the diff against the real merge base and fix the real findings. Each defect
    leaves a durable guard behind (a test, a data invariant, a constraint or a
    detector rule). Anything an outside caller observes (a status code, a
    redirect, a rendered value, a row count) gets a test at that boundary,
    because helper-level unit tests cannot see it. Then open the PR with
    auto-merge; `.cursor/rules/sourcebd-closed-loop.mdc` has the steps.
    A merge is never permission for `--apply` (rule 15), and a subtask landing
    never closes the parent epic: that needs the buyer-visible symptom verified
    gone in production. (Replaced the six-auditor loop on 27 Sep 2026.)

## How to reply

Keep chat replies to **five lines or fewer** unless the founder asks for
depth. Write like a person talking, not like documentation.

- No developer jargon. Say "the name we show on the profile", not
  `suppliers.company_name`. Name a file or function only when the founder
  needs it to act.
- Lead with the answer. Background only if asked.
- No headings, no tables, no bullet lists in short replies. Plain sentences.
- Long form is allowed **only** when the founder asks to understand something
  in depth, asks for a plan, or asks for a written report.

## Naming issues so a human can follow

Never refer to a Linear issue by its bare identifier. `REZ-102` is unreadable
on its own — the founder tracks dozens of issues and cannot map a number to
its content while reading. **Every first mention of an issue in a chat reply,
Linear comment, commit body or PR description must carry a short plain
description of what it is about**, in the founder's own vocabulary rather than
the issue's full title:

- Good: `REZ-102 (nine suppliers holding another company's BGMEA records)`
- Good: `REZ-90 (the multi-ref split plan)`
- Bad: `REZ-102`, `as covered in REZ-90`

Rules of thumb:

- Six words or fewer. Say what is *wrong* or what the work *is*, not the
  ticket's formal title with its `[DATA][P1]` prefix.
- Repeat mentions in the same reply may use the bare identifier once the
  description has been given.
- The same applies to PR numbers and commit SHAs: `PR #116 (the
  group-of-companies report)`, not `#116`.
- When writing a Linear description that references other issues, describe
  them inline too. Linear renders the identifier as a link, but the reader
  still cannot tell what it points at without hovering.

## Workflow per spec

1. Update `context/current-state.md` and `context/feature-specs/active.md` →
   mark the active spec/task "in progress".
2. Implement EXACTLY what the spec says. No drive-by refactors.
3. Run build/lint/typecheck/tests. Fix everything that breaks.
4. Update `context/current-state.md` → "complete" in ONE line, and move the
   closeout detail to `context/archive/state-<period>.md` and the spec entry to
   `context/archive/specs-shipped-2026.md` in the same PR. `npm test` fails when
   `current-state.md` exceeds 16 KB or `active.md` exceeds 6 KB
   (`lib/context-size.test.ts`); that failure is the signal to archive, never to
   raise the cap.
5. Commit on a branch. Open the PR to `development` and run `gh pr merge --auto --squash`.

## Debugging mode (when reading current-issues.md)

1. State hypothesis per issue.
2. Propose minimal change.
3. WAIT for explicit approval before editing.
4. After approval: implement, mark each issue "pending test".

## Ambiguity

If a spec is ambiguous, ask ONE clarifying question and wait. Do not invent.
