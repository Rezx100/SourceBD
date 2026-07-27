import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nearestLandmarks } from "./bd-landmarks";
import {
  boundingBox,
  centroid,
  clusterCoincident,
  formatDistanceKm,
  haversineKm,
  metresPerPixel,
  nearestOtherIndex,
  spiderfyOffset,
  widestSpanKm,
} from "./geo";

// Reference points used across the suite. All are real Bangladesh RMG-belt
// coordinates so the assertions double as a sanity check on plausible outputs.
const DHAKA_AIRPORT = { latitude: 23.8433, longitude: 90.3978 };
const CHATTOGRAM_PORT = { latitude: 22.3086, longitude: 91.8033 };
const KONABARI = { latitude: 23.99, longitude: 90.34 };
const ASHULIA = { latitude: 23.91, longitude: 90.29 };

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    assert.equal(haversineKm(DHAKA_AIRPORT, DHAKA_AIRPORT), 0);
  });

  it("is symmetric", () => {
    const ab = haversineKm(DHAKA_AIRPORT, CHATTOGRAM_PORT);
    const ba = haversineKm(CHATTOGRAM_PORT, DHAKA_AIRPORT);
    assert.ok(Math.abs(ab - ba) < 1e-9);
  });

  it("matches the known Dhaka–Chattogram great-circle distance", () => {
    // Published straight-line distance is roughly 220 km.
    const km = haversineKm(DHAKA_AIRPORT, CHATTOGRAM_PORT);
    assert.ok(km > 210 && km < 230, `expected ~220 km, got ${km}`);
  });

  it("resolves short intra-belt distances", () => {
    const km = haversineKm(KONABARI, ASHULIA);
    assert.ok(km > 8 && km < 12, `expected ~10 km, got ${km}`);
  });

  it("handles a one-degree latitude step", () => {
    const km = haversineKm(
      { latitude: 23, longitude: 90 },
      { latitude: 24, longitude: 90 },
    );
    assert.ok(Math.abs(km - 111.2) < 0.5, `expected ~111.2 km, got ${km}`);
  });
});

describe("formatDistanceKm", () => {
  it("rounds sub-kilometre distances to 10 m", () => {
    assert.equal(formatDistanceKm(0.324), "~320 m");
    assert.equal(formatDistanceKm(0.036), "~40 m");
  });

  it("never claims better than 10 m", () => {
    assert.equal(formatDistanceKm(0.0001), "~10 m");
  });

  it("uses one decimal below 10 km", () => {
    assert.equal(formatDistanceKm(3.217), "~3.2 km");
    assert.equal(formatDistanceKm(9.94), "~9.9 km");
  });

  it("drops the decimal above 10 km", () => {
    assert.equal(formatDistanceKm(12.4), "~12 km");
    assert.equal(formatDistanceKm(219.7), "~220 km");
  });

  it("returns empty for unusable input", () => {
    assert.equal(formatDistanceKm(Number.NaN), "");
    assert.equal(formatDistanceKm(-3), "");
  });
});

describe("boundingBox", () => {
  it("encloses every point inside the requested radius", () => {
    const box = boundingBox(DHAKA_AIRPORT, 5);
    const inside = { latitude: 23.86, longitude: 90.41 };
    assert.ok(haversineKm(DHAKA_AIRPORT, inside) < 5);
    assert.ok(inside.latitude >= box.minLat && inside.latitude <= box.maxLat);
    assert.ok(inside.longitude >= box.minLng && inside.longitude <= box.maxLng);
  });

  it("grows with the radius", () => {
    const small = boundingBox(DHAKA_AIRPORT, 1);
    const large = boundingBox(DHAKA_AIRPORT, 20);
    assert.ok(large.maxLat - large.minLat > small.maxLat - small.minLat);
  });

  it("is wider in longitude than latitude at Bangladesh latitudes", () => {
    const box = boundingBox(DHAKA_AIRPORT, 10);
    assert.ok(box.maxLng - box.minLng > box.maxLat - box.minLat);
  });
});

describe("centroid", () => {
  it("returns null for an empty set", () => {
    assert.equal(centroid([]), null);
  });

  it("returns the point itself for one point", () => {
    assert.deepEqual(centroid([KONABARI]), KONABARI);
  });

  it("averages two points", () => {
    const c = centroid([
      { latitude: 23, longitude: 90 },
      { latitude: 24, longitude: 91 },
    ])!;
    assert.equal(c.latitude, 23.5);
    assert.equal(c.longitude, 90.5);
  });
});

describe("widestSpanKm", () => {
  it("returns null below two points", () => {
    assert.equal(widestSpanKm([]), null);
    assert.equal(widestSpanKm([KONABARI]), null);
  });

  it("finds the furthest-apart pair, not just the first", () => {
    const span = widestSpanKm([KONABARI, ASHULIA, CHATTOGRAM_PORT])!;
    const pair = [span.fromIndex, span.toIndex].sort();
    assert.deepEqual(pair, [0, 2]);
    assert.ok(span.km > 200);
  });
});

