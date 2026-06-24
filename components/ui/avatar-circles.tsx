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

// Deterministic forest-family tints — all high-contrast so the initials read.
const TINTS = [
  "bg-brand-forest text-white",
  "bg-brand-forest-mid text-white",
  "bg-emerald-800 text-white",
  "bg-emerald-700 text-white",
  "bg-neutral-900 text-white",
  "bg-emerald-600 text-white",
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
          const tint = TINTS[index % TINTS.length] ?? TINTS[0];
          return (
            <span
              key={index}
              title={url.label}
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white font-display text-sm font-bold shadow-sm",
                tint,
              )}
            >
              {url.initials}
            </span>
          );
        }
        return (
          <span
            key={index}
            title={url.label}
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-brand-forest-soft object-contain p-2.5 shadow-sm"
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
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white bg-brand-forest text-center text-xs font-semibold text-white shadow-sm">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
