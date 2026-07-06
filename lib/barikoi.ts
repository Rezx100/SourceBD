// Barikoi geocoding (server-side only — never import from client components).
//
// Resolution order for a profile's location pins:
//   1. `public.address_geocodes` — the DB cache populated by the ETL
//      `geocode-addresses` job (bulk Rupantor backfill).
//   2. Live Rupantor call for a small number of cache misses, memoised
//      in-process so repeated views of the same profile don't re-bill.
//
// Fails closed everywhere: no API key, provider error, or unresolvable
// address simply yields no pin. The profile renders fine without a map.

import { createClient } from "@supabase/supabase-js";

export type GeocodedLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

const RUPANTOR_URL = "https://barikoi.xyz/v2/api/search/rupantor/geocode";
const LIVE_LOOKUP_LIMIT = 4;
const LIVE_TIMEOUT_MS = 3500;

/** Same normalisation the ETL job uses — keep the two in sync. */
export function normalizeAddressKey(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

function barikoiApiKey(): string | null {
  return process.env.BARIKOI_API_KEY ?? process.env.BRIKOI_API_KEY ?? null;
}

type LatLng = { latitude: number; longitude: number };

// In-process memo (positive and negative results) so `force-dynamic`
// profile pages don't re-call the provider on every request.
const liveMemo = new Map<string, LatLng | null>();

function anonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function cacheLookup(keys: string[]): Promise<Map<string, LatLng | null>> {
  const out = new Map<string, LatLng | null>();
  const supabase = anonSupabase();
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

async function liveGeocode(address: string): Promise<LatLng | null> {
  const key = normalizeAddressKey(address);
  if (liveMemo.has(key)) return liveMemo.get(key)!;

  const apiKey = barikoiApiKey();
  if (!apiKey) return null;

  let result: LatLng | null = null;
  try {
    const body = new URLSearchParams({ q: address });
    const res = await fetch(`${RUPANTOR_URL}?api_key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as {
        geocoded_address?: { latitude?: string | number; longitude?: string | number };
      };
      const lat = Number(json.geocoded_address?.latitude);
      const lng = Number(json.geocoded_address?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        result = { latitude: lat, longitude: lng };
      }
    }
  } catch {
    result = null;
  }
  liveMemo.set(key, result);
  return result;
}

/**
 * Resolve coordinates for up to `max` addresses. DB cache first, then a
 * bounded number of live lookups for misses. Order of the input is
 * preserved in the output; unresolvable addresses are dropped.
 */
export async function geocodeAddresses(
  addresses: readonly string[],
  max = 8,
): Promise<GeocodedLocation[]> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const addr of addresses) {
    const key = normalizeAddressKey(addr);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(addr);
    if (unique.length >= max) break;
  }
  if (unique.length === 0) return [];

  const cached = await cacheLookup(unique.map(normalizeAddressKey));

  const results = await Promise.all(
    unique.map(async (addr, i): Promise<GeocodedLocation | null> => {
      const key = normalizeAddressKey(addr);
      if (cached.has(key)) {
        const hit = cached.get(key);
        return hit ? { ...hit, label: addr } : null;
      }
      // Bounded live fallback for the first few cache misses only.
      const missRank = unique
        .slice(0, i)
        .filter((a) => !cached.has(normalizeAddressKey(a))).length;
      if (missRank >= LIVE_LOOKUP_LIMIT) return null;
      const live = await liveGeocode(addr);
      return live ? { ...live, label: addr } : null;
    }),
  );
  return results.filter((r): r is GeocodedLocation => r !== null);
}
