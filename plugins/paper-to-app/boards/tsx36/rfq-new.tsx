import { CaretRight, CheckCircle, Plus, X } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function RfqNewPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full min-h-dvh relative flex-col bg-surface text-xs">
      
      {/* Bar */}
      <div className="flex items-center justify-between h-14 shrink-0 pr-4 pl-5">
        <div className="flex items-center gap-1.5">
          <CheckCircle size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
          <div className="text-ink-3 text-sm">
            Draft saved
          </div>
        </div>
        {/* Close */}
        <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-9">
          <X size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-1 gap-4 px-5">
        <div className="tracking-tighter font-medium text-ink text-2xl/[36px]">
          New RFQ
        </div>
        {/* To */}
        <div className="flex items-center py-3 px-3.5 rounded-[12px] gap-3 bg-subtle">
          <div className="flex items-center justify-center shrink-0 rounded-[10px] bg-surface border border-solid border-line size-9">
            <div className="flex font-semibold text-ink-2 text-xs">
              AK
            </div>
          </div>
          <div className="flex flex-col grow basis-0">
            <div className="text-ink-3 text-xs">
              To 1 supplier
            </div>
            <div className="font-medium text-ink text-[15px]/[18px]">
              Aboni Knitwear Ltd.
            </div>
          </div>
          <div className="flex items-center h-[34px] px-3 rounded-full gap-1 bg-surface border border-solid border-line">
            <Plus size={14} weight="thin" className="shrink-0 text-ink" aria-hidden/>
            <div className="font-medium text-ink text-sm/[16px]">
              Add
            </div>
          </div>
        </div>
        {/* Field · product */}
        <div className="flex flex-col gap-1.5">
          <div className="font-medium text-ink-2 text-sm/[16px]">
            Product
          </div>
          <div className="flex items-center min-h-[52px] py-3 px-3.5 rounded-[10px] [border-width:1.5px] border-solid border-ink">
            <div className="flex text-ink text-md/[22px]">
              Men’s heavyweight French terry hoodies, 420gsm
            </div>
          </div>
        </div>
        {/* Row · qty */}
        <div className="flex gap-2.5">
          <div className="flex flex-col grow basis-0 gap-1.5">
            <div className="font-medium text-ink-2 text-sm/[16px]">
              Quantity
            </div>
            <div className="flex items-center justify-between h-[52px] px-3.5 rounded-[10px] shrink-0 border border-solid border-line">
              <div className="tabular-nums text-ink text-md/[20px]">
                10,000
              </div>
              <div className="text-ink-3 text-base/[18px]">
                pieces
              </div>
            </div>
          </div>
          <div className="flex flex-col grow basis-0 gap-1.5">
            <div className="font-medium text-ink-2 text-sm/[16px]">
              Target price
            </div>
            <div className="flex items-center justify-between h-[52px] px-3.5 rounded-[10px] shrink-0 border border-solid border-line">
              <div className="text-ink-3 text-base/[18px]">
                US$
              </div>
              <div className="tabular-nums text-ink text-md/[20px]">
                8.90
              </div>
            </div>
          </div>
        </div>
        {/* Row · ship */}
        <div className="flex gap-2.5">
          <div className="flex flex-col grow basis-0 gap-1.5">
            <div className="font-medium text-ink-2 text-sm/[16px]">
              Ship by
            </div>
            <div className="flex items-center h-[52px] px-3.5 rounded-[10px] shrink-0 border border-solid border-line">
              <div className="flex text-ink text-md/[20px]">
                15 Jan 2027
              </div>
            </div>
          </div>
          <div className="flex flex-col grow basis-0 gap-1.5">
            <div className="font-medium text-ink-2 text-sm/[16px]">
              Ship to
            </div>
            <div className="flex items-center h-[52px] px-3.5 rounded-[10px] shrink-0 border border-solid border-line">
              <div className="flex text-ink text-md/[20px]">
                United Kingdom
              </div>
            </div>
          </div>
        </div>
        {/* More */}
        <div className="flex flex-col border-t border-t-line">
          <div className="flex items-center justify-between min-h-14 border-b border-b-line">
            <div className="flex flex-col">
              <div className="font-medium text-ink text-[15px]/[18px]">
                Questions · 3
              </div>
              <div className="text-ink-3 text-xs">
                Price per piece, MOQ per colour, certificate
              </div>
            </div>
            <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
          </div>
          <div className="flex items-center justify-between min-h-14">
            <div className="flex flex-col">
              <div className="font-medium text-ink text-[15px]/[18px]">
                Message
              </div>
              <div className="text-ink-3 text-xs">
                From your RFQ template
              </div>
            </div>
            <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
          </div>
        </div>
      </div>
      {/* Action bar */}
      <div className="fixed bottom-0 flex flex-col bg-surface border-t border-t-line inset-x-0">
        <div className="text-center pt-2.5 px-4">
          <div className="text-center flex justify-center flex-wrap text-ink-3 text-xs">
            Suppliers reply in Messages. Your email stays private.
          </div>
        </div>
        <div className="flex pt-2 pb-1.5 px-4">
          <div className="flex items-center justify-center grow basis-0 h-12 rounded-lg bg-brand">
            <div className="flex font-medium text-surface text-md/[20px]">
              Send RFQ
            </div>
          </div>
        </div>
        
      </div>
    </div>);
}
