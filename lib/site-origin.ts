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
