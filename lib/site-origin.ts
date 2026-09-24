/** Public site origin for redirects. Never taken from the request Host. */

export const FALLBACK_SITE_ORIGIN = "https://sourcebd.net";

function originFromRaw(raw: string | undefined): string | null {
  if (!raw || !URL.canParse(raw)) return null;
  return new URL(raw).origin;
}

/** SITE_URL first, then APP_URL, then the public site. Each is tried alone
 *  so a present-but-invalid SITE_URL cannot hide a valid APP_URL. */
export function siteOriginFromEnv(
  env: {
    NEXT_PUBLIC_SITE_URL?: string;
    NEXT_PUBLIC_APP_URL?: string;
  } = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
): string {
  return (
    originFromRaw(env.NEXT_PUBLIC_SITE_URL) ??
    originFromRaw(env.NEXT_PUBLIC_APP_URL) ??
    FALLBACK_SITE_ORIGIN
  );
}

/** Build an on-site URL. Assign pathname onto the site origin so a
 *  protocol-relative path (`//evil.example/…`) cannot change the host. */
export function urlOnSite(
  pathname: string,
  search = "",
  env?: {
    NEXT_PUBLIC_SITE_URL?: string;
    NEXT_PUBLIC_APP_URL?: string;
  },
): URL {
  const dest = new URL(`${siteOriginFromEnv(env)}/`);
  const raw = pathname.startsWith("/") ? pathname : `/${pathname}`;
  dest.pathname = raw.replace(/^\/+/, "/");
  dest.search = search;
  return dest;
}

/**
 * Build an on-site URL from a whole href — path AND query together.
 *
 * `urlOnSite` takes them separately and assigns the first to `URL.pathname`,
 * which percent-encodes a "?". Passing a full href to it therefore produces
 * `/app/discover%3Fq=knit`, which 404s. Every caller holding an href built
 * elsewhere (a saved search, a stored redirect target) wants this instead.
 */
export function urlOnSiteFromHref(
  href: string,
  env?: { NEXT_PUBLIC_SITE_URL?: string; NEXT_PUBLIC_APP_URL?: string },
): URL {
  const q = href.indexOf("?");
  const pathname = q === -1 ? href : href.slice(0, q);
  const search = q === -1 ? "" : href.slice(q);
  return urlOnSite(pathname, search, env);
}
