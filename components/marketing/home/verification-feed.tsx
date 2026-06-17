"use client";

// Live verification feed — AnimatedList.
//
// A rolling feed of the kind of provenance events the platform records:
// a new register match, a certificate verified, a sanctions screen passed,
// a brand disclosure attached. Each row is a "receipt" — issuer, action,
// timestamp — reinforcing the receipts-first doctrine in motion.

import {
  Buildings,
  Certificate,
  FileText,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

import { AnimatedList } from "@/components/ui/animated-list";

type Event = {
  issuer: string;
  action: string;
  tier: string;
  icon: React.ReactNode;
  tint: string;
};

const EVENTS: Event[] = [
  {
    issuer: "RSC",
    action: "Remediation progress verified — 98%",
    tier: "Government",
    icon: <ShieldCheck size={18} weight="fill" />,
    tint: "bg-[#ecf3ee] text-[#1f4d3a]",
  },
  {
    issuer: "OEKO-TEX",
    action: "STANDARD 100 certificate confirmed",
    tier: "Certification",
    icon: <Certificate size={18} weight="fill" />,
    tint: "bg-[#dcf0f1] text-[#0e7c86]",
  },
  {
    issuer: "BGMEA",
    action: "Membership register match",
    tier: "Association",
    icon: <Buildings size={18} weight="fill" />,
    tint: "bg-[#deede3] text-[#19543a]",
  },
  {
    issuer: "UFLPA / OFAC",
    action: "Sanctions screen passed — no hit",
    tier: "Sanctions",
    icon: <Warning size={18} weight="fill" />,
    tint: "bg-[#f6e1df] text-[#a22b25]",
  },
  {
    issuer: "DIFE",
    action: "Fire & building inspection mirrored",
    tier: "Government",
    icon: <FileText size={18} weight="fill" />,
    tint: "bg-[#ecf3ee] text-[#1f4d3a]",
  },
  {
    issuer: "WRAP",
    action: "Gold certification verified",
    tier: "Certification",
    icon: <Certificate size={18} weight="fill" />,
    tint: "bg-[#dcf0f1] text-[#0e7c86]",
  },
];

function Row({ issuer, action, tier, icon, tint }: Event) {
  return (
    <figure className="relative mx-auto w-full max-w-[480px] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(16,40,28,0.25)]">
      <div className="flex items-center gap-3.5">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tint}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-[family-name:var(--mkt-font-display)] text-[15px] font-semibold text-neutral-900">
              {issuer}
            </span>
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 font-[family-name:var(--mkt-font-mono)] text-[10px] uppercase tracking-wide text-neutral-500">
              {tier}
            </span>
          </div>
          <p className="truncate text-[13px] text-neutral-500">{action}</p>
        </div>
      </div>
    </figure>
  );
}

export function VerificationFeed() {
  return (
    <div className="relative flex h-[392px] w-full flex-col overflow-hidden">
      <AnimatedList delay={1800} maxItems={4}>
        {EVENTS.map((e, i) => (
          <Row key={i} {...e} />
        ))}
      </AnimatedList>
      {/* fade top + bottom into the neutral-50 section background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-neutral-50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-neutral-50 via-neutral-50/80 to-transparent" />
    </div>
  );
}