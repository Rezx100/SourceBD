// Shared auth split-pane shell — light mode, Magic UI aligned.
//
// Server component. Renders a two-column enterprise auth layout:
//   • Left  — a light "brand / proof" panel (forest #1f4d3a signature
//             only) with an animated grid backdrop and a verified-evidence proof
//             card — the data moat made visible on the way in.
//   • Right — a clean white form panel; each page passes its own form
//             via `children` and its own headline copy via props.
//
// Mounted by `app/(auth)/layout.tsx` (which sets `data-surface="marketing"`
// + the Archivo / Hanken Grotesk / IBM Plex Mono font variables and the
// H2 `auth` rate-limit class). The Supabase server actions in
// `app/(auth)/actions.ts` continue to drive every form unchanged.

import Link from "next/link";

import { CheckCircle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { BrandMark } from "@/components/marketing/logo";

import { AuthGridBackdrop } from "./auth-grid-backdrop";

const DISPLAY = "font-[family-name:var(--mkt-font-display)]";

type ProofRow = {
  label: string;
  description: string;
  tone: "search" | "receipts" | "export";
};

const AUTH_WORKFLOW: ProofRow[] = [
  {
    label: "Search the verified register",
    description: "Filter factories and buying houses by location, certificates, and source coverage.",
    tone: "search",
  },
  {
    label: "Open the provenance trail",
    description: "Check the issuer, source URL, and last-seen date behind every visible claim.",
    tone: "receipts",
  },
  {
    label: "Keep evidence ready",
    description: "Save suppliers and use the compliance hub when your team needs audit context.",
    tone: "export",
  },
];

const WORKFLOW_DOT: Record<ProofRow["tone"], string> = {
  search: "var(--mkt-tier-gov)",
  receipts: "var(--mkt-tier-assoc)",
  export: "var(--mkt-tier-cert)",
};

export function AuthShell({
  brandHeadline,
  brandHeadlineAccent,
  brandSub,
  brandFooter,
  topRight,
  children,
}: {
  brandHeadline: string;
  brandHeadlineAccent: string;
  brandSub: string;
  brandFooter: string;
  topRight: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh bg-white">
      {/* ── Left: brand / proof panel ───────────────────────────── */}
      <aside className="relative hidden w-[45%] shrink-0 overflow-hidden border-r border-neutral-200 bg-[#f5f8f6] lg:flex lg:flex-col lg:justify-between lg:gap-8 lg:p-12 xl:w-[42%] xl:p-14">
        <AuthGridBackdrop />

        <div className="relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-neutral-900"
          >
            <BrandMark className="size-9 rounded-xl" glyphClassName="h-5 w-5" />
            <span className={DISPLAY}>
              Source<span className="font-extrabold">BD</span>
            </span>
          </Link>
        </div>

        <BlurFade inView delay={0.05} className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1f4d3a]/15 bg-white/70 px-3 py-1 text-xs font-medium text-[#1f4d3a] backdrop-blur">
            <ShieldCheck size={13} weight="fill" />
            Verified Bangladesh RMG register
          </span>

          <h2
            className={`${DISPLAY} mt-5 text-[2.1rem] leading-[1.12] font-extrabold tracking-tight text-neutral-900`}
          >
            {brandHeadline}{" "}
            <span className="text-[#1f4d3a]">{brandHeadlineAccent}</span>
          </h2>
          <p className="mt-4 text-[0.975rem] leading-relaxed text-neutral-600">
            {brandSub}
          </p>

          {/* Workspace preview */}
          <div className="relative mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_18px_40px_-24px_rgba(16,25,20,0.45)]">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ecf3ee] text-[#1f4d3a]">
                <ShieldCheck size={20} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">
                  Your SourceBD workspace
                </p>
                <p className="text-xs text-neutral-500">
                  Built for faster supplier due diligence.
                </p>
              </div>
              <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[0.7rem] font-medium text-emerald-700 sm:inline-flex">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Free beta
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {AUTH_WORKFLOW.map((p) => (
                <div
                  key={p.label}
                  className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 px-3 py-2.5"
                >
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ background: WORKFLOW_DOT[p.tone] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8rem] font-semibold text-neutral-800">
                      {p.label}
                    </span>
                    <span className="mt-0.5 block text-[0.72rem] leading-relaxed text-neutral-500">
                      {p.description}
                    </span>
                  </span>
                  <CheckCircle size={14} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" />
                </div>
              ))}
            </div>

            <BorderBeam
              size={70}
              duration={8}
              colorFrom="#8CBC9D"
              colorTo="#1f4d3a"
              borderWidth={1.5}
            />
          </div>
        </BlurFade>

        <p className="relative z-10 flex items-center gap-2 text-xs text-neutral-500">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {brandFooter}
        </p>
      </aside>

      {/* ── Right: form panel ───────────────────────────────────── */}
      <section className="relative flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-end gap-1.5 px-6 py-6 text-sm text-neutral-500 sm:px-10">
          {topRight}
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-2 sm:px-10 sm:pb-16">
          <BlurFade inView className="w-full max-w-[26rem]">
            {/* Mobile wordmark — the brand panel is hidden < lg */}
            <Link
              href="/"
              className="mb-8 inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-neutral-900 lg:hidden"
            >
              <BrandMark className="size-9 rounded-xl" glyphClassName="h-5 w-5" />
              <span className={DISPLAY}>
                Source<span className="font-extrabold">BD</span>
              </span>
            </Link>
            {children}
          </BlurFade>
        </div>
      </section>
    </main>
  );
}

/** Page heading block, kept consistent across every auth form. */
export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-2">
      <h1
        className={`${DISPLAY} text-[1.75rem] leading-tight font-extrabold tracking-tight text-neutral-900`}
      >
        {title}
      </h1>
      <p className="text-[0.95rem] text-neutral-500">{subtitle}</p>
    </div>
  );
}
