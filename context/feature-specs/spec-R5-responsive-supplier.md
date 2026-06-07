# Spec R5 — Responsive supplier (`/supplier/*`)

> Every supplier-portal surface, all `force-dynamic` (except `/supplier/documents` placeholder). Depends on R2.

## 1. Scope
- `/supplier` (dashboard)
- `/supplier/claim`, `/supplier/claim/[id]`, `/supplier/claim/verify` (S1)
- `/supplier/profile`, `/supplier/profile/[id]` (S2 editor)
- `/supplier/documents` (`force-static` placeholder)
- `/supplier/rfqs`, `/supplier/rfqs/[id]`
- `/supplier/messages`, `/supplier/messages/[thread]`
- `/supplier/partners`

## 2. Dependencies
- R1 + R2 merged.

## 3. Per-route responsive intents
- **Dashboard**: claimed companies + pending claims as responsive cards (1-col → 2-col → 3-col). Quick CTA to claim flow.
- **Claim flow (S1)**: rewritten on `<Wizard>` (steps: search → initiate → verify) + `<StickyActionBar>`. Verify-token input full-width, 16 px from R1 baseline. Email magic-link path keeps the F3 server actions.
- **Profile editor (S2)**: `<FormGrid cols="profile">` for the 10-key allow-list. **S2's `supplier_profile_upsert` RPC + the sibling-column write semantics are untouched** — R5 is presentation-only. `<StickyActionBar>` for save. The register-locked keys (RJSC / BIN / EPB ref / etc.) remain visibly read-only inputs.
- **Documents** placeholder: stays `force-static`. Cosmetic only.
- **RFQs**: supplier inbox → `ResponsiveTable mode="stacked"`; detail page → `MasterDetail` + supplier quote-submit form on `<FormGrid>`.
- **Messages**: identical pattern to R4 buyer messaging. Composer pinned above keyboard. Realtime island unchanged.
- **Partners**: partner-factory list → `ResponsiveTable mode="priority"` (keep partner-factory name + tier; expand for the rest).

## 4. Hard constraints
- S2 `supplier_profile_upsert` allow-list (10 keys) untouched. No new fields. Register PII never overwritten.
- B6 Realtime island unchanged.
- All routes stay `force-dynamic` except `/supplier/documents`.

## 5. Smoke + validation
- `ops/_r5_smoke.py`: every route still `force-dynamic`; S2 form still posts to `/api/v1/supplier/profile` (regression); `ResponsiveTable` imports present.
- Manual QA at xs/sm/md/lg/xl. File-picker step on `/supplier/claim/[id]` opens native mobile picker.
