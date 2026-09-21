# The mutation harness — the closed loop's positive control

`.cursor/rules/sourcebd-closed-loop.mdc` §16: every defect a critic finds must
leave behind a durable guard. A guard nobody has watched fail is not a guard,
so each entry in `mutate.py` reverts **one** repair in a **source** file, runs
the suite, and records whether it went red.

It lived in a container home directory for five cycles, which meant the guards
*on the guards* were not durable and could not be reviewed. They are here now.

```
MUTATE_ROOT=/path/to/a/worktree \
MUTATE_TEST=$PWD/scripts/mutation/dash-test.sh \
MUTATE_OUT=/tmp/mutations \
python3 scripts/mutation/mutate.py          # the whole sweep
python3 scripts/mutation/mutate.py c10-     # one family
```

## What it refuses, and why each refusal exists

- **The tree you commit from.** The sweep rewrites source files. Three commits
  on `rez-a-dashboard-kit` were made while a sweep was in flight, each swept up
  the live mutant, and two shipped it — the branch then sat red for two commits
  with every CI check green. `MUTATE_ROOT` must be a worktree of its own.
- **A dirty worktree.** A tree with uncommitted changes is not the candidate,
  and a mutation left behind by an interrupted run would be measured as if it
  were the author's code.
- **An anchor that does not appear exactly once.** Zero matches used to print
  `SKIP` and carry on, so a repair silently removed a guard from the sweep
  while the headline still read "0 survived". Two matches are worse: the
  harness replaces the first occurrence and scores RED for whatever that
  happened to break. `c6-long-name-truncated` pointed at a string that occurs
  twice in the card, neither of them the long supplier name it is named after.
- **A red baseline.** The positive control needs one of its own. Over a tree
  that is already red every entry scores RED and the sweep reports a perfect
  result while proving nothing — which is exactly what one cycle-9 run was
  doing.

## Reading its output

`summary.json` carries the SHA and root it swept. The last line of the log is
the headline, and it is the only number to quote:

```
<sha>: N caught / N survived / N did not compile / N skipped, of N
```

`did not compile` is counted separately on purpose. `dash-test.sh` runs
`tsc || exit 1` first, so a mutation that does not type-check exits non-zero
with **no test having run** — that is the compiler rejecting it, not a guard
catching it, and one cycle-7 sweep reported 73/73 with one of those in it.

A revert that changes no rendered output scores a **false** RED. Five have been
found and repointed. When you add an entry, confirm it actually changes what a
screen says.
