// Builds the home film's supplier lights (handoff-home-film §6.1) from production, read-only, into
// public/site/film/cells.json: one row per square kilometre with published suppliers (longitude, latitude,
// count), the day it was read, the two counts the page prints ("N of M have a mapped address") and the one
// place the story follows. Never an address, a name or an id.
//
// The read is the one lib/nearby-suppliers.ts makes, through the project's own service key and the PostgREST
// API: published suppliers → v_supplier_addresses (address → supplier) → address_geocodes (the Barikoi cache,
// migration 0077). The join is done here, in the same two steps the app uses (the raw string, then the
// normalised key). The SQL it stands for, and each run's result, are in ops/plans/home-film-data.md (rule 14).
//
// Usage: node scripts/film/build-cells.mjs [--env E:/SourceBD/.env] [--story "Mondol Fabrics Ltd."]
// Reads SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY from the environment or
// the env file. Prints counts only.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { applyPlaceLexicon } from "../../lib/bd-place-lexicon.ts";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const envFile = arg("--env", ".env");
const STORY = arg("--story", "Mondol Fabrics Ltd.");
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/site/film/cells.json");

// The env file may hold lines that are not variables; only KEY=value lines are read, and nothing is printed.
try {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  /* no env file: the variables must already be set */
}
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed (read-only; see ops/plans/home-film-data.md)");
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/**
 * Every row of a table or view, a page at a time. The pages are ordered (Postgres gives separate LIMIT/OFFSET reads
 * no order of their own, so an unordered page can skip or repeat a row), and the read goes on until an empty page
 * comes back, whatever the server's own page size is.
 */
async function all(from, select, order, filter = (q) => q) {
  const rows = [];
  for (let at = 0; ; at += rows.length - at) {
    let q = filter(sb.from(from).select(select));
    for (const col of order) q = q.order(col);
    const { data, error } = await q.range(at, at + 999);
    if (error) throw new Error(`${from}: ${error.message}`);
    if (!data.length) return rows;
    rows.push(...data);
  }
}

/** The same key the ETL geocode job and lib/barikoi.ts use. */
const normalize = (address) => applyPlaceLexicon(address.trim().toLowerCase().replace(/\s+/g, " ")).replace(/\s+/g, " ").trim();

// Bangladesh, generously; a geocode outside it is the provider's miss, not a supplier.
const INSIDE = ([lng, lat]) => lng > 87.9 && lng < 92.8 && lat > 20.4 && lat < 26.8;
// A 1 km grid, square at the country's middle latitude.
const LAT0 = 23.7;
const KM_LNG = 111.32 * Math.cos((LAT0 * Math.PI) / 180);
const KM_LAT = 110.57;
const cellOf = ([lng, lat]) => [Math.floor(lng * KM_LNG), Math.floor(lat * KM_LAT)];
const centre = ([ix, iy]) => [+((ix + 0.5) / KM_LNG).toFixed(3), +((iy + 0.5) / KM_LAT).toFixed(3)];
// A site's address first; a registered or mailing address only when the site has none.
const KIND_ORDER = ["factory", "factory_inherited", "registered", "registered_inherited", "mailing", "mailing_inherited"];
const rank = (kind) => (KIND_ORDER.indexOf(kind) + 1 || KIND_ORDER.length + 1);

const suppliers = await all("suppliers", "id, company_name", ["id"], (q) => q.eq("is_published", true));
const addresses = await all("v_supplier_addresses", "supplier_id, address_kind, address", ["supplier_id", "address_kind", "address"]);
const geocodes = await all("address_geocodes", "address_raw, address_norm, latitude, longitude, confidence_pct, address_status", ["id"], (q) => q.not("latitude", "is", null).not("longitude", "is", null));

const byRaw = new Map(), byNorm = new Map();
for (const g of geocodes) {
  const hit = { at: [Number(g.longitude), Number(g.latitude)], confidence: g.confidence_pct == null ? null : Number(g.confidence_pct), status: g.address_status ?? null };
  if (!Number.isFinite(hit.at[0]) || !Number.isFinite(hit.at[1])) continue;
  if (g.address_raw && !byRaw.has(g.address_raw.trim())) byRaw.set(g.address_raw.trim(), hit);
  if (g.address_norm && !byNorm.has(g.address_norm)) byNorm.set(g.address_norm, hit);
}
const bySupplier = new Map();
for (const a of addresses) {
  const text = a.address?.trim();
  if (!a.supplier_id || !text) continue;
  (bySupplier.get(a.supplier_id) ?? bySupplier.set(a.supplier_id, []).get(a.supplier_id)).push({ rank: rank(a.address_kind), text });
}
let exact = 0, normalised = 0, outside = 0;
const placeOf = (id) => {
  for (const a of (bySupplier.get(id) ?? []).sort((x, y) => x.rank - y.rank)) {
    const raw = byRaw.get(a.text);
    const hit = raw ?? byNorm.get(normalize(a.text));
    if (!hit) continue;
    if (!INSIDE(hit.at)) {
      outside++;
      continue;
    }
    raw ? exact++ : normalised++;
    return hit;
  }
  return null;
};

const counts = new Map();
let mapped = 0;
for (const s of suppliers) {
  const hit = placeOf(s.id);
  if (!hit) continue;
  mapped++;
  const k = cellOf(hit.at).join();
  counts.set(k, (counts.get(k) ?? 0) + 1);
}
const cells = [...counts].map(([k, n]) => [...centre(k.split(",").map(Number)), n]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);

// The register spells the name in capitals with no stop ("MONDOL FABRICS LTD"); letters and digits decide.
const plain = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const story = suppliers.filter((s) => plain(s.company_name) === plain(STORY));
if (story.length !== 1) throw new Error(`${story.length} published suppliers named "${STORY}"`);
const place = placeOf(story[0].id);
if (!place) throw new Error(`"${STORY}" has no mapped address`);

const date = new Date().toISOString().slice(0, 10);
const file = { date, what: "suppliers per km²", mapped, suppliers: suppliers.length, cells, chosen: [+place.at[0].toFixed(4), +place.at[1].toFixed(4)] };
writeFileSync(OUT, JSON.stringify(file));

const top = Math.max(...cells.map((c) => c[2]));
console.log(`cells.json written, ${date}
published suppliers: ${suppliers.length}
address rows: ${addresses.length} for ${bySupplier.size} suppliers; geocode rows with a position: ${geocodes.length}
with a mapped address: ${mapped} (${exact} by the raw string, ${normalised} by the normalised key; ${outside} positions outside Bangladesh skipped)
cells: ${cells.length} (the fullest holds ${top} suppliers; ${cells.filter((c) => c[2] === 1).length} hold one)
story: "${STORY}" → ${place.status ?? "no status"}, confidence ${place.confidence ?? "none"}
file: ${Buffer.byteLength(JSON.stringify(file))} bytes`);
