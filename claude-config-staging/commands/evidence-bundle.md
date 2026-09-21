---
description: Freeze the candidate and write the audit evidence bundle (no prose) for the closed-loop fan-out
argument-hint: <merge-base-ref> <linear-issue-id>
---

$ARGUMENTS = `<merge-base-ref> <issue-id>`.

Refuse if `git status --short` is not empty (§6: the candidate is an immutable commit).

`SHA` = `git rev-parse HEAD`. `BASE` = `git merge-base <merge-base-ref> HEAD` — the PR's real merge
base, never blindly `development` (§7).

Write `/tmp/sourcebd-audit/$SHA/`:

- `snapshot.txt` — CANDIDATE_SHA, MERGE_BASE_SHA, UTC time, the DB reference time if data is
  involved, and the mutation-set fingerprint if a mutation is proposed
- `issue.md` — the issue text verbatim and in full (Linear MCP; if unavailable, ask the founder to
  paste it and stop — do not summarise it from memory)
- `diff.patch` (`git diff $BASE...HEAD`), `stat.txt` (`git diff --stat $BASE...HEAD`)
- `tests/` — every new or changed test file, in full
- `unchanged/` — the unchanged source the changed paths depend on
- `verify/` — raw, unedited output of each gate, tee'd to files
- `data/` — raw query output, schema state, counts, sampled rows, the full dry-run plan,
  before/after metrics
- `verdicts/` — created empty, for the critics to write into

No summary, reasoning or claim of correctness anywhere in the bundle (§7). Print the path and the
snapshot block, then stop.
