import { ArrowLeft, CaretRight, Check, CheckCircle, Package, PencilSimple, Plus } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function ProductsPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            Products
          </div>
          <div className="text-ink-3 text-sm">
            4 products · only you see these
          </div>
        </div>
        {/* Add product */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <Plus size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-1 pb-12 gap-4 px-5">
        {/* Status chips */}
        <div className="flex gap-1.5">
          <div className="flex items-center h-9 pr-3 pl-2.5 rounded-full gap-1.5 shrink-0 bg-ink">
            <Check size={16} weight="thin" className="shrink-0 text-surface" aria-hidden/>
            <div className="font-medium text-surface text-base">
              All 4
            </div>
          </div>
          <div className="flex items-center h-9 px-3 rounded-full shrink-0 border border-solid border-line">
            <div className="font-medium text-ink text-base">
              Active 2
            </div>
          </div>
          <div className="flex items-center h-9 px-3 rounded-full shrink-0 border border-solid border-line">
            <div className="font-medium text-ink text-base">
              Draft 1
            </div>
          </div>
          <div className="flex items-center h-9 px-3 rounded-full shrink-0 border border-solid border-line">
            <div className="font-medium text-ink text-base">
              Archived 1
            </div>
          </div>
        </div>
        {/* Product list */}
        <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
          {/* Product */}
          <div className="flex flex-col p-4 gap-2.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              <div className="font-medium text-ink-2 text-xs">
                Active
              </div>
              <div className="grow font-mono text-ink-3 text-xs">
                · NW-701
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Women’s knitted dresses
            </div>
            <div className="text-ink-2 text-sm">
              US$4.20 per piece · MOQ 3,000 pieces
            </div>
            <div className="text-ink-3 text-xs">
              Updated 2 Oct · in 1 order
            </div>
          </div>
          {/* Product */}
          <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              <div className="font-medium text-ink-2 text-xs">
                Active
              </div>
              <div className="grow font-mono text-ink-3 text-xs">
                · FT-114
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              French terry hoodie
            </div>
            <div className="text-ink-2 text-sm">
              US$7.80 per piece · MOQ 1,200 pieces
            </div>
            <div className="text-ink-3 text-xs">
              Updated 26 Sep · in 1 RFQ
            </div>
          </div>
          {/* Product */}
          <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
            <div className="flex items-center gap-1.5">
              <PencilSimple size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              <div className="font-medium text-ink-3 text-xs">
                Draft
              </div>
              <div className="grow font-mono text-ink-3 text-xs">
                · TS-020
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Basic crew T-shirt
            </div>
            <div className="text-ink-2 text-sm">
              No price yet · MOQ 5,000 pieces
            </div>
            <div className="text-ink-3 text-xs">
              Updated 9 Oct · make it active to send an RFQ
            </div>
          </div>
          {/* Product */}
          <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
            <div className="flex items-center gap-1.5">
              <Package size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              <div className="font-medium text-ink-3 text-xs">
                Archived
              </div>
              <div className="grow font-mono text-ink-3 text-xs">
                · SS-24-09
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Summer polo, last season
            </div>
            <div className="text-ink-2 text-sm">
              US$3.10 per piece · MOQ 2,000 pieces
            </div>
            <div className="text-ink-3 text-xs">
              Archived 14 Aug · restore it to use it again
            </div>
          </div>
        </div>
        {/* Notes */}
        <div className="flex flex-col gap-2">
          <div className="text-ink-3 text-xs">
            Every RFQ from a product carries its size chart, materials and tech pack.
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
            <div className="text-ink-3 text-xs">
              Sample products; nobody has saved one yet
            </div>
          </div>
        </div>
      </div>
    </div>);
}
