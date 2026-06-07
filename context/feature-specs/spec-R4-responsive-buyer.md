# Spec R4 — Responsive buyer (`/app/*`)

> Every buyer surface, all `force-dynamic`. Depends on R2 (needs the new shell).

## 1. Scope (routes)
- `/app` (dashboard, B5)
- `/app/discover` (buyer Discover — `force-dynamic`, per-user saved-set overlay, never cached)
- `/app/suppliers/[slug]` (buyer profile)
- `/app/match` (Smart-Match wizard, B4, 3 steps)
- `/app/saved` (B5)
- `/app/rfqs`, `/app/rfqs/new`, `/app/rfqs/[id]` (B7)
- `/app/orders`, `/app/orders/new`, `/app/orders/[id]` (B8 manual v1)
- `/app/messages`, `/app/messages/[thread]` (B6 — Realtime island, encrypted threads)
- `/app/compliance`, `/app/compliance/expiry`, `/app/compliance/msa`, `/app/compliance/uflpa` (B9)
- `/app/settings`, `/app/settings/profile`, `/app/settings/notifications`, `/app/settings/plan` (B10)

## 2. Dependencies
- R1 + R2 merged.

## 3. Per-route responsive intents
- **Dashboard**: stat tile grid 5-col → 2-col → 1-col. Activity feed full-width on phone.
- **Buyer Discover**: shares R1 `FilterRailResponsive`. `SaveButton` on each result card promoted to a first-class 44 px tap target (icon → labelled pill on `<sm`).
- **Buyer profile**: full reflow + a sticky mobile action bar (`StickyActionBar`) containing Save, Request Quote, Message. Header dossier reflow already from I-028.
- **Smart-Match wizard**: rewritten on R1 `<Wizard>` + `<StickyActionBar>`. Step progress: full stepper desktop, compact "Step N of 3" + segmented bar mobile. Validation errors scroll into view.
- **Saved**: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3. Star/unsave is 44 px tap.
- **RFQs / Orders**: list pages get `ResponsiveTable mode="stacked"`. Detail pages use `<MasterDetail>` (desktop side-by-side; phone single pane with back). Compose forms use `<FormGrid cols={1|2}>` + `<StickyActionBar>`.
- **Messages**: list → `MasterDetail` list pane. Thread page keeps the B6 Realtime island untouched; wraps it in a `MasterDetail` detail pane. **Composer pinned above keyboard/inset** via `.safe-pb` + `position: sticky; bottom: 0`. Encrypted message bodies wrap; `body_ciphertext` still revoke-grant-protected at the SELECT layer.
- **Compliance hub**: tiles + sub-pages. `/expiry` and `/uflpa` tables (current `<table>` with `overflow-x-auto`) convert to `ResponsiveTable mode="stacked"`. MSA generator form sticky-submits via `<StickyActionBar>`.
- **Settings**: `<FormGrid>` standardisation. Plan tab cosmetic (Stripe deferred).

## 4. Hard constraints
- B6 Realtime island unchanged. `thread_messages` RPC decrypt path untouched. `body_ciphertext` SELECT grant unchanged.
- S2 register-PII allow-list is not affected (S2 is `/supplier/*`, handled in R5).
- All caching directives stay `force-dynamic`.

## 5. Smoke + validation
- `ops/_r4_smoke.py`: every route still `force-dynamic`; `thread-realtime.tsx` unchanged; `ResponsiveTable` import present on every touched list page; route count 64 unchanged.
- Manual QA: messages composer above iOS keyboard at 390×844 and 844×390 landscape.
