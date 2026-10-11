import { Boat, CaretRight, CheckCircle, Clock, PencilSimple, Plus } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function OrdersPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full min-h-dvh relative flex-col bg-surface text-xs">
      
      {/* Page head */}
      <div className="flex items-center justify-between pt-2 pb-3 px-5">
        <div className="tracking-tighter font-medium text-ink text-2xl/[36px]">
          Quotes
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center h-9 pr-3.5 pl-2.5 rounded-full gap-1.5 bg-sunken">
            <Plus size={16} weight="thin" className="shrink-0 text-ink" aria-hidden/>
            <div className="font-medium text-ink text-base/[18px]">
              New order
            </div>
          </div>
          <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-9">
            <div className="flex font-semibold text-ink-2 text-sm/[16px]">
              AM
            </div>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex h-12 shrink-0 px-3 gap-1 border-b border-b-line">
        {/* Tab · RFQs */}
        <div className="flex items-center shrink-0 px-2 gap-1.5">
          <div className="font-medium text-ink-3 text-md/[20px]">
            RFQs
          </div>
          <div className="text-ink-3 text-sm/[16px]">
            6
          </div>
        </div>
        {/* Tab · Orders (current) */}
        <div className="flex items-center shrink-0 px-2 gap-1.5 relative">
          <div className="font-medium text-ink text-md/[20px]">
            Orders
          </div>
          <div className="text-ink-3 text-sm/[16px]">
            4
          </div>
          {/* Indicator */}
          <div className="absolute -bottom-px h-0.5 rounded-tl-[2px] rounded-tr-[2px] bg-ink inset-x-2"/>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col px-5">
        {/* Sample note */}
        <div className="flex items-center pt-3.5 pb-3 gap-1.5">
          <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
          <div className="text-ink-3 text-xs">
            Sample state: no real orders yet, supplier names are real
          </div>
        </div>
        {/* Items */}
        <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
          {/* Item · Dresses */}
          <div className="flex flex-col p-4 gap-2.5">
            {/* Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={16} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
                <div className="font-medium text-caution text-xs">
                  In production · 1 step late
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Women’s knitted dresses
            </div>
            <div className="text-ink-2 text-sm">
              Mondol Fabrics · US$84,000 · 20,000 pieces
            </div>
            {/* Progress */}
            <div className="flex h-1 gap-[3px] w-full shrink-0">
              <div className="grow basis-0 rounded-full bg-ink-2"/>
              <div className="grow basis-0 rounded-full bg-ink-2"/>
              <div className="grow basis-0 rounded-full bg-ink-2"/>
              <div className="grow basis-0 rounded-full bg-caution-icon"/>
              <div className="grow basis-0 rounded-full bg-sunken"/>
            </div>
            <div className="flex justify-between">
              <div className="font-medium text-caution text-sm/[16px]">
                Trims in house · 11 days late
              </div>
              <div className="text-ink-3 text-xs">
                ship by 14 Nov
              </div>
            </div>
          </div>
          {/* Item · Polos */}
          <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
            {/* Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Boat size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
                <div className="font-medium text-ink-3 text-xs">
                  At sea
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Men’s knitted polo shirts
            </div>
            <div className="text-ink-2 text-sm">
              S M Knitwears · US$26,550 · 4,500 pieces
            </div>
            {/* Progress */}
            <div className="flex h-1 gap-[3px] w-full shrink-0">
              <div className="grow basis-0 rounded-full bg-ink-2"/>
              <div className="grow basis-0 rounded-full bg-ink-2"/>
              <div className="grow basis-0 rounded-full bg-ink-2"/>
              <div className="grow basis-0 rounded-full bg-ink-2"/>
              <div className="grow basis-0 rounded-full bg-sunken"/>
            </div>
            <div className="flex justify-between">
              <div className="text-ink-2 text-sm/[16px]">
                Left Chattogram 25 Sep
              </div>
              <div className="text-ink-3 text-xs">
                Felixstowe 24 Oct
              </div>
            </div>
          </div>
          {/* Item · T-shirts */}
          <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
            {/* Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={16} weight="thin" className="shrink-0 text-brand" aria-hidden/>
                <div className="font-medium text-brand text-xs">
                  Delivered 30 Aug
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Kids’ cotton T-shirts
            </div>
            <div className="text-ink-2 text-sm">
              Aboni Knitwear · US$37,200 · 12,000 pieces
            </div>
          </div>
          {/* Item · Crew-neck */}
          <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
            {/* Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <PencilSimple size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
                <div className="font-medium text-ink-3 text-xs">
                  Draft · not sent
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Men’s crew-neck T-shirts
            </div>
            <div className="text-ink-2 text-sm">
              Zaheen Knitwears Limited · Sheds 3–5, 10–13
            </div>
            <div className="text-ink-3 text-xs">
              30,000 pieces · no price yet · ship by 15 Feb 2027
            </div>
          </div>
        </div>
      </div>
      
    </div>);
}
