// Barikoi geocoding (server-side only — never import from client components).
//
// Profile location pins are resolved purely from `public.address_geocodes`,
// the DB cache populated by the ETL `geocode-addresses` job. The web app
// never calls Barikoi: a cache miss yields no pin until the next ETL run.
//
// The cache is keyed on the RAW registry address the ETL geocoded, so lookups
// must pass those raw strings — not the cleaned display address. Dedup
// re-punctuates the display string (newlines become commas, repeated
// administrative tails are dropped) and `normalizeAddressKey` preserves
// commas, so a display-string lookup would miss the cache on roughly 9,000
// rows and, when a live fallback existed, silently re-bill Rupantor for them.
//
// Fails closed everywhere: no cache row simply yields no pin. The profile
// renders fine without a map.

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { normalizeAddressKey } from "@/lib/bd-place-lexicon";

/** The cache key (REZ-28) lives beside the lexicon, where a plain Node script can also read it; re-exported for the app. */
export { normalizeAddressKey };

export type GeocodedLocation = {
  latitude: number;
  longitude: number;
  label: string;
  /** Echoed straight back from the target so callers can keep their own
   *  classification (address kind) attached to the resolved pin. */
  kind?: string;
  /** Rupantor's own confidence in the match, as cached by the ETL job.
   *  Surfaced so the map can tell a buyer when a pin is a loose locate
   *  rather than a building-level one. Null when the cache row predates
   *  confidence capture. */
  confidencePct: number | null;
  /** Rupantor address_status ("full_address", "area" …) — coarse label for
   *  how precisely the address text resolved. */
  addressStatus: string | null;
};

/** One merged location: the address to display, plus every raw registry
 *  spelling it was merged from, any of which may be the cache key. */
export type GeocodeTarget = {
  label: string;
  lookups: readonly string[];
  kind?: string;
};

type CacheHit = {
  latitude: number;
  longitude: number;
  confidencePct: number | null;
  addressStatus: string | null;
};

// REZ-23: address_geocodes RLS policy was tightened to deny anon reads.
// Use the service role (server-only context) for cache reads so the policy
// change does not break profile map lookups.
function serviceSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The cache's rows for these keys, or null when it could not be read (no service key, or the query failed). */
async function cacheLookup(keys: string[]): Promise<Map<string, CacheHit | null> | null> {
  const out = new Map<string, CacheHit | null>();
  if (keys.length === 0) return out;
  const supabase = serviceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("address_geocodes")
    .select("address_norm, latitude, longitude, confidence_pct, address_status")
    .in("address_norm", keys);
  if (error || !data) return null;
  for (const row of data) {
    out.set(
      row.address_norm as string,
      row.latitude != null && row.longitude != null
        ? {
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            confidencePct:
              row.confidence_pct != null ? Number(row.confidence_pct) : null,
            addressStatus: (row.address_status as string | null) ?? null,
          }
        : null,
    );
  }
  return out;
}

/**
 * Resolve coordinates for up to `max` merged locations from the DB cache.
 * Each target is tried against every raw spelling it was merged from, so a
 * location still gets a pin when only one registry's wording was geocoded.
 * Order is preserved; unresolvable locations are dropped. Never calls Barikoi.
 */
export async function geocodeLocations(
  targets: readonly GeocodeTarget[],
  max = 8,
): Promise<GeocodedLocation[]> {
  return ((await geocodeTargets(targets, max)) ?? []).filter((g): g is GeocodedLocation => g !== null);
}

/**
 * As `geocodeLocations`, but position-preserving: entry `i` is the pin for
 * `targets[i]`, or null when it has none (a cache miss, or past `max`). The
 * record's Sites tab needs this to say which site is pinned and which is not. Null when the cache
 * could not be read at all, which is not the same as every site having no pin.
 */
export async function geocodeTargets(
  targets: readonly GeocodeTarget[],
  max = 8,
): Promise<(GeocodedLocation | null)[] | null> {
  const wanted = targets.slice(0, max);
  const none = targets.map(() => null);
  if (wanted.length === 0) return none;

  const keys = new Set<string>();
  for (const target of wanted) {
    for (const lookup of target.lookups) {
      const key = normalizeAddressKey(lookup);
      if (key) keys.add(key);
    }
  }
  if (keys.size === 0) return none;

  const cached = await cacheLookup([...keys]);
  if (!cached) return null;

  return targets.map((target, i) => {
    if (i >= max) return null;
    for (const lookup of target.lookups) {
      const hit = cached.get(normalizeAddressKey(lookup));
      if (hit) return { ...hit, label: target.label, kind: target.kind };
    }
    return null;
  });
}
