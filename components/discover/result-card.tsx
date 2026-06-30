// Shared Discover result card — used by both `/app/discover` (auth) and
// `/discover` (public). Server component; takes a pre-typed `DiscoverRow`
// straight from the `discover_suppliers` RPC and renders the prototype
// design-language card (white hairline surface + verified-sources glyph).
//
// SBI hard contract: payload is `t13_source_count` only — never any SBI
// numeric, pillar, grade, or "Score" / "Rating" string.

import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarBlank,
  Factory,
  Gauge,
  MapPin,
  Package,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";

import { ReceiptsRing } from "@/components/receipts-ring";
import { Pill } from "@/components/ui/page-kit";
import { ProductIcon } from "@/components/supplier/product-icon";
import { ENTITY_TYPES } from "@/components/discover/filter-rail";
import { establishedYear } from "@/lib/established";
import { formatCompanyName } from "@/lib/format-company-name";
import { formatProfileCityLine } from "@/lib/format-location";
import { dedupProducts } from "@/lib/product-icons";
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

export type DiscoverRow = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  source_tags: string[];
  t13_source_count: number;
  completeness_pct?: number | null;
  employees_total: number | null;
  established_date: string | null;
  principal_products: string[];
  factory_types: string[];
  rsc_progress_pct: number | null;
  parent_group_name: string | null;
  primary_address?: string | null;
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
  const location = formatProfileCityLine(
    row.primary_address,
    row.city,
    row.district,
  );
  const entityLabel =
    ENTITY_TYPES.find((o) => o.value === row.entity_type)?.label ??
    row.entity_type.replace(/_/g, " ");
  const visiblePills = row.source_tags.slice(0, 4);
  const extraPills = Math.max(0, row.source_tags.length - visiblePills.length);

  return (
    <article className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition-colors duration-200 ease-smooth hover:border-neutral-300 hover:bg-neutral-50 sm:p-5">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        {actionSlot}
      </div>

      <Link
        href={`${hrefBase}/${row.slug}`}
        className="flex flex-col gap-4 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest sm:flex-row sm:items-start sm:gap-5"
      >
        <div className="flex items-center gap-3 sm:block">
          <ReceiptsRing sources={row.t13_source_count} size={48} />
        </div>

        <div className="min-w-0 flex-1 space-y-3.5">
          <div className="space-y-2 pr-8">
            <h2 className="font-display text-base font-semibold leading-snug tracking-[-0.01em] text-neutral-900">
              {formatCompanyName(row.company_name)}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
              <Pill tone="forest">{entityLabel}</Pill>
              {location ? (
                <span className="inline-flex items-center gap-1 text-neutral-700">
                  <MapPin size={13} weight="duotone" aria-hidden />
                  {location}
                </span>
              ) : null}
              {row.parent_group_name ? (
                <span className="inline-flex items-center gap-1 text-neutral-500">
                  <Factory size={13} weight="duotone" aria-hidden />
                  part of {row.parent_group_name}
                </span>
              ) : null}
            </div>
          </div>

          {visiblePills.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                {visiblePills.map((tag) => (
                  <SourcePill key={tag} tag={tag} />
                ))}
                {extraPills > 0 ? (
                  <span className="self-center text-[12px] font-medium text-neutral-500">
                    +{extraPills} more
                  </span>
                ) : null}
              </div>
              <SupplierFactCluster row={row} />
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
  const cleaned = dedupProducts(products);
  const limit = 5;
  const shown = cleaned.slice(0, limit);
  const overflow = Math.max(0, cleaned.length - shown.length);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((product) => (
        <span
          key={product}
          className="inline-flex min-h-8 items-center gap-2 rounded-pill border border-neutral-200 bg-neutral-50 py-1 pl-1.5 pr-2.5 text-[12px] font-medium leading-none text-neutral-700"
        >
          <ProductIcon product={product} className="product-icon preview-product-icon" />
          {product}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="inline-flex min-h-7 items-center rounded-pill border border-dashed border-neutral-300 px-2.5 py-1 text-[12px] font-medium leading-none text-neutral-500">
          +{overflow} more
        </span>
      ) : null}
    </div>
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
    <span className="inline-flex min-h-8 items-center gap-2 rounded-pill border border-neutral-200 bg-white px-2.5 py-1 text-[12px] font-medium text-neutral-700 shadow-[0_1px_1px_rgba(15,15,20,0.03)]">
      <span
        data-source={tag}
        className="discover-source-pill-logo flex h-5 max-w-9 shrink-0 items-center justify-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" className="max-h-5 max-w-9 object-contain" />
      </span>
      {label}
    </span>
  );
}

function SupplierFactCluster({ row }: { row: DiscoverRow }) {
  const facts: string[] = [];
  if (typeof row.completeness_pct === "number") {
    facts.push(`${Math.round(row.completeness_pct)}% complete`);
  }
  facts.push(`${Math.min(row.t13_source_count, 5)}${row.t13_source_count > 5 ? "+" : ""} verified sources`);
  if (facts.length < 2 && row.rsc_progress_pct !== null) {
    facts.push(`RSC ${Number(row.rsc_progress_pct).toFixed(0)}%`);
  }
  if (facts.length < 2 && row.employees_total) {
    facts.push(`${row.employees_total.toLocaleString()} workers`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-neutral-500 sm:justify-end">
      {facts.map((fact) => (
        <span
          key={fact}
          className="inline-flex min-h-7 items-center rounded-pill border border-neutral-200 bg-neutral-50 px-2.5 py-1"
        >
          {fact}
        </span>
      ))}
    </div>
  );
}

function StatLine({ row }: { row: DiscoverRow }) {
  const parts: { label: string; icon: ReactNode }[] = [];
  const estYear = establishedYear(row.established_date);
  if (estYear)
    parts.push({
      label: `Est. ${estYear}`,
      icon: <CalendarBlank size={13} weight="duotone" aria-hidden />,
    });
  if (row.employees_total)
    parts.push({
      label: `${row.employees_total.toLocaleString()} employees`,
      icon: <UsersThree size={13} weight="duotone" aria-hidden />,
    });
  if (row.factory_types.length > 0)
    parts.push({
      label: row.factory_types.slice(0, 2).join(" · "),
      icon: <Package size={13} weight="duotone" aria-hidden />,
    });
  if (row.rsc_progress_pct !== null)
    parts.push({
      label: `RSC ${Number(row.rsc_progress_pct).toFixed(0)}%`,
      icon: <Gauge size={13} weight="duotone" aria-hidden />,
    });
  if (parts.length === 0) return null;
  return (
    <div className="grid gap-2 border-t border-neutral-200 pt-3 text-[12px] text-neutral-500 min-[460px]:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
      {parts.map((part) => (
        <span
          key={part.label}
          className="inline-flex min-w-0 items-center gap-1.5"
        >
          <span className="shrink-0 text-neutral-400">{part.icon}</span>
          <span className="min-w-0 truncate sm:whitespace-normal">
            {part.label}
          </span>
        </span>
      ))}
    </div>
  );
}
