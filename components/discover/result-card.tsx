// Shared supplier list card — the one card design used everywhere a
// supplier/company preview renders: buyer Discover (`/app/discover`),
// public Discover (`/discover`), Saved (`/app/saved`), the buyer dashboard's
// recently-saved list, and Smart Match results. Server component; takes a
// pre-typed `DiscoverRow` straight from the `discover_suppliers` RPC (or an
// equivalent mapped shape) and renders the finalized card design decided in
// the 2 Jul UX audit (see frontend-design-spec.md §0.2 and §14.2).
//
// SBI hard contract: payload is `t13_source_count` only — never any SBI
// numeric, pillar, grade, or "Score" / "Rating" string.

import Link from "next/link";
import {
  ArrowRight,
  CalendarBlank,
  Gauge,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";

import { CompanyAvatar } from "@/components/supplier/company-avatar";
import { ProductIcon } from "@/components/supplier/product-icon";
import { ENTITY_TYPES } from "@/components/discover/filter-rail";
import {
  COMPLETENESS_BAND_CLASSES,
  completenessBand,
} from "@/lib/completeness-band";
import { establishedYear } from "@/lib/established";
import { formatCompanyName } from "@/lib/format-company-name";
import { formatProfileCityLine } from "@/lib/format-location";
import { dedupProducts } from "@/lib/product-icons";
import { sourceLogo } from "@/lib/source-logos";
import { cn } from "@/lib/utils";

// Source-code → human label, used for accessible names and the "+N more"
// overflow text. Brand disclosure codes (`BRAND_ASOS`, `BRAND_HM`, …) must
// never render raw on a card; certification codes keep their
// issuer-canonical hyphenation. Everything else (registry codes like
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

/** Compact 3–4 letter mark for the registry-mark tile (real logo is used
 *  instead whenever one exists — this is only the text fallback). */
function shortCode(tag: string): string {
  const letters = pillLabel(tag).replace(/[^A-Za-z0-9]/g, "");
  return letters.length > 4 ? letters.slice(0, 3).toUpperCase() : letters.toUpperCase();
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
  const visibleMarks = row.source_tags.slice(0, 3);
  const extraMarks = Math.max(0, row.source_tags.length - visibleMarks.length);
  const name = formatCompanyName(row.company_name);
  const estYear = establishedYear(row.established_date);

  return (
    <article className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white px-4 pb-3.5 pt-4 text-left shadow-sm transition-colors duration-200 ease-smooth hover:border-brand-forest/[0.22] hover:bg-neutral-50 sm:p-5">
      {actionSlot ? (
        <div className="absolute right-4 top-4 z-10 sm:right-5 sm:top-5">
          {actionSlot}
        </div>
      ) : null}

      <Link
        href={`${hrefBase}/${row.slug}`}
        className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest"
      >
        <div className="flex items-start gap-4 sm:gap-5">
          <CompanyAvatar
            name={name}
            verified={row.t13_source_count > 0}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2 pr-8">
              <h2 className="truncate font-display text-[19px] font-black leading-tight tracking-[-0.02em] text-neutral-900 transition-colors group-hover:text-brand-forest sm:text-[21px]">
                {name}
              </h2>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-neutral-600">
              <span className="inline-flex items-center rounded-pill bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                {entityLabel}
              </span>
              {location ? (
                <>
                  <MapPin
                    size={12}
                    weight="fill"
                    aria-hidden
                    className="ml-0.5 shrink-0 text-neutral-400"
                  />
                  <span className="truncate">{location}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {visibleMarks.length > 0 || row.t13_source_count > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-neutral-600 sm:gap-3">
            {visibleMarks.map((tag) => (
              <RegistryMark key={tag} tag={tag} />
            ))}
            {extraMarks > 0 ? (
              <span className="text-neutral-500">+{extraMarks}</span>
            ) : null}
            <span className="min-w-0 truncate font-medium text-neutral-700">
              {Math.min(row.t13_source_count, 5)}
              {row.t13_source_count > 5 ? "+" : ""} verified{" "}
              {row.t13_source_count === 1 ? "source" : "sources"}
            </span>
            {typeof row.completeness_pct === "number" ? (
              <CompletenessPill
                pct={row.completeness_pct}
                className="ml-auto shrink-0"
              />
            ) : null}
          </div>
        ) : null}

        {row.principal_products.length > 0 ? (
          <ProductsLine products={row.principal_products} />
        ) : null}

        {footerSlot}

        <div
          className="mt-3 flex items-center justify-between gap-3 pt-3 text-[12px] text-neutral-500"
          style={{ borderTop: "1px solid rgba(15,15,20,0.045)" }}
        >
          <div className="flex flex-wrap items-center gap-3">
            {estYear ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarBlank size={13} weight="duotone" aria-hidden className="text-neutral-400" />
                Est. {estYear}
              </span>
            ) : null}
            {row.employees_total ? (
              <span className="inline-flex items-center gap-1">
                <span className="font-display text-[14px] font-bold tabular-nums text-neutral-700">
                  {row.employees_total.toLocaleString()}
                </span>
                employees
              </span>
            ) : null}
          </div>
          <span className="-mr-1.5 flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-brand-forest transition-colors duration-hover ease-smooth group-hover:bg-brand-forest-soft">
            View profile
            <ArrowRight
              size={13}
              weight="bold"
              aria-hidden
              className="transition-transform duration-hover ease-smooth group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </Link>
    </article>
  );
}

function ProductsLine({ products }: { products: string[] }) {
  const cleaned = dedupProducts(products);
  if (cleaned.length === 0) return null;

  // One fewer inline chip on mobile than desktop — same "+N more" pattern
  // already used for registry marks, so no data is lost, it's just
  // disclosed one tap later on the narrower viewport instead of wrapping.
  const desktopShown = cleaned.slice(0, 3);
  const mobileShown = cleaned.slice(0, 2);
  const desktopOverflow = cleaned.length - desktopShown.length;
  const mobileOverflow = cleaned.length - mobileShown.length;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-snug text-neutral-700">
      {desktopShown.map((product, i) => (
        <span
          key={product}
          className={cn(
            "inline-flex items-center gap-1 font-medium",
            i >= mobileShown.length && "hidden sm:inline-flex",
          )}
        >
          <ProductIcon
            product={product}
            className="product-icon preview-product-icon shrink-0 text-neutral-400"
          />
          {product}
        </span>
      ))}
      {mobileOverflow > 0 ? (
        <span className="font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2 sm:hidden">
          +{mobileOverflow} more categories
        </span>
      ) : null}
      {desktopOverflow > 0 ? (
        <span className="hidden font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2 sm:inline">
          +{desktopOverflow} more categories
        </span>
      ) : null}
    </div>
  );
}

