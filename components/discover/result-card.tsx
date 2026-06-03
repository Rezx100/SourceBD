// Shared Discover result card — used by both `/app/discover` (auth) and
// `/discover` (public). Server component; takes a pre-typed `DiscoverRow`
// straight from the `discover_suppliers` RPC and renders the prototype
// design-language card (proto-card.hoverable + R1 receipt-stack glyph).
//
// SBI hard contract: payload is `t13_source_count` only — never any SBI
// numeric, pillar, grade, or "Score" / "Rating" string.

import Link from "next/link";

import { ReceiptsRing } from "@/components/receipts-ring";
import { ENTITY_TYPES } from "@/components/discover/filter-rail";

export type DiscoverRow = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  source_tags: string[];
  t13_source_count: number;
  completeness_pct: number;
  employees_total: number | null;
  established_date: string | null;
  principal_products: string[];
  factory_types: string[];
  rsc_progress_pct: number | null;
  parent_group_name: string | null;
  total_count: number;
};

export function DiscoverResultCard({
  row,
  hrefBase,
  actionSlot,
}: {
  row: DiscoverRow;
  hrefBase: "/app/suppliers" | "/suppliers";
  actionSlot?: React.ReactNode;
}) {
  const location = [row.city, row.district].filter(Boolean).join(", ");
  const entityLabel =
    ENTITY_TYPES.find((o) => o.value === row.entity_type)?.label ??
    row.entity_type.replace(/_/g, " ");
  const visiblePills = row.source_tags.slice(0, 4);
  const extraPills = Math.max(0, row.source_tags.length - visiblePills.length);
  const thin = row.t13_source_count <= 1 && row.completeness_pct < 50;
  const completenessClass = thin ? "completeness thin" : "completeness";

  return (
    <article className="proto-card hoverable relative">
      <div className="absolute right-5 top-5 flex items-center gap-2">
        {row.completeness_pct > 0 ? (
          <span className={completenessClass} title="Completeness">
            {row.completeness_pct}%
          </span>
        ) : null}
        {actionSlot}
      </div>

      <Link
        href={`${hrefBase}/${row.slug}`}
        className="flex items-start gap-5 rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest"
      >
        <div className="shrink-0 pt-1">
          <ReceiptsRing sources={row.t13_source_count} size={32} />
        </div>

        <div className="min-w-0 flex-1 space-y-3 pr-32">
          <div>
            <h2 className="header-name !text-xl">{row.company_name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="chip">{entityLabel}</span>
              {location ? (
                <span className="text-ink-tertiary">{location}</span>
              ) : null}
              {row.parent_group_name ? (
                <span className="text-ink-tertiary">
                  · part of {row.parent_group_name}
                </span>
              ) : null}
            </div>
          </div>

          {visiblePills.length > 0 ? (
            <div className="pill-row">
              {visiblePills.map((tag) => (
                <span key={tag} className="proto-pill">
                  {tag}
                </span>
              ))}
              {extraPills > 0 ? (
                <span className="proto-pill inherited">
                  + {extraPills} more
                </span>
              ) : null}
            </div>
          ) : null}

          <StatLine row={row} />
        </div>
      </Link>
    </article>
  );
}

function StatLine({ row }: { row: DiscoverRow }) {
  const parts: string[] = [];
  if (row.established_date) parts.push(`Established ${row.established_date}`);
  if (row.employees_total)
    parts.push(`${row.employees_total.toLocaleString()} employees`);
  if (row.factory_types.length > 0)
    parts.push(row.factory_types.slice(0, 2).join(" · "));
  if (row.principal_products.length > 0)
    parts.push(row.principal_products.slice(0, 3).join(", "));
  if (row.rsc_progress_pct !== null)
    parts.push(`RSC ${Number(row.rsc_progress_pct).toFixed(0)}%`);
  if (parts.length === 0) return null;
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-tertiary">
      {parts.join(" · ")}
    </p>
  );
}
