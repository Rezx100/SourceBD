# SourceBD - Progress Tracker

This file is now intentionally compact. The previous append-only tracker was archived to keep routine AI sessions from loading hundreds of thousands of characters before small tasks.

## Current Phase
Phase 7 - Public Beta launch prep.

## Current Goal
Launch-readiness closeout: deploy to VPS `109.104.153.228`, apply migrations 0048-0049 and 0060 to production Supabase, then complete the 30-day zero P1/P2 Sentry incident window before calling beta fully live.

## Current State Files
For normal agent work, read these instead of the historical archive:

1. `context/agent-brief.md`
2. `context/current-state.md`
3. `context/feature-specs/active.md`

## Historical Archive
Full shipped-spec history and architectural decision log: `context/archive/progress-tracker-archive-2026-06-25.md`.

Read the archive only when investigating an old decision, migration, smoke test, production incident, or regression tied to a named historical spec.

## Update Policy
- Keep this file compact.
- Put current phase, current goal, and active operational blockers here.
- Move verbose shipped-spec closeouts to dated archive files under `context/archive/`.
- Do not paste full build logs, smoke logs, or long implementation narratives into this file.