// Registry / certification mark — a compact neutral tile carrying the real
// provider logo when one exists, or a short text code otherwise. Uniform
// size and treatment for every mark: no color-coding of "more marks = more
// trustworthy," per platform-neutrality policy. Full name stays available
// via the accessible name for assistive tech and the `title` hover hint.
function RegistryMark({ tag }: { tag: string }) {
  const logo = sourceLogo(tag);
  const label = pillLabel(tag);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex size-[21px] shrink-0 items-center justify-center rounded-[5px] border border-neutral-200/70 bg-neutral-50 font-mono text-[7.5px] font-bold text-neutral-600 transition-colors duration-hover ease-smooth group-hover:border-neutral-300 group-hover:bg-white"
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full rounded-[4px] object-contain p-0.5" />
      ) : (
        shortCode(tag)
      )}
    </span>
  );
}

// Completeness — the only "quality" indicator shown outside /admin per
// frontend-design-spec.md §14.2. Quieter than a filled pill on purpose:
// "verified by N sources" is the senior trust signal on this card;
// completeness is real and spec-mandated but shouldn't out-shout it. Text
// stays neutral for the non-critical bands so only the icon + border carry
// the semantic colour the spec requires; the red band (a real data-quality
// gap) is the one band where the text itself stays colored.
function CompletenessPill({ pct, className }: { pct: number; className?: string }) {
  const band = completenessBand(pct);
  const tone = COMPLETENESS_BAND_CLASSES[band];
  const rounded = Math.round(pct);
  return (
    <span
      title={`${rounded}% profile completeness`}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11.5px] font-medium",
        tone.border,
        tone.text,
        className,
      )}
    >
      <Gauge size={11} weight="bold" aria-hidden className={cn("shrink-0", tone.icon)} />
      {rounded}%
    </span>
  );
}
