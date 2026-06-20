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
// Pricing is intentionally post-beta. The public page can compare future
// capability tiers, but must not imply live checkout, paid access, or a
// trial during the free public beta.

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
    tagline: "For every beta buyer evaluating Bangladesh suppliers.",
    priceHeadline: "Free",
    priceSubline: "Public beta. No card required.",
    trialNote: null,
    ctaLabel: "Start free",
    ctaTarget: { kind: "signup", plan: "starter" },
    features: [
      "Search the verified supplier index",
      "Saved-supplier dashboard",
      "Compliance Hub (UFLPA + MSA generator)",
      "Source-pill provenance on every supplier",
    ],
  },
  {
    key: "growth",
    label: "Growth",
    tagline: "Future tier for active sourcing teams placing repeat orders.",
    priceHeadline: "Post-beta",
    priceSubline: "Pricing opens after usage signals justify monetisation.",
    trialNote: "Available after the free beta. No checkout today.",
    ctaLabel: "Join free beta",
    ctaTarget: { kind: "signup", plan: "starter" },
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
    tagline: "Future programme support for multi-buyer sourcing teams.",
    priceHeadline: "Talk to us",
    priceSubline: "Enterprise terms are scoped after the beta evidence is real.",
    trialNote: null,
    ctaLabel: "Contact sales",
    ctaTarget: {
      kind: "mailto",
      email: "sales@sourcebd.net",
      subject: "SourceBD Enterprise enquiry",
    },
    features: [
      "Everything in the future Growth tier",
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
  { feature: "Discover supplier views during beta", starter: "Open beta", growth: "Future", enterprise: "Future" },
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
    a: "During the public beta, everyone uses the free Starter experience. Growth describes the future paid capability set we expect active sourcing teams to need after beta usage proves the right limits and workflows.",
  },
  {
    q: "Can I pay for Growth today?",
    a: "No. SourceBD is running as a free public beta. Stripe checkout, paid tiers, billing portal, and plan enforcement are deferred until product-market signals justify monetisation.",
  },
  {
    q: "Will beta access suddenly become paid?",
    a: "No. The beta remains free while SourceBD validates buyer workflows and data quality. Any paid conversion path will ship as a separate announced rollout with pricing, terms, and billing controls visible before purchase.",
  },
  {
    q: "Is my data exported if I cancel?",
    a: "Export workflows are planned for paid programme operations. During beta, saved suppliers, RFQs, messages, and orders remain available inside your account while the platform is live.",
  },
  {
    q: "Where is my data stored?",
    a: "Operational data is stored in Supabase's Singapore region (project ref `stnrfxrxfonwexzcvvpv`). Compliance documents mirrored on your behalf are stored on Bunny CDN. We retain UK GDPR posture for buyer accounts; the ICO registration and GDPR Representative appointment are tracked as launch deliverables.",
  },
  {
    q: "Do you charge per seat?",
    a: "Not during beta. Team seats are part of the future Enterprise programme design and will be scoped after real usage shows how sourcing, compliance, and operations teams share work.",
  },
  {
    q: "What is \u201cContact reveal\u201d?",
    a: "Contact reveal means showing verified supplier contact details only after the server confirms the caller is entitled to see them. The beta keeps this posture strict: the UI never hides contact data that the server already sent by mistake.",
  },
];
