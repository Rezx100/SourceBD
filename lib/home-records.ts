// The facts the home page prints from three real records (Paper "32 Home", sections 8 and 9): Mondol Fabrics,
// Aboni Knitwear and Liberty Knitwear, read at request time through the anon RPC `buyer_supplier_profile`, cached ten
// minutes like the site's figures. Every fact carries its source and the day that source was read; a fact the read
// does not hold is left out, never filled. The signed-out read carries no contact fields, and nothing here asks for
// one. The parsing is pure so a test reads it.

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { displayName, formatDay } from "@/lib/dashboard/facts";

export type HomeFact = { icon: "rosette" | "shield" | "ledger"; title: string; sub: string; tone?: "caution" };
export type HomeRecord = { slug: string; name: string; meta: string; marks: string[]; facts: HomeFact[] };

/** What each card shows, in order. */
export type FactSpec = { kind: "cert"; cert: "gots" | "wrap" } | { kind: "expired" } | { kind: "rsc" } | { kind: "member"; source: "BGMEA" } | { kind: "epb" };

export const CARDS: { slug: string; facts: FactSpec[] }[] = [
  { slug: "mondol-fabrics", facts: [{ kind: "cert", cert: "gots" }, { kind: "rsc" }] },
  { slug: "aboni-knitwear", facts: [{ kind: "cert", cert: "wrap" }, { kind: "member", source: "BGMEA" }] },
  { slug: "liberty-knitwear", facts: [{ kind: "rsc" }, { kind: "epb" }] },
];

/** The callouts on Aboni's record (section 8): a lapsed certificate, a valid GOTS, the WRAP certificate. */
export const CALLOUTS: FactSpec[] = [{ kind: "expired" }, { kind: "cert", cert: "gots" }, { kind: "cert", cert: "wrap" }];
export const CALLOUT_SLUG = "aboni-knitwear";

/** The marks in the order the strip draws them; a source outside it has no locked mark and is not drawn. */
const MARK_ORDER = ["EPB", "RSC", "BGMEA", "BKMEA", "BTMA", "BGAPMEA", "GOTS", "OEKO-TEX", "WRAP"];
const CERT_SOURCE: Record<string, { code: string; name: string }> = { gots: { code: "GOTS", name: "GOTS database" }, wrap: { code: "WRAP", name: "WRAP register" } };

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === "object") : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+(\.\d+)?$/.test(v) ? Number(v) : null);
const mark = (code: string) => (code.toUpperCase() === "OEKO_TEX" ? "OEKO-TEX" : code.toUpperCase());

/** The latest day a source was read, from the record's provenance rows. */
function readOn(profile: Obj, code: string): string | null {
  const days = list(profile.provenance)
    .filter((p) => mark(String(p.source_code ?? "")) === code)
    .map((p) => str(p.last_seen_at))
    .filter((d): d is string => d !== null)
    .sort();
  return formatDay(days.at(-1) ?? null);
}

function certFact(profile: Obj, c: Obj, today: Date): HomeFact | null {
  const no = str(c.certificate_no);
  const kind = str(c.kind)?.toLowerCase() ?? "";
  const src = CERT_SOURCE[kind];
  const exp = str(c.expires_on);
  const day = formatDay(exp);
  const read = src ? readOn(profile, src.code) : null;
  if (!no || !src || !day || !read) return null;
  const lapsed = exp! < today.toISOString().slice(0, 10);
  const issuer = str(c.issuer);
  // "TÜV Rheinland (China) Ltd. · GOTS database · read 26 Jun 2026"; an issuer that is the register itself is not repeated.
  const sub = `${issuer && issuer.toUpperCase() !== src.code ? `${issuer} · ` : ""}${src.name} · read ${read}`;
  // "GOTS-31587" names its scheme; WRAP files a bare "7865", so the scheme goes in front.
  const id = no.toUpperCase().startsWith(src.code) ? no : `${src.code} ${no}`;
  return lapsed ? { icon: "rosette", title: `${id} · expired ${day}`, sub, tone: "caution" } : { icon: "rosette", title: `${id} · valid to ${day}`, sub };
}

