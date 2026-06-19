// Shared Discover result card — used by both `/app/discover` (auth) and
// `/discover` (public). Server component; takes a pre-typed `DiscoverRow`
// straight from the `discover_suppliers` RPC and renders the prototype
// design-language card (proto-card.hoverable + R1 receipt-stack glyph).
//
// SBI hard contract: payload is `t13_source_count` only — never any SBI
// numeric, pillar, grade, or "Score" / "Rating" string.

import Link from "next/link";

import { ReceiptsRing } from "@/components/receipts-ring";
import { Pill } from "@/components/ui/page-kit";
import { ENTITY_TYPES } from "@/components/discover/filter-rail";
import { establishedYear } from "@/lib/established";
import { sourceLogo } from "@/lib/source-logos";

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

// Source data tags some products with parenthesised sub-classification codes
// — standalone "(B)" entries or trailing "Polo Shirt (A)" markers from the
// BGMEA / EPB feeds. They mean nothing to a buyer, so peel them before
// display (mirrors `stripMarker` on the full dossier).
function cleanProduct(raw: string): string {
  let s = (raw ?? "").trim();
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/^\(\s*[A-Za-z0-9]{1,3}\s*\)\s*/, "")
      .replace(/\s*\(\s*[A-Za-z0-9]{1,3}\s*\)\s*$/, "")
      .trim();
  }
  return s;
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

  return (
    <article className="group relative rounded-lg border border-hairline bg-surface-l1 p-4 transition-colors duration-200 ease-smooth hover:border-brand-forest/30 hover:bg-[#fbfdfb] sm:p-6">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        {actionSlot}
      </div>

      <Link
        href={`${hrefBase}/${row.slug}`}
        className="flex items-start gap-3.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest sm:gap-5"
      >
        <div className="shrink-0">
          <ReceiptsRing sources={row.t13_source_count} size={32} />
        </div>

        <div className="min-w-0 flex-1 space-y-3.5">
          <div className="space-y-2 pr-8">
            <h2 className="font-display text-[19px] font-bold leading-snug tracking-[-0.02em] text-ink-primary">
              {row.company_name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
              <Pill tone="forest">{entityLabel}</Pill>
              {location ? (
                <span className="text-ink-secondary">{location}</span>
              ) : null}
              {row.parent_group_name ? (
                <span className="text-ink-tertiary">
                  · part of {row.parent_group_name}
                </span>
              ) : null}
            </div>
          </div>

          {visiblePills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {visiblePills.map((tag) => (
                <SourcePill key={tag} tag={tag} />
              ))}
              {extraPills > 0 ? (
                <span className="self-center text-[12px] font-medium text-ink-tertiary">
                  +{extraPills} more
                </span>
              ) : null}
            </div>
          ) : null}

          {row.principal_products.length > 0 ? (
            <ProductsLine products={row.principal_products} />
          ) : null}

          <StatLine row={row} />
          {footerSlot}
        </div>
      </Link>
    </article>
  );
}

function ProductsLine({ products }: { products: string[] }) {
  const cleaned = products.map(cleanProduct).filter(Boolean);
  const limit = 6;
  const shown = cleaned.slice(0, limit);
  const overflow = Math.max(0, cleaned.length - shown.length);
  if (shown.length === 0) return null;
  return (
    <p className="text-[13px] leading-relaxed text-ink-secondary">
      {shown.join("  ·  ")}
      {overflow > 0 ? (
        <span className="text-ink-tertiary">{`  ·  +${overflow} more`}</span>
      ) : null}
    </p>
  );
}

// Source/registry chip. Renders a rounded provider logo when one exists,
// otherwise falls back to a plain neutral text pill.
function SourcePill({ tag }: { tag: string }) {
  const logo = sourceLogo(tag);
  const label = pillLabel(tag);
  if (!logo) {
    return <Pill tone="neutral">{label}</Pill>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface-l1 py-[3px] pl-[3px] pr-2.5 text-[12px] font-medium text-ink-secondary">
      <span className="flex size-[18px] items-center justify-center overflow-hidden rounded-full border border-hairline bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" className="size-full object-contain p-[1px]" />
      </span>
      {label}
    </span>
  );
}

function StatLine({ row }: { row: DiscoverRow }) {
  const parts: string[] = [];
  const estYear = establishedYear(row.established_date);
  if (estYear) parts.push(`Est. ${estYear}`);
  if (row.employees_total)
    parts.push(`${row.employees_total.toLocaleString()} employees`);
  if (row.factory_types.length > 0)
    parts.push(row.factory_types.slice(0, 2).join(" · "));
  if (row.rsc_progress_pct !== null)
    parts.push(`RSC ${Number(row.rsc_progress_pct).toFixed(0)}%`);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-hairline pt-3 text-[12px] text-ink-tertiary">
      {parts.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-2">
          {i > 0 ? (
            <span aria-hidden className="text-hairline-strong">
              ·
            </span>
          ) : null}
          {p}
        </span>
      ))}
    </div>
  );
}
