// The public Discover page's own parts, drawn from the v4 kit (B9h). An anonymous visitor: the same search the
// buyer has, as plain GET forms and links so it works with no script, and rows that open the public profile.
// No Save, no RFQ, no contact value (the RPC payload carries none), no score: the count is the number of
// sources that hold the supplier. Server components; the page decides the data, these decide the look.

import Link from "next/link";
import {
  Button,
  ButtonLink,
  Checkbox,
  Empty,
  ErrorPanel,
  Field,
  Input,
  Pagination,
  Segmented,
  Table,
  TableFrame,
  TableScroll,
  Td,
  Th,
  Tr,
  Unpublished,
  buttonClass,
  fieldBox,
  fieldEdge,
  rowLinkClass,
} from "@/components/kit";
import { SourcesCell, SupplierRow } from "@/components/patterns";
import {
  BRAND_SOURCES,
  CERT_KINDS,
  ENTITY_TYPES,
  MIN_SOURCES_OPTIONS,
  PAGE_SIZE,
  REGISTRY_SOURCES,
  SORT_OPTIONS,
  buildQuery,
  type DiscoverFacets,
  type SortValue,
} from "@/components/discover/filter-rail";
import type { DiscoverRow } from "@/components/discover/result-card";
import { formatCount } from "@/lib/dashboard/facts";
import { formatCompanyName } from "@/lib/format-company-name";
import { formatCardLocation } from "@/lib/format-location";
import { dedupProducts } from "@/lib/product-icons";
import { cn } from "@/lib/utils";

export type BaseQuery = Record<string, string | string[]>;

/** What a result row shows, worked out from the RPC row: names, places and counts only. */
export type PublicRow = {
  slug: string;
  name: string;
  type: string;
  place: string | null;
  workers: string | null;
  sources: number;
  marks: string[];
  products: string | null;
  href: string;
};

export function publicRow(row: DiscoverRow): PublicRow {
  const products = dedupProducts(row.principal_products ?? []);
  const shown = products.slice(0, 3).join(", ");
  const more = products.length - 3;
  return {
    slug: row.slug,
    name: formatCompanyName(row.company_name),
    type: ENTITY_TYPES.find((o) => o.value === row.entity_type)?.label ?? row.entity_type.replace(/_/g, " "),
    place: formatCardLocation(row.primary_address, row.city, row.district),
    workers: formatCount(row.employees_total),
    sources: row.t13_source_count,
    marks: row.source_tags ?? [],
    products: shown ? (more > 0 ? `${shown} +${more} more` : shown) : null,
    href: `/suppliers/${row.slug}`,
  };
}

export function SuggestionList({ id, values }: { id: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );
}

/** The three lists the City, District and Category fields suggest from, drawn once per page. */
export function FacetLists({ facets }: { facets: DiscoverFacets }) {
  return (
    <>
      <SuggestionList id="discover-cities" values={facets.cities} />
      <SuggestionList id="discover-districts" values={facets.districts} />
      <SuggestionList id="discover-products" values={facets.products} />
    </>
  );
}

function Group({ label, name, options, selected, touch }: { label: string; name: string; options: ReadonlyArray<{ value: string; label: string }>; selected: string[]; touch: boolean }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-sm font-medium text-ink">{label}</legend>
      <div className={cn("flex flex-wrap gap-x-4", touch && "flex-col gap-x-0")}>
        {options.map((o) => (
          <Checkbox key={o.value} size={touch ? "touch" : "md"} name={name} value={o.value} defaultChecked={selected.includes(o.value)}>
            {o.label}
          </Checkbox>
        ))}
      </div>
    </fieldset>
  );
}

export type FilterProps = {
  q: string;
  sort: string;
  entityTypes: string[];
  certKinds: string[];
  registries: string[];
  brandCodes: string[];
  factoryTypes: string[];
  minSources: string;
  city: string;
  district: string;
  category: string;
  facets: DiscoverFacets;
};

/** The number of filters on, the search words not counted: they are the box above. */
export function filterCount(f: Pick<FilterProps, "entityTypes" | "certKinds" | "registries" | "brandCodes" | "factoryTypes" | "minSources" | "city" | "district" | "category">): number {
  return (
    f.entityTypes.length +
    f.certKinds.length +
    f.registries.length +
    f.brandCodes.length +
    f.factoryTypes.length +
    (f.minSources ? 1 : 0) +
    (f.city ? 1 : 0) +
    (f.district ? 1 : 0) +
    (f.category ? 1 : 0)
  );
}

