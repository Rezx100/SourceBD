// Shared SourceBD logo mark + wordmark used by marketing, auth, and app chrome.

import Link from "next/link";

const SOURCEBD_LOGO_SRC = "/icons/brand/sourcebd-logo.png";

/** Shield outline with an inner checkmark. White stroke on a forest box. */
export function ShieldGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3l8 3.5v5c0 4.6-3.2 7.8-8 9-4.8-1.2-8-4.4-8-9v-5L12 3z" />
      <path d="M9 12l2 2 4-4.5" />
    </svg>
  );
}

type BrandMarkProps = {
  /** Size + radius of the logo frame, e.g. "size-12 rounded-2xl". */
  className?: string;
  /** Size of the inner SourceBD logo, e.g. "h-6 w-6". */
  glyphClassName?: string;
  title?: string;
};

type BrandMarkWithHairlineProps = BrandMarkProps & {
  durationSeconds?: number;
  wrapperClassName?: string;
};

/**
 * The canonical SourceBD brand mark. Use this everywhere the platform identity
 * needs a standalone mark so the uploaded logo stays consistent.
 */
export function BrandMark({
  className = "size-12",
  glyphClassName = "h-full w-full",
  title,
}: BrandMarkProps) {
  return (
    <span
      title={title}
      role={title ? "img" : undefined}
      aria-label={title}
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
    >
      <img
        src={SOURCEBD_LOGO_SRC}
        alt=""
        aria-hidden
        className={`block object-contain ${glyphClassName}`}
      />
    </span>
  );
}

export function BrandMarkWithHairline({
  className = "size-16 rounded-lg shadow-sm sm:size-20 lg:size-[76px]",
  glyphClassName,
  title = "SourceBD",
  durationSeconds = 3.2,
  wrapperClassName = "relative z-10",
}: BrandMarkWithHairlineProps) {
  return (
    <span className={`inline-flex ${wrapperClassName}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-xl border border-brand-forest/20 bg-white/40 opacity-80 shadow-[0_0_0_4px_var(--brand-forest-soft)] motion-safe:animate-pulse"
        style={{ animationDuration: `${durationSeconds}s` }}
      />
      <BrandMark
        className={className}
        glyphClassName={glyphClassName}
        title={title}
      />
    </span>
  );
}

type WordmarkProps = {
  href?: string;
  /** Size of the logo frame. */
  boxClassName?: string;
  /** Size of the inner SourceBD logo. */
  glyphClassName?: string;
  /** Text size for the wordmark. */
  textClassName?: string;
  className?: string;
  onClick?: () => void;
};

/** Icon-only brand mark for app shell chrome (no wordmark text). */
export function BrandMarkLink({
  href = "/app",
  boxClassName = "h-8 w-8 sm:h-9 sm:w-9",
  className,
  title = "SourceBD home",
}: {
  href?: string;
  boxClassName?: string;
  className?: string;
  title?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={title}
      title={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg transition-opacity hover:opacity-90 ${className ?? ""}`}
    >
      <BrandMark className={boxClassName} glyphClassName="h-full w-full" />
    </Link>
  );
}

/** SourceBD logo mark + wordmark, wrapped in a link to `href`. */
export function Wordmark({
  href = "/",
  boxClassName = "h-7 w-7",
  glyphClassName = "h-full w-full",
  textClassName = "text-lg",
  className,
  onClick,
}: WordmarkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 font-brand font-medium leading-none tracking-[-0.035em] text-neutral-950 ${textClassName} ${className ?? ""}`}
    >
      <span
        className={`flex items-center justify-center ${boxClassName}`}
      >
        <img
          src={SOURCEBD_LOGO_SRC}
          alt=""
          aria-hidden
          className={`block object-contain ${glyphClassName}`}
        />
      </span>
      <span className="inline-flex items-center leading-none">
        SOURCE
        <span className="ml-0.5 font-semibold tracking-[-0.08em] text-brand-forest">
          BD
        </span>
      </span>
    </Link>
  );
}
