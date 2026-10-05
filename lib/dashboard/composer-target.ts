// The RFQ composer's inputs, read on the server or in the browser: a supplier
// row as the composer draws it, and the buyer's workspace defaults. One module
// for the search's pane, the page-mode composer, the supplier picker and
// GET /api/v1/suppliers, so the four cannot draw one supplier four ways.
//
// Not a client module: the server pages call these, and a function exported
// from a "use client" file cannot be called on the server.

import type { ComposerTarget, ComposerWorkspace } from "@/components/rfqs/composer-model";
import { displayName, entityLabel, initials, placeLabel } from "@/lib/dashboard/facts";
import { marksFromTags, topTier } from "@/lib/dashboard/source-tiers";

/** The only supplier columns a composer target is read from. Each is granted to `authenticated` (0083); none is a contact detail. */
export const TARGET_COLUMNS = "id, slug, company_name, entity_type, city, district, source_tags, is_published, is_sanctioned";

/** A supplier as the suppliers table, the saved list and `rfq_get`'s targets carry it. Never a contact value. */
export type SupplierRow = {
  id: string;
  slug: string;
  company_name: string;
  entity_type?: string | null;
  city?: string | null;
  district?: string | null;
  source_tags?: string[] | null;
  is_published?: boolean | null;
  is_sanctioned?: boolean | null;
};

export function targetFromRow(r: SupplierRow): ComposerTarget {
  const name = displayName(r.company_name);
  const tags = r.source_tags ?? [];
  return {
    id: r.id,
    slug: r.slug,
    name,
    initials: initials(name),
    tier: topTier(tags),
    marks: marksFromTags(tags),
    place: placeLabel(r.city ?? null, r.district ?? null),
    type: entityLabel(r.entity_type ?? null),
    sanctioned: Boolean(r.is_sanctioned),
  };
}

/** `settings_get`'s answer → the composer's workspace; null when there is none to read. */
export function workspaceFrom(raw: unknown): ComposerWorkspace | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const w = (s.workspace && typeof s.workspace === "object" ? s.workspace : {}) as Record<string, unknown>;
  const inq = (s.inquiry && typeof s.inquiry === "object" ? s.inquiry : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    companyName: str(w.company_name),
    userName: str(s.display_name),
    website: str(w.website),
    questions: Array.isArray(inq.questions) ? inq.questions.filter((q): q is string => typeof q === "string" && q.trim().length > 0) : [],
    emailTemplate: str(inq.email_template),
  };
}
