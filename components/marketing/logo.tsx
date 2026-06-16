// Shared SourceBD shield wordmark — used by the marketing nav + footer.
//
// The forest-green shield (#1f4d3a) is the ONLY brand-accent surface in
// the marketing chrome: a quiet signature, never a section background.
// Wordmark text uses Archivo (--mkt-font-display); the "BD" is heavier.

import Link from "next/link";

const FOREST = "#1f4d3a";

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
  /** Size + radius of the forest badge, e.g. "size-12 rounded-2xl". */
  className?: string;
  /** Size of the inner SourceBD glyph, e.g. "h-6 w-6". */
  glyphClassName?: string;
  title?: string;
};

/**
 * The canonical SourceBD brand mark: a forest-green squircle badge with the
 * white SourceBD shield glyph perfectly centred. Use this everywhere a
 * "green shield" is needed so the identity stays consistent.
 */
export function BrandMark({
  className = "size-12 rounded-2xl",
  glyphClassName = "h-1/2 w-1/2",
  title,
}: BrandMarkProps) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ backgroundColor: FOREST }}
    >
      <ShieldGlyph className={glyphClassName} />
    </span>
  );
}

type WordmarkProps = {
  href?: string;
  /** Size of the forest shield box. */
  boxClassName?: string;
  /** Size of the inner shield glyph. */
  glyphClassName?: string;
  /** Text size for the wordmark. */
  textClassName?: string;
  className?: string;
  onClick?: () => void;
};

/** Shield box + "SourceBD" wordmark, wrapped in a link to `href`. */
export function Wordmark({
  href = "/",
  boxClassName = "h-8 w-8",
  glyphClassName = "h-5 w-5",
  textClassName = "text-lg",
  className,
  onClick,
}: WordmarkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 font-bold tracking-tight text-neutral-900 ${textClassName} ${className ?? ""}`}
    >
      <span
        className={`flex items-center justify-center rounded-lg ${boxClassName}`}
        style={{ backgroundColor: FOREST }}
      >
        <ShieldGlyph className={glyphClassName} />
      </span>
      <span className="font-[family-name:var(--mkt-font-display)]">
        Source<span className="font-extrabold">BD</span>
      </span>
    </Link>
  );
}
