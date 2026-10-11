import { X } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function SaveSearchPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full flex-col bg-[#8A8C8F] text-xs">
      
      {/* Results behind */}
      <div className="h-[180px] shrink-0"/>
      {/* Sheet */}
      <div className="flex flex-col overflow-clip bg-surface rounded-t-pane-phone">
        <div className="flex justify-center pt-2">
          <div className="w-9 h-1 rounded-full shrink-0 bg-line"/>
        </div>
        {/* Sheet head */}
        <div className="flex items-center pt-2.5 pr-4 pb-3.5 pl-5 gap-3 border-b border-b-line">
          <div className="flex flex-col grow basis-0 min-w-0">
            <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
              Save this search
            </div>
            <div className="text-ink-3 text-sm">
              2 suppliers match it today
            </div>
          </div>
          <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
            <X size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
          </div>
        </div>
        {/* Sheet body */}
        <div className="flex flex-col px-5">
          {/* Name */}
          <div className="flex flex-col py-5 gap-1.5 border-b border-b-line">
            <div className="font-medium text-ink-2 text-sm">
              Name
            </div>
            <div className="flex items-center h-12 px-3.5 rounded-lg gap-px shrink-0 border border-solid border-ink">
              <div className="text-ink text-md/[22px]">
                UK knitwear, GOTS valid
              </div>
              <div className="w-[1.5px] h-5 shrink-0 bg-ink"/>
            </div>
            <div className="text-ink-3 text-xs">
              Filled in from your filters. Only you see it.
            </div>
          </div>
          {/* Filters */}
          <div className="flex flex-col py-5 gap-3 border-b border-b-line">
            <div className="flex flex-col gap-0.5">
              <div className="font-medium text-ink text-md/[22px]">
                What it looks for
              </div>
              <div className="text-ink-3 text-sm">
                4 filters, from the search you just ran
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  Knitwear
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  Ships to UK
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  GOTS valid 30+ days
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  Sanctioned hidden
                </div>
              </div>
            </div>
          </div>
          {/* Alert */}
          <div className="flex items-center min-h-[52px] pt-4 pb-6 gap-3">
            <div className="flex flex-col grow basis-0 gap-0.5">
              <div className="text-ink text-[15px]/[22px]">
                Tell me about new matches
              </div>
              <div className="text-ink-3 text-sm">
                One email on Monday, only when something new matches
              </div>
            </div>
            <div className="w-11 h-[26px] shrink-0 rounded-full relative bg-ink">
              <div className="left-[21px] top-[3px] rounded-full absolute bg-surface size-5"/>
            </div>
          </div>
        </div>
        {/* Action bar */}
        <div className="flex flex-col shrink-0 bg-surface border-t border-t-line">
          <div className="flex items-center h-16 px-4 gap-2 shrink-0">
            <div className="grow basis-0 h-12 flex items-center justify-center rounded-lg bg-brand">
              <div className="font-medium text-surface text-md/[20px]">
                Save search
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>);
}
