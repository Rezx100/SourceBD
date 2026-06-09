// R9 round 2 — refined wordmark glyph. Replaces the round-1 plain forest
// square (read as placeholder) and the original shield+check (read as
// generic AI). Mark is a small forest-filled rounded square with three
// white horizontal bars at varying widths, evoking layered/verified
// records (the data-moat metaphor) without being literal-shield.
//
// Server component. Inverts on dark surfaces via the parent
// `.mkt-auth-brand` selector — no prop needed.

export function WordmarkMark({ className }: { className?: string }) {
  return (
    <svg
      className={`mkt-wm-mark${className ? ` ${className}` : ""}`}
      viewBox="0 0 22 22"
      width={22}
      height={22}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect className="mkt-wm-mark-bg" x="1" y="1" width="20" height="20" rx="4.5" />
      <rect className="mkt-wm-mark-row" x="6" y="6.6" width="6" height="1.6" rx="0.4" />
      <rect className="mkt-wm-mark-row" x="6" y="10.2" width="10" height="1.6" rx="0.4" />
      <rect className="mkt-wm-mark-row" x="6" y="13.8" width="8" height="1.6" rx="0.4" />
    </svg>
  );
}
