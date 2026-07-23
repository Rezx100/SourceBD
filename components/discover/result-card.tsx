// Shared supplier list card — the one card design used everywhere a
// supplier/company preview renders: buyer Discover (`/app/discover`),
// public Discover (`/discover`), Saved (`/app/saved`), the buyer dashboard's
// recently-saved list, and Smart Match results. Server component; takes a
// pre-typed `DiscoverRow` straight from the `discover_suppliers` RPC (or an
// equivalent mapped shape) and renders the finalized card design decided in
// the 2 Jul UX audit (see frontend-design-spec.md §0.2 and §14.2).
//
// Mobile and desktop are two genuinely different arrangements (not just a
// scaled-up mobile layout): mobile stacks avatar/name → trust row → products
// → a divided footer bar; desktop moves to a two-column layout with a fixed
// right-hand rail (follow button, employee count, est. year, CTA) that has
// no footer divider at all. Both are built from one DOM via Tailwind
// responsive classes so there is exactly one markup source of truth, per
// `ops/design-mockups/discover-card-mockup.html` (the approved reference).
//
// SBI hard contract: payload is `t13_source_count` only — never any SBI
// numeric, pillar, grade, or "Score" / "Rating" string.

import Link from "next/link";
import { cloneElement, isValidElement, type ReactElement } from "react";
import {
  ArrowRight,
  CalendarBlank,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";

import { CompanyAvatar } from "@/components/supplier/company-avatar";
import { ProductIcon } from "@/components/supplier/product-icon";
import { ENTITY_TYPES } from "@/components/discover/filter-rail";
import { establishedYear } from "@/lib/established";
import { formatCompanyName } from "@/lib/format-company-name";
import { formatCardLocation } from "@/lib/format-location";
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

/** Render the same action element (SaveButton) at two DOM positions — the
 *  mobile header row and the desktop rail — since only one is visible at
 *  any given viewport width (the other is `display:none`). Keys keep React
 *  from complaining about reusing the same element reference twice. */
function slotFor(node: React.ReactNode | undefined, key: string) {
  if (!node) return null;
  return isValidElement(node) ? cloneElement(node as ReactElement, { key }) : node;
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
  layout = "responsive",
}: {
  row: DiscoverRow;
  hrefBase: "/app/suppliers" | "/suppliers";
  actionSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  /** `"mobile"` locks the approved mobile arrangement at every breakpoint. */
  layout?: "responsive" | "mobile";
}) {
  const forceMobile = layout === "mobile";
  const location = formatCardLocation(row.primary_address, row.city, row.district);
  const entityLabel =
    ENTITY_TYPES.find((o) => o.value === row.entity_type)?.label ??
    row.entity_type.replace(/_/g, " ");
  const visibleMarks = row.source_tags.slice(0, 3);
  const extraMarks = Math.max(0, row.source_tags.length - visibleMarks.length);
  const name = formatCompanyName(row.company_name);
  const estYear = establishedYear(row.established_date);
  const hasTrustRow = visibleMarks.length > 0 || row.t13_source_count > 0;
  const actionMobile = slotFor(actionSlot, "action-mobile");
  const actionDesktop = slotFor(actionSlot, "action-desktop");

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-lg border border-neutral-200 bg-white px-4 pb-3.5 pt-4 text-left shadow-sm transition-colors duration-200 ease-smooth hover:border-brand-forest/[0.22] hover:bg-[#fafaf9]",
        !forceMobile && "sm:p-5",
      )}
    >
      <Link
        href={`${hrefBase}/${row.slug}`}
        className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest"
      >
        <div className={cn("flex gap-4", !forceMobile && "sm:gap-6")}>
          {/* Left column: identity, trust row, products. Full width on
              mobile; shares the row with the desktop rail at sm+. */}
          <div
            className={cn(
              "flex min-w-0 flex-1 items-start gap-4",
              !forceMobile && "sm:gap-5",
            )}
          >
            <CompanyAvatar
              name={name}
              verified={row.t13_source_count > 0}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2
                    className={cn(
                      "truncate font-display text-[20px] font-black leading-tight tracking-[-0.02em] text-neutral-900 transition-colors group-hover:text-brand-forest",
                      !forceMobile && "sm:text-[23px]",
                    )}
                  >
                    {name}
                  </h2>
                  {actionMobile ? (
                    <span
                      className={cn("shrink-0", !forceMobile && "sm:hidden")}
                    >
                      {actionMobile}
                    </span>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1.5 text-[14px] font-medium text-neutral-600",
                    !forceMobile && "sm:mt-1.5",
                  )}
                >
                  <span className="inline-flex items-center rounded-pill bg-neutral-100 px-2 py-0.5 text-[12px] font-semibold text-neutral-600">
                    {entityLabel}
                  </span>
                  {location ? (
                    <>
                      <MapPin
                        size={16}
                        weight="fill"
                        aria-hidden
                        className="ml-0.5 shrink-0 text-neutral-400"
                      />
                      <span className="truncate">{location}</span>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Desktop only: trust row + products nest under the name
                  column here (indented past the avatar), matching the
                  approved desktop mockup. Mobile renders its own copy of
                  these two rows full-width below (see sibling block after
                  this flex row) since the mobile mockup runs them the full
                  card width, not indented under the avatar. */}
              {!forceMobile ? (
                <div className="mt-3 hidden sm:block sm:space-y-3">
                  {hasTrustRow ? (
                    <TrustRow
                      row={row}
                      marks={visibleMarks}
                      extraMarks={extraMarks}
                      mobile={false}
                    />
                  ) : null}
                  {row.principal_products.length > 0 ? (
                    <ProductsLine products={row.principal_products} mobile={false} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* Desktop-only right rail. No vertical divider — separation
              comes from generous padding alone so the card still reads as
              one unit, not two. */}
          {!forceMobile ? (
            <div className="hidden w-[160px] shrink-0 flex-col items-end gap-3 pl-10 text-right sm:flex">
              {actionDesktop}
              <div className="mt-auto">
                {row.employees_total ? (
                  <div className="flex items-baseline justify-end gap-1.5">
                    <span className="font-display text-[20px] font-bold leading-none tabular-nums tracking-[-0.01em] text-neutral-800">
                      {row.employees_total.toLocaleString()}
                    </span>
                    <span className="text-[14px] font-normal text-neutral-400">
                      employees
                    </span>
                  </div>
                ) : null}
                {estYear ? (
                  <div className="mt-1 text-[13px] font-medium text-neutral-500">
                    Est. {estYear}
                  </div>
                ) : null}
                <span className="group/cta -mr-2 mt-1.5 flex items-center justify-end gap-1 rounded-md px-2 py-1.5 text-[14px] font-semibold text-brand-forest underline decoration-transparent underline-offset-2 transition-colors duration-hover ease-smooth hover:bg-brand-forest-soft hover:decoration-brand-forest/40">
                  View profile
                  <ArrowRight
                    size={17}
                    weight="bold"
                    aria-hidden
                    className="transition-transform duration-hover ease-smooth group-hover/cta:translate-x-0.5"
                  />
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Mobile only: trust row + products at full card width (not
            indented under the avatar) — see comment above. Needs its own
            top margin since it's a sibling of the identity row, not a
            child nesting under existing spacing. */}
        <div className={cn("mt-3.5", !forceMobile && "sm:hidden")}>
          {hasTrustRow ? (
            <TrustRow
              row={row}
              marks={visibleMarks}
              extraMarks={extraMarks}
              mobile
              singleLine={forceMobile}
            />
          ) : null}
          {row.principal_products.length > 0 ? (
            <ProductsLine products={row.principal_products} mobile />
          ) : null}
        </div>

        {footerSlot}

        {/* Mobile-only footer bar — the desktop rail replaces this above sm. */}
        <div
          className={cn(
            "mt-3 flex items-center justify-between gap-3 border-t border-[rgba(15,15,20,0.045)] pt-3 text-[13px] text-neutral-500",
            !forceMobile && "sm:hidden",
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            {estYear ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarBlank size={17} weight="duotone" aria-hidden className="text-neutral-400" />
                Est. {estYear}
              </span>
            ) : null}
            {row.employees_total ? (
              <span className="inline-flex items-center gap-1">
                <span className="font-display text-[15px] font-bold tabular-nums text-neutral-700">
                  {row.employees_total.toLocaleString()}
                </span>
                employees
              </span>
            ) : null}
          </div>
          <span className="group/cta -mr-1.5 flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-brand-forest underline decoration-transparent underline-offset-2 transition-colors duration-hover ease-smooth hover:bg-brand-forest-soft hover:decoration-brand-forest/40">
            View profile
            <ArrowRight
              size={17}
              weight="bold"
              aria-hidden
              className="transition-transform duration-hover ease-smooth group-hover/cta:translate-x-0.5"
            />
          </span>
        </div>
      </Link>
    </article>
  );
}

// Trust row — registry marks and "verified by N sources." Mobile and desktop
// render this as two structurally separate blocks (see `DiscoverResultCard`).
function TrustRow({
  row,
  marks,
  extraMarks,
  mobile,
  singleLine = false,
}: {
  row: DiscoverRow;
  marks: string[];
  extraMarks: number;
  mobile: boolean;
  /** Keep marks + verified count on one row (hub / forced-mobile cards). */
  singleLine?: boolean;
}) {
  const count = row.t13_source_count;
  return (
    <div
      className={cn(
        "flex items-center text-[13px] text-neutral-600",
        singleLine ? "flex-nowrap gap-2 overflow-hidden" : "flex-wrap",
        !singleLine && (mobile ? "gap-x-2.5 gap-y-1.5" : "gap-3"),
      )}
    >
      {marks.map((tag) => (
        <RegistryMark key={tag} tag={tag} />
      ))}
      {/* Hub single-line: skip +N overflow — the verified count already states it. */}
      {!singleLine && extraMarks > 0 ? (
        <span className="mr-0.5 shrink-0 text-neutral-500">
          +{extraMarks}
          {mobile ? "" : " more"}
        </span>
      ) : null}
      <span className="min-w-0 truncate whitespace-nowrap font-medium text-neutral-700">
        {singleLine
          ? `Verified by ${count} ${count === 1 ? "source" : "sources"}`
          : mobile
            ? `${Math.min(count, 5)}${count > 5 ? "+" : ""} verified ${count === 1 ? "source" : "sources"}`
            : `Verified by ${count} ${count === 1 ? "source" : "sources"}`}
      </span>
    </div>
  );
}

function ProductsLine({ products, mobile }: { products: string[]; mobile: boolean }) {
  const cleaned = dedupProducts(products);
  if (cleaned.length === 0) return null;

  // One fewer inline chip on mobile than desktop — same "+N more" pattern
  // already used for registry marks, so no data is lost, it's just
  // disclosed one tap later on the narrower viewport instead of wrapping.
  const shown = cleaned.slice(0, mobile ? 2 : 3);
  const overflow = cleaned.length - shown.length;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] leading-snug text-neutral-700">
      {shown.map((product) => (
        <span key={product} className="inline-flex items-center gap-1 font-medium">
          <ProductIcon
            product={product}
            className="product-icon preview-product-icon shrink-0 text-neutral-400"
          />
          {product}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="whitespace-nowrap font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2">
          +{overflow} more categories
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
      className="flex size-[30px] shrink-0 items-center justify-center rounded-[6px] border border-[rgba(15,15,20,0.065)] bg-[#fafaf9] font-mono text-[12px] font-bold text-[#4a4a55] transition-colors duration-hover ease-smooth group-hover:border-[rgba(15,15,20,0.12)] group-hover:bg-white"
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full rounded-[5px] object-contain p-1" />
      ) : (
        shortCode(tag)
      )}
    </span>
  );
}
