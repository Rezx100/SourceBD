import { ArrowLeft, CalendarBlank, CaretDown, Check, Storefront } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function NewOrderPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full relative flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            New order
          </div>
          <div className="text-ink-3 text-sm">
            From the quote you accepted on 2 Oct
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-1 pb-[120px] px-5">
        {/* Supplier */}
        <div className="flex items-center py-3.5 px-4 rounded-[10px] gap-3 border border-solid border-line">
          <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-10">
            <Storefront size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
          </div>
          <div className="flex flex-col grow basis-0">
            <div className="font-medium text-ink text-md/[22px]">
              Mondol Fabrics Ltd.
            </div>
            <div className="text-ink-3 text-sm">
              Factory · Gazipur
            </div>
          </div>
          <div className="flex items-center h-11 shrink-0 px-3.5 rounded-full bg-sunken">
            <div className="font-medium text-ink text-base">
              Change
            </div>
          </div>
        </div>
        {/* Ordering */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-6 pb-3.5">
            <div className="tracking-tight font-medium text-ink text-lg">
              What you’re ordering
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="font-medium text-ink-2 text-sm">
                Product
              </div>
              <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
                <div className="text-ink text-md/[22px]">
                  Women’s knitted dresses
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col grow basis-0 gap-1.5">
                <div className="font-medium text-ink-2 text-sm">
                  Quantity
                </div>
                <div className="flex items-center justify-between h-12 pr-2 pl-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
                  <div className="tabular-nums text-ink text-md/[22px]">
                    20,000
                  </div>
                  <div className="flex items-center h-8 pr-1.5 pl-2 rounded-md gap-0.5 bg-sunken">
                    <div className="font-medium text-ink-2 text-sm">
                      pcs
                    </div>
                    <CaretDown size={12} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
                  </div>
                </div>
              </div>
              <div className="flex flex-col grow basis-0 gap-1.5">
                <div className="font-medium text-ink-2 text-sm">
                  Price per piece
                </div>
                <div className="flex items-center justify-between h-12 pr-2 pl-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
                  <div className="tabular-nums text-ink text-md/[22px]">
                    4.20
                  </div>
                  <div className="flex items-center h-8 pr-1.5 pl-2 rounded-md gap-0.5 bg-sunken">
                    <div className="font-medium text-ink-2 text-sm">
                      US$
                    </div>
                    <CaretDown size={12} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="font-medium text-ink-2 text-sm">
                PO number · optional
              </div>
              <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
                <div className="font-mono text-ink text-[15px]/[22px]">
                  PO-2026-0917
                </div>
              </div>
            </div>
            {/* Order value */}
            <div className="flex flex-col pt-3.5 pb-3 rounded-[10px] gap-1 px-4 bg-subtle border border-solid border-line">
              <div className="text-ink-3 text-sm">
                Order value
              </div>
              <div className="tracking-tighter font-medium tabular-nums text-ink text-xl">
                US$84,000
              </div>
              <div className="text-ink-2 text-sm">
                20,000 pcs at US$4.20, as quoted
              </div>
            </div>
          </div>
        </div>
        {/* Shipping */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-6 pb-3.5">
            <div className="tracking-tight font-medium text-ink text-lg">
              Shipping
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="font-medium text-ink-2 text-sm">
                Incoterm
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center h-9 pr-3.5 pl-2.5 rounded-full gap-1.5 bg-ink">
                  <Check size={16} weight="thin" className="shrink-0 text-surface" aria-hidden/>
                  <div className="font-medium text-surface text-base">
                    FOB
                  </div>
                </div>
                <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                  <div className="font-medium text-ink text-base">
                    CIF
                  </div>
                </div>
                <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                  <div className="font-medium text-ink text-base">
                    EXW
                  </div>
                </div>
                <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                  <div className="font-medium text-ink text-base">
                    DDP
                  </div>
                </div>
                <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                  <div className="font-medium text-ink text-base">
                    DAP
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col grow basis-0 gap-1.5">
                <div className="font-medium text-ink-2 text-sm">
                  From port
                </div>
                <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
                  <div className="text-ink text-md/[22px]">
                    Chattogram
                  </div>
                </div>
              </div>
              <div className="flex flex-col grow basis-0 gap-1.5">
                <div className="font-medium text-ink-2 text-sm">
                  Ship to
                </div>
                <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
                  <div className="text-ink text-md/[22px]">
                    United Kingdom
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col grow basis-0 gap-1.5">
                <div className="font-medium text-ink-2 text-sm">
                  Ship by
                </div>
                <div className="flex items-center justify-between h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
                  <div className="text-ink text-md/[22px]">
                    14 Nov 2026
                  </div>
                  <CalendarBlank size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
                </div>
                <div className="text-ink-3 text-xs">
                  In 34 days
                </div>
              </div>
              <div className="flex flex-col grow basis-0 gap-1.5">
                <div className="font-medium text-ink-2 text-sm">
                  Deliver by
                </div>
                <div className="flex items-center justify-between h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
                  <div className="text-ink-3 text-md/[22px]">
                    Optional
                  </div>
                  <CalendarBlank size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Notes */}
        <div className="flex flex-col pt-5 gap-2">
          <div className="text-ink-3 text-xs">
            Mondol Fabrics sees this order and can log its own updates.
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
            <div className="text-ink-3 text-xs">
              Sample order; the supplier is real
            </div>
          </div>
        </div>
      </div>
      {/* Action bar */}
      <div className="fixed bottom-0 flex flex-col bg-surface border-t border-t-line inset-x-0">
        <div className="flex items-center h-16 py-2 px-4 gap-2 shrink-0">
          <div className="flex items-center justify-center h-12 shrink-0 px-[18px] rounded-lg border border-solid border-line">
            <div className="font-medium text-ink text-md/[20px]">
              Cancel
            </div>
          </div>
          <div className="grow basis-0 h-12 flex items-center justify-center rounded-lg bg-brand">
            <div className="font-medium text-surface text-md/[20px]">
              Create order
            </div>
          </div>
        </div>
        
      </div>
    </div>);
}
