// Spec M4 — Public sitemap.
//
// Next 15 `MetadataRoute.Sitemap` convention — Next bakes this to a
// route at `/sitemap.xml` and emits a body artefact under
// `.next/server/app/sitemap.*` that the M4 smoke reads.
//
// Static routes + 5 compliance slugs (from the M3 content module) +
// `/discover` + every `is_published=true` supplier slug from Supabase.
// Read uses the existing anon server client — `pol_suppliers_pub_read`
// already covers the SELECT, no service-role.
//
// JC #2: hourly ISR so daily ETL publish cycles surface within ~1h
// without a redeploy. SELECT wrapped in try/catch — a transient
// Supabase outage returns only the static routes rather than failing
// `pnpm build`. `[m4]`-prefixed log line mirrors the M1 convention.

import type { MetadataRoute } from "next";

import { COMPLIANCE_PAGES } from "@/lib/marketing/compliance-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

type SupplierRow = { slug: string; updated_at: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/status`, lastModified: now, changeFrequency: "hourly", priority: 0.5 },
    { url: `${SITE_URL}/legal/trademarks`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/data-sources`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/discover`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/compliance`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...COMPLIANCE_PAGES.map((p) => ({
      url: `${SITE_URL}/compliance/${p.slug}`,
      lastModified: new Date(p.last_reviewed_at),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  let supplierEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createSupabaseServerClient();
    const rows: SupplierRow[] = [];
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("suppliers")
        .select("slug, updated_at")
        .eq("is_published", true)
        .order("slug", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const batch = (data ?? []) as SupplierRow[];
      rows.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    supplierEntries = rows.map((r) => ({
      url: `${SITE_URL}/suppliers/${r.slug}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
    console.log(`[m4] sitemap suppliers: ${supplierEntries.length}`);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("[m4] sitemap suppliers fetch failed:", e?.code ?? e?.message ?? err);
    supplierEntries = [];
  }

  return [...staticEntries, ...supplierEntries];
}
