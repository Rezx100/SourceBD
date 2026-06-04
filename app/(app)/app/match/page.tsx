// /app/match \u2014 Spec B4 Smart Match wizard (Phase 2 buyer surface).
//
// Server component shell. The 3-step wizard form holds local state across
// steps and POSTs to /api/v1/match, so it ships as a client island in
// `./smart-match-wizard.tsx`. This page only renders the page header and
// mounts the wizard.

import { Sparkle } from "@phosphor-icons/react/dist/ssr";

import { SmartMatchWizard } from "./smart-match-wizard";

export const metadata = {
  title: "Find matches · SourceBD",
  description:
    "Describe your product and requirements; SourceBD ranks verified Bangladesh suppliers with the receipts behind each match.",
};

export default function SmartMatchPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary">
          <Sparkle size={12} weight="fill" className="text-brand-forest" />
          Find matches
        </p>
        <h1 className="font-display text-3xl font-light tracking-tight text-ink-primary">
          Tell us what you need
        </h1>
        <p className="affiliation-disclaimer">
          Three steps: product, requirements, ranked matches. Every match shows
          the verified receipts that satisfied your brief \u2014 BGMEA registry,
          WRAP / GOTS / OEKO-TEX / SA8000 certificates, RSC remediation
          progress, sewing-machine capacity.
        </p>
      </header>
      <SmartMatchWizard />
    </div>
  );
}
