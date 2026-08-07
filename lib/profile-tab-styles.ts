// Shared tab-bar visual for both supplier profile routes

// (app/(app)/app/suppliers/[slug] and app/(public)/suppliers/[slug]) so

// the two copies of the tab bar can't drift out of sync again.



export const profileTabClass =

  "mb-0 shrink-0 rounded-lg border-b-0 px-3 py-2.5 text-[13.5px] font-medium text-neutral-500 transition-colors duration-150 ease-smooth hover:bg-neutral-100/70 hover:text-neutral-800 data-[state=active]:bg-neutral-100 data-[state=active]:font-semibold data-[state=active]:text-neutral-900 sm:px-3.5 sm:py-2";



export const profileTabCountClass =

  "ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-neutral-500 group-data-[state=active]:bg-white group-data-[state=active]:text-neutral-700";



/** Primary CTA — forest fill, semibold, hover elevation. Phones: compact
 *  36px pill that stretches to its action-grid cell; sm+: intrinsic-width
 *  40px button. */

export const profileHeaderContactClass =

  "h-9 min-h-9 w-full min-w-0 shrink-0 gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold shadow-[0_1px_4px_rgba(15,15,20,0.08)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_3px_10px_rgba(15,15,20,0.12)] sm:h-10 sm:min-h-10 sm:w-auto sm:gap-2 sm:px-[18px] sm:text-[14px]";



/** Secondary follow — quiet outline, no shadow, medium weight. */

export const profileHeaderFollowClass =

  "inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] font-medium text-neutral-600 transition-all duration-150 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800 hover:shadow-[0_1px_4px_rgba(15,15,20,0.06)] sm:h-10 sm:gap-1.5 sm:px-4 sm:text-[14px]";



/** Header metadata chips (verified, entity type, location) — one tinted pill
 *  set. Phones: compact 22px pills sized so entity type + location +
 *  verified badge always share a single line; sm+: roomier 26px pills. */

export const profileHeaderChipClass =

  "inline-flex h-[22px] max-w-full shrink-0 items-center gap-1 rounded-pill bg-neutral-100 px-2 text-[11px] font-semibold leading-none text-neutral-600 transition-colors duration-150 hover:bg-neutral-200/70 sm:h-[26px] sm:gap-1.5 sm:px-2.5 sm:text-[12.5px]";

