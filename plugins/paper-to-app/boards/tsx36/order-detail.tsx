import { ArrowLeft, ChatCircle, Check, Clock, DotsThree, FileText, Storefront } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function OrderDetailPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full relative flex-col bg-surface text-xs">
      
      {/* Bar */}
      <div className="flex items-center justify-between h-14 shrink-0 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        {/* More */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <DotsThree size={22} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-1 pb-[104px] gap-[18px] h-fit px-5">
        {/* Head */}
        <div className="flex flex-col pb-1 gap-3">
          {/* Status */}
          <div className="flex items-center h-7 self-start pr-2.5 pl-2 rounded-full gap-1.5 shrink-0 bg-caution-tint">
            <Clock size={16} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
            <div className="font-medium text-caution text-sm">
              In production · 1 step late
            </div>
          </div>
          <div className="tracking-tighter font-medium text-ink text-2xl/[36px]">
            Women’s knitted dresses
          </div>
          {/* Identity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Storefront size={18} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              <div className="text-ink-2 text-[15px]/[22px]">
                Mondol Fabrics Ltd.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText size={18} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              <div className="font-mono text-ink-2 text-sm/[22px]">
                PO-2026-0917
              </div>
            </div>
          </div>
        </div>
        {/* Tiles */}
        <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
          <div className="flex">
            <div className="flex flex-col grow basis-0 gap-1 pt-3.5 pb-3 px-3.5 border-r border-r-line">
              <div className="text-ink-3 text-sm">
                Order value
              </div>
              <div className="tracking-tighter font-medium tabular-nums text-ink text-xl">
                US$84,000
              </div>
              <div className="text-ink-2 text-sm">
                20,000 at US$4.20
              </div>
            </div>
            <div className="flex flex-col grow basis-0 gap-1 pt-3.5 pb-3 px-3.5">
              <div className="text-ink-3 text-sm">
                Ship by
              </div>
              <div className="tracking-tighter font-medium tabular-nums text-ink text-xl">
                14 Nov
              </div>
              <div className="text-ink-2 text-sm">
                in 34 days
              </div>
            </div>
          </div>
        </div>
        {/* Timeline */}
        <div className="flex flex-col">
          <div className="flex items-baseline justify-between pb-3.5 pt-6">
            <div className="tracking-tight font-medium text-ink text-lg">
              Progress
            </div>
            <div className="font-medium text-caution text-sm/[16px]">
              1 late
            </div>
          </div>
          {/* Step · done */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center w-5 shrink-0">
              <div className="flex items-center justify-center rounded-full shrink-0 bg-ink-2 size-5">
                <Check size={12} weight="thin" className="shrink-0 text-surface" aria-hidden/>
              </div>
              <div className="w-0.5 grow basis-0 min-h-5 bg-line"/>
            </div>
            <div className="flex justify-between grow basis-0 pb-4">
              <div className="text-ink-2 text-base/[18px]">
                3 milestones done
              </div>
              <div className="font-medium text-ink text-sm/[16px]">
                Show
              </div>
            </div>
          </div>
          {/* Step · late */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center w-5 shrink-0">
              <div className="rounded-full shrink-0 bg-caution-tint border-2 border-solid border-caution-icon size-5"/>
              <div className="w-0.5 grow basis-0 min-h-5 bg-line"/>
            </div>
            <div className="flex flex-col grow basis-0 pb-4 gap-0.5">
              <div className="flex justify-between">
                <div className="font-medium text-ink text-[15px]/[18px]">
                  Trims in house
                </div>
                <div className="font-medium text-caution text-sm/[16px]">
                  11 days late
                </div>
              </div>
              <div className="text-ink-3 text-xs">
                Planned 30 Sep · not logged yet
              </div>
            </div>
          </div>
          {/* Step · logged */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center w-5 shrink-0">
              <div className="flex items-center justify-center rounded-full shrink-0 bg-ink-2 size-5">
                <Check size={12} weight="thin" className="shrink-0 text-surface" aria-hidden/>
              </div>
              <div className="w-0.5 grow basis-0 min-h-5 bg-line"/>
            </div>
            <div className="flex flex-col grow basis-0 pb-4 gap-0.5">
              <div className="flex justify-between">
                <div className="font-medium text-ink text-[15px]/[18px]">
                  Bulk cutting started
                </div>
                <div className="text-ink-2 text-sm/[16px]">
                  2 Oct
                </div>
              </div>
              <div className="text-ink-3 text-xs">
                Logged by Mondol Fabrics
              </div>
            </div>
          </div>
          {/* Step · planned */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center w-5 shrink-0">
              <div className="rounded-full shrink-0 border-2 border-dashed border-line-strong size-5"/>
              <div className="w-0.5 grow basis-0 min-h-5 bg-line"/>
            </div>
            <div className="flex flex-col grow basis-0 pb-4 gap-0.5">
              <div className="flex justify-between">
                <div className="font-medium text-ink text-[15px]/[18px]">
                  Final inspection
                </div>
                <div className="text-ink-3 text-sm/[16px]">
                  6 Nov
                </div>
              </div>
            </div>
          </div>
          {/* Step · planned 2 */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center w-5 shrink-0">
              <div className="rounded-full shrink-0 border-2 border-dashed border-line-strong size-5"/>
            </div>
            <div className="flex flex-col grow basis-0 gap-0.5">
              <div className="flex justify-between">
                <div className="font-medium text-ink text-[15px]/[18px]">
                  Ex-factory, by sea
                </div>
                <div className="text-ink-3 text-sm/[16px]">
                  14 Nov
                </div>
              </div>
              <div className="text-ink-3 text-xs">
                From Chattogram
              </div>
            </div>
          </div>
        </div>
        {/* Sample note */}
        <div className="flex items-center pt-1 gap-1.5">
          <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
          <div className="text-ink-3 text-xs">
            Sample state: no real orders yet, supplier name is real
          </div>
        </div>
      </div>
      {/* Action bar */}
      <div className="fixed bottom-0 flex flex-col bg-surface border-t border-t-line inset-x-0">
        <div className="flex gap-2 items-center h-16 py-2 shrink-0 px-4">
          {/* Message */}
          <div className="flex items-center justify-center shrink-0 rounded-lg border border-solid border-line size-12">
            <ChatCircle size={24} weight="thin" className="shrink-0 text-ink" aria-hidden/>
          </div>
          <div className="flex items-center justify-center grow basis-0 h-12 rounded-lg bg-brand">
            <div className="flex font-medium text-surface text-md/[20px]">
              Add update
            </div>
          </div>
        </div>
        
      </div>
    </div>);
}
