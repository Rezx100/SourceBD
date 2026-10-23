// The buyer app's theme (founder, 23 Oct 2026): light by default, dark when the reader picks it in
// Settings · Profile. Kept in a cookie, so the server draws the frame in the right theme with no flash.
// Per browser, not per account. Server-safe.

export type Theme = "light" | "dark";

export const THEME_COOKIE = "sb-theme";

/** Anything but "dark" (no cookie, an old or edited value) is the default, light. */
export function readTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}

/** The cookie a choice writes: a year, the whole site, never sent cross-site. */
export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
