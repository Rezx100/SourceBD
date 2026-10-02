# Onboarding data map (S7, 3 Oct 2026)

Each answer the v4 onboarding collects and where it lands (read from `supabase/migrations`).
"NEW" = needs a migration; the founder applies it (rule 15). None is written in this run.
Interim, no migration: `profiles.onboarding_state` (jsonb, 0047) through `profile_onboarding_set(key, value)`.

## Buyer

| Step | Answer | Lands in |
| --- | --- | --- |
| 1 Sign up | work email, password, magic link | Supabase Auth (`auth.users`) |
| 1 | terms accepted (in words, no box) | NEW `profiles.terms_accepted_at`, `terms_version` |
| 2 Verify | code or link, changed email | `auth.users.email_confirmed_at`, `auth.users.email` |
| 3 About you | name | `profiles.display_name` (0031) |
| 3 | work role (Sourcing, Compliance, Merchandising, Founder or owner, Other) | NEW `profiles.job_role` (not `profiles.role`, the buyer/supplier/admin enum) |
| 4 Company | name | `buyer_settings.company_name` (0106) |
| 4 | type: brand, retailer, importer, agent, other | `buyer_settings.company_type` (0106, same five values) |
| 4 | people: 1–10 … 1000+ | `buyer_settings.employee_count` (0106, same five bands) |
| 4 | country | NEW `buyer_settings.company_country` |
| 5 What you source | HS headings | NEW `buyer_settings.sourcing_hs_headings text[]` |
| 5 | required certificates | NEW `buyer_settings.required_cert_kinds text[]` |
| 5 | markets: UK, EU, US, Canada | NEW `buyer_settings.sell_markets text[]`. `customer_base` (0106) stays the free-text Settings field |
| 5 | the search itself | `saved_searches` row (0104: `name`, `query_state`, `last_count`) |
| 6 First results | coach mark seen | `onboarding_state.coach_source_seen` |
| 7 Checklist | dismissed | `onboarding_state.checklist_dismissed_at` |
| 7 | save 3 suppliers | count of `saved_suppliers` (0026) |
| 7 | check a source | `onboarding_state.source_checked_at` |
| 7 | first RFQ | `rfqs` (0028) exists for the user |
| 7 | certificate alerts | `buyer_settings.notify_saved_alerts` (0031) |
| 7 | RFQ template | `buyer_settings.inquiry_questions`, `inquiry_email_template` (0106) |
| 8 Invite | email, role per invite (Approver, Editor, Viewer) | NEW tables `workspaces`, `workspace_members`, `workspace_invites`. Buyer rows are per user (`owner_id`) today: the largest change |
| 9 Invited user | name, password | Auth + `profiles.display_name` |
| 10 | joins, sees shared saved list | NEW `workspace_members` row; saved lists read by workspace |

## Supplier

| Step | Answer | Lands in |
| --- | --- | --- |
| Find your company | chosen supplier | `claim_requests.supplier_id`, `claimant_user_id` (0032) |
| Verify by email | company address | `claim_requests.proof_email`, `proof_email_domain`, `method = domain_email`, token hash and expiry (0032) |
| Verify by document | trade licence or BGMEA certificate | `method = manual_review` exists; NEW `claim_requests.document_path`, `document_kind` |
| Pending, approved, rejected | status, reviewer note | `claim_requests.status`, `decision_note`; `suppliers.claimed_by` |
| Someone at the domain already claimed | ask to be added | NEW (needs supplier-side membership) |
| Company not listed | "Tell us" request | NEW (`claim_requests.supplier_id` is not null) |
| Edit profile | tagline, about, MOQ, lead time, contact, capabilities | `suppliers.supplier_tagline`, `supplier_about`, `supplier_moq`, `supplier_lead_time_days`, `supplier_contact_*`, `supplier_capabilities` |
| Edit profile | MOQ unit, product photos | NEW |
| Answer RFQs | price, MOQ, lead time, valid until, message | `rfq_quotes` (0028: `unit_price`, `currency`, `moq`, `lead_time_days`, `valid_until`, `notes`, `status`) |

## Migration order (founder)

1. Additive, nullable: `profiles` job_role, terms_accepted_at, terms_version; `buyer_settings` company_country, sourcing_hs_headings, required_cert_kinds, sell_markets.
2. `claim_requests.document_path`, `document_kind`.
3. Workspaces and invites: own spec, new RLS on every buyer table.
