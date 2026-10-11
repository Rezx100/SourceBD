import { CaretRight, ChatCircle, CheckCircle, Clock, Plus, Warning } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function RfqsPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full relative flex-col bg-surface text-xs">
      
      {/* Page head */}
      <div className="flex items-center justify-between pt-2 pb-3 px-5">
        <div className="tracking-tighter font-medium text-ink text-2xl/[36px]">
          Quotes
        </div>
        <div className="flex items-center gap-2">
          {/* New RFQ */}
          <div className="flex items-center h-9 pr-3.5 pl-2.5 rounded-full gap-1.5 bg-sunken">
            <Plus size={16} weight="thin" className="shrink-0 text-ink" aria-hidden/>
            <div className="font-medium text-ink text-base/[18px]">
              New RFQ
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
        {/* Tab · RFQs (current) */}
        <div className="flex items-center shrink-0 px-2 gap-1.5 relative">
          <div className="font-medium text-ink text-md/[20px]">
            RFQs
          </div>
          <div className="text-ink-3 text-sm/[16px]">
            6
          </div>
          {/* Indicator */}
          <div className="absolute -bottom-px h-0.5 rounded-tl-[2px] rounded-tr-[2px] bg-ink inset-x-2"/>
        </div>
        {/* Tab · Orders */}
        <div className="flex items-center shrink-0 px-2 gap-1.5">
          <div className="font-medium text-ink-3 text-md/[20px]">
            Orders
          </div>
          <div className="text-ink-3 text-sm/[16px]">
            4
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pb-[104px] px-5">
        {/* Sample note */}
        <div className="flex items-center pt-3.5 gap-1.5 pb-3">
          <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
          <div className="text-ink-3 text-xs">
            Sample state: supplier names are real, quotes are samples
          </div>
        </div>
        {/* Items */}
        <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
          {/* Item · Hoodies */}
          <div className="flex flex-col p-4 gap-2.5">
            {/* Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ChatCircle size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
                <div className="font-medium text-ink-3 text-xs">
                  RFQ · 2 of 3 replied
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Men’s French terry hoodies, 420gsm
            </div>
            <div className="flex items-baseline gap-2 w-full">
              <div className="tracking-tighter shrink-0 w-max font-medium tabular-nums text-ink text-xl/[30px]">
                US$8.55
              </div>
              <div className="shrink-0 w-max text-ink-3 text-sm/[16px]">
                from Aboni
              </div>
              {/* Spacer */}
              <div className="grow basis-0"/>
              {/* Delta */}
              <div className="flex items-center h-6 shrink-0 self-center pr-2 pl-1.5 rounded-full gap-1 bg-brand-tint">
                <CheckCircle size={14} weight="thin" className="shrink-0 text-brand" aria-hidden/>
                <div className="w-max font-medium text-brand text-xs">
                  US$0.35 under
                </div>
              </div>
            </div>
            <div className="text-ink-3 text-xs">
              10,000 pieces · next S M Knitwears, US$9.30
            </div>
          </div>
          {/* Item · Hoodies, waiting */}
          <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
            {/* Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
                <div className="font-medium text-ink-3 text-xs">
                  RFQ · quote promised by Monday
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Men’s French terry hoodies, 420gsm
            </div>
            <div className="text-ink-2 text-sm">
              Thermax Woven Dyeing will quote by Monday.
            </div>
            <div className="text-ink-3 text-xs">
              12,000 pieces · target US$8.95 · sent 18 Jul
            </div>
          </div>
          {/* Item · Pyjamas */}
          <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
            {/* Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ChatCircle size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
                <div className="font-medium text-ink-3 text-xs">
                  RFQ · 4 quotes
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Kids’ cotton pyjama sets
            </div>
            <div className="flex items-baseline gap-2 w-full">
              <div className="tracking-tighter shrink-0 w-max font-medium tabular-nums text-ink text-xl/[30px]">
                US$3.10
              </div>
              <div className="shrink-0 w-max text-ink-3 text-sm/[16px]">
                best of 4
              </div>
              {/* Spacer */}
              <div className="grow basis-0"/>
              {/* Delta */}
              <div className="flex items-center h-6 shrink-0 self-center pr-2 pl-1.5 rounded-full gap-1 bg-caution-tint">
                <Warning size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
                <div className="w-max font-medium text-caution text-xs">
                  US$0.15 over
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Warning size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
              <div className="text-caution text-sm">
                Its MOQ is 30,000 sets, above your 24,000
              </div>
            </div>
          </div>
          {/* Item · Dresses */}
          <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
            {/* Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={16} weight="thin" className="shrink-0 text-brand" aria-hidden/>
                <div className="font-medium text-brand text-xs">
                  Quote accepted · order started
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              Women’s knitted dresses
            </div>
            <div className="text-ink-2 text-sm">
              Mondol Fabrics at US$4.20 per piece
            </div>
          </div>
        </div>
      </div>
      
    </div>);
}
