import { CaretRight, FileText, Hourglass, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function SearchHomePhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full min-h-dvh relative flex-col bg-surface text-xs">
      
      {/* Page head */}
      <div className="flex items-center justify-between pt-2 px-5">
        <div className="tracking-tighter font-medium text-ink text-2xl/[36px]">
          Search
        </div>
        {/* Account */}
        <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-9">
          <div className="flex font-semibold text-ink-2 text-sm/[16px]">
            AM
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-4 gap-6 px-5">
        {/* Search field */}
        <div className="flex items-center h-[52px] px-4 rounded-[12px] gap-2.5 shrink-0 bg-sunken">
          <MagnifyingGlass size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
          <div className="text-ink-3 text-md">
            Supplier, product or certificate
          </div>
        </div>
        {/* Quick searches */}
        <div className="flex flex-wrap -mt-3 gap-2">
          <div className="flex items-center h-[34px] px-3.5 rounded-full border border-solid border-line">
            <div className="flex font-medium text-ink-2 text-base/[18px]">
              Knit
            </div>
          </div>
          <div className="flex items-center h-[34px] px-3.5 rounded-full border border-solid border-line">
            <div className="flex font-medium text-ink-2 text-base/[18px]">
              Woven
            </div>
          </div>
          <div className="flex items-center h-[34px] px-3.5 rounded-full border border-solid border-line">
            <div className="flex font-medium text-ink-2 text-base/[18px]">
              Denim
            </div>
          </div>
          <div className="flex items-center h-[34px] px-3.5 rounded-full border border-solid border-line">
            <div className="flex font-medium text-ink-2 text-base/[18px]">
              GOTS
            </div>
          </div>
        </div>
        {/* Needs a look */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pb-3.5">
            <div className="flex items-baseline gap-2">
              <div className="tracking-tight font-medium text-ink text-lg">
                Needs a look
              </div>
              <div className="text-ink-3 text-lg">
                2
              </div>
            </div>
            <div className="text-ink-3 text-sm">
              In your saved suppliers
            </div>
          </div>
          {/* Items */}
          <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
            {/* Item · Mondol Intimates */}
            <div className="flex flex-col p-4 gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Hourglass size={16} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
                  <div className="font-medium text-caution text-xs">
                    Certificate · GOTS expired 8 Oct
                  </div>
                </div>
                <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              </div>
              <div className="font-medium text-ink text-md/[22px]">
                Mondol Intimates Ltd.
              </div>
              <div className="text-ink-3 text-xs">
                3 days ago · renewal not checked yet
              </div>
            </div>
            {/* Item · Tex Town */}
            <div className="flex flex-col p-4 gap-1.5 border-t border-t-line">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Hourglass size={16} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
                  <div className="font-medium text-caution text-xs">
                    Certificate · GOTS ends 15 Oct
                  </div>
                </div>
                <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              </div>
              <div className="font-medium text-ink text-md/[22px]">
                Tex Town Ltd.
              </div>
              <div className="text-ink-3 text-xs">
                4 days left · WRAP valid to Jun 2027
              </div>
            </div>
          </div>
          {/* Source line */}
          <div className="flex items-center pt-3 gap-1.5">
            <FileText size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            <div className="text-ink-3 text-xs">
              GOTS register · read date not stored
            </div>
          </div>
        </div>
        {/* Recent searches */}
        <div className="flex flex-col">
          <div className="pb-1">
            <div className="tracking-tight font-medium text-ink text-lg">
              Recent searches
            </div>
          </div>
          <div className="flex items-center justify-between min-h-12 border-b border-b-line">
            <div className="text-ink text-[15px]/[18px]">
              knit
            </div>
            <div className="tabular-nums text-ink-3 text-sm/[16px]">
              4,645 suppliers
            </div>
          </div>
          <div className="flex items-center justify-between min-h-12">
            <div className="text-ink text-[15px]/[18px]">
              knit · GOTS · Gazipur
            </div>
            <div className="tabular-nums text-ink-3 text-sm/[16px]">
              71 suppliers
            </div>
          </div>
        </div>
      </div>
      
    </div>);
}
