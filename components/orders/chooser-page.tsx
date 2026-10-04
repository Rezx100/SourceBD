// New order, step one (Paper `10 · New order choose a supplier inline`, `11 · New order`): the page
// around the supplier chooser, with the "Faster: accept a quote" card beside it when an RFQ has
// quotes waiting. Server component; the chooser itself is the client `SupplierChooser`.

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { SupplierChooser } from "./new-order";
import type { ChooserRow } from "./new-model";

export function ChooserPage({ fromRfqs, hint, total }: { fromRfqs: ChooserRow[]; hint: { id: string; title: string; waiting: number; best: string | null } | null; total: number | null }) {
  return (
    <section aria-label="New order" data-detail="" className="flex min-h-0 flex-1 flex-col bg-surface">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-6">
        <Link href="/app/orders" prefetch={false} className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-base font-medium text-ink-2 outline-none hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-6">
          <ArrowLeft size={16} className="shrink-0" aria-hidden />
          Back to orders
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-ink">New order</h1>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:flex-row xl:overflow-visible">
        <div className="min-w-0 px-4 py-5 sm:px-6 xl:flex-1 xl:overflow-y-auto">
          <p className="pb-3 text-md text-ink-2 sm:hidden">Who is the order with?</p>
          <SupplierChooser fromRfqs={fromRfqs} total={total} />
        </div>
        {hint ? (
          <aside aria-label="Faster: accept a quote" className="flex flex-col gap-3 border-t border-line bg-subtle px-4 py-5 sm:px-6 xl:w-details xl:shrink-0 xl:border-l xl:border-t-0">
            <h2 className="text-md font-semibold text-ink">Faster: accept a quote</h2>
            <p className="text-base text-ink-2">Accepting a quote fills in the supplier, product, price and quantity for you.</p>
            <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
              <p className="text-base font-medium text-ink [overflow-wrap:anywhere]">{hint.title}</p>
              <p className="text-sm text-ink-2">
                {hint.waiting} {hint.waiting === 1 ? "quote" : "quotes"} waiting{hint.best ? ` · best ${hint.best}` : ""}
              </p>
              <Link href={`/app/rfqs/${hint.id}`} prefetch={false} className="inline-flex w-fit text-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:decoration-2 max-sm:min-h-11 max-sm:items-center">
                Compare quotes
              </Link>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
