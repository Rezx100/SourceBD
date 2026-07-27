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

export type GeocodedLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

/** One merged location: the address to display, plus every raw registry
 *  spelling it was merged from, any of which may be the cache key. */
export type GeocodeTarget = {
  label: string;
  lookups: readonly string[];
};

/** Same normalisation the ETL job uses — keep the two in sync. */
export function normalizeAddressKey(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

type LatLng = { latitude: number; longitude: number };

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

async function cacheLookup(keys: string[]): Promise<Map<string, LatLng | null>> {
  const out = new Map<string, LatLng | null>();
  const supabase = serviceSupabase();
  if (!supabase || keys.length === 0) return out;
  const { data, error } = await supabase
    .from("address_geocodes")
    .select("address_norm, latitude, longitude")
    .in("address_norm", keys);
  if (error || !data) return out;
  for (const row of data) {
    out.set(
      row.address_norm as string,
      row.latitude != null && row.longitude != null
        ? { latitude: Number(row.latitude), longitude: Number(row.longitude) }
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
  const wanted = targets.slice(0, max);
  if (wanted.length === 0) return [];

  const keys = new Set<string>();
  for (const target of wanted) {
    for (const lookup of target.lookups) {
      const key = normalizeAddressKey(lookup);
      if (key) keys.add(key);
    }
  }
  if (keys.size === 0) return [];

  const cached = await cacheLookup([...keys]);

  const out: GeocodedLocation[] = [];
  for (const target of wanted) {
    for (const lookup of target.lookups) {
      const hit = cached.get(normalizeAddressKey(lookup));
      if (hit) {
        out.push({ ...hit, label: target.label });
        break;
      }
    }
  }
  return out;
}
