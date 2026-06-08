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
import { apparelIconUrl } from "@/lib/apparel-icons";
import { establishedYear } from "@/lib/established";

// Source-code → human pill label. Brand disclosure codes (`BRAND_ASOS`,
// `BRAND_HM`, …) must never render raw on a card; certification codes keep
// their issuer-canonical hyphenation. Everything else (registry codes like
// BGMEA / EPB / RSC) renders as-is.
const BRAND_PILL_LABELS: Record<string, string> = {
  BRAND_HM: "H&M",
  BRAND_NEXT: "Next",
  BRAND_MS: "M&S",
  BRAND_ASOS: "ASOS",
};

function pillLabel(tag: string): string {
  const brand = BRAND_PILL_LABELS[tag];
  if (brand) return brand;
  if (tag.startsWith("BRAND_")) {
    const raw = tag.slice(6).replace(/_/g, " ").trim();
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : tag;
  }
  if (tag === "OEKO_TEX") return "OEKO-TEX";
  return tag;
}

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
  footerSlot,
}: {
  row: DiscoverRow;
  hrefBase: "/app/suppliers" | "/suppliers";
  actionSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
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
                  {pillLabel(tag)}
                </span>
              ))}
              {extraPills > 0 ? (
                <span className="proto-pill inherited">
                  + {extraPills} more
                </span>
              ) : null}
            </div>
          ) : null}

          {row.principal_products.length > 0 ? (
            <ProductsRow products={row.principal_products} />
          ) : null}

          <StatLine row={row} />
          {footerSlot}
        </div>
      </Link>
    </article>
  );
}

function ProductsRow({ products }: { products: string[] }) {
  const limit = 6;
  const shown = products.slice(0, limit);
  const overflow = Math.max(0, products.length - shown.length);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink-secondary">
      {shown.map((p) => (
        <ProductTag key={p} product={p} />
      ))}
      {overflow > 0 ? (
        <span className="text-ink-tertiary">+ {overflow} more</span>
      ) : null}
    </div>
  );
}

function ProductTag({ product }: { product: string }) {
  const icon = apparelIconUrl(product);
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          width={16}
          height={16}
          loading="lazy"
          className="inline-block opacity-80"
        />
      ) : (
        <span aria-hidden className="text-ink-tertiary">
          ◆
        </span>
      )}
      <span>{product}</span>
    </span>
  );
}

function StatLine({ row }: { row: DiscoverRow }) {
  const parts: string[] = [];
  const estYear = establishedYear(row.established_date);
  if (estYear) parts.push(`Established ${estYear}`);
  if (row.employees_total)
    parts.push(`${row.employees_total.toLocaleString()} employees`);
  if (row.factory_types.length > 0)
    parts.push(row.factory_types.slice(0, 2).join(" · "));
  if (row.rsc_progress_pct !== null)
    parts.push(`RSC ${Number(row.rsc_progress_pct).toFixed(0)}%`);
  if (parts.length === 0) return null;
  return (
    <p className="text-[11px] text-ink-tertiary">
      {parts.join(" · ")}
    </p>
  );
}
