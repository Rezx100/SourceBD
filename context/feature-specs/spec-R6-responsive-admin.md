# Spec R6 — Responsive admin (`/admin/*`)

> Table-heavy surfaces. Highest risk for the mobile contract. Depends on R2.

## 1. Scope
- `/admin` (dashboard)
- `/admin/suppliers`, `/admin/suppliers/[id]`, `/admin/suppliers/import`
- `/admin/users`, `/admin/users/[id]` (A5)
- `/admin/certifications` (A3 queue)
- `/admin/sanctions` (A4 queue)
- `/admin/claims` (stub)
- `/admin/audit-log`, `/admin/audit-log/[id]`

## 2. Dependencies
- R1 + R2 merged.

## 3. Per-route responsive intents
- **Dashboard**: data-moat metric grid responsive. Sparkline SVGs `viewBox`-fluid.
- **Suppliers list**: filter form `<FormGrid cols={4}>` (already mostly correct). List converts from `<ul divide-y>` to `<ResponsiveTable mode="priority">` — keep company name + entity_type + published + sanctioned visible; expand for tier coverage / SBI / updated_at / claim status / pending-rescore.
- **Suppliers editor**: heavy multi-section form → `<FormGrid>` + `<StickyActionBar>` for Save / Publish / Sanction-decide. `<pre>` JSON dumps keep `overflow-x-auto` (mono code is acceptable swipe content).
- **Import preview** (`/admin/suppliers/import`): the wide preview grid is the ONE legitimate use of `<ResponsiveTable mode="swipe">` — horizontal scroll + sticky first column (slug or row #) + edge-fade affordance. Error rows surface inline below each previewed row.
- **Users / Certifications / Sanctions / Claims queues**: `<ResponsiveTable mode="stacked">`. **Approve / Reject become unmistakable 44×44 buttons in a `<Sheet>` row-action menu**, not inline text links.
- **Audit log**: long metadata rows → `ResponsiveTable mode="stacked"`; row → tap → detail.

## 4. Hard constraints
- Admin role gate stays server-side in middleware.
- `revalidateTag(TAG_DISCOVER_FACETS / TAG_DISCOVER_SUPPLIERS / tagSupplier(slug))` calls in the five admin route handlers untouched.
- All `force-dynamic`.

## 5. Smoke + validation
- `ops/_r6_smoke.py`: every list route imports `ResponsiveTable`; `/admin/suppliers/import` uses `mode="swipe"`; queue decision buttons render at 44×44 (CSS class check). Route count 64 unchanged.
- Manual QA at xs/sm/md/lg/xl on every admin surface. Decision buttons reachable with a thumb on a 390 phone.