/** One GET form: it keeps the search words and the sort in hidden fields and posts every filter by its own name. `touch` is the phone's sizes. */
export function PublicFilters({ basePath, touch = false, ...f }: FilterProps & { basePath: string; touch?: boolean }) {
  const size = touch ? "touch" : "md";
  const advanced = f.entityTypes.length + f.registries.length + f.brandCodes.length + f.factoryTypes.length + (f.district ? 1 : 0) + (f.category ? 1 : 0);
  const clearHref = basePath + buildQuery({ q: f.q });
  return (
    <form method="get" action={basePath} aria-label="Filter suppliers" className="flex flex-col gap-4">
      {f.q ? <input type="hidden" name="q" value={f.q} /> : null}
      {f.sort && f.sort !== "default" ? <input type="hidden" name="sort" value={f.sort} /> : null}

      <div className={cn("grid gap-4", !touch && "md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,180px)]")}>
        <Field label="City">
          {(a) => <Input {...a} size={size} name="city" list="discover-cities" defaultValue={f.city} placeholder="e.g. Dhaka" autoComplete="off" />}
        </Field>
        <Group label="Certification" name="cert" options={CERT_KINDS} selected={f.certKinds} touch={touch} />
        <Field label="Verified sources">
          {(a) => (
            <select {...a} name="min_sources" defaultValue={f.minSources} className={cn(fieldBox, fieldEdge, touch ? "h-input-touch px-3 text-md" : "h-control px-2 text-base")}>
              {MIN_SOURCES_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <details open={advanced > 0} className="group border-t border-line pt-3">
        <summary className="flex min-h-8 w-fit cursor-pointer list-none items-center text-base font-medium text-ink [&::-webkit-details-marker]:hidden">
          More filters{advanced > 0 ? ` · ${advanced}` : ""}
        </summary>
        <div className="flex flex-col gap-4 pt-3">
          <div className={cn("grid gap-4", !touch && "sm:grid-cols-2 lg:grid-cols-3")}>
            <Field label="District">
              {(a) => <Input {...a} size={size} name="district" list="discover-districts" defaultValue={f.district} placeholder="e.g. Gazipur" autoComplete="off" />}
            </Field>
            <Field label="Category or product">
              {(a) => <Input {...a} size={size} name="category" list="discover-products" defaultValue={f.category} placeholder="e.g. knitwear" autoComplete="off" />}
            </Field>
          </div>
          <div className={cn("grid gap-4", !touch && "sm:grid-cols-2 lg:grid-cols-4")}>
            <Group label="Company type" name="entity" options={ENTITY_TYPES} selected={f.entityTypes} touch={touch} />
            <Group label="Registry membership" name="registry" options={REGISTRY_SOURCES} selected={f.registries} touch={touch} />
            <Group label="Brand supplier list" name="brand" options={BRAND_SOURCES} selected={f.brandCodes} touch={touch} />
            {f.facets.factory_types.length > 0 ? (
              <Group label="Factory type" name="ftype" options={f.facets.factory_types.slice(0, 12).map((t) => ({ value: t, label: t }))} selected={f.factoryTypes} touch={touch} />
            ) : null}
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" kind="primary" size={size}>
          Apply filters
        </Button>
        {filterCount(f) > 0 ? (
          <ButtonLink href={clearHref} prefetch={false} kind="secondary" size={size}>
            Clear filters
          </ButtonLink>
        ) : null}
      </div>
    </form>
  );
}

/** Wide screens draw the form open; a phone folds it under one row so the results come first. */
export function ResponsiveFilters({ basePath, ...f }: FilterProps & { basePath: string }) {
  const n = filterCount(f);
  return (
    <>
      <div className="hidden rounded-md border border-line p-5 md:block">
        <PublicFilters basePath={basePath} {...f} />
      </div>
      <details open={n > 0} className="rounded-md border border-line md:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 text-md font-medium text-ink [&::-webkit-details-marker]:hidden">
          Filters{n > 0 ? ` · ${n}` : ""}
        </summary>
        <div className="border-t border-line p-4">
          <PublicFilters basePath={basePath} touch {...f} />
        </div>
      </details>
    </>
  );
}

export function SortRow({ basePath, current, baseQuery }: { basePath: string; current: SortValue; baseQuery: BaseQuery }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-3">Sort</span>
      <Segmented
        name="sort"
        label="Sort results"
        value={current}
        options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label, href: basePath + buildQuery({ ...baseQuery, sort: o.value === "default" ? "" : o.value, page: "" }) }))}
      />
    </div>
  );
}

function ResultsTable({ rows }: { rows: PublicRow[] }) {
  return (
    <TableFrame className="max-md:hidden">
      <TableScroll role="region" aria-label="Results table" tabIndex={0} className="outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
        <Table className="min-w-[860px]">
          <thead>
            <tr>
              <Th className="w-80">Supplier</Th>
              <Th className="w-[120px]">Type</Th>
              <Th className="w-[160px]">Location</Th>
              <Th align="right" className="w-[110px]">
                Workers
              </Th>
              <Th align="right" className="w-[90px]">
                Sources
              </Th>
              <Th>Listed in</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.slug}>
                <Td className="py-2.5">
                  <Link href={r.href} prefetch={false} className={rowLinkClass}>
                    {r.name}
                  </Link>
                  {r.products ? <p className="text-xs text-ink-3">{r.products}</p> : null}
                </Td>
                <Td>{r.type}</Td>
                <Td>{r.place ?? <Unpublished />}</Td>
                <Td align="right" className="tabular-nums text-ink">
                  {r.workers ?? <Unpublished />}
                </Td>
                <Td align="right" className="tabular-nums text-ink">
                  {r.sources}
                </Td>
                <Td>{r.marks.length > 0 ? <SourcesCell sources={r.marks} /> : <Unpublished>None found</Unpublished>}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableScroll>
    </TableFrame>
  );
}

