// Live Discover typeahead — anon-safe suggestion endpoint.
//
// Powers the Google-style search box on `/discover` and `/app/discover`.
// Every keystroke (debounced client-side) hits this route with `?q=`.
//
// It reuses the existing anon-granted `public.discover_suppliers` RPC
// (migration 0074) for company matches — that RPC already runs FTS +
// fuzzy `ilike` over company name, parent group, city, district and
// principal products, so matches feel intent-aware from the first letter.
// It never returns PII (email/phone/contact) or any SBI numeric; only the
// public card fields (name, slug, city, district) are surfaced.
//
// Product / location / certification suggestions come from the cached
// `discover_facets()` universe so we can offer "search this term" chips
// without a second DB round-trip per keystroke.

import { createClient } from "@supabase/supabase-js";

import { CERT_KINDS } from "@/components/discover/filter-rail";
import { fetchDiscoverFacets } from "@/lib/discover-facets";
import { formatCompanyName } from "@/lib/format-company-name";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_COMPANIES = 6;
const MAX_PRODUCTS = 4;
const MAX_LOCATIONS = 3;
const MAX_CERTS = 2;

type CompanySuggestion = {
  type: "company";
  label: string;
  sublabel: string | null;
  slug: string;
};

type TermSuggestion = {
  type: "product" | "location" | "cert";
  label: string;
  value: string;
};

export type DiscoverSuggestion = CompanySuggestion | TermSuggestion;

type CompanyRow = {
  slug: string;
  company_name: string;
  city: string | null;
  district: string | null;
};

async function fetchCompanies(q: string): Promise<CompanySuggestion[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("discover_suppliers", {
    p_q: q,
    p_entity_types: null,
    p_min_sources: null,
    p_cert_kinds: null,
    p_rsc_min: null,
    p_city: null,
    p_district: null,
    p_category: null,
    p_sort: "default",
    p_limit: MAX_COMPANIES,
    p_offset: 0,
    p_registries: null,
    p_factory_types: null,
    p_brand_codes: null,
    p_completeness_min: null,
    p_workers_min: null,
  });

  if (error || !data) return [];

  return (data as CompanyRow[]).map((row) => {
    const location = [row.city, row.district]
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(", ");
    return {
      type: "company" as const,
      label: formatCompanyName(row.company_name),
      sublabel: location || null,
      slug: row.slug,
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length === 0) {
    return Response.json(
      { q, suggestions: [] as DiscoverSuggestion[] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const lower = q.toLowerCase();

  const [companies, facets] = await Promise.all([
    fetchCompanies(q),
    fetchDiscoverFacets().catch(() => null),
  ]);

  const products: TermSuggestion[] = [];
  const locations: TermSuggestion[] = [];

  if (facets) {
    for (const p of facets.products) {
      if (products.length >= MAX_PRODUCTS) break;
      if (p.toLowerCase().includes(lower)) {
        products.push({ type: "product", label: p, value: p });
      }
    }

    const seen = new Set<string>();
    for (const loc of [...facets.cities, ...facets.districts]) {
      if (locations.length >= MAX_LOCATIONS) break;
      const key = loc.toLowerCase();
      if (key.includes(lower) && !seen.has(key)) {
        seen.add(key);
        locations.push({ type: "location", label: loc, value: loc });
      }
    }
  }

  const certs: TermSuggestion[] = CERT_KINDS.filter(
    (c) => c.label.toLowerCase().includes(lower) || c.value.toLowerCase().includes(lower),
  )
    .slice(0, MAX_CERTS)
    .map((c) => ({ type: "cert" as const, label: c.label, value: c.label }));

  const suggestions: DiscoverSuggestion[] = [
    ...companies,
    ...products,
    ...locations,
    ...certs,
  ];

  return Response.json(
    { q, suggestions },
    {
      headers: {
        // Same result for every visitor (no auth-specific data), so a short
        // shared cache is safe and keeps keystroke latency low.
        "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
      },
    },
  );
}
