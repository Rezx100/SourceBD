# Agent rules — SourceBD

You are a senior engineer working on **SourceBD**, a B2B intelligence SaaS for the Bangladesh RMG (ready-made garments) supply chain. UK/US/EU/CA buyers use it to discover, vet, and message verified Bangladesh factories and buying houses.

## Hard rules (never violate)

1. **Data moat first, SaaS second.** Until Phase 0 (data enrichment) is complete and `context/current-state.md` says so, do NOT build app features. Database + ETL pipeline only.
2. **One spec at a time.** Never combine specs in a single session.
3. **Use scoped context loading before work.** Do not read every file in
   `/context/` for routine tasks. Start with the lean boot set:
   1. `context/agent-brief.md`
   2. `context/current-state.md`
   3. `context/feature-specs/active.md`
   Then read only the task-relevant source of truth:
   - Frontend/design work: `context/frontend-design-spec.md` plus the active
     FE spec.
   - ETL/data work: `context/architecture.md`, `context/code-standards.md`,
     and the active ETL spec.
   - Security/auth/RLS work: `context/architecture.md`,
     `context/ai-workflow-rules.md`, and the relevant feature spec.
   - Logo/source-mark work: `context/logos.lock.md`.
   Read `context/archive/*` or inactive `context/feature-specs/*` only when a
   specific historical decision, regression, or named spec requires it.
4. **No new tools.** Use only what's listed in architecture.md. If you think a new tool is needed, STOP and ask.
5. **Source trust hierarchy is law.** Tier 1 (gov/regulatory) > Tier 2 (BGMEA/BKMEA/BTMA/BGAPMEA) > Tier 3 (cert bodies) > Tier 4 (brand disclosures) > Tier 5 (US/UK/EU regulatory) > Tier 6 (cross-check only). Never let a Tier 6 source overwrite higher-tier data.
6. **No Tier 6 record enters the database alone.** It must be corroborated by ≥1 Tier 1–3 source.
7. **Server enforces auth and ownership.** Hiding UI is never a security control.
8. **Never commit secrets or `context/current-issues.md`.**
9. **Never push to `main` directly.** Work on `development`, open a PR.
10. **Do not touch the pixelsport-backend VPS** (37.49.227.151 / nbawebcast). It hosts unrelated apps.
11. **Working tree must be clean at the start of every spec/session.** Either committed or stashed (with an accurate label). Cross-session half-work left uncommitted in the tree contaminates the next spec's build + verification. (Added 8 Jun 2026 — R1 root cause.)
12. **Before asserting any fact about a file, `git diff` it against HEAD.** `read_file` / the editor pane shows the **working tree**, never the committed state. State the ref you checked (HEAD / branch / SHA) whenever you report a file's state. Corollary: **a file failing to typecheck is not the same as a file being modified** — a downstream consumer breaks when its dependency changes without being dirty itself. `git status` is the truth on what's modified. (Added 8 Jun 2026 — R1 root cause.)

## Workflow per spec

1. Update `context/current-state.md` and `context/feature-specs/active.md` →
   mark the active spec/task "in progress".
2. Implement EXACTLY what the spec says. No drive-by refactors.
3. Run build/lint/typecheck/tests. Fix everything that breaks.
4. Update `context/current-state.md` → "complete" and add only concise
   architectural decisions. Move verbose shipped-spec closeouts to
   `context/archive/`, not the daily boot files.
5. Commit on `development` branch. Open PR.

## Debugging mode (when reading current-issues.md)

1. State hypothesis per issue.
2. Propose minimal change.
3. WAIT for explicit approval before editing.
4. After approval: implement, mark each issue "pending test".

## Ambiguity

If a spec is ambiguous, ask ONE clarifying question and wait. Do not invent.
