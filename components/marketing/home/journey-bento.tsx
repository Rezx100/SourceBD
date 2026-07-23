// Static Search → Vet → Message bento row for /home-demo. Illustrative UI
// only — mirrors ProductDemo / MessagingDemo fidelity without animation.
// Same convention as product-demo: real registry marks, example companies, no SBI.

import {
  ArrowRight,
  ChatCircleText,
  Check,
  MagnifyingGlass,
  PaperPlaneTilt,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";

import { CompanyAvatar } from "@/components/supplier/company-avatar";
import { MagicCard } from "@/components/ui/magic-card";
import { sourceLogo } from "@/lib/source-logos";
import { cn } from "@/lib/utils";

const FOREST = "var(--brand-forest)";

function MarkTile({ tag, size = 26 }: { tag: string; size?: number }) {
  const logo = sourceLogo(tag);
  const label = tag === "OEKO_TEX" ? "OEKO-TEX" : tag.toUpperCase();
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex shrink-0 items-center justify-center rounded-[6px] border border-neutral-200 bg-[#fafaf9] font-mono text-[10px] font-bold text-neutral-600"
      style={{ width: size, height: size }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full rounded-[5px] object-contain p-0.5" />
      ) : (
        label.replace(/[^A-Za-z0-9]/g, "").slice(0, 3)
      )}
    </span>
  );
}

const STEPS = [
  {
    step: "01",
    title: "Search",
    icon: MagnifyingGlass,
    body: "Filter by certification, product, district or factory type — every result is on the public record.",
  },
  {
    step: "02",
    title: "Vet",
    icon: ShieldCheck,
    body: "Open a profile and read the evidence row by row. Each claim links to the issuer that published it.",
  },
  {
    step: "03",
    title: "Message",
    icon: ChatCircleText,
    body: "Send an inquiry or RFQ to the verified supplier itself. SourceBD never sits between you.",
  },
] as const;

export function JourneyBento() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
      {/* Search */}
      <MagicCard
        className="flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white"
        gradientFrom={FOREST}
        gradientTo="var(--brand-forest-mid)"
        gradientColor="var(--brand-forest-soft)"
        gradientOpacity={0.1}
      >
        <div className="flex items-start gap-3 border-b border-neutral-100 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-forest-soft text-brand-forest">
            <MagnifyingGlass size={18} weight="duotone" aria-hidden />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-brand-forest">
              {STEPS[0].step} · {STEPS[0].title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">{STEPS[0].body}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left shadow-sm">
            <p className="font-mono text-[11px] text-neutral-400">Discover</p>
            <p className="mt-1 text-sm font-medium text-neutral-800">
              OEKO-TEX certified knit factory, Dhaka
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <CompanyAvatar name="DBL Group" verified className="scale-[0.85]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-semibold text-neutral-900">
                  DBL Group
                </p>
                <p className="text-[11px] text-neutral-500">Factory · Gazipur</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {["BGMEA", "OEKO_TEX", "RSC"].map((m) => (
                    <MarkTile key={m} tag={m} size={22} />
                  ))}
                  <span className="text-[11px] font-medium text-neutral-600">
                    5 sources
                  </span>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-brand-forest px-2 py-1 text-[11px] font-semibold text-white">
                View
                <ArrowRight size={12} weight="bold" aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </MagicCard>

      {/* Vet */}
      <MagicCard
        className="flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white lg:mt-4"
        gradientFrom={FOREST}
        gradientTo="var(--brand-forest-mid)"
        gradientColor="var(--brand-forest-soft)"
        gradientOpacity={0.1}
      >
        <div className="flex items-start gap-3 border-b border-neutral-100 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-forest-soft text-brand-forest">
            <ShieldCheck size={18} weight="duotone" aria-hidden />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-brand-forest">
              {STEPS[1].step} · {STEPS[1].title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">{STEPS[1].body}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <CompanyAvatar name="DBL Group" verified className="scale-[0.78]" />
            <div>
              <p className="font-display text-sm font-semibold text-neutral-900">DBL Group</p>
              <p className="text-[11px] text-neutral-500">Verified evidence</p>
            </div>
          </div>

          <ul className="space-y-2">
            {[
              { code: "BGMEA", label: "Trade association register", status: "Verified" },
              { code: "RSC", label: "Remediation & safety evidence", status: "96%" },
              { code: "GOTS", label: "Certification body record", status: "Active" },
              { code: "uflpa", label: "Sanctions screening", status: "Clear" },
            ].map((row) => (
              <li
                key={row.code}
                className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2"
              >
                <MarkTile tag={row.code} size={24} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-neutral-800">{row.label}</p>
                  <p className="truncate font-mono text-[10px] text-neutral-400">{row.code === "OEKO_TEX" ? "OEKO-TEX" : row.code.toUpperCase()}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-semibold",
                    row.status === "Verified" || row.status === "Active" || row.status === "Clear"
                      ? "bg-brand-forest-soft text-brand-forest"
                      : "bg-white text-neutral-600",
                  )}
                >
                  {row.status === "Verified" || row.status === "Active" || row.status === "Clear" ? (
                    <Check size={10} weight="bold" aria-hidden />
                  ) : null}
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </MagicCard>

      {/* Message */}
      <MagicCard
        className="flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white"
        gradientFrom={FOREST}
        gradientTo="var(--brand-forest-mid)"
        gradientColor="var(--brand-forest-soft)"
        gradientOpacity={0.1}
      >
        <div className="flex items-start gap-3 border-b border-neutral-100 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-forest-soft text-brand-forest">
            <ChatCircleText size={18} weight="duotone" aria-hidden />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-brand-forest">
              {STEPS[2].step} · {STEPS[2].title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">{STEPS[2].body}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 p-5">
          <div className="space-y-2.5">
            <div className="flex justify-end">
              <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-brand-forest px-3.5 py-2.5 text-[12px] leading-relaxed text-white">
                Hi — interested in your OEKO-TEX knit capacity for AW25. What&apos;s your MOQ?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-3.5 py-2.5 text-[12px] leading-relaxed text-neutral-700 shadow-sm">
                MOQ is 3,000 pcs per style. OEKO-TEX &amp; GOTS certified — sample lead time is 7
                days.
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[88%] rounded-2xl rounded-br-sm border border-brand-forest/25 bg-brand-forest-soft px-3.5 py-2.5">
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-white text-brand-forest">
                  <PaperPlaneTilt size={14} weight="duotone" aria-hidden />
                </span>
                <p className="mt-1.5 text-[12px] font-semibold text-neutral-800">
                  RFQ · 12,000 pcs cotton polo
                </p>
                <p className="text-[10px] text-neutral-500">AW25 · 3 colourways · FOB Chattogram</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
            <Check size={14} weight="bold" className="shrink-0 text-brand-forest" aria-hidden />
            Direct to the factory — no broker commission
          </div>
        </div>
      </MagicCard>
    </div>
  );
}
