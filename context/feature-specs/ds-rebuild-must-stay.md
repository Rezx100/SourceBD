# Design rebuild — the "must stay" list

Status: draft for founder approval. No code until approved.
Written from product rules and the database only. No old design file was opened for this list.

## 1. Rules of the rebuild

- The old design is deleted, not adapted. Nothing from it is kept "because it worked".
- The builder may not open: `app/globals.css`, `tailwind.config.ts`, `components/ui/*`, `context/frontend-design-spec.md`, `context/design-brief-phase1.md`, `ops/design-mockups/`, `ops/visual/`.
- Those files move to `context/archive/` on day one of the build so nobody reads them by accident.
- Built on its own branch. One switch at the end. Old and new never run together.
- Every page on all four surfaces is rebuilt. No page keeps old styling.
- One spec. Clean working tree at start. Founder approves each gate.

## 2. Fixed by the product (never changes)

- Buyers see receipts, not opinions. Cert badges, register numbers, remediation %, named sources. Never a SourceBD score, grade, rating, or star.
- Admin is the only place the internal score may appear.
- A sanctioned supplier shows a red warning on every surface. That warning cannot be hidden by layout.
- Contact details (email, phone, contact name, role) are hidden unless the server allows them. The design must have a proper "locked" state, not a blur trick.
- Every fact can show where it came from. Each field needs room for a small source mark and a link.
- Sources have a rank: government first, then industry bodies, then cert bodies, then brand lists, then foreign regulators. The design must make that rank visible at a glance.
- No SourceBD trademark on third-party marks. Their logos stay as they are (`context/logos.lock.md` still applies).
- Nothing fake. Demos and animations use real records or nothing.
- No new packages. Allowed: Tailwind, shadcn/Radix pieces, Phosphor icons, the `motion` library (marketing and login pages only). Everything else is plain CSS or React.
- Tailwind classes only. No hand-typed colours anywhere except one token file.
- Works without animation when the user's device asks for that.

## 3. Real-world facts that set the sizes

- 10,922 companies live today. Lists must scroll and page well.
- Company names: median 34 characters, one in ten over 44, longest 125. Cards and headers must not break on long names. Test with the longest.
- Names carry suffixes like "(Extension)", "Unit-2", "Ltd". Do not truncate these away.
- 17 named sources today across five tiers. Room for more.
- Registries per company: up to about 8 marks in a row.
- Products per company: free text lists, sometimes 20+ items.
- Certifications: each has issuer, number, issue date, expiry date, document link.
- Facilities: a mother company can have many buildings. Each building has its own address, worker counts, and inspection status.
- RSC data: remediation %, progress %, training status, plus four inspection links (structural, fire, electrical, boiler).
- Addresses: several per company. Each has a map pin, a confidence level, and a "which building" label.
- Worker counts: total, male, female. Often missing — the empty state is as common as the filled one.
- Phones from 320px wide up. Test at 320, 360, 390, 414, 430.
- Readable for everyone: text contrast passes the standard check. Keyboard works everywhere.

## 4. What each surface must hold

### Marketing (no login)
Home, Discover (public, contacts locked), Compliance guides, Pricing, Status, Legal pages (privacy, terms, cookies, data sources, trademarks).
Must show: live supplier count, how verification works, the source tiers.

### Buyer app
Dashboard, Smart Match (3-step wizard with "why matched"), Discover with filters, Supplier profile, Saved, Messages, RFQs, Orders, Compliance Hub (expiry, MSA, UFLPA), Settings (profile, plan, notifications).
Profile tabs: Overview, Compliance, Capacity, Brands, Contact, Provenance, Locations, Facilities.

### Supplier portal
Dashboard, Claim profile (search, verify, status), Edit profile, Documents, Messages, RFQs, Partners.

### Admin
Dashboard, Suppliers (list, edit, import), Users, Claims, Certifications queue, Evidence queue, Review queue, Sanctions queue, Sources, Audit log, Beta, Feedback.
Admin is the only surface that may show the internal score and tier labels.

Shared: login, signup, forgot/reset password, suspended, not found, error.

## 5. States every piece must have

- Empty (no data yet) — very common.
- Locked (needs plan or login).
- Loading.
- Error.
- Sanctioned (red, cannot be missed).
- Unverified vs verified vs contradicted (for facts).
- Expired vs valid (for certs).

## 6. Checks before the switch

- Typecheck clean. All tests pass.
- No hand-typed colour outside the token file. A lint rule enforces this.
- Every page screenshot at 320 and 1280.
- Contrast check on every text colour pair.
- Longest real company name on every card type.
- A sanctioned supplier on every surface.
- A supplier with no data on every surface.

## 7. Questions for you

1. Dark mode: yes, no, or later?
2. Fonts: one family or two? Any you want or refuse?
3. Do the third-party source logos stay as images, or become text marks?
4. Do public Discover cards show product icons, or text only?
