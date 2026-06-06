// Spec M6a — Hero dossier showcase supplier loader.
//
// Picks a single real, published, non-sanctioned Bangladesh supplier
// to drive the dark hero's 3D-tilted "verified dossier" mock-up on
// the homepage. JC #5 of the M6 spec: try a short list of curated
// candidate slugs in order; fall back to null and let the page
// render a fully-synthetic decorative card.
//
// Calls `public.buyer_supplier_profile(p_slug)` (anon-granted, the
// same RPC powering `/suppliers/[slug]`) inside `unstable_cache` so
// the homepage's ISR pages share one cached payload per hour.

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import { TAG_DISCOVER_SUPPLIERS } from "@/lib/cache/tags";

// Curated candidates. First one that resolves to a published,
// non-sanctioned supplier with `t13_source_count >= 3` wins.
// Add/replace slugs as the data moat grows.
const CANDIDATE_SLUGS = [
  "cotton-club-bd-ltd",
  "ananta-apparels-ltd",
  "ananta-jeanswear-ltd",
  "ha-meem-denim-ltd",
  "envoy-textiles-limited",
] as const;

export type ShowcaseRow = {
  source_code: string;
  label: string;
  tier:
    | "tier1_gov"
    | "tier2_industry"
    | "tier3_cert"
    | "tier4_brand"
    | "tier5_regulatory"
    | "tier6_crosscheck";
};

export type ShowcaseSupplier = {
  slug: string;
  company_name: string;
  city: string | null;
  district: string | null;
  entity_type: "factory" | "buying_house" | "unknown";
  t13_source_count: number;
  monogram: string;
  rows: ShowcaseRow[];
};

type RpcSupplier = {
  slug: string;
  company_name: string;
  city: string | null;
  district: string | null;
  country: string | null;
  entity_type: "factory" | "buying_house" | "unknown";
  is_sanctioned: boolean;
  factory_types: string[];
};
type RpcPill = {
  source_code: string;
  label: string;
};
type RpcPayload = {
  supplier: RpcSupplier;
  t13_source_count: number;
  pills: RpcPill[];
};

// Mapping of source_code to the tier of the source that issued it.
// Hard-coded; mirrors the `public.sources.tier` column for the
// codes that can possibly appear in pills. Any code not in this map
// is rendered as a Tier-4 brand row by default (the visual tone is
// the same regardless — only the colour swatch differs).
const SOURCE_TIER_MAP: Record<string, ShowcaseRow["tier"]> = {
  BEPZA: "tier1_gov",
  DIFE: "tier1_gov",
  EPB: "tier1_gov",
  RJSC: "tier1_gov",
  RSC: "tier1_gov",
  BGMEA: "tier2_industry",
  BKMEA: "tier2_industry",
  BTMA: "tier2_industry",
  BGAPMEA: "tier2_industry",
  WRAP: "tier3_cert",
  OEKO_TEX: "tier3_cert",
  GOTS: "tier3_cert",
  OFAC: "tier5_regulatory",
  UFLPA: "tier5_regulatory",
  US_WRO: "tier5_regulatory",
  UK_OFSI: "tier5_regulatory",
  EU_SANC: "tier5_regulatory",
};

function monogramFor(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(ltd|limited|inc|llc|co|company|bd|the)$/i.test(w));
  const initials = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return initials.join("") || name.slice(0, 2).toUpperCase();
}

async function loadShowcase(): Promise<ShowcaseSupplier | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const slug of CANDIDATE_SLUGS) {
    const { data, error } = await supabase.rpc("buyer_supplier_profile", {
      p_slug: slug,
    });
    if (error || !data) continue;
    const payload = data as RpcPayload;
    const s = payload.supplier;
    if (!s || s.is_sanctioned) continue;
    if ((payload.t13_source_count ?? 0) < 3) continue;
    const pills = Array.isArray(payload.pills) ? payload.pills : [];
    const rows: ShowcaseRow[] = pills
      .slice(0, 3)
      .map((p) => ({
        source_code: p.source_code,
        label: p.label || p.source_code,
        tier: SOURCE_TIER_MAP[p.source_code] ?? "tier4_brand",
      }));
    if (rows.length === 0) continue;
    return {
      slug: s.slug,
      company_name: s.company_name,
      city: s.city,
      district: s.district,
      entity_type: s.entity_type,
      t13_source_count: payload.t13_source_count,
      monogram: monogramFor(s.company_name),
      rows,
    };
  }
  return null;
}

export const fetchShowcaseSupplier = unstable_cache(
  loadShowcase,
  ["mkt-showcase-supplier"],
  { revalidate: 3600, tags: [TAG_DISCOVER_SUPPLIERS] },
);
