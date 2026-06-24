import { cn } from "@/lib/utils";

type UserAvatarProps = {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-[12px]",
  lg: "size-12 text-sm",
} as const;

function initialsFrom(displayName?: string | null, email?: string | null): string {
  const source = (displayName ?? "").trim() || (email ?? "").trim();
  if (!source) return "SB";
  const parts = source
    .replace(/@.*$/, "")
    .split(/\s+|[._-]+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "S";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? ""}`.toUpperCase();
}

export function UserAvatar({
  avatarUrl,
  displayName,
  email,
  size = "md",
  className,
}: UserAvatarProps) {
  const label = displayName || email || "User";
  const sizeClass = SIZE_CLASS[size];

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={label}
        className={cn(
          "shrink-0 rounded-full border border-neutral-200 bg-white object-cover shadow-sm",
          sizeClass,
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-brand-forest/20 bg-brand-forest text-center font-display font-bold text-white shadow-sm",
        sizeClass,
        className,
      )}
    >
      {initialsFrom(displayName, email)}
    </span>
  );
}
