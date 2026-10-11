import { CaretDown, Check, Clock, Info, X } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function FiltersPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full flex-col bg-[#8A8C8F] text-xs">
      
      {/* Sheet */}
      <div className="relative top-0 flex flex-col overflow-clip bg-surface inset-x-0 rounded-t-pane-phone">
        {/* Grabber */}
        <div className="flex justify-center pt-2">
          <div className="w-9 h-1 rounded-full shrink-0 bg-line"/>
        </div>
        {/* Head */}
        <div className="flex items-center pt-2.5 pr-4 pb-3.5 pl-5 gap-3 border-b border-b-line">
          <div className="grow basis-0 flex items-baseline gap-2">
            <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
              Filters
            </div>
            <div className="text-ink-3 text-xl/[30px]">
              4
            </div>
          </div>
          <div className="px-2">
            <div className="font-medium text-ink-2 text-base">
              Clear all
            </div>
          </div>
          {/* Close */}
          <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
            <X size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
          </div>
        </div>
        {/* Groups */}
        <div className="grow basis-0 flex flex-col px-5 overflow-clip">
          {/* Group · Ships to */}
          <div className="flex flex-col py-5 gap-3 border-b border-b-line">
            <div className="flex flex-col gap-0.5">
              <div className="font-medium text-ink text-md/[22px]">
                Ships to
              </div>
              <div className="text-ink-3 text-sm">
                From customs records, Sep 2024 – Aug 2026
              </div>
            </div>
            {/* Chips */}
            <div className="flex flex-wrap gap-2">
              {/* Chip · UK (on) */}
              <div className="flex items-center h-9 pr-3.5 pl-2.5 rounded-full gap-1.5 bg-ink">
                <Check size={16} weight="thin" className="shrink-0 text-surface" aria-hidden/>
                <div className="font-medium text-surface text-base">
                  UK
                </div>
              </div>
              {/* Chip · EU */}
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  EU
                </div>
              </div>
              {/* Chip · US */}
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  US
                </div>
              </div>
              {/* Chip · Canada */}
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  Canada
                </div>
              </div>
            </div>
          </div>
          {/* Group · Exports */}
          <div className="flex flex-col py-5 gap-3 border-b border-b-line">
            <div className="flex flex-col gap-0.5">
              <div className="font-medium text-ink text-md/[22px]">
                Exported in 2 years
              </div>
              <div className="text-ink-3 text-sm">
                Total value of its shipments, in US dollars
              </div>
            </div>
            {/* Chips */}
            <div className="flex flex-wrap gap-2">
              {/* Chip · Any (on) */}
              <div className="flex items-center h-9 pr-3.5 pl-2.5 rounded-full gap-1.5 bg-ink">
                <Check size={16} weight="thin" className="shrink-0 text-surface" aria-hidden/>
                <div className="font-medium text-surface text-base">
                  Any
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  $1M+
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  $10M+
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  $50M+
                </div>
              </div>
            </div>
            {/* Coverage note */}
            <div className="flex py-2.5 px-3 rounded-lg gap-2 bg-subtle">
              <Info size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              <div className="text-ink-2 text-sm">
                We have customs records for 114 suppliers so far. A size or market filter hides the rest.
              </div>
            </div>
          </div>
          {/* Group · Certificates */}
          <div className="flex flex-col py-5 gap-3 border-b border-b-line">
            <div className="flex flex-col gap-0.5">
              <div className="font-medium text-ink text-md/[22px]">
                Certificates
              </div>
              <div className="text-ink-3 text-sm">
                Checked with each issuer’s own list
              </div>
            </div>
            {/* Chips */}
            <div className="flex flex-wrap gap-2">
              {/* Chip · GOTS (on) */}
              <div className="flex items-center h-9 pr-3.5 pl-2.5 rounded-full gap-1.5 bg-ink">
                <Check size={16} weight="thin" className="shrink-0 text-surface" aria-hidden/>
                <div className="font-medium text-surface text-base">
                  GOTS
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  WRAP
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  OEKO-TEX
                </div>
              </div>
            </div>
            {/* Toggle · still valid */}
            <div className="flex items-center min-h-11 gap-3">
              <div className="grow basis-0 flex flex-col gap-0.5">
                <div className="text-ink text-[15px]/[22px]">
                  Valid for 30 more days or longer
                </div>
                <div className="text-ink-3 text-sm">
                  Leaves out ones that expired or end soon
                </div>
              </div>
              {/* Switch (on) */}
              <div className="w-11 h-[26px] shrink-0 rounded-full relative bg-ink">
                <div className="top-[3px] left-[21px] rounded-full absolute bg-surface size-5"/>
              </div>
            </div>
          </div>
          {/* Group · Safety */}
          <div className="flex flex-col py-4 gap-1 border-b border-b-line">
            <div className="pt-1">
              <div className="font-medium text-ink text-md/[22px]">
                Factory safety
              </div>
            </div>
            {/* Toggle · RSC */}
            <div className="flex items-center min-h-[52px] gap-3">
              <div className="grow basis-0 flex flex-col gap-0.5">
                <div className="text-ink text-[15px]/[22px]">
                  Inspected by RSC
                </div>
                <div className="text-ink-3 text-sm">
                  Building and fire safety programme
                </div>
              </div>
              {/* Switch (off) */}
              <div className="w-11 h-[26px] shrink-0 rounded-full relative bg-sunken border border-solid border-line">
                <div className="top-0.5 left-0.5 rounded-full absolute [box-shadow:#15181C33_0px_1px_2px] bg-surface size-5"/>
              </div>
            </div>
            {/* Toggle · on schedule */}
            <div className="flex items-center min-h-[52px] gap-3">
              <div className="grow basis-0 flex flex-col gap-0.5">
                <div className="text-ink text-[15px]/[22px]">
                  Repairs on schedule
                </div>
                <div className="text-ink-3 text-sm">
                  Every building, as RSC last reported
                </div>
              </div>
              {/* Switch (off) */}
              <div className="w-11 h-[26px] shrink-0 rounded-full relative bg-sunken border border-solid border-line">
                <div className="top-0.5 left-0.5 rounded-full absolute [box-shadow:#15181C33_0px_1px_2px] bg-surface size-5"/>
              </div>
            </div>
          </div>
          {/* Group · Location */}
          <div className="flex flex-col py-5 gap-3 border-b border-b-line">
            <div className="font-medium text-ink text-md/[22px]">
              Location
            </div>
            {/* Chips */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  Dhaka
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  Gazipur
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  Narayanganj
                </div>
              </div>
              <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  Chattogram
                </div>
              </div>
              <div className="flex items-center h-9 pr-2.5 pl-3.5 rounded-full gap-1 bg-sunken">
                <div className="font-medium text-ink text-base">
                  More
                </div>
                <CaretDown size={14} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
            </div>
          </div>
          {/* Group · Sanctions */}
          <div className="flex flex-col pt-4 pb-6 gap-1">
            <div className="pt-1">
              <div className="font-medium text-ink text-md/[22px]">
                Sanctions
              </div>
            </div>
            {/* Toggle · hide listed */}
            <div className="flex items-center min-h-[52px] gap-3">
              <div className="grow basis-0 flex flex-col gap-0.5">
                <div className="text-ink text-[15px]/[22px]">
                  Hide suppliers on a sanctions list
                </div>
                <div className="text-ink-3 text-sm">
                  UK, EU and US lists read 6 to 11 Oct
                </div>
              </div>
              {/* Switch (on) */}
              <div className="w-11 h-[26px] shrink-0 rounded-full relative bg-ink">
                <div className="top-[3px] left-[21px] rounded-full absolute bg-surface size-5"/>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
              <div className="font-medium text-caution text-xs">
                The US forced-labour list (UFLPA) is not read yet
              </div>
            </div>
          </div>
        </div>
        {/* Action bar */}
        <div className="flex flex-col shrink-0 bg-surface border-t border-t-line">
          <div className="flex items-center h-16 px-4 gap-2 shrink-0">
            {/* Clear */}
            <div className="flex items-center justify-center h-12 shrink-0 px-[18px] rounded-lg border border-solid border-line">
              <div className="font-medium text-ink text-md/[20px]">
                Clear
              </div>
            </div>
            {/* Show results */}
            <div className="grow basis-0 flex items-center justify-center h-12 rounded-lg bg-brand">
              <div className="font-medium text-surface text-md/[20px]">
                Show 2 suppliers
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>);
}
