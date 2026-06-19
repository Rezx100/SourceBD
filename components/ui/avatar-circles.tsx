import { cn } from "@/lib/utils";

interface Avatar {
  imageUrl?: string;
  /** Company initials, e.g. "AT" for Aman Textiles. Rendered when no imageUrl. */
  initials?: string;
  profileUrl?: string;
  label?: string;
}
interface AvatarCirclesProps {
  className?: string;
  numPeople?: number;
  /** Custom overflow label (e.g. "10k+"). Overrides numPeople rendering. */
  overflowLabel?: string;
  avatarUrls: Avatar[];
}

// Deterministic forest-family tints — all high-contrast so the initials
// always read (dark forest with white text + a couple of mid-tones).
const TINTS = [
  { bg: "#1f4d3a", fg: "#ffffff" },
  { bg: "#2d6a4f", fg: "#ffffff" },
  { bg: "#19543a", fg: "#ffffff" },
  { bg: "#3a7d5c", fg: "#ffffff" },
  { bg: "#123e2b", fg: "#ffffff" },
  { bg: "#4e9268", fg: "#ffffff" },
];

export function AvatarCircles({
  numPeople,
  overflowLabel,
  className,
  avatarUrls,
}: AvatarCirclesProps) {
  const badge = overflowLabel ?? (numPeople ? `+${numPeople}` : null);
  return (
    <div className={cn("z-10 flex -space-x-4 rtl:space-x-reverse", className)}>
      {avatarUrls.map((url, index) => {
        if (url.initials) {
          const tint = TINTS[index % TINTS.length] ?? { bg: "#1f4d3a", fg: "#ffffff" };
          return (
            <span
              key={index}
              title={url.label}
              style={{ backgroundColor: tint.bg, color: tint.fg }}
              className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white font-[family-name:var(--mkt-font-display)] text-sm font-bold shadow-[0_4px_12px_-4px_rgba(16,40,28,0.2)] transition-transform hover:z-20 hover:-translate-y-1"
            >
              {url.initials}
            </span>
          );
        }
        return (
          <span
            key={index}
            title={url.label}
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-[#ecf3ee] object-contain p-2.5 shadow-[0_4px_12px_-4px_rgba(16,40,28,0.18)] transition-transform hover:z-20 hover:-translate-y-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="h-full w-full object-contain"
              src={url.imageUrl}
              width={56}
              height={56}
              alt={url.label ?? `Avatar ${index + 1}`}
            />
          </span>
        );
      })}
      {badge ? (
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white bg-[#1f4d3a] text-center text-xs font-semibold text-white shadow-[0_4px_12px_-4px_rgba(31,77,58,0.3)]">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
