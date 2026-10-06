// The two headers our server adds to every Supabase call so the activity record (0131) can say where an
// action came from: the visitor's address and browser, as the request that reached us carried them. Without
// them the database sees only our own server's address. Pure, so it is tested without Next.
//
// The address: Cloudflare's `cf-connecting-ip` when the request came through Cloudflare (it overwrites a
// header a visitor sends), else `x-real-ip` (Caddy), else the leftmost `x-forwarded-for`. A visitor can forge
// the last two before Cloudflare, so the record keeps this beside the gateway's own view and the reader
// weighs both (0131's header). No header, no value: "0.0.0.0" is never sent.

export const FORWARDED_IP_HEADER = "x-sourcebd-ip";
export const FORWARDED_UA_HEADER = "x-sourcebd-ua";

const MAX_UA = 300;
const CONTROL = /[\u0000-\u001f\u007f]/g;

/** A header value with no control characters (a newline would be a second header), trimmed and bounded. */
function clean(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(CONTROL, "").trim().slice(0, max);
}

/** The visitor's address as the request named it, or null when no header says. */
export function visitorIp(h: Headers | null | undefined): string | null {
  if (!h) return null;
  const cf = clean(h.get("cf-connecting-ip"), 64);
  if (cf) return cf;
  const real = clean(h.get("x-real-ip"), 64);
  if (real) return real;
  const first = clean(h.get("x-forwarded-for")?.split(",")[0], 64);
  return first || null;
}

/** The headers to add to a Supabase client's calls for this request; empty when the request says nothing. */
export function forwardedRequestHeaders(h: Headers | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const ip = visitorIp(h);
  if (ip) out[FORWARDED_IP_HEADER] = ip;
  const ua = clean(h?.get("user-agent"), MAX_UA);
  if (ua) out[FORWARDED_UA_HEADER] = ua;
  return out;
}
