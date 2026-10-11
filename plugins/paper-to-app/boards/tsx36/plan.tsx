import { ArrowLeft, Envelope } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function PlanPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            Plan and usage
          </div>
          <div className="text-ink-3 text-sm line-clamp-1">
            What your account includes
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pb-12 px-5">
        {/* Your plan */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-4 pb-3.5">
            <div className="tracking-tight font-medium text-ink text-lg">
              Your plan
            </div>
            <div className="text-ink-3 text-sm">
              Free in the beta
            </div>
          </div>
          <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
            <div className="flex py-3.5 px-4 gap-2.5">
              <div className="w-24 shrink-0 text-ink-2 text-base">
                Includes
              </div>
              <div className="grow basis-0 text-ink text-base">
                Search, saved suppliers, RFQs, messages, orders and the compliance hub
              </div>
            </div>
            <div className="flex py-3.5 px-4 gap-2.5 border-t border-t-line">
              <div className="w-24 shrink-0 text-ink-2 text-base">
                Billing
              </div>
              <div className="grow basis-0 text-ink-3 text-base">
                Not set up. Nothing is charged.
              </div>
            </div>
          </div>
        </div>
        {/* This month */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-6 pb-3.5">
            <div className="tracking-tight font-medium text-ink text-lg">
              This month
            </div>
            <div className="text-ink-3 text-sm">
              1 to 11 Oct
            </div>
          </div>
          <div className="flex rounded-[10px] overflow-clip border border-solid border-line">
            <div className="flex flex-col grow basis-0 pt-3.5 pb-3 gap-1 px-3.5 border-r border-r-line">
              <div className="text-ink-3 text-sm">
                Evidence packs
              </div>
              <div className="tracking-tighter font-medium tabular-nums text-ink text-xl">
                2
              </div>
              <div className="text-ink-2 text-sm">
                up to 50 a day
              </div>
            </div>
            <div className="flex flex-col grow basis-0 pt-3.5 pb-3 gap-1 px-3.5">
              <div className="text-ink-3 text-sm">
                RFQs sent
              </div>
              <div className="tracking-tighter font-medium tabular-nums text-ink text-xl">
                3
              </div>
              <div className="text-ink-2 text-sm">
                to 7 suppliers
              </div>
            </div>
          </div>
        </div>
        <div className="flex pt-5">
          <div className="flex items-center justify-center h-11 grow px-3.5 rounded-full gap-1.5 bg-sunken">
            <Envelope size={16} weight="thin" className="shrink-0 text-ink" aria-hidden/>
            <div className="font-medium text-ink text-base">
              Contact support about your plan
            </div>
          </div>
        </div>
        <div className="flex items-center pt-4 gap-1.5">
          <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
          <div className="text-ink-3 text-xs">
            Sample usage
          </div>
        </div>
      </div>
    </div>);
}
