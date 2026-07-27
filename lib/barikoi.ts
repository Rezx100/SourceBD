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

import { applyPlaceLexicon } from "@/lib/bd-place-lexicon";

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

/** Same normalisation the ETL job uses — keep the two in sync (REZ-28:
 *  place lexicon applied so variant spellings share the same cache key). */
export function normalizeAddressKey(address: string): string {
  const lower = address.trim().toLowerCase().replace(/\s+/g, " ");
  return applyPlaceLexicon(lower).replace(/\s+/g, " ").trim();
}

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

async function cacheLookup(keys: string[]): Promise<Map<string, CacheHit | null>> {
  const out = new Map<string, CacheHit | null>();
  const supabase = serviceSupabase();
  if (!supabase || keys.length === 0) return out;
  const { data, error } = await supabase
    .from("address_geocodes")
    .select("address_norm, latitude, longitude, confidence_pct, address_status")
    .in("address_norm", keys);
  if (error || !data) return out;
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
        out.push({ ...hit, label: target.label, kind: target.kind });
        break;
      }
    }
  }
  return out;
}
