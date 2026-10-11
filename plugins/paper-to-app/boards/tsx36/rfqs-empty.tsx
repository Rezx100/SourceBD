import { MagnifyingGlass, Plus, Receipt } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function RfqsEmptyPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full min-h-dvh relative flex-col bg-surface text-xs">
      
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
            0
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
            0
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-10 pb-[104px] gap-5 px-5">
        <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-12">
          <Receipt size={24} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col gap-2">
          <div className="tracking-tighter font-medium text-ink text-xl/[30px]">
            No RFQs yet
          </div>
          <div className="text-ink-2 text-[15px]/[22px]">
            Ask one supplier from its record, or up to 50 at once from Saved. Quotes come back here, side by side.
          </div>
        </div>
        <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
          <div className="flex items-center min-h-[52px] py-2 px-4 gap-3">
            <div className="w-6 shrink-0 font-medium text-ink-3 text-base">
              1
            </div>
            <div className="grow basis-0 text-ink text-[15px]/[22px]">
              Find suppliers in Search
            </div>
          </div>
          <div className="flex items-center min-h-[52px] py-2 px-4 gap-3 border-t border-t-line">
            <div className="w-6 shrink-0 font-medium text-ink-3 text-base">
              2
            </div>
            <div className="grow basis-0 text-ink text-[15px]/[22px]">
              Save the ones you like
            </div>
          </div>
          <div className="flex items-center min-h-[52px] py-2 px-4 gap-3 border-t border-t-line">
            <div className="w-6 shrink-0 font-medium text-ink-3 text-base">
              3
            </div>
            <div className="grow basis-0 text-ink text-[15px]/[22px]">
              Send one RFQ to all of them
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-12 rounded-lg gap-1.5 shrink-0 bg-brand">
          <MagnifyingGlass size={18} weight="thin" className="shrink-0 text-surface" aria-hidden/>
          <div className="font-medium text-surface text-md/[20px]">
            Search suppliers
          </div>
        </div>
      </div>
      
    </div>);
}
