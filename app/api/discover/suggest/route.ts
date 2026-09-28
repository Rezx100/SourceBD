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
import { appSuggestions, placeWords } from "@/lib/search-suggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_COMPANIES = 6;
const MAX_PRODUCTS = 4;
const MAX_LOCATIONS = 3;
const MAX_CERTS = 2;
const MAX_Q_LEN = 200;

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
  /**
   * The buyer-search parameter this term sets exactly, when there is one:
   * a city is `city=`, a district `district=`, a certificate kind `cert=`
   * (the v3.2 search's own keys, `lib/discover-v32-state.ts`). Without it
   * the term runs as free text. The public `/discover` box ignores it.
   */
  param?: [key: string, value: string];
};

export type DiscoverSuggestion = CompanySuggestion | TermSuggestion;

type CompanyRow = {
  slug: string;
  company_name: string;
  city: string | null;
  district: string | null;
};

async function fetchCompanyRows(q: string, limit: number): Promise<CompanyRow[]> {
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
    p_limit: limit,
    p_offset: 0,
    p_registries: null,
    p_factory_types: null,
    p_brand_codes: null,
    p_completeness_min: null,
    p_workers_min: null,
  });

  if (error || !Array.isArray(data)) return [];
  return data as CompanyRow[];
}

async function fetchCompanies(q: string): Promise<CompanySuggestion[]> {
  return (await fetchCompanyRows(q, MAX_COMPANIES)).map((row) => ({
    type: "company" as const,
    label: formatCompanyName(row.company_name),
    // "Gazipur" once: a city and a district of the same name are one place.
    sublabel: placeWords(row.city, row.district),
    slug: row.slug,
  }));
}

/**
 * The buyer app's field (`?scope=app`): categories first, then certificates
 * and places, then suppliers whose NAME matches (`lib/search-suggest.ts`).
 * The search ranks by its full-text match over names AND product lists, so
 * it is asked for more rows than are shown and only the name matches kept.
 */
async function appScope(q: string) {
  const [rows, facets] = await Promise.all([fetchCompanyRows(q, 24).catch(() => []), fetchDiscoverFacets().catch(() => null)]);
  return appSuggestions({
    query: q,
    companies: rows.map((r) => ({ slug: r.slug, name: formatCompanyName(r.company_name), city: r.city, district: r.district })),
    products: facets?.products ?? [],
    districts: facets?.districts ?? [],
    cities: facets?.cities ?? [],
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

  if (q.length > MAX_Q_LEN) {
    return Response.json(
      { error: "query_too_long", max: MAX_Q_LEN },
      { status: 400 },
    );
  }

  if (searchParams.get("scope") === "app") {
    return Response.json(
      { q, suggestions: await appScope(q) },
      { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" } },
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
    // Districts first: Dhaka, Gazipur, Narayanganj and Chittagong are each
    // both a district and a city, and the district is the wider search.
    for (const [field, list] of [
      ["district", facets.districts],
      ["city", facets.cities],
    ] as const) {
      for (const loc of list) {
        if (locations.length >= MAX_LOCATIONS) break;
        const key = loc.toLowerCase();
        if (key.includes(lower) && !seen.has(key)) {
          seen.add(key);
          locations.push({ type: "location", label: loc, value: loc, param: [field, loc] });
        }
      }
    }
  }

  const certs: TermSuggestion[] = CERT_KINDS.filter(
    (c) => c.label.toLowerCase().includes(lower) || c.value.toLowerCase().includes(lower),
  )
    .slice(0, MAX_CERTS)
    .map((c) => ({ type: "cert" as const, label: c.label, value: c.label, param: ["cert", c.value] }));

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
