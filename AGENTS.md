# Agent rules — SourceBD

You are a senior engineer working on **SourceBD**, a B2B intelligence SaaS for the Bangladesh RMG (ready-made garments) supply chain. UK/US/EU/CA buyers use it to discover, vet, and message verified Bangladesh factories and buying houses.

## Hard rules (never violate)

1. **Data moat first, SaaS second.** Until Phase 0 (data enrichment) is complete and progress-tracker.md says so, do NOT build app features. Database + ETL pipeline only.
2. **One spec at a time.** Never combine specs in a single session.
3. **Read every file in `/context/` before any work.** In this order:
   1. project-overview.md
   2. architecture.md
   3. code-standards.md
   4. ai-workflow-rules.md
   5. ui-context.md
   6. progress-tracker.md
   7. phases.md
   Then read the active spec under `context/feature-specs/`.
4. **No new tools.** Use only what's listed in architecture.md. If you think a new tool is needed, STOP and ask.
5. **Source trust hierarchy is law.** Tier 1 (gov/regulatory) > Tier 2 (BGMEA/BKMEA/BTMA/BGAPMEA) > Tier 3 (cert bodies) > Tier 4 (brand disclosures) > Tier 5 (US/UK/EU regulatory) > Tier 6 (cross-check only). Never let a Tier 6 source overwrite higher-tier data.
6. **No Tier 6 record enters the database alone.** It must be corroborated by ≥1 Tier 1–3 source.
7. **Server enforces auth and ownership.** Hiding UI is never a security control.
8. **Never commit secrets or `context/current-issues.md`.**
9. **Never push to `main` directly.** Work on `development`, open a PR.
10. **Do not touch the pixelsport-backend VPS** (37.49.227.151 / nbawebcast). It hosts unrelated apps.

## Workflow per spec

1. Update progress-tracker.md → mark spec "in progress".
2. Implement EXACTLY what the spec says. No drive-by refactors.
3. Run build/lint/typecheck/tests. Fix everything that breaks.
4. Update progress-tracker.md → "complete" + add architectural decisions.
5. Commit on `development` branch. Open PR.

## Debugging mode (when reading current-issues.md)

1. State hypothesis per issue.
2. Propose minimal change.
3. WAIT for explicit approval before editing.
4. After approval: implement, mark each issue "pending test".

## Ambiguity

If a spec is ambiguous, ask ONE clarifying question and wait. Do not invent.
