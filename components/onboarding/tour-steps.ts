// Spec H5 — Onboarding tour step content.
//
// Pure data module shared by buyer + supplier flavours. Step shape is
// intentionally narrow: title, body, CTA href + label. The tour renders as a
// route-independent modal/sheet (see `tour.tsx`) — the CTA link is the
// "Take me there" affordance so the user can deep-link into the surface the
// step describes without losing the rest of the tour.

export type TourStep = {
  id: string;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string;
};

export const BUYER_STEPS: ReadonlyArray<TourStep> = [
  {
    id: "dashboard",
    title: "Dashboard at a glance",
    body: "Saved suppliers, active RFQs, compliance alerts, and recent activity — all in one place. This is your home base when you sign in.",
    cta_label: "Open dashboard",
    cta_href: "/app",
  },
  {
    id: "discover",
    title: "Discover verified suppliers",
    body: "Filter by certification, register, RSC remediation, city, and category. Every result card carries a Receipts Ring showing how many independent Tier 1–3 sources verified that supplier.",
    cta_label: "Open Discover",
    cta_href: "/app/discover",
  },
  {
    id: "saved",
    title: "Build your shortlist",
    body: "Star a supplier on any card or profile to add it to Saved suppliers. Your shortlist is the launching pad for RFQs and outreach.",
    cta_label: "Open Saved",
    cta_href: "/app/saved",
  },
  {
    id: "rfq",
    title: "Send your first RFQ",
    body: "Compose one RFQ and target up to 50 suppliers from your shortlist. Each target gets a private encrypted thread you can manage from Messages.",
    cta_label: "Open RFQs",
    cta_href: "/app/rfqs",
  },
  {
    id: "messages",
    title: "Encrypted messaging",
    body: "Every RFQ thread is end-to-end stored encrypted at rest. Replies arrive in real time and stay scoped to participants only.",
    cta_label: "Open Messages",
    cta_href: "/app/messages",
  },
];

export const SUPPLIER_STEPS: ReadonlyArray<TourStep> = [
  {
    id: "dashboard",
    title: "Your supplier portal",
    body: "Claimed companies and pending claim requests live here. Once a claim is approved you can edit the public profile and respond to RFQs.",
    cta_label: "Open portal",
    cta_href: "/supplier",
  },
  {
    id: "profile",
    title: "Edit your company profile",
    body: "Buyer-facing fields like capabilities, capacity, and certifications are editable per claimed company. Register-sourced fields (BGMEA / BKMEA / RSC) stay locked to the authoritative tier.",
    cta_label: "Open profile editor",
    cta_href: "/supplier/profile",
  },
  {
    id: "inquiries",
    title: "Inbound messages",
    body: "Buyer messages that aren't tied to a specific RFQ show up under Messages. Replies are server-side decrypted under your session.",
    cta_label: "Open Messages",
    cta_href: "/supplier/messages",
  },
  {
    id: "rfqs",
    title: "RFQs received",
    body: "When a buyer targets one of your claimed companies, the RFQ appears here. Submit a quote (unit price, lead time, MOQ, validity) and the buyer can accept or reject in one click.",
    cta_label: "Open RFQs received",
    cta_href: "/supplier/rfqs",
  },
  {
    id: "messages",
    title: "Stay in the thread",
    body: "Every accepted RFQ becomes a long-running thread with the buyer. Use it for samples, revisions, and order coordination.",
    cta_label: "Open Messages",
    cta_href: "/supplier/messages",
  },
];
