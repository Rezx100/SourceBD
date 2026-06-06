// Next.js cache tag constants for Discover and supplier surfaces.
//
// Used by `unstable_cache` wrappers in `lib/discover-facets.ts` and
// `lib/discover-suppliers.ts`, and by `revalidateTag` calls in admin
// route handlers (supplier edit / rescore / import, sanctions decide,
// certifications decide) so anon-cached pages refresh when moderators
// approve or change data.

export const TAG_DISCOVER_FACETS = "discover-facets" as const;
export const TAG_DISCOVER_SUPPLIERS = "discover-suppliers" as const;

export function tagSupplier(slug: string): string {
  return `supplier-${slug}`;
}