/** One fact from the record, or null when the record does not hold it with its source and date. */
export function factFrom(profile: Obj, spec: FactSpec, today: Date): HomeFact | null {
  const certs = list(profile.certifications);
  if (spec.kind === "cert") {
    // The valid certificate of that kind that runs longest; else none.
    const valid = certs
      .filter((c) => str(c.kind)?.toLowerCase() === spec.cert && (str(c.expires_on) ?? "") >= today.toISOString().slice(0, 10))
      .sort((a, b) => String(b.expires_on).localeCompare(String(a.expires_on)));
    return valid[0] ? certFact(profile, valid[0], today) : null;
  }
  if (spec.kind === "expired") {
    const lapsed = certs.filter((c) => CERT_SOURCE[str(c.kind)?.toLowerCase() ?? ""] && (str(c.expires_on) ?? "9999") < today.toISOString().slice(0, 10));
    return lapsed[0] ? certFact(profile, lapsed[0], today) : null;
  }
  if (spec.kind === "rsc") {
    // The building with the most workers on the RSC's record.
    const row = list(profile.rsc_remediation).sort((a, b) => (num(b.workers_count) ?? 0) - (num(a.workers_count) ?? 0))[0];
    const pct = row ? num(row.progress_pct) : null;
    const read = row ? formatDay(str(row.fetched_at)) : null;
    if (!row || pct === null || !read) return null;
    const building = str(row.building_name);
    return { icon: "shield", title: `RSC · ${Math.round(pct)}% of findings fixed`, sub: `${building ? `${displayName(building)} · ` : ""}RMG Sustainability Council · read ${read}` };
  }
  const code = spec.kind === "epb" ? "EPB" : spec.source;
  const pill = list(profile.pills).find((p) => mark(String(p.source_code ?? "")) === code && (code === "EPB" ? /reg/i.test(String(p.label)) : /member/i.test(String(p.label))));
  const value = pill ? str(pill.value) : null;
  const read = readOn(profile, code);
  if (!value || !read) return null;
  if (spec.kind === "epb") return { icon: "ledger", title: `EPB exporter ${value}`, sub: `Export Promotion Bureau · read ${read}` };
  // The class as the register files it: "BGMEA General member #" is a general member, never assumed.
  const cls = /(\w+) member\b/i.exec(String(pill!.label))?.[1]?.toLowerCase();
  return { icon: "ledger", title: `${code} ${cls && cls !== code.toLowerCase() ? `${cls} ` : ""}member ${value}`, sub: `${code} member register · read ${read}` };
}

/** A card from one `buyer_supplier_profile` answer, or null when the answer is not a record. */
export function recordFrom(raw: unknown, slug: string, specs: FactSpec[], today: Date): HomeRecord | null {
  const profile = obj(raw);
  const s = obj(profile.supplier);
  const name = str(s.company_name);
  if (!name) return null;
  const type = str(s.entity_type) === "buying_house" ? "Buying house" : "Factory";
  const workers = num(s.employees_total);
  const sources = num(profile.t13_source_count);
  const meta = [type, str(s.district), workers !== null ? `${new Intl.NumberFormat("en-GB").format(workers)} workers filed` : null, sources !== null ? `${sources} sources` : null].filter(Boolean).join(" · ");
  const seen = new Set(list(profile.provenance).map((p) => mark(String(p.source_code ?? ""))));
  return {
    slug,
    name: displayName(name),
    meta,
    marks: MARK_ORDER.filter((c) => seen.has(c)),
    facts: specs.map((f) => factFrom(profile, f, today)).filter((f): f is HomeFact => f !== null),
  };
}

/** One record through the anon read. Throws on a failed read, so the cache keeps only answers, never a miss. */
async function readProfile(slug: string): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("buyer_supplier_profile", { p_slug: slug });
  if (error) throw new Error(`buyer_supplier_profile ${slug}: ${error.message}`);
  return data;
}

/** Each record cached ten minutes on its own; a read that fails is retried on the next request, not remembered. */
async function profile(slug: string): Promise<unknown> {
  try {
    return await unstable_cache(() => readProfile(slug), ["home-record-v1", slug], { revalidate: 600 })();
  } catch {
    return null;
  }
}

/**
 * The three cards and Aboni's callouts, each fact dated. The callouts keep their places (`CALLOUTS` order, null where
 * the record does not hold that fact), because each is drawn against its own row of the dated screen.
 */
export async function loadHomeRecords(today = new Date()): Promise<{ cards: HomeRecord[]; callouts: (HomeFact | null)[] }> {
  const slugs = [...new Set([...CARDS.map((c) => c.slug), CALLOUT_SLUG])];
  const read = Object.fromEntries(await Promise.all(slugs.map(async (s) => [s, await profile(s)] as const)));
  const cards = CARDS.map((c) => recordFrom(read[c.slug], c.slug, c.facts, today)).filter((r): r is HomeRecord => r !== null && r.facts.length > 0);
  const aboni = read[CALLOUT_SLUG];
  const callouts = recordFrom(aboni, CALLOUT_SLUG, [], today) ? CALLOUTS.map((spec) => factFrom(obj(aboni), spec, today)) : [];
  return { cards, callouts };
}
