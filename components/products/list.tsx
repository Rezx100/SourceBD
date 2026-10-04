// The parts of Products around its table (Paper `10 · Products`, `· empty`, `· loading and error`,
// `11 · Products`): the header with its status tabs, the phone's tab row, the empty teaching state,
// the failed read, the loading skeleton. Server components; the table and its menu are client
// (`table.tsx`, `actions.tsx`).

import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ErrorPanel, Skeleton, TabLink, buttonClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import { PRODUCTS_ERROR_BODY, PRODUCTS_ERROR_TITLE, PRODUCT_TABS, STATUS_LABEL, addHref, productsCaption, tabCount, tabHref, type ProductRow, type ProductStatus, type ProductTab } from "./words";

const num = (n: number | null) => (n === null ? undefined : n);

export function AddProduct({ className }: { className?: string }) {
  return (
    <Link href={addHref} prefetch={false} className={buttonClass({ kind: "primary", className: cn("gap-2", className) })}>
      <Plus size={16} aria-hidden />
      Add product
    </Link>
  );
}

/** The header on the list: title, caption, Add product, and the status tabs (not on an empty or failed list). */
export function ProductsHead({ rows, tab }: { rows: readonly ProductRow[] | null; tab: ProductTab }) {
  const tabs = rows !== null && rows.length > 0;
  return (
    <header className={cn("flex shrink-0 flex-col gap-4 px-6 pt-7 max-md:hidden", tabs && "border-b border-line pb-0")}>
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Products</h1>
          <p className="text-base text-ink-3">{productsCaption(rows)}</p>
        </div>
        {tabs ? <AddProduct /> : null}
      </div>
      {tabs ? (
        <nav aria-label="Product status" className="-mx-3 flex flex-wrap gap-3">
          {PRODUCT_TABS.map((t) => (
            <TabLink key={t.key} href={tabHref(t.key)} current={t.key === tab} count={num(tabCount(rows, t.key))} prefetch={false}>
              {t.label}
            </TabLink>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

/** On a phone the title is the frame's; this row has the caption, Add product, and the tabs as chips. */
export function PhoneProductsHead({ rows, tab }: { rows: readonly ProductRow[] | null; tab: ProductTab }) {
  const tabs = rows !== null && rows.length > 0;
  return (
    <div className="flex flex-col gap-3 pb-2 pl-4 md:hidden">
      <div className="flex items-center justify-between gap-2 pr-2">
        <p className="text-sm text-ink-3">{productsCaption(rows)}</p>
        {tabs ? (
          <Link href={addHref} prefetch={false} className="flex h-11 items-center px-2 text-md font-semibold text-brand outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
            Add product
          </Link>
        ) : null}
      </div>
      {tabs ? (
        <nav aria-label="Product status" className="flex gap-2 overflow-x-auto pr-4">
          {PRODUCT_TABS.map((t) => {
            const on = t.key === tab;
            const n = tabCount(rows, t.key);
            return (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                prefetch={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-11 shrink-0 items-center rounded-md border px-3.5 text-md outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  on ? "border-brand bg-brand-tint font-semibold text-brand" : "border-line font-medium text-ink-2",
                )}
              >
                {t.label}
                {n === null ? "" : ` · ${n}`}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

const CARRIES: readonly (readonly [string, string])[] = [
  ["Basics", "Name, style number, target price, MOQ"],
  ["Size chart", "Points of measure across every size, with tolerances"],
  ["Materials", "Fabric and trims per piece, with units"],
  ["Tech pack", "One PDF or image, up to 10 MB"],
];

/** No products yet (`10 · Products · empty`): what one product carries into an RFQ, and the way to start. */
export function ProductsEmpty() {
  return (
    <div className="flex gap-16 px-6 pt-14 max-lg:flex-col max-lg:gap-8 max-md:px-4 max-md:pt-8">
      <div className="flex w-[440px] shrink-0 flex-col gap-4 max-lg:w-auto max-lg:max-w-[440px]">
        <h2 className="text-2xl font-semibold tracking-tighter text-ink">Keep your products here</h2>
        <p className="text-md text-ink-2">Save a product once. Every RFQ from it carries the size chart, materials and tech pack.</p>
        <div className="pt-2">
          <AddProduct className="max-md:h-input-touch max-md:w-full" />
        </div>
      </div>
      <div className="flex max-w-[560px] flex-1 flex-col rounded-lg border border-line">
        <p className="border-b border-line px-4 py-3 text-xs font-medium text-ink-3">What one product carries into an RFQ</p>
        <dl>
          {CARRIES.map(([k, v], i) => (
            <div key={k} className={cn("flex gap-4 px-4 py-3.5", i < CARRIES.length - 1 && "border-b border-line")}>
              <dt className="w-[120px] shrink-0 text-sm text-ink-3">{k}</dt>
              <dd className="text-base text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** A status tab with nothing in it, on a list that has products. */
export function ProductsTabEmpty({ tab }: { tab: ProductStatus }) {
  return (
    <div className="px-6 py-10 max-md:px-4">
      <p className="text-md font-semibold text-ink">No {STATUS_LABEL[tab].toLowerCase()} products.</p>
      <p className="pt-1 text-base text-ink-2">Products move here as their status changes.</p>
    </div>
  );
}

/** `buyer_product_list` failed. "Keep your products here" would be a claim a failed read cannot make. */
export function ProductsError({ retryHref }: { retryHref: string }) {
  return (
    <div className="p-6 max-md:p-4">
      <ErrorPanel
        title={PRODUCTS_ERROR_TITLE}
        retry={
          <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
            Try again
          </Link>
        }
      >
        {PRODUCTS_ERROR_BODY}
      </ErrorPanel>
    </div>
  );
}

/** The list while it loads: the table's own silhouette (rows of two lines under 768). */
export function ProductsSkeleton() {
  const widths = [240, 260, 200, 230, 180];
  return (
    <div role="status" aria-busy="true" aria-label="Loading products" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-1.5 px-6 pb-4 pt-7 max-md:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Products</h1>
        <Skeleton className="h-3 w-[180px]" />
      </div>
      <div className="hidden h-row-head items-center border-y border-line bg-subtle px-6 text-xs font-medium text-ink-3 md:flex">
        <span className="min-w-0 flex-1">Product</span>
        <span className="w-[170px]">Target price</span>
        <span className="w-[140px]">MOQ</span>
        <span className="w-[110px]">Status</span>
        <span className="w-[130px]">Updated</span>
        <span className="w-12" />
      </div>
      <div aria-hidden>
        {widths.map((w, i) => (
          <div key={i} className="flex h-14 items-center border-b border-line px-6 max-md:h-auto max-md:flex-col max-md:items-start max-md:gap-2 max-md:px-4 max-md:py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 shrink-0" style={{ width: w }} />
              <Skeleton tone="subtle" className="h-2.5 w-[120px] shrink-0" />
            </div>
            <div className="w-[170px] shrink-0 max-md:hidden">
              <Skeleton className="h-3 w-[100px]" />
            </div>
            <div className="w-[140px] shrink-0 max-md:hidden">
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="w-[110px] shrink-0 max-md:hidden">
              <Skeleton className="h-5 w-14" />
            </div>
            <div className="w-[130px] shrink-0 max-md:hidden">
              <Skeleton className="h-3 w-[90px]" />
            </div>
            <span className="w-12 shrink-0 max-md:hidden" />
          </div>
        ))}
      </div>
    </div>
  );
}