function PhoneRows({ rows }: { rows: PublicRow[] }) {
  return (
    <ul className="rounded-md border border-line md:hidden">
      {rows.map((r) => (
        <li key={r.slug}>
          <SupplierRow layout="phone" href={r.href} name={r.name} type={r.type} place={r.place} sources={r.sources} problem={r.products ? <span className="text-ink-3">{r.products}</span> : undefined} />
        </li>
      ))}
    </ul>
  );
}

function Pages({ page, pages, total, shown, hrefFor }: { page: number; pages: number; total: number; shown: number; hrefFor: (page: number) => string }) {
  const prev = page > 1 ? hrefFor(page - 1) : undefined;
  const next = page < pages ? hrefFor(page + 1) : undefined;
  const from = (page - 1) * PAGE_SIZE + 1;
  return (
    <>
      <div className="max-md:hidden">
        <Pagination noun="suppliers" from={from} to={from + shown - 1} total={total} page={page} pages={pages} prevHref={prev} nextHref={next} />
      </div>
      <nav aria-label="Supplier pages" className="flex flex-col gap-2 md:hidden">
        <p className="text-center text-sm text-ink-3">
          Page {formatCount(page)} of {formatCount(pages)}
        </p>
        <div className="flex gap-2">
          {[
            ["Previous", prev],
            ["Next", next],
          ].map(([label, href]) =>
            href ? (
              <Link key={label} href={href} className={buttonClass({ kind: "secondary", size: "touch", className: "flex-1" })}>
                {label}
              </Link>
            ) : (
              <span key={label} aria-disabled="true" className={buttonClass({ kind: "secondary", size: "touch", className: "flex-1" })}>
                {label}
              </span>
            ),
          )}
        </div>
      </nav>
    </>
  );
}

/** What the signed-out visitor is told once, under the list: what a buyer account adds. Nothing here is a value. */
export function SignUpNote() {
  return (
    <aside aria-label="Sign up" className="flex flex-col items-start gap-3 rounded-md bg-subtle p-5">
      <p className="text-base text-ink-2">Contact details, certificates with their dates, and RFQs are for signed-in buyers. It is free while SourceBD is in beta.</p>
      <ButtonLink href="/signup" prefetch={false} kind="primary">
        Start free
      </ButtonLink>
    </aside>
  );
}

export type ResultsProps = {
  basePath: string;
  q: string;
  rows: DiscoverRow[];
  total: number;
  page: number;
  pages: number;
  failed: boolean;
  filtersOn: boolean;
  sort: SortValue;
  baseQuery: BaseQuery;
};

/** The count and the sort, then the table (the rows on a phone), then the pages: or the one state the search ended in. */
export function PublicResults({ basePath, q, rows, total, page, pages, failed, filtersOn, sort, baseQuery }: ResultsProps) {
  const hrefFor = (p: number) => basePath + buildQuery({ ...baseQuery, page: p > 1 ? String(p) : "" });
  const clearHref = basePath + buildQuery({ q });
  let body;
  if (failed) {
    body = (
      <ErrorPanel
        title="We couldn't load suppliers."
        retry={
          <Link href={hrefFor(page)} prefetch={false} className={buttonClass({ kind: "primary" })}>
            Try again
          </Link>
        }
      >
        Your search is kept. Try again in a moment.
      </ErrorPanel>
    );
  } else if (rows.length === 0 && page > 1) {
    body = (
      <Empty
        title="That page is past the end of these results."
        action={
          <ButtonLink href={hrefFor(1)} prefetch={false} kind="secondary">
            Back to the first page
          </ButtonLink>
        }
      >
        Page {formatCount(page)} has no suppliers.
      </Empty>
    );
  } else if (rows.length === 0) {
    body = (
      <Empty
        title={filtersOn ? "No suppliers match these filters." : `No suppliers match “${q}”.`}
        action={
          <ButtonLink href={filtersOn ? clearHref : basePath} prefetch={false} kind="secondary">
            {filtersOn ? "Clear filters" : "Clear search"}
          </ButtonLink>
        }
      >
        {filtersOn ? "Remove the most restrictive filter to widen the search." : "Try a product, a place or a certificate."}
      </Empty>
    );
  } else {
    const shown = rows.map(publicRow);
    body = (
      <>
        <ResultsTable rows={shown} />
        <PhoneRows rows={shown} />
        {pages > 1 ? <Pages page={page} pages={pages} total={total} shown={rows.length} hrefFor={hrefFor} /> : null}
        <SignUpNote />
      </>
    );
  }
  return (
    <section id="discover-results" aria-label="Results" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {failed ? null : (
          <h2 className="text-lg font-semibold text-ink">
            {formatCount(total)} {total === 1 ? "result" : "results"}
          </h2>
        )}
        <SortRow basePath={basePath} current={sort} baseQuery={baseQuery} />
      </div>
      {body}
    </section>
  );
}
