// The home page's icon family (Paper "Home · Icon set", page 32): 22 line icons on a 24 grid, 1.5 stroke, round
// caps and joins, in the ink, each with one detail in the brand green (the receipt's seal). 24 px inline, 40 px over
// a feature heading. Decoration only: the words beside an icon carry its meaning, so every one is `aria-hidden`.
// The ink follows `currentColor`, so a dark section sets the text colour and the icon follows; the green detail
// is the brand token, never a hex.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const G = "text-brand";

/** Each icon: its ink strokes, then the one green detail. */
export const ICONS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" className={G} /></>,
  ledger: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 8h6M9 12h6" /><path d="M9 16h3" className={G} /></>,
  receipt: <><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5V3z" /><path d="M9 8h4M9 12h3" /><circle cx="15" cy="13" r="2" className={G} /></>,
  factory: <><path d="M3 21V10l5 3.5V10l5 3.5V10l5 3.5V21H3z" /><path d="M16 4h3v6" /><path d="M7 16h2v2H7z" className={G} /></>,
  pin: <><path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" /><circle cx="12" cy="11" r="2" className={G} /></>,
  rosette: <><circle cx="12" cy="9" r="5.5" /><path d="M9 13.5L8 21l4-2 4 2-1-7.5" /><path d="M9.8 9l1.5 1.5 3-3" className={G} /></>,
  hourglass: <><path d="M7 3h10M7 21h10M8 3c0 5 4 5 4 9s-4 4-4 9M16 3c0 5-4 5-4 9s4 4 4 9" /><path d="M10.5 18.5h3" className={G} /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="1.5" /><path d="M4 10h16M8 3v4M16 3v4" /><path d="M14 14.5h2.5" className={G} /></>,
  send: <><path d="M3 11l18-8-7 18-2.5-7.5L3 11z" /><path d="M11.5 13.5L21 3" className={G} /></>,
  quotes: <><rect x="3" y="5" width="7" height="14" rx="1.5" /><rect x="14" y="5" width="7" height="14" rx="1.5" /><path d="M5.5 9h2M5.5 12.5h2M16.5 9h2" /><path d="M16.5 12.5h2" className={G} /></>,
  thread: <><path d="M4 5h16v10H9l-5 4V5z" /><path d="M8.5 10h0.01M12 10h0.01M15.5 10h0.01" strokeWidth={2.2} className={G} /></>,
  carton: <><path d="M3 8l9-4 9 4v9l-9 4-9-4V8z" /><path d="M3 8l9 4 9-4M12 12v9" /><path d="M7.5 6l9 4" className={G} /></>,
  flag: <><path d="M6 21V4" /><path d="M6 4h11l-2.5 3.5L17 11H6" /><circle cx="6" cy="21" r="1" className={G} /></>,
  shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" className={G} /></>,
  listcheck: <><path d="M9 6h12M9 12h12M9 18h12" /><rect x="3" y="10.5" width="3" height="3" rx="0.5" /><rect x="3" y="16.5" width="3" height="3" rx="0.5" /><path d="M3 6l1.2 1.2L6.5 4.7" className={G} /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><circle cx="12" cy="16" r="1.3" className={G} /></>,
  stop: <><path d="M7.5 12V6a1.5 1.5 0 0 1 3 0v5M10.5 10V4.5a1.5 1.5 0 0 1 3 0V10M13.5 10.5V6a1.5 1.5 0 0 1 3 0v6" /><path d="M16.5 12V9.5a1.5 1.5 0 0 1 3 0V14c0 4-3 7-7 7h-1c-2.5 0-4-1.5-5.5-4L4.2 14.6a1.4 1.4 0 0 1 2.3-1.6L7.5 14" /><path d="M11 17h3" className={G} /></>,
  bookmark: <><path d="M6 3h12v18l-6-4-6 4V3z" /><path d="M9 8h6" className={G} /></>,
  bell: <><path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15L6 17z" /><path d="M10 21a2 2 0 0 0 4 0" /><circle cx="17.5" cy="6" r="2" className={G} /></>,
  export: <><path d="M12 15V3" /><path d="M7 8l5-5 5 5" className={G} /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" /><circle cx="17" cy="9" r="2.5" className={G} /><path d="M17 14.5c2.3 0 4 2 4 4.5" /></>,
  keyboard: <><rect x="3" y="7" width="18" height="11" rx="1.5" /><path d="M7 11h0.01M10.5 11h0.01M14 11h0.01M17.5 11h0.01" strokeWidth={2.2} /><path d="M8 15h8" className={G} /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

/** One icon at 24 px (inline) or 40 px (over a feature heading). The ink is the text colour; the detail is green. */
export function HomeIcon({ name, size = 24, className }: { name: IconName; size?: 20 | 24 | 40; className?: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      // The green parts take `text-brand` and draw in currentColor too, so the stroke follows the class.
      className={cn("shrink-0 [&_.text-brand]:stroke-current", className)}
    >
      {ICONS[name]}
    </svg>
  );
}
