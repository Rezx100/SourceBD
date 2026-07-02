import { Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

// CompanyAvatar — identity slot for supplier list cards (Discover, Saved,
// Smart Match, dashboard). Decided 2 Jul during the Discover card UX audit;
// see frontend-design-spec.md §0.2.
//
// Deliberately NOT `ReceiptsRing`: a numeric trust glyph as every card's
// "face" invited glance-comparison across a results grid. This tile is a
// flat, uniform monogram (or, once `suppliers` gains a logo column, the real
// logo) so the identity slot itself never signals relative trust — the
// verify seal below only answers yes/no, and the precise source count lives
// in plain text alongside the card's other facts.

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

export function CompanyAvatar({
  name,
  logoUrl,
  verified,
  className,
}: {
  name: string;
  /** Reserved for when `suppliers` gains a logo column — not populated today. */
  logoUrl?: string | null;
  verified: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-[10px] border font-display text-[17px] font-bold tracking-[-0.02em]",
          "shadow-[0_1px_3px_rgba(15,15,20,0.05)] sm:h-[58px] sm:w-[58px] sm:text-[20px]",
          logoUrl ? "bg-white p-2.5" : "bg-neutral-100 text-neutral-900",
        )}
        style={{ borderColor: "rgba(15,15,20,0.055)" }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          monogram(name)
        )}
      </span>
      {verified ? (
        <span
          role="img"
          aria-label="Verified by independent sources"
          title="Verified by independent sources"
          className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-[1.5px] bg-white text-brand-forest"
          style={{ borderColor: "rgba(15,15,20,0.14)" }}
        >
          <Check size={10} weight="bold" aria-hidden />
        </span>
      ) : null}
    </span>
  );
}
