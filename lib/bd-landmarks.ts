// Curated Bangladesh logistics landmarks for map context chips (REZ-30).
//
// WHAT THIS IS: a small, hand-maintained gazetteer of the places a sourcing
// buyer actually orients by — sea and land ports, international airports,
// BEPZA export processing zones, inland container depots, the two long-haul
// bridges, and the recognised RMG manufacturing belts.
//
// WHAT THIS IS NOT: registry data. These coordinates are approximate centroids
// compiled for display only. They never enter the database, never corroborate a
// supplier record, and have no standing in the source trust hierarchy. Anything
// derived from them is rendered as an approximate ("~") straight-line distance
// and labelled as context.
//
// Kept as a static table on purpose: no Nearby/POI API call, no per-render
// lookup cost, and a fixed set means the same supplier always reads the same
// way to every buyer.

// Relative import: this module is compiled directly by the `pnpm test` tsc
// invocation, which runs without the `@/*` path mapping.
import { haversineKm, type LatLng } from "./geo";

export type LandmarkKind =
  | "seaport"
  | "landport"
  | "airport"
  | "epz"
  | "logistics"
  | "cluster";

export type Landmark = {
  name: string;
  kind: LandmarkKind;
  latitude: number;
  longitude: number;
};

export const BD_LANDMARKS: readonly Landmark[] = [
  // Sea ports
  { name: "Chattogram Port", kind: "seaport", latitude: 22.3086, longitude: 91.8033 },
  { name: "Mongla Port", kind: "seaport", latitude: 22.49, longitude: 89.59 },
  { name: "Payra Port", kind: "seaport", latitude: 21.98, longitude: 90.24 },

  // Land ports
  { name: "Benapole Land Port", kind: "landport", latitude: 23.035, longitude: 88.895 },
  { name: "Bhomra Land Port", kind: "landport", latitude: 22.75, longitude: 88.92 },
  { name: "Akhaura Land Port", kind: "landport", latitude: 23.87, longitude: 91.23 },
  { name: "Tamabil Land Port", kind: "landport", latitude: 25.19, longitude: 92.02 },
  { name: "Hili Land Port", kind: "landport", latitude: 25.29, longitude: 89.01 },
  { name: "Burimari Land Port", kind: "landport", latitude: 26.16, longitude: 89.01 },
  { name: "Sonamasjid Land Port", kind: "landport", latitude: 24.76, longitude: 88.14 },
  { name: "Teknaf Land Port", kind: "landport", latitude: 20.86, longitude: 92.3 },

  // International airports
  { name: "Hazrat Shahjalal Airport (Dhaka)", kind: "airport", latitude: 23.8433, longitude: 90.3978 },
  { name: "Shah Amanat Airport (Chattogram)", kind: "airport", latitude: 22.2496, longitude: 91.8133 },
  { name: "Osmani Airport (Sylhet)", kind: "airport", latitude: 24.9632, longitude: 91.8668 },
  { name: "Cox's Bazar Airport", kind: "airport", latitude: 21.4522, longitude: 91.9639 },
  { name: "Saidpur Airport", kind: "airport", latitude: 25.7593, longitude: 88.9089 },
  { name: "Jashore Airport", kind: "airport", latitude: 23.1838, longitude: 89.1608 },

  // BEPZA export processing zones + the Mirsharai economic zone
  { name: "Dhaka EPZ (Savar)", kind: "epz", latitude: 23.89, longitude: 90.27 },
  { name: "Chattogram EPZ", kind: "epz", latitude: 22.305, longitude: 91.79 },
  { name: "Karnaphuli EPZ", kind: "epz", latitude: 22.26, longitude: 91.79 },
  { name: "Adamjee EPZ (Narayanganj)", kind: "epz", latitude: 23.67, longitude: 90.52 },
  { name: "Cumilla EPZ", kind: "epz", latitude: 23.46, longitude: 91.16 },
  { name: "Mongla EPZ", kind: "epz", latitude: 22.48, longitude: 89.59 },
  { name: "Ishwardi EPZ", kind: "epz", latitude: 24.13, longitude: 89.06 },
  { name: "Uttara EPZ (Nilphamari)", kind: "epz", latitude: 25.9, longitude: 88.92 },
  { name: "Bangabandhu Shilpa Nagar (Mirsharai)", kind: "epz", latitude: 22.73, longitude: 91.47 },

  // Inland logistics
  { name: "Kamalapur ICD (Dhaka)", kind: "logistics", latitude: 23.732, longitude: 90.426 },
  { name: "Pangaon Inland Terminal", kind: "logistics", latitude: 23.66, longitude: 90.45 },
  { name: "Padma Bridge", kind: "logistics", latitude: 23.43, longitude: 90.26 },
  { name: "Bangabandhu (Jamuna) Bridge", kind: "logistics", latitude: 24.405, longitude: 89.79 },

  // Recognised RMG / textile manufacturing belts
  { name: "Ashulia industrial belt", kind: "cluster", latitude: 23.91, longitude: 90.29 },
  { name: "Savar industrial belt", kind: "cluster", latitude: 23.858, longitude: 90.267 },
  { name: "Konabari, Gazipur", kind: "cluster", latitude: 23.99, longitude: 90.34 },
  { name: "Chandra, Kaliakair", kind: "cluster", latitude: 24.03, longitude: 90.22 },
  { name: "Sreepur, Gazipur", kind: "cluster", latitude: 24.19, longitude: 90.47 },
  { name: "Tongi industrial area", kind: "cluster", latitude: 23.89, longitude: 90.405 },
  { name: "Bhaluka, Mymensingh", kind: "cluster", latitude: 24.4, longitude: 90.37 },
  { name: "Fatullah, Narayanganj", kind: "cluster", latitude: 23.61, longitude: 90.49 },
  { name: "Madhabdi, Narsingdi", kind: "cluster", latitude: 23.92, longitude: 90.72 },
  { name: "Kalurghat industrial area", kind: "cluster", latitude: 22.35, longitude: 91.91 },
  { name: "Mirpur, Dhaka", kind: "cluster", latitude: 23.806, longitude: 90.369 },
  { name: "Motijheel, Dhaka", kind: "cluster", latitude: 23.733, longitude: 90.417 },
];

export type NearbyLandmark = { landmark: Landmark; km: number };

/**
 * Nearest curated landmarks to a point, closest first.
 *
 * `maxKm` keeps the chips meaningful: a factory 180 km from the nearest port
 * learns nothing from being told so, and the row would read as filler.
 * At most one entry per kind, so a site inside an industrial belt does not
 * spend all three slots on neighbouring belts.
 */
export function nearestLandmarks(
  point: LatLng,
  { limit = 3, maxKm = 60 }: { limit?: number; maxKm?: number } = {},
): NearbyLandmark[] {
  const ranked = BD_LANDMARKS.map((landmark) => ({
    landmark,
    km: haversineKm(point, landmark),
  }))
    .filter((entry) => entry.km <= maxKm)
    .sort((a, b) => a.km - b.km);

  const picked: NearbyLandmark[] = [];
  const usedKinds = new Set<LandmarkKind>();
  for (const entry of ranked) {
    if (picked.length >= limit) break;
    if (usedKinds.has(entry.landmark.kind)) continue;
    usedKinds.add(entry.landmark.kind);
    picked.push(entry);
  }
  return picked;
}
