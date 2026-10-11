import { Bell, CaretRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function SavedSearchesPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full relative flex-col bg-surface text-xs">
      
      {/* Page head */}
      <div className="flex items-center justify-between pt-2 pb-3 px-5">
        <div className="tracking-tighter font-medium text-ink text-2xl/[36px]">
          Saved
        </div>
        <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-9">
          <div className="flex font-semibold text-ink-2 text-sm/[16px]">
            AM
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex h-12 shrink-0 px-3 gap-1 border-b border-b-line">
        <div className="flex items-center shrink-0 px-2 gap-1.5">
          <div className="font-medium text-ink-3 text-md/[20px]">
            Suppliers
          </div>
          <div className="text-ink-3 text-sm/[16px]">
            11
          </div>
        </div>
        <div className="flex items-center shrink-0 px-2 gap-1.5 relative">
          <div className="font-medium text-ink text-md/[20px]">
            Searches
          </div>
          <div className="text-ink-3 text-sm/[16px]">
            2
          </div>
          <div className="absolute -bottom-px h-0.5 rounded-tl-[2px] rounded-tr-[2px] bg-ink inset-x-2"/>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-4 pb-[104px] gap-4 px-5">
        <div className="text-ink-3 text-sm">
          2 saved searches · only you see them
        </div>
        {/* Search list */}
        <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
          {/* Search */}
          <div className="flex flex-col p-4 gap-2.5">
            <div className="flex items-center gap-1.5">
              <Bell size={16} weight="thin" className="shrink-0 text-info" aria-hidden/>
              <div className="grow basis-0 font-medium text-info text-xs">
                1 new since you looked on 6 Oct
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-medium text-ink text-md/[22px]">
                UK knitwear, GOTS valid
              </div>
              <div className="flex items-baseline shrink-0 gap-1">
                <div className="font-medium tabular-nums text-ink text-md/[22px]">
                  2
                </div>
                <div className="text-ink-3 text-sm">
                  today
                </div>
              </div>
            </div>
            <div className="text-ink-2 text-sm">
              Ships to the UK · GOTS valid 30 days or more · sanctioned suppliers hidden
            </div>
            <div className="flex items-center min-h-11 gap-3">
              <div className="grow basis-0 text-ink text-base">
                Email me new matches every Monday
              </div>
              <div className="w-11 h-[26px] shrink-0 rounded-full relative bg-ink">
                <div className="left-[21px] top-[3px] rounded-full absolute bg-surface size-5"/>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-ink-3 text-xs">
                Run 9 Oct · counted 2h ago
              </div>
              <div className="flex items-center h-11 shrink-0 px-3.5 rounded-full gap-1.5 bg-sunken">
                <MagnifyingGlass size={16} weight="thin" className="shrink-0 text-ink" aria-hidden/>
                <div className="font-medium text-ink text-base">
                  Run search
                </div>
              </div>
            </div>
          </div>
          {/* Search */}
          <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
            <div className="flex items-center gap-1.5">
              <Bell size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              <div className="grow basis-0 text-ink-3 text-xs">
                Nothing new since you looked on 4 Oct
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-medium text-ink text-md/[22px]">
                T-shirt factories in Gazipur
              </div>
              <div className="flex items-baseline shrink-0 gap-1">
                <div className="font-medium tabular-nums text-ink text-md/[22px]">
                  37
                </div>
                <div className="text-ink-3 text-sm">
                  today
                </div>
              </div>
            </div>
            <div className="text-ink-2 text-sm">
              Exports HS 6109, T-shirts · Gazipur · factories only
            </div>
            <div className="flex items-center min-h-11 gap-3">
              <div className="grow basis-0 text-ink text-base">
                No email for new matches
              </div>
              <div className="w-11 h-[26px] shrink-0 rounded-full relative bg-sunken border border-solid border-line">
                <div className="left-0.5 top-0.5 rounded-full absolute [box-shadow:#15181C33_0px_1px_2px] bg-surface size-5"/>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-ink-3 text-xs">
                Run 4 Oct · counted 3 days ago
              </div>
              <div className="flex items-center h-11 shrink-0 px-3.5 rounded-full gap-1.5 bg-sunken">
                <MagnifyingGlass size={16} weight="thin" className="shrink-0 text-ink" aria-hidden/>
                <div className="font-medium text-ink text-base">
                  Run search
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Notes */}
        <div className="flex flex-col gap-2">
          <div className="text-ink-3 text-xs">
            Alert emails go out on Monday, only when something new matches.
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
            <div className="text-ink-3 text-xs">
              Sample searches; counts are illustrative
            </div>
          </div>
        </div>
      </div>
      
    </div>);
}
