// The marketing demos' snapshot (handoff-mercury-m2-m3.md, M2): what a signed-out visitor can read of production
// through the anon RPCs, written to lib/marketing/demo-snapshot.json so the demos on the site play real records.
// Read-only (AGENTS.md rule 15). The URL and key come from the process environment, never a file:
//
//   NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… node ops/marketing_demo_snapshot.mjs
//
// It reads: `discover_suppliers` for the Find demo's rows (the same call the search makes, "knit" with GOTS held);
// `buyer_supplier_profile` for the Check demo's record and for every supplier the Ask and Watch demos name;
// `sanctions_lists_read` for the day the UFLPA list was last read. No contact field is in the anon answers, and
// the script refuses to write if one appears. Only what the demos draw is kept, so the file stays small.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the environment");

const PII = /"(email_primary|contact_name|contact_role)":\s*"[^"]|"phones":\s*\[\s*"/;

async function rpc(fn, args, tries = 8) {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(args ?? {}) });
  const text = await r.text();
  // The search's first run on a cold cache can pass the statement timeout; the same call then answers in seconds.
  if (r.status === 500 && text.includes("57014") && tries > 1) {
    await new Promise((f) => setTimeout(f, 5000));
    return rpc(fn, args, tries - 1);
  }
  if (!r.ok) throw new Error(`${fn} ${r.status} ${text.slice(0, 200)}`);
  if (PII.test(text)) throw new Error(`${fn}: a contact value is in the anon answer; nothing written`);
  return JSON.parse(text);
}

/** The Find demo's search: `discoverRpcArgs` for q "knit", GOTS held, most sources first (lib/discover-v32-state.ts). */
const SEARCH = { q: "knit", chips: ["knit", "GOTS"] };
const args = {
  p_q: SEARCH.q, p_entity_types: null, p_min_sources: null, p_cert_kinds: ["gots"], p_rsc_min: null, p_city: null, p_district: null, p_category: null,
  p_sort: "receipts", p_limit: 8, p_offset: 0, p_registries: null, p_factory_types: null, p_brand_codes: null, p_completeness_min: null,
  p_workers_min: null, p_hs_codes: null, p_cert_state: null, p_rsc_state: null, p_est_from: null, p_est_to: null, p_workers_max: null,
  p_districts: null, p_cities: null, p_exclude_sanctioned: true,
};

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
const day = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** A search row as the demo draws it: the results table's columns, nothing else. */
const row = (r) => ({
  slug: r.slug,
  name: r.company_name,
  type: r.entity_type === "buying_house" ? "Buying house" : "Factory",
  place: str(r.district) ?? str(r.city),
  workers: num(r.employees_total),
  sources: num(r.t13_source_count) ?? 0,
  products: Array.isArray(r.principal_products) ? r.principal_products.filter((p) => typeof p === "string").slice(0, 6) : [],
  brands: Array.isArray(r.brand_codes) ? r.brand_codes : [],
  certs: list(r.cert_summary).map((c) => ({ kind: str(c.kind) ?? str(c.scheme) ?? "", expiresOn: day(c.expires_on ?? c.expiresOn) })),
});

/** A record as the demos draw it: the head, the sources read, every certificate with its issuer and date. */
const record = (p) => {
  const s = p.supplier ?? {};
  const prov = list(p.provenance);
  const readOn = (code) => prov.filter((x) => String(x.source_code).toUpperCase() === code).map((x) => day(x.last_seen_at)).filter(Boolean).sort().at(-1) ?? null;
  return {
    slug: s.slug,
    name: s.company_name,
    type: s.entity_type === "buying_house" ? "Buying house" : "Factory",
    place: str(s.district) ?? str(s.city),
    workers: num(s.employees_total),
    sources: [...new Set(prov.map((x) => String(x.source_code).toUpperCase().replace("OEKO_TEX", "OEKO-TEX")))],
    read: Object.fromEntries(["EPB", "RSC", "BGMEA", "BKMEA", "BTMA", "BGAPMEA", "GOTS", "OEKO-TEX", "WRAP"].map((c) => [c, readOn(c === "OEKO-TEX" ? "OEKO_TEX" : c)]).filter(([, d]) => d)),
    bgmea: str(list(p.pills).find((x) => String(x.source_code).toUpperCase() === "BGMEA" && /member/i.test(String(x.label)))?.value),
    certs: list(p.certifications).map((c) => ({ kind: str(c.kind) ?? "", number: str(c.certificate_no), issuer: str(c.issuer), expiresOn: day(c.expires_on), documentUrl: str(c.source_url) ?? str(c.document_url) })),
  };
};

const raw = await rpc("discover_suppliers", args);
const rows = raw.map(row);
const total = num(raw[0]?.total_count);
if (!rows.some((r) => r.slug === "aboni-knitwear")) console.warn("Aboni Knitwear is not on the first page of this search; the Find demo hovers the first row instead");
const profileOf = async (slug) => record(await rpc("buyer_supplier_profile", { p_slug: slug }));
// The Check demo's record, then the first eleven rows' records for the Watch demo (their certificates) and the Ask demo (three of them).
const check = await profileOf("aboni-knitwear");
const saved = [];
for (const r of rows.slice(0, 11)) saved.push(await profileOf(r.slug));
const lists = await rpc("sanctions_lists_read").catch(() => []);
const uflpa = list(lists).find((l) => l.list === "uflpa") ?? null;

const out = {
  readAt: new Date().toISOString().slice(0, 10),
  search: { ...SEARCH, total, rows },
  check,
  saved,
  uflpa: uflpa ? { entries: num(uflpa.entries_listed), lastRead: day(uflpa.last_read) } : null,
};
const text = JSON.stringify(out, null, 1);
if (PII.test(text)) throw new Error("a contact value reached the snapshot; nothing written");
const file = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "marketing", "demo-snapshot.json");
writeFileSync(file, text + "\n");
console.log(`wrote ${file}: ${rows.length} rows, ${saved.length} saved records, ${check.certs.length} certificates on ${check.name}, UFLPA read ${out.uflpa?.lastRead ?? "unknown"}`);