describe("nearestOtherIndex", () => {
  it("returns null when there is nothing to compare against", () => {
    assert.equal(nearestOtherIndex([KONABARI], 0), null);
  });

  it("skips the origin and picks the closest neighbour", () => {
    const nearest = nearestOtherIndex(
      [CHATTOGRAM_PORT, KONABARI, ASHULIA],
      1,
    )!;
    assert.equal(nearest.index, 2);
    assert.ok(nearest.km > 8 && nearest.km < 12);
  });
});

describe("clusterCoincident", () => {
  it("keeps well-separated pins in their own clusters", () => {
    const result = clusterCoincident([KONABARI, ASHULIA, CHATTOGRAM_PORT]);
    assert.deepEqual(
      result.map((r) => r.clusterSize),
      [1, 1, 1],
    );
  });

  it("groups pins that would overlap on screen", () => {
    // ~20 m apart — a factory and a registered office at the same gate.
    const a = { latitude: 23.99, longitude: 90.34 };
    const b = { latitude: 23.99018, longitude: 90.34 };
    const result = clusterCoincident([a, b]);
    assert.equal(result[0]!.clusterId, result[1]!.clusterId);
    assert.equal(result[0]!.clusterSize, 2);
    assert.deepEqual(
      result.map((r) => r.positionInCluster),
      [0, 1],
    );
  });

  it("keeps distinct clusters distinct in a mixed set", () => {
    const a = { latitude: 23.99, longitude: 90.34 };
    const b = { latitude: 23.99018, longitude: 90.34 };
    const result = clusterCoincident([a, b, CHATTOGRAM_PORT]);
    assert.equal(result[2]!.clusterSize, 1);
    assert.notEqual(result[2]!.clusterId, result[0]!.clusterId);
  });
});

describe("spiderfyOffset", () => {
  it("leaves a lone pin on its true coordinate", () => {
    assert.deepEqual(spiderfyOffset(0, 1), [0, 0]);
  });

  it("leaves the first pin of a cluster on its true coordinate", () => {
    assert.deepEqual(spiderfyOffset(0, 3), [0, 0]);
  });

  it("pushes later pins of a cluster off centre", () => {
    const [dx, dy] = spiderfyOffset(1, 3);
    assert.ok(Math.abs(dx) + Math.abs(dy) > 0);
  });

  it("fans members to different positions", () => {
    const first = spiderfyOffset(1, 4);
    const second = spiderfyOffset(2, 4);
    assert.notDeepEqual(first, second);
  });
});

describe("metresPerPixel", () => {
  it("halves for each zoom level", () => {
    const z14 = metresPerPixel(23.8, 14);
    const z15 = metresPerPixel(23.8, 15);
    assert.ok(Math.abs(z14 / z15 - 2) < 1e-9);
  });

  it("gives building-scale resolution at campus zoom", () => {
    const mpp = metresPerPixel(23.8, 16);
    assert.ok(mpp > 1 && mpp < 3, `expected ~2.2 m/px, got ${mpp}`);
  });
});

describe("nearestLandmarks", () => {
  it("puts the airport first for a site beside it", () => {
    const found = nearestLandmarks(DHAKA_AIRPORT, { limit: 1 });
    assert.equal(found.length, 1);
    assert.match(found[0]!.landmark.name, /Shahjalal/);
    assert.ok(found[0]!.km < 1);
  });

  it("finds the port for a Chattogram site", () => {
    const names = nearestLandmarks(CHATTOGRAM_PORT, { limit: 3 }).map(
      (n) => n.landmark.name,
    );
    assert.ok(names.includes("Chattogram Port"));
  });

  it("returns one landmark per kind so the row is not all belts", () => {
    const found = nearestLandmarks(KONABARI, { limit: 3 });
    const kinds = found.map((f) => f.landmark.kind);
    assert.equal(new Set(kinds).size, kinds.length);
  });

  it("returns results in ascending distance order", () => {
    const found = nearestLandmarks(ASHULIA, { limit: 3 });
    for (let i = 1; i < found.length; i++) {
      assert.ok(found[i]!.km >= found[i - 1]!.km);
    }
  });

  it("stays quiet when nothing curated is within range", () => {
    // Bay of Bengal, far south of every landmark in the table.
    const offshore = { latitude: 19.5, longitude: 90.5 };
    assert.deepEqual(nearestLandmarks(offshore, { maxKm: 60 }), []);
  });

  it("honours the limit", () => {
    assert.ok(nearestLandmarks(KONABARI, { limit: 2 }).length <= 2);
  });
});
