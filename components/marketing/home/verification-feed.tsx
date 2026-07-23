"use client";

// Live verification feed — a calm, continuous vertical Marquee.
//
// A rolling feed of the kind of provenance events the platform records:
// a new register match, a certificate verified, a sanctions screen passed,
// a brand disclosure attached. Each row is verified evidence — issuer, action,
// tier. A seamless vertical Marquee scrolls them upward forever (no
// enter/exit layout animation, so it never stutters or ping-pongs); the
// top and bottom fade into the section background.

import {
  Buildings,
  Certificate,
  FileText,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

import { Marquee } from "@/components/ui/marquee";
import { cn } from "@/lib/utils";

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
    tint: "bg-brand-forest-soft text-brand-forest",
  },
  {
    issuer: "OEKO-TEX",
    action: "STANDARD 100 certificate confirmed",
    tier: "Certification",
    icon: <Certificate size={18} weight="fill" />,
    tint: "bg-cyan-50 text-cyan-700",
  },
  {
    issuer: "BGMEA",
    action: "Membership register match",
    tier: "Association",
    icon: <Buildings size={18} weight="fill" />,
    tint: "bg-emerald-50 text-emerald-800",
  },
  {
    issuer: "UFLPA / OFAC",
    action: "Sanctions screen passed — no hit",
    tier: "Sanctions",
    icon: <Warning size={18} weight="fill" />,
    tint: "bg-red-50 text-red-700",
  },
  {
    issuer: "DIFE",
    action: "Fire & building inspection mirrored",
    tier: "Government",
    icon: <FileText size={18} weight="fill" />,
    tint: "bg-brand-forest-soft text-brand-forest",
  },
  {
    issuer: "WRAP",
    action: "Gold certification verified",
    tier: "Certification",
    icon: <Certificate size={18} weight="fill" />,
    tint: "bg-cyan-50 text-cyan-700",
  },
];

function Row({ issuer, action, tier, icon, tint }: Event) {
  return (
    <figure className="relative w-full overflow-hidden rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3.5">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tint}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[16px] font-semibold text-neutral-900">
              {issuer}
            </span>
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[12px] uppercase tracking-wide text-neutral-500">
              {tier}
            </span>
          </div>
          <p className="truncate text-[14px] text-neutral-500">{action}</p>
        </div>
      </div>
    </figure>
  );
}

export function VerificationFeed({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate mx-auto flex h-[322px] w-full max-w-[480px] flex-col overflow-hidden [contain:layout_paint] sm:h-[392px]",
        className,
      )}
    >
      <Marquee
        vertical
        className="[--duration:28s] [--gap:0.875rem] py-0 sm:[--gap:1rem]"
      >
        {EVENTS.map((e, i) => (
          <Row key={i} {...e} />
        ))}
      </Marquee>
      {/* fade top + bottom into the neutral-50 section background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-neutral-50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-neutral-50 to-transparent" />
    </div>
  );
}