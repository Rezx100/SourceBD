// Shared auth split-pane shell — light mode, Magic UI aligned.
//
// Server component. Renders a two-column enterprise auth layout:
//   • Left  — a light "brand / proof" panel (forest #1f4d3a signature
//             only) with an animated grid backdrop and a receipts proof
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
  tier: "tier1_gov" | "tier2_industry" | "tier5_regulatory";
};

const DEFAULT_PROOF: ProofRow[] = [
  { label: "DIFE factory register", tier: "tier1_gov" },
  { label: "BGMEA membership #3041", tier: "tier2_industry" },
  { label: "OFAC · UFLPA — clear", tier: "tier5_regulatory" },
];

const TIER_DOT: Record<ProofRow["tier"], string> = {
  tier1_gov: "var(--mkt-tier-gov)",
  tier2_industry: "var(--mkt-tier-assoc)",
  tier5_regulatory: "var(--mkt-tier-sanction)",
};

/** Small receipts glyph — count of distinct Tier 1–3 sources (never SBI). */
function ReceiptsRing({ count }: { count: number }) {
  const pct = Math.min(count, 5) / 5;
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <span
      role="img"
      aria-label={`${count} verified sources`}
      className="relative inline-grid size-9 place-items-center"
    >
      <svg viewBox="0 0 32 32" className="size-9 -rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" stroke="#dbeae0" strokeWidth="3" />
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          stroke="#1f4d3a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <span className="absolute text-[0.7rem] font-semibold text-[#1f4d3a]">
        {count}
      </span>
    </span>
  );
}

export function AuthShell({
  brandHeadline,
  brandHeadlineAccent,
  brandSub,
  brandFooter,
  proofTitle = "Cotton Club (BD) Ltd",
  proofSubtitle = "Knit composite · Gazipur",
  topRight,
  children,
}: {
  brandHeadline: string;
  brandHeadlineAccent: string;
  brandSub: string;
  brandFooter: string;
  proofTitle?: string;
  proofSubtitle?: string;
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

          {/* Receipts proof card */}
          <div className="relative mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_18px_40px_-24px_rgba(16,25,20,0.45)]">
            <div className="flex items-center gap-3">
              <ReceiptsRing count={3} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {proofTitle}
                </p>
                <p className="truncate text-xs text-neutral-500">{proofSubtitle}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[0.7rem] font-medium text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Corroborated
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {DEFAULT_PROOF.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-2.5 text-[0.8rem] text-neutral-700"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: TIER_DOT[p.tier] }}
                  />
                  <span className="flex-1 truncate">{p.label}</span>
                  <CheckCircle size={14} weight="fill" className="text-emerald-500" />
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
