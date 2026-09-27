# Product

<!-- impeccable:product-schema 1 -->

Drawn from the founder's own records (`AGENTS.md`, `context/agent-brief.md`,
`context/feature-specs/ds-rebuild-must-stay.md` §2) on 27 Sep 2026. Those files
stay the authority; this is the short version for design work.

## Platform

web

## Users

Sourcing and compliance people at clothing brands and retailers in the UK, US,
EU and Canada. They are at a desk, shortlisting Bangladesh factories and buying
houses, checking each one's registers, certificates and safety record, then
sending an RFQ. Secondary: Bangladeshi suppliers claiming and editing their own
record, and SourceBD admins.

## Product Purpose

Let a buyer find, vet, save and message verified Bangladesh RMG suppliers
without trusting anyone's opinion: every fact on a supplier is a receipt from a
named public source. Success is a buyer who shortlists and sends an RFQ in one
sitting and can show their compliance team where each fact came from.

## Positioning

Receipts, not opinions. Facts come from government registers, industry bodies
(BGMEA, BKMEA, BTMA, BGAPMEA), certification bodies, brand disclosures and
foreign regulators, ranked in that order. SourceBD never scores, grades or rates
a supplier.

## Operating Context

Search with filters, open a supplier record beside the results, save to a list,
send an RFQ to one or up to 50 suppliers, follow replies in Messages, track
orders, watch certificate expiry and sanction flags in the Compliance hub.

## Capabilities and Constraints

- Server enforces auth, role and ownership; hiding UI is never a control.
- Contact details (email, phones, contact name and role) are locked unless the
  server returns them. The locked state is a real state, not a blur.
- A sanctioned supplier carries a red warning on every surface, and Send RFQ is
  refused.
- No SourceBD score, grade, rating or star outside admin.
- Every fact has room for its source mark and a link to the source page.
- No new packages. Tailwind utilities, the dashboard kit under
  `components/dashboard/*`, tokens in `lib/design/tokens.ts`.
- Third-party logos follow `context/logos.lock.md`.

## Brand Commitments

Name SourceBD. Brand green is fixed. One type family (Geist). Plain, calm voice:
state the fact and where it came from.

## Evidence on Hand

Live production data: about 10,900 companies, 10,266 published. Real records
for testing are listed in `ds-rebuild-must-stay.md` §3. No testimonials, customer
logos or benchmarks exist; none may be invented.

## Product Principles

1. Every fact shows its source.
2. Nothing fake: real records or nothing.
3. Locked, empty, stale and sanctioned are normal states, designed as such.
4. The buyer never loses their search: records open beside the results.

## Accessibility & Inclusion

WCAG 2.2 AA; contrast pairs are tested in `lib/design/tokens.ts`. Works with
reduced motion and at 320px.
