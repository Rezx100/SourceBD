// /app/match \u2014 Spec B4 Smart Match wizard (Phase 2 buyer surface).
//
// Server component shell. The 3-step wizard form holds local state across
// steps and POSTs to /api/v1/match, so it ships as a client island in
// `./smart-match-wizard.tsx`. This page only renders the page header and
// mounts the wizard.

import { Sparkle } from "@phosphor-icons/react/dist/ssr";

import { PageHeader } from "@/components/ui/page-kit";
import { SmartMatchWizard } from "./smart-match-wizard";

export const metadata = {
  title: "Find matches · SourceBD",
  description:
    "Describe your product and requirements; SourceBD ranks verified Bangladesh suppliers with the receipts behind each match.",
};

export default function SmartMatchPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        kicker="Find matches"
        icon={<Sparkle size={20} weight="fill" aria-hidden />}
        title="Tell us what you need"
        description="Three steps: product, requirements, ranked matches. Every match shows the verified receipts that satisfied your brief — BGMEA registry, WRAP / GOTS / OEKO-TEX / SA8000 certificates, RSC remediation progress, sewing-machine capacity."
      />
      <SmartMatchWizard />
    </div>
  );
}
