// Spec P1 — canonical viewport widths for the responsive QA matrix.
//
// Locked: every value here corresponds to a real device class the platform
// must look correct at. Do not add or remove without a spec change — the
// `app/(dev)/responsive-grid/page.dev.tsx` QA aid iterates this list, and
// expanding it dilutes the founder's review surface.

export const RESPONSIVE_WIDTHS = [
  360,  // small phone (Galaxy S, iPhone SE in portrait)
  414,  // iPhone 15 Pro portrait
  768,  // iPad Mini portrait
  1024, // iPad Pro portrait / small laptop
  1280, // typical laptop
  1440, // 14-16" desktop
  1920, // 1080p desktop
  2560, // 4K / QHD
] as const;

export type ResponsiveWidth = (typeof RESPONSIVE_WIDTHS)[number];

// Default heights paired with each width — keeps the iframe aspect ratio
// realistic for the device class without forcing an exact device list.
export function heightForWidth(width: ResponsiveWidth): number {
  if (width <= 414) return 844;   // phone
  if (width <= 768) return 1024;  // small tablet
  if (width <= 1024) return 768;  // landscape tablet / small laptop
  if (width <= 1440) return 900;  // laptop
  return 1080;                    // 1080p+
}
