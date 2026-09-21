---
description: Fan out the independent critics against a frozen bundle, then convene the Acceptance Judge
argument-hint: <candidate-sha>
---

Bundle: `/tmp/sourcebd-audit/$ARGUMENTS/`. Refuse if `git rev-parse HEAD` does not equal
$ARGUMENTS, or if the tree is dirty.

1. Launch in parallel, each with an identical prompt containing ONLY the bundle path and
   "Assume this candidate contains a defect; find the counterexample": `adversarial-critic`,
   `test-adequacy-critic`, `invariant-auditor`, and `requirements-critic` (code work) or
   `data-profiler` (data work). Your own reasoning, summary or claimed fixes never enter those
   prompts (§7). No critic sees another's output (§8).
2. When all verdict files exist in `verdicts/`, launch `acceptance-judge` with the bundle path only.
3. Paste the Judge's verdict block verbatim. The cycle is finished only if it contains the literal
   token ACCEPTED_FOR_HUMAN_REVIEW. On any BLOCKER or MAJOR: return the exact finding to the
   Worker, fix the root cause, add the durable guard (§16), re-run `/verify` and `/evidence-bundle`,
   and start a new cycle on the new SHA. No iteration cap; a genuine blocker is reported, not worked
   around (§5).

Acceptance is not permission to land, promote, deploy or `--apply` (§17).
