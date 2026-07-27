// Great-circle geometry for the supplier profile Locations map (REZ-30).
//
// Everything here is pure arithmetic on coordinates we already hold in
// `public.address_geocodes`. There is deliberately no routing, no reverse
// geocoding and no provider call: straight-line distance is enough to answer
// "how far apart are these sites" and "what is this site near", and it costs
// nothing. Road distance would need a routing API, which is out of scope.
//
// Distances are presented with a "~" everywhere because the inputs are
// geocoded from registry address prose, not surveyed.

export type LatLng = { latitude: number; longitude: number };

/** IUGG mean Earth radius. */
const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Buyer-facing distance. Precision is deliberately coarse and drops as the
 * distance grows — quoting "3.21 km" from a geocoded address line would imply
 * survey accuracy we do not have.
 */
export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 0.95) {
    const metres = Math.max(10, Math.round((km * 1000) / 10) * 10);
    return `~${metres} m`;
  }
  if (km < 10) return `~${km.toFixed(1)} km`;
  return `~${Math.round(km)} km`;
}

/** Degree-space envelope around a point — cheap prefilter before haversine. */
export function boundingBox(
  center: LatLng,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusKm / 111.32;
  // Longitude degrees shrink towards the poles; clamp the cosine so a point
  // near a pole cannot produce an infinite envelope.
  const lngDelta =
    radiusKm / (111.32 * Math.max(0.01, Math.cos(toRad(center.latitude))));
  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta,
  };
}

export function centroid(points: readonly LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.latitude;
    lng += p.longitude;
  }
  return { latitude: lat / points.length, longitude: lng / points.length };
}

/** The two furthest-apart points in the set, i.e. how wide the footprint is. */
export function widestSpanKm(
  points: readonly LatLng[],
): { km: number; fromIndex: number; toIndex: number } | null {
  if (points.length < 2) return null;
  let best = { km: 0, fromIndex: 0, toIndex: 1 };
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const km = haversineKm(points[i]!, points[j]!);
      if (km > best.km) best = { km, fromIndex: i, toIndex: j };
    }
  }
  return best;
}

/** Closest other point to `index`, or null when there is nothing to compare. */
export function nearestOtherIndex(
  points: readonly LatLng[],
  index: number,
): { index: number; km: number } | null {
  const origin = points[index];
  if (!origin || points.length < 2) return null;
  let best: { index: number; km: number } | null = null;
  for (let i = 0; i < points.length; i++) {
    if (i === index) continue;
    const km = haversineKm(origin, points[i]!);
    if (!best || km < best.km) best = { index: i, km };
  }
  return best;
}

/** Web-mercator ground resolution — drives the on-map scale bar. */
export function metresPerPixel(latitude: number, zoom: number): number {
  return (156543.03392 * Math.cos(toRad(latitude))) / 2 ** zoom;
}

/**
 * Group points that land close enough together to overlap as map pins.
 * Returns, for each input index, the cluster it belongs to and its position
 * within that cluster, so the caller can fan overlapping pins out instead of
 * stacking them into one unclickable blob.
 */
export function clusterCoincident(
  points: readonly LatLng[],
  thresholdKm = 0.06,
): Array<{ clusterId: number; positionInCluster: number; clusterSize: number }> {
  const clusterOf = new Array<number>(points.length).fill(-1);
  let nextCluster = 0;

  for (let i = 0; i < points.length; i++) {
    if (clusterOf[i] !== -1) continue;
    const id = nextCluster++;
    clusterOf[i] = id;
    for (let j = i + 1; j < points.length; j++) {
      if (clusterOf[j] !== -1) continue;
      if (haversineKm(points[i]!, points[j]!) <= thresholdKm) clusterOf[j] = id;
    }
  }

  const sizes = new Array<number>(nextCluster).fill(0);
  for (const id of clusterOf) sizes[id]! += 1;

  const seen = new Array<number>(nextCluster).fill(0);
  return clusterOf.map((id) => {
    const positionInCluster = seen[id]!;
    seen[id]! += 1;
    return { clusterId: id, positionInCluster, clusterSize: sizes[id]! };
  });
}

/**
 * Pixel offset that fans the nth pin of a cluster off centre. The first pin
 * keeps the true position so the honest coordinate is still shown; the rest
 * are pushed onto a small ring around it.
 */
export function spiderfyOffset(
  positionInCluster: number,
  clusterSize: number,
): [number, number] {
  if (clusterSize < 2 || positionInCluster === 0) return [0, 0];
  const spokes = clusterSize - 1;
  // Radii are tuned to the pin head (~21px across) so fanned pins stay
  // individually clickable rather than merely visibly distinct.
  const radius = spokes <= 3 ? 20 : 26;
  // Start at 12 o'clock and walk clockwise.
  const angle = (2 * Math.PI * (positionInCluster - 1)) / spokes - Math.PI / 2;
  return [
    Math.round(Math.cos(angle) * radius),
    Math.round(Math.sin(angle) * radius),
  ];
}
