# Spec R2 — Responsive app shell

> Wires the R1 primitives into the authenticated app shell + the marketing chrome. Also corrects the I-022b debt: ships the role-aware topbar that progress-tracker.md previously claimed already existed.

## 1. Goal
One primary nav per device class, no overlap, on every authenticated surface (`/app/*`, `/supplier/*`, `/admin/*`) and the marketing chrome.

## 2. Dependencies
- **R1 must be merged.** R2 imports `BottomTabBar`, `SidebarRail`, `MobileDrawer` from R1.
- **Unblocks R4 / R5 / R6.** R3 does not depend on R2 directly but does share the marketing top-nav rewrite in §4.
- **R2 builds on HEAD.** Note: HEAD `components/shell/topbar.tsx` already carries the role-aware `QUICK_LINKS` + moat chip + `{role, moatTotal}` props from I-022b (verified 8 Jun 2026 — the earlier "WIP to inherit from `wip/r2-shell-facets-preflight`" note was a misread of the dirty working tree, since corrected). R2's topbar scope is therefore narrower than originally implied: extend the existing role-aware topbar with the `<md` hamburger trigger that opens a `<MobileDrawer>`; do not rewrite the QUICK_LINKS structure.

## 3. Tier visibility contract (locked from R1)
| Device class | Width | Primary nav |
|---|---|---|
| Phone (`<md`) | 320–767 | `BottomTabBar` + hamburger → `MobileDrawer` containing the full sidebar slot list |
| Tablet (`md..<lg`) | 768–1023 | `SidebarRail` (icon-only) — one nav, no bottom-tab, no drawer |
| Desktop (`≥lg`) | 1024+ | Full `Sidebar` (current implementation, unchanged structurally) |

## 4. Deliverables

### 4.1 `app/(app)/layout.tsx`
- Render order on the authenticated shell:
  - `<Topbar role={role} moatTotal={moatTotal}/>` (now role-aware, see §4.2)
  - `<div className="flex flex-1 flex-col md:flex-row md:items-start">` — keep the `md:items-start` from I-022b (sticky aside depends on it).
  - `<aside>` containing **both** the existing full `<Sidebar>` (visibility `hidden lg:flex`) and the new `<SidebarRail>` (visibility `hidden md:flex lg:hidden`). The `<details>` mobile disclosure currently in `sidebar.tsx` is removed — replaced by the hamburger trigger in the topbar that opens a `<MobileDrawer>` containing the full sidebar slots.
  - `<main>` content.
  - `<BottomTabBar role={role}/>` rendered last so it stacks above main on phones (`md:hidden`). Pad `<main>` `pb-[72px] md:pb-0` so content doesn't hide behind the bar.

### 4.2 `components/shell/topbar.tsx` (extend the existing I-022 role-aware shape)
- HEAD already has `Topbar({role, moatTotal})` with the `QUICK_LINKS` map per role (buyer = Discover · Saved · RFQs · Messages · Compliance; supplier = Dashboard · RFQs · Messages · Profile; admin = Overview · Suppliers · Claims · Sanctions), the `topbar-moat` chip at `xl:inline-flex`, and the `<Link>` avatar. Do **not** rewrite that structure.
- Add **hamburger trigger** at `<md` that opens a `<MobileDrawer>` mounted from a small `'use client'` `<TopbarHamburger>` island. Drawer body = the full sidebar's nav slot list.
- Search form stays `md:flex max-w-md`.
- Avatar continues to shrink to 28 px at `<md`, 32 px at `≥md`.

### 4.3 `components/shell/sidebar.tsx`
- **Remove** the `<details className="proto-sidebar md:hidden">` mobile disclosure block. That role is now `<MobileDrawer>`.
- The desktop aside stays `hidden lg:flex` (was `md:flex` before — adjust by one tier so the tablet band hands off to `SidebarRail`).
- Export `BUYER_SECTIONS`, `SUPPLIER_SECTIONS`, `ADMIN_SECTIONS`, `variantFromPath`, `VARIANT_LABEL`, `SECTIONS`, `VARIANT_HREF` constants so `SidebarRail`, `BottomTabBar`, and `MobileDrawer` can consume them without re-declaring.

### 4.4 `components/marketing/top-nav.tsx`
- Add a hamburger trigger at `<md` that opens a `<MobileDrawer>` containing the marketing nav links.
- **Preserve the I-033 session island.** The hamburger drawer must respect both anon and logged-in states without re-fetching `/api/session/me`. SSR + first client render emit the anon variant (matches static HTML); the `useEffect` swap continues to flip the right-hand link group only.

## 5. Smoke — `ops/_r2_smoke.py`
- Topbar exports the new role-aware nav (regex on the source file for `QUICK_LINKS` literal).
- `(app)/layout.tsx` mounts `BottomTabBar` + `SidebarRail` + `Sidebar` in the documented order.
- `sidebar.tsx` no longer contains the `<details className="proto-sidebar md:hidden">` block.
- Marketing top-nav imports `MobileDrawer`.
- Live page-level HTTP smoke against `https://sourcebd.net` for `/` (200), `/login` (200), `/app` (307 → /login), `/admin` (307 → /login), `/supplier` (307 → /login). Confirms middleware still gates server-side.
- `.next/routes-manifest.json` count == 64 (still unchanged — R2 adds no routes).
- Forbidden-token scan of every touched file — diff `[]`.

## 6. Validation
- typecheck / lint / build clean.
- Manual QA at xs / sm / md / lg / xl on every authenticated surface — one nav visible per class, no overlap.

## 7. Out of scope (deferred to R4/R5/R6)
- Per-surface page bodies (discover grid, supplier profile, RFQ inbox, etc.). R2 is shell only.
