/**
 * Facility slug → mother profile redirect — REZ-72 / Extensions B2.
 *
 * When `buyer_supplier_profile` returns nothing, both profile routes call
 * `facility_parent_slug` before `notFound()`. Shared decision logic lives here
 * so the marketing and app routes cannot drift.
 *
 * SQL SoT: `supabase/migrations/0096_facility_parent_slug.sql`
 * Sitemap: unpublished facilities already drop out via `.eq("is_published", true)`.
 */

// "public" is the loading-free app/(public) group serving /suppliers/[slug];
// "app" is the authenticated /app/suppliers/[slug] route.
export type FacilityRouteGroup = "public" | "app";

export type UnpublishedProfileOutcome =
  | { action: "render" }
  | { action: "redirect"; path: string }
  | { action: "not_found" };

/** Paths pinned by containment tests — relative to repo root. */
export const FACILITY_PARENT_SLUG_MIGRATION =
  "supabase/migrations/0096_facility_parent_slug.sql";

export const SITEMAP_SOURCE = "app/sitemap.ts";

export function facilityParentPath(
  routeGroup: FacilityRouteGroup,
  parentSlug: string,
): string {
  return routeGroup === "app"
    ? `/app/suppliers/${parentSlug}`
    : `/suppliers/${parentSlug}`;
}

/**
 * Pure decision for the profile miss path.
 *
 * `parentSlug` is whatever `facility_parent_slug` returned (null when the slug
 * is not a facility, the mother is unpublished, or the slug does not exist).
 * A published profile never reaches this with `profileFound: false`.
 */
export function resolveUnpublishedProfileMiss(args: {
  profileFound: boolean;
  parentSlug: string | null;
  routeGroup: FacilityRouteGroup;
}): UnpublishedProfileOutcome {
  if (args.profileFound) return { action: "render" };

  const slug =
    typeof args.parentSlug === "string" ? args.parentSlug.trim() : "";
  if (slug.length > 0) {
    return {
      action: "redirect",
      path: facilityParentPath(args.routeGroup, slug),
    };
  }
  return { action: "not_found" };
}

type RpcClient = {
  rpc: (
    fn: string,
    args: { p_slug: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

/**
 * Server-side lookup. On RPC error, treat as no mapping (404) — never leak.
 *
 * A row whose `facility_of` points at itself would otherwise redirect to its
 * own URL in an infinite loop; a self-mapping is treated as no mapping.
 */
export async function fetchFacilityParentSlug(
  supabase: RpcClient,
  slug: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("facility_parent_slug", {
    p_slug: slug,
  });
  if (error) return null;
  if (typeof data !== "string") return null;
  const trimmed = data.trim();
  if (trimmed.length === 0 || trimmed === slug) return null;
  return trimmed;
}

/**
 * Pin the migration contract and sitemap gate without a live database.
 */
export function assertFacilityParentRedirectContract(args: {
  migrationSql: string;
  sitemapSource: string;
}): void {
  const { migrationSql, sitemapSource } = args;

  if (!/create or replace function public\.facility_parent_slug\(p_slug text\)/.test(
    migrationSql,
  )) {
    throw new Error("migration must define facility_parent_slug(p_slug text)");
  }
  if (!/security definer/i.test(migrationSql)) {
    throw new Error("facility_parent_slug must be SECURITY DEFINER");
  }
  if (!/c\.facility_of is not null/.test(migrationSql)) {
    throw new Error(
      "query must require facility_of is not null — non-facility unpublished rows must 404",
    );
  }
  if (!/p\.is_published = true/.test(migrationSql)) {
    throw new Error("parent must be published or the function returns NULL");
  }
  if (!/returns text/.test(migrationSql)) {
    throw new Error("function must return only text (the parent slug)");
  }
  const bodyMatch = migrationSql.match(/as \$\$([\s\S]*?)\$\$;/);
  const body = bodyMatch?.[1] ?? "";
  if (!body || /jsonb|company_name|email_primary|phones|contact_name/.test(body)) {
    throw new Error("function body must select only p.slug — no PII or jsonb");
  }
  if (!/grant execute on function public\.facility_parent_slug\(text\) to anon, authenticated/.test(
    migrationSql,
  )) {
    throw new Error("anon and authenticated need EXECUTE for the redirect lookup");
  }

  // Exactly one suppliers fetch, gated on is_published — no second source.
  const supplierFrom = [
    ...sitemapSource.matchAll(/\.from\(\s*["']suppliers["']\s*\)/g),
  ];
  if (supplierFrom.length !== 1) {
    throw new Error(
      `sitemap must have exactly one suppliers source, found ${supplierFrom.length}`,
    );
  }
  if (!/\.eq\(\s*["']is_published["']\s*,\s*true\s*\)/.test(sitemapSource)) {
    throw new Error("sitemap must gate suppliers on is_published = true");
  }
}
