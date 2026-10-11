import { Clock } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function InboxPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full min-h-dvh relative flex-col bg-surface text-xs">
      
      {/* Page head */}
      <div className="flex items-center justify-between pt-2 px-5">
        <div className="tracking-tighter font-medium text-ink text-2xl/[36px]">
          Messages
        </div>
        <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-9">
          <div className="flex font-semibold text-ink-2 text-sm/[16px]">
            AM
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-3.5 px-5">
        {/* Sample note */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
            <div className="text-ink-3 text-xs">
              Sample messages; supplier names are real
            </div>
          </div>
          <div className="text-ink-3 text-sm">
            2 unread
          </div>
        </div>
        {/* Thread · Thermax */}
        <div className="flex py-3.5 gap-3 border-b border-b-line">
          <div className="flex items-center justify-center shrink-0 rounded-[12px] bg-sunken size-11">
            <div className="flex font-semibold text-ink-2 text-base/[18px]">
              TW
            </div>
          </div>
          <div className="flex flex-col grow basis-0 min-w-0 gap-[3px]">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-ink text-md/[22px]">
                Thermax Woven Dyeing
              </div>
              <div className="font-medium text-ink text-xs">
                11:20
              </div>
            </div>
            <div className="text-ink text-base">
              Thank you. We will send the quote by Monday.
            </div>
            <div className="flex items-center justify-between">
              <div className="text-ink-3 text-xs">
                RFQ · French terry hoodies
              </div>
              <div className="rounded-full shrink-0 bg-ink size-2"/>
            </div>
          </div>
        </div>
        {/* Thread · Quattro */}
        <div className="flex py-3.5 gap-3 border-b border-b-line">
          <div className="flex items-center justify-center shrink-0 rounded-[12px] bg-sunken size-11">
            <div className="flex font-semibold text-ink-2 text-base/[18px]">
              QF
            </div>
          </div>
          <div className="flex flex-col grow basis-0 min-w-0 gap-[3px]">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-ink text-md/[22px]">
                Quattro Fashion Limited
              </div>
              <div className="font-medium text-ink text-xs">
                Yesterday
              </div>
            </div>
            <div className="text-ink text-base">
              We can make the T-shirts. Our MOQ is 500 pieces per colour.
            </div>
            <div className="flex items-center justify-between">
              <div className="text-ink-3 text-xs">
                RFQ · T-shirt
              </div>
              <div className="rounded-full shrink-0 bg-ink size-2"/>
            </div>
          </div>
        </div>
        {/* Thread · Aboni */}
        <div className="flex py-3.5 gap-3 border-b border-b-line">
          <div className="flex items-center justify-center shrink-0 rounded-[12px] bg-sunken size-11">
            <div className="flex font-semibold text-ink-2 text-base/[18px]">
              AK
            </div>
          </div>
          <div className="flex flex-col grow basis-0 min-w-0 gap-[3px]">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-ink text-md/[22px]">
                Aboni Knitwear Ltd.
              </div>
              <div className="text-ink-3 text-xs">
                26 Sep
              </div>
            </div>
            <div className="text-ink-2 text-base">
              You: Can you confirm the fabric mill?
            </div>
            <div className="flex items-center gap-[5px]">
              <Clock size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
              <div className="font-medium text-caution text-xs">
                No reply in 15 days
              </div>
              <div className="text-ink-3 text-xs">
                · RFQ · French terry hoodies
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>);
}
