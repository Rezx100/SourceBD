# Spec ADMIN-CONSOLE — Admin Console Repair

> Status: Completed in working tree, including admin UI overhaul, 26 Jun 2026.
> Scope: Admin console workflow, publish feedback, review queue visibility, and admin usability polish.

## Goal

Make `/admin` usable by a non-technical operator for the core launch tasks:

- Understand what needs review.
- Open the relevant queue or supplier record from dashboard/sidebar.
- Review evidence and moderation items.
- Publish or unpublish suppliers with clear feedback.
- See why a supplier cannot be published.

## Constraints

- Preserve all server-side admin gates in middleware, route layouts, API routes, and SECURITY DEFINER RPCs.
- Preserve the publish invariant: a supplier cannot be published without at least one active Tier 1-3 source record.
- Do not allow Tier 6-only records to become publishable.
- Do not expose contact PII or SBI outside admin-only surfaces.
- Use existing UI primitives and Tailwind utilities only. No new packages.
- For the admin UI overhaul, use the existing vendored SourceBD/Magic UI-style
  visual/layout primitives through `components/ui` and admin-specific wrappers.
  Keep admin motion restrained, reduced-motion safe, and tied only to real
  server data.

## Implementation Slices

1. Fix supplier editor feedback and public profile freshness after publication changes.
2. Add `/admin/queue` as the central review backlog, with dashboard and sidebar links.
3. Improve supplier list/detail labels and task structure for operator use.
4. Align claims, certifications, and sanctions pages with the admin UI system.
5. Verify lint/typecheck/build where feasible and manually smoke the key admin flows.

## Acceptance Criteria

- Dashboard queue counts link to actionable queue pages.
- Sidebar includes a primary review queue entry with backlog badge.
- Supplier publish failures show clear plain-language errors.
- Successful supplier publication invalidates public and app profile paths.
- `/admin/queue` lists all verification queue types and provides safe actions for generic queue rows.
- Existing claim, certification, and sanctions review flows remain functional.
- Admin pages remain responsive and avoid raw endpoint/database labels in visible copy.
- Suppliers, review queue, supplier detail, and the remaining admin pages share
  one responsive admin presentation system with usable mobile cards, touch-safe
  controls, and consistent page headers/filter areas.
