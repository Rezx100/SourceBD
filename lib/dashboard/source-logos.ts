// Which sources have an approved one-colour mark (context/logos.lock.md §3),
// and where it lives. A source not listed here keeps its two-letter square:
// "no row in this file → no render in product" (§5.1).
//
// The files are built by scripts/build_source_marks.py from the founder's
// originals in public/inapp-logos/ — the mono reduction §5.2 allows and
// nothing else.

const LOGOS: Record<string, string> = {
  BEPZA: "/icons/sources/regulatory/bepza.png",
  DIFE: "/icons/sources/regulatory/dife.png",
  EPB: "/icons/sources/regulatory/epb.png",
  RSC: "/icons/sources/regulatory/rsc.png",
  BGMEA: "/icons/sources/associations/bgmea.png",
  BKMEA: "/icons/sources/associations/bkmea.png",
  BTMA: "/icons/sources/associations/btma.png",
  BGAPMEA: "/icons/sources/associations/bgapmea.png",
  WRAP: "/icons/sources/cert/wrap.png",
  GOTS: "/icons/sources/cert/gots.png",
  OEKO_TEX: "/icons/sources/cert/oeko-tex.png",
  "OEKO-TEX": "/icons/sources/cert/oeko-tex.png",
};

/** The mono mark's path for a source code, or null when none is approved. */
export function sourceLogo(code: string): string | null {
  return LOGOS[code.toUpperCase()] ?? LOGOS[code] ?? null;
}

/** Every mark file once: the buyer layout preloads them (`app/(app)/app/layout.tsx`). */
export const SOURCE_LOGO_FILES: readonly string[] = [...new Set(Object.values(LOGOS))];
