// GET /api/v1/suppliers?ids=<uuid,…>&slugs=<slug,…> — the RFQ composer's
// targets, resolved on the server.
//
// The supplier picker gathers suppliers from three places (the buyer's saved
// list, the typeahead, their recent RFQs) and only one of them knows the id,
// the source tags and the sanction flag. So the composer asks here once, when
// the buyer confirms: every target is read from `public.suppliers` through the
// caller's session, published only, with the columns migration 0083 grants to
// `authenticated` — never a contact column. A sanctioned supplier comes back
// flagged, so the composer can say so before `rfq_create` refuses it.
//
// Buyer or admin only: this is the composer's lookup, not a public directory.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { TARGET_COLUMNS } from "@/lib/dashboard/composer-target";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,199}$/;
/** `rfq_create`'s own cap: one RFQ goes to at most 50 suppliers. */
const MAX = 50;

// A route file may export only its handlers and config: the columns live in lib.
type TargetRow = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string | null;
  city: string | null;
  district: string | null;
  source_tags: string[] | null;
  is_sanctioned: boolean;
};

function list(v: string | null, re: RegExp): string[] | null {
  if (!v) return [];
  const items = [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))];
  if (items.length > MAX || items.some((x) => !re.test(x))) return null;
  return items;
}

export async function GET(req: Request) {
  const role = await getServerRole();
  if (role !== "buyer" && role !== "admin") {
    return NextResponse.json({ error: "Sign in with a buyer account." }, { status: 401 });
  }
  const url = new URL(req.url);
  const ids = list(url.searchParams.get("ids"), UUID_RE);
  const slugs = list(url.searchParams.get("slugs"), SLUG_RE);
  if (ids === null || slugs === null) {
    return NextResponse.json({ error: `Pass up to ${MAX} supplier ids or slugs, separated by commas.` }, { status: 400 });
  }
  if (ids.length + slugs.length === 0) return NextResponse.json({ rows: [] });
  if (ids.length + slugs.length > MAX) {
    return NextResponse.json({ error: `An RFQ goes to at most ${MAX} suppliers.` }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const reads = await Promise.all([
    ids.length > 0 ? supabase.from("suppliers").select(TARGET_COLUMNS).in("id", ids).eq("is_published", true) : null,
    slugs.length > 0 ? supabase.from("suppliers").select(TARGET_COLUMNS).in("slug", slugs).eq("is_published", true) : null,
  ]);
  if (reads.some((r) => r?.error)) {
    return NextResponse.json({ error: "The suppliers could not be read just now. Try again in a moment." }, { status: 502 });
  }
  const seen = new Set<string>();
  const rows: TargetRow[] = [];
  for (const r of reads) {
    for (const raw of ((r?.data as unknown[] | null) ?? []) as Record<string, unknown>[]) {
      if (typeof raw.id !== "string" || seen.has(raw.id)) continue;
      seen.add(raw.id);
      // Named fields only: a column added to the select by mistake still cannot leave.
      rows.push({
        id: raw.id,
        slug: String(raw.slug ?? ""),
        company_name: String(raw.company_name ?? ""),
        entity_type: typeof raw.entity_type === "string" ? raw.entity_type : null,
        city: typeof raw.city === "string" ? raw.city : null,
        district: typeof raw.district === "string" ? raw.district : null,
        source_tags: Array.isArray(raw.source_tags) ? raw.source_tags.filter((t): t is string => typeof t === "string") : null,
        is_sanctioned: raw.is_sanctioned === true,
      });
    }
  }
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "private, no-store" } });
}
