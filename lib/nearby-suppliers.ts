// "Other verified sites nearby" map layer (REZ-30) — server-side only.
//
// This is a SourceBD moat feature, not a map-provider feature: every pin comes
// from our own published supplier catalog joined to our own geocode cache. No
// Barikoi Nearby/POI call is made, and no live geocoding happens.
//
// Data path:
//   address_geocodes (bounding box)  →  v_supplier_addresses (address → supplier)
//   →  suppliers (published, unsanctioned, non-PII columns only)
//
// Reads use the service role because REZ-23 closed `address_geocodes` to anon
// and REZ-17/0082 revoked the address views from anon — so the published/
// unsanctioned gate and the no-PII projection are enforced HERE, explicitly,
// rather than being inherited from RLS. Nothing beyond public name, slug,
// entity type and coordinates ever leaves this module.
//
// Fails closed: any missing env, missing table or query error yields an empty
// layer, and the map simply shows no neighbours.

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { boundingBox, haversineKm, type LatLng } from "@/lib/geo";

export type NearbySupplierSite = {
  slug: string;
  companyName: string;
  entityType: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

/** Hard ceiling on returned pins — the layer is orientation, not a search. */
export const NEARBY_RESULT_CAP = 12;
/** Widest radius a caller may ask for. */
export const NEARBY_MAX_RADIUS_KM = 25;
export const NEARBY_DEFAULT_RADIUS_KM = 6;

/** Geocode rows scanned inside the envelope before distance ranking. Dhaka is
 *  dense enough that an unbounded scan would be wasteful. */
const GEOCODE_SCAN_LIMIT = 600;
/** Closest cache rows we bother resolving back to a supplier. */
const RESOLVE_LIMIT = 60;

function serviceSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type GeocodeRow = {
  address_raw: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

async function scanEnvelope(
  supabase: SupabaseClient,
  centre: LatLng,
  radiusKm: number,
): Promise<GeocodeRow[]> {
  const box = boundingBox(centre, radiusKm);
  const { data, error } = await supabase
    .from("address_geocodes")
    .select("address_raw, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", box.minLat)
    .lte("latitude", box.maxLat)
    .gte("longitude", box.minLng)
    .lte("longitude", box.maxLng)
    .limit(GEOCODE_SCAN_LIMIT);
  if (error || !data) return [];

  const rows: GeocodeRow[] = [];
  for (const row of data) {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const addressRaw = (row.address_raw as string | null)?.trim();
    if (!addressRaw || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    const distanceKm = haversineKm(centre, { latitude, longitude });
    // The envelope is a rectangle; the promise to the buyer is a radius.
    if (distanceKm > radiusKm) continue;
    rows.push({ address_raw: addressRaw, latitude, longitude, distanceKm });
  }
  rows.sort((a, b) => a.distanceKm - b.distanceKm);
  return rows.slice(0, RESOLVE_LIMIT);
}

/**
 * Other published suppliers with a geocoded site inside `radiusKm` of
 * `centre`, closest first. `excludeSlug` drops the profile being viewed.
 */
export async function findNearbySupplierSites(
  centre: LatLng,
  {
    radiusKm = NEARBY_DEFAULT_RADIUS_KM,
    excludeSlug,
    limit = NEARBY_RESULT_CAP,
  }: { radiusKm?: number; excludeSlug?: string; limit?: number } = {},
): Promise<NearbySupplierSite[]> {
  const supabase = serviceSupabase();
  if (!supabase) return [];

  const clampedRadius = Math.min(
    NEARBY_MAX_RADIUS_KM,
    Math.max(0.5, radiusKm),
  );
  const candidates = await scanEnvelope(supabase, centre, clampedRadius);
  if (candidates.length === 0) return [];

  // address text → supplier. The view is already restricted to published
  // suppliers; the explicit is_published check below is the real gate.
  const { data: addressRows, error: addressError } = await supabase
    .from("v_supplier_addresses")
    .select("supplier_id, address")
    .in(
      "address",
      candidates.map((c) => c.address_raw),
    );
  if (addressError || !addressRows) return [];

  const closestBySupplier = new Map<string, GeocodeRow>();
  const byAddress = new Map(candidates.map((c) => [c.address_raw, c]));
  for (const row of addressRows) {
    const supplierId = row.supplier_id as string | null;
    const address = (row.address as string | null)?.trim();
    if (!supplierId || !address) continue;
    const hit = byAddress.get(address);
    if (!hit) continue;
    const current = closestBySupplier.get(supplierId);
    if (!current || hit.distanceKm < current.distanceKm) {
      closestBySupplier.set(supplierId, hit);
    }
  }
  if (closestBySupplier.size === 0) return [];

  const { data: supplierRows, error: supplierError } = await supabase
    .from("suppliers")
    // Public card fields only — no phone, email, contact or scoring internals.
    .select("id, slug, company_name, entity_type")
    .in("id", [...closestBySupplier.keys()])
    .eq("is_published", true)
    .eq("is_sanctioned", false);
  if (supplierError || !supplierRows) return [];

  const out: NearbySupplierSite[] = [];
  for (const row of supplierRows) {
    const slug = row.slug as string | null;
    const companyName = row.company_name as string | null;
    const hit = closestBySupplier.get(row.id as string);
    if (!slug || !companyName || !hit) continue;
    if (excludeSlug && slug === excludeSlug) continue;
    out.push({
      slug,
      companyName,
      entityType: (row.entity_type as string | null) ?? null,
      latitude: hit.latitude,
      longitude: hit.longitude,
      distanceKm: hit.distanceKm,
    });
  }

  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, Math.min(limit, NEARBY_RESULT_CAP));
}
