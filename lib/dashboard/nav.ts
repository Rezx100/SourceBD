// The buyer rail's items and which one a path belongs to live in `lib/frame-nav.ts`
// (the v4 frame). What is left here is the one rule about `?back=`.

/**
 * A full record page's `?back=`: the list it was expanded from (the pane's
 * Expand). Only a path inside the buyer app is followed; anything else draws
 * no Back link, so the parameter cannot send the buyer off the site.
 */
export function backToList(raw: string | string[] | undefined): string | null {
  const back = Array.isArray(raw) ? raw[0] : raw;
  if (!back || !back.startsWith("/app/") || /[\\\s]/.test(back)) return null;
  try {
    const url = new URL(back, "https://sourcebd.invalid");
    return url.origin === "https://sourcebd.invalid" && url.pathname.startsWith("/app/") ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}
