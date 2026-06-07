// Spec M2 — Pricing plans (shared source of truth).
//
// Single source for the three plan tiers. Identifiers (`starter` / `growth`
// / `enterprise`) MUST match the `profiles.plan_tier` CHECK constraint
// shipped in migration 0031 (B10). Display labels mirror
// `/app/settings/plan`.
//
// Both `/pricing` (M2) and `/app/settings/plan` (B10) import from this
// module. The M2 smoke asserts both files import `PLANS` from here so the
// matrix cannot drift.
//
// `<!-- launch marker: price -->` HTML comments wrap every placeholder
// figure in the rendered page so the smoke can assert markers are still
// present (forces a deliberate pre-launch swap).

export type PlanKey = "starter" | "growth" | "enterprise";

export type CtaTarget =
  | { kind: "signup"; plan: PlanKey }
  | { kind: "mailto"; email: string; subject: string };

export type PricingPlan = {
  key: PlanKey;
  label: string;
  tagline: string;
  priceHeadline: string; // wrapped server-side with launch marker
  priceSubline: string;
  trialNote: string | null;
  ctaLabel: string;
  ctaTarget: CtaTarget;
  features: string[];
};

export const PLANS: PricingPlan[] = [
  {
    key: "starter",
    label: "Starter",
    tagline: "For buyers evaluating Bangladesh suppliers for the first time.",
    priceHeadline: "Free",
    priceSubline: "No card required.",
    trialNote: null,
    ctaLabel: "Start free",
    ctaTarget: { kind: "signup", plan: "starter" },
    features: [
      "Discover up to 50 suppliers per month",
      "Saved-supplier dashboard",
      "Compliance Hub (UFLPA + MSA generator)",
      "Source-pill provenance on every supplier",
    ],
  },
  {
    key: "growth",
    label: "Growth",
    tagline: "For active sourcing teams placing repeat orders.",
    priceHeadline: "£149 / month",
    priceSubline: "Pay annually, save 2 months (available with billing).",
    trialNote: "14-day free trial. Downgrades to Starter after.",
    ctaLabel: "Start 14-day trial",
    ctaTarget: { kind: "signup", plan: "growth" },
    features: [
      "Unlimited Discover",
      "Smart Match wizard",
      "RFQs + order tracking",
      "Contact reveal on verified suppliers",
      "Email digests + saved-supplier alerts",
    ],
  },
  {
    key: "enterprise",
    label: "Enterprise",
    tagline: "For programmes with multiple buyers and audit obligations.",
    priceHeadline: "From £499 / month",
    priceSubline: "Custom pricing based on seats and integration scope.",
    trialNote: null,
    ctaLabel: "Contact sales",
    ctaTarget: {
      kind: "mailto",
      email: "sales@sourcebd.net",
      subject: "SourceBD Enterprise enquiry",
    },
    features: [
      "Everything in Growth",
      "Team seats + role-based access",
      "API access + bulk export",
      "Dedicated compliance review",
      "Priority support + onboarding",
    ],
  },
];

export type ComparisonRow = {
  feature: string;
  starter: string | boolean;
  growth: string | boolean;
  enterprise: string | boolean;
};

export const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: "Discover supplier views per month", starter: "50", growth: "Unlimited", enterprise: "Unlimited" },
  { feature: "Saved-supplier dashboard", starter: true, growth: true, enterprise: true },
  { feature: "Source-pill provenance", starter: true, growth: true, enterprise: true },
  { feature: "Compliance Hub (UFLPA + MSA)", starter: true, growth: true, enterprise: true },
  { feature: "Smart Match wizard", starter: false, growth: true, enterprise: true },
  { feature: "Contact reveal on verified suppliers", starter: false, growth: true, enterprise: true },
  { feature: "RFQs + quote management", starter: false, growth: true, enterprise: true },
  { feature: "Order tracking + milestones", starter: false, growth: true, enterprise: true },
  { feature: "Email digests + saved-supplier alerts", starter: false, growth: true, enterprise: true },
  { feature: "Team seats + role-based access", starter: false, growth: false, enterprise: true },
  { feature: "API access + bulk export", starter: false, growth: false, enterprise: true },
  { feature: "Dedicated compliance review", starter: false, growth: false, enterprise: true },
];

export type FaqEntry = { q: string; a: string };

export const PRICING_FAQS: FaqEntry[] = [
  {
    q: "What is the difference between Starter and Growth?",
    a: "Starter is free forever and capped at 50 supplier views per month with no contact reveal. Growth unlocks unlimited Discover, the Smart Match wizard, RFQs, order tracking, and contact reveal on verified suppliers. Most teams placing more than two orders a quarter end up on Growth.",
  },
  {
    q: "How does the 14-day Growth trial work?",
    a: "You enter card details when you start the trial. On day 15 we charge the first month at the published price, unless you cancel first — cancelling at any point during the trial downgrades you to the free Starter plan with no charge.",
  },
  {
    q: "What happens if I exceed my Starter supplier-view limit?",
    a: "We do not lock you out of saved suppliers or the Compliance Hub. New Discover queries pause for the remainder of the calendar month, with a prompt to start a Growth trial. Counts reset on the first day of the next month.",
  },
  {
    q: "Is my data exported if I cancel?",
    a: "Yes. From Settings you can export your saved suppliers, RFQs, and order history at any time as CSV. Cancellation does not delete that history immediately — your account is read-only for 30 days so the export is always reachable.",
  },
  {
    q: "Where is my data stored?",
    a: "Operational data is stored in Supabase's Singapore region (project ref `stnrfxrxfonwexzcvvpv`). Compliance documents mirrored on your behalf are stored on Bunny CDN. We retain UK GDPR posture for buyer accounts; the ICO registration and GDPR Representative appointment are tracked as launch deliverables.",
  },
  {
    q: "Do you charge per seat?",
    a: "Starter and Growth are single-seat. Enterprise pricing scales with the number of seats and includes role-based access (buyer / supplier-admin / compliance reviewer) — contact sales for a quote.",
  },
  {
    q: "What is \u201cContact reveal\u201d?",
    a: "On Growth and above, the verified contact name, email, and phone published by a supplier on a Tier-1 or Tier-2 register (BGMEA, BKMEA, EPB, RSC, BTMA, BGAPMEA) becomes visible on the supplier profile. On Starter the field is blurred — you can see that contact data exists and is source-verified, but not the value itself.",
  },
];
