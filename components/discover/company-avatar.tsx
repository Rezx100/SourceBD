import { Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

// CompanyAvatar — identity slot for supplier list cards (Discover, Saved,
// Smart Match, dashboard) and the full company profile header.

function monogram(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

export function CompanyAvatar({
  name,
  logoUrl,
  verified = false,
  variant = "default",
  className,
}: {
  name: string;
  logoUrl?: string | null;
  verified?: boolean;
  /** Profile header: larger identity tile; seal renders when `verified`. */
  variant?: "default" | "profile";
  className?: string;
}) {
  const isProfile = variant === "profile";
  const showSeal = verified && !isProfile;
  // Profile header: instead of a static seal, a verified company gets the
  // quiet "live sync" ring pulse — SourceBD is continuously re-scanning
  // authority sources in the background, and the avatar breathes with it.
  const livePulse = verified && isProfile;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0",
        livePulse && "profile-avatar-live",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center font-display tracking-[-0.02em]",
          isProfile
            ? cn(
                // 320–389px phones (incl. the common 360px width): 56px tile
                // so long company names still have room to settle into 2
                // lines without clipping — the old 360px (`xs`) breakpoint
                // bumped this up too early and reintroduced the cut-off.
                // 390px+: 64px; sm+: the 92px dossier tile.
                "size-14 rounded-xl text-[19px] font-bold leading-none tracking-[0.01em] min-[390px]:size-16 min-[390px]:text-[22px] sm:size-[5.75rem] sm:rounded-2xl sm:text-[2rem]",
                logoUrl
                  ? "border border-neutral-200/80 bg-white p-2 shadow-[0_1px_3px_rgba(15,15,20,0.03)]"
                  : cn(
                      "border border-brand-forest/12 bg-gradient-to-br from-brand-forest/[0.1] via-brand-forest/[0.05] to-white text-neutral-500",
                      "shadow-[0_1px_3px_rgba(15,15,20,0.03)]",
                    ),
              )
            : cn(
                "h-14 w-14 rounded-xl border text-[20px] font-bold shadow-[0_1px_4px_rgba(15,15,20,0.07)] sm:h-16 sm:w-16 sm:text-[24px]",
                logoUrl ? "border-neutral-200/60 bg-white p-2.5" : "border-neutral-200/60 bg-neutral-100 text-neutral-900",
              ),
        )}
        style={isProfile ? undefined : { borderColor: "rgba(15,15,20,0.06)" }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          monogram(name)
        )}
      </span>
      {showSeal ? (
        <span
          role="img"
          aria-label="Verified by independent sources"
          title="Verified by independent sources"
          className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-[1.5px] bg-white text-brand-forest"
          style={{ borderColor: "rgba(15,15,20,0.14)" }}
        >
          <Check size={16} weight="bold" aria-hidden />
        </span>
      ) : null}
    </span>
  );
}
