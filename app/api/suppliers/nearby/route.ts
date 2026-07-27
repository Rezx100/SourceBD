// Nearby verified supplier sites (REZ-30) — anon-safe orientation layer.
//
// Powers the optional "Other verified sites nearby" toggle on the supplier
// profile Locations map. It is lazy: nothing is requested until a buyer turns
// the layer on, which keeps the default profile render at zero extra queries.
//
// Every field returned is already public on /discover (name, slug, entity
// type, geocoded coordinates). No contact PII, no scoring internals, no
// unpublished or sanctioned supplier — see lib/nearby-suppliers.ts for where
// those gates are applied.

import {
  findNearbySupplierSites,
  NEARBY_DEFAULT_RADIUS_KM,
  NEARBY_MAX_RADIUS_KM,
  NEARBY_RESULT_CAP,
  type NearbySupplierSite,
} from "@/lib/nearby-suppliers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bangladesh envelope with a little slack — the catalog is BD-only, so a
// request outside it is either a bug or a probe and is not worth a query.
const BD_BOUNDS = { minLat: 20.3, maxLat: 26.9, minLng: 87.8, maxLng: 92.9 };

function parseCoord(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const latitude = parseCoord(searchParams.get("lat"));
  const longitude = parseCoord(searchParams.get("lng"));
  if (latitude === null || longitude === null) {
    return Response.json({ error: "invalid_coordinates" }, { status: 400 });
  }
  if (
    latitude < BD_BOUNDS.minLat ||
    latitude > BD_BOUNDS.maxLat ||
    longitude < BD_BOUNDS.minLng ||
    longitude > BD_BOUNDS.maxLng
  ) {
    return Response.json(
      { sites: [] as NearbySupplierSite[], radiusKm: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const requestedRadius = parseCoord(searchParams.get("radius"));
  const radiusKm = Math.min(
    NEARBY_MAX_RADIUS_KM,
    Math.max(0.5, requestedRadius ?? NEARBY_DEFAULT_RADIUS_KM),
  );
  const excludeSlug = (searchParams.get("exclude") ?? "").trim().slice(0, 120);

  const sites = await findNearbySupplierSites(
    { latitude, longitude },
    {
      radiusKm,
      excludeSlug: excludeSlug || undefined,
      limit: NEARBY_RESULT_CAP,
    },
  ).catch(() => [] as NearbySupplierSite[]);

  return Response.json(
    { sites, radiusKm },
    {
      headers: {
        // Identical for every visitor (published catalog only) and the geocode
        // cache changes at ETL cadence, so a short shared cache is safe.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
