import { LockSimple, PaperPlaneTilt, Paperclip, Receipt, Storefront, X } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function ThreadPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full min-h-dvh flex-col bg-subtle text-xs">
      {/* Head */}
      <div className="flex flex-col bg-surface border-b border-b-line">
        
        {/* Bar */}
        <div className="flex items-center min-h-14 pt-1.5 pr-4 pb-2.5 pl-5 gap-3">
          <div className="flex flex-col grow basis-0 min-w-0">
            <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px] line-clamp-1">
              Thermax Woven Dyeing
            </div>
            <div className="text-ink-3 text-sm">
              RFQ · French terry hoodies
            </div>
          </div>
          <div className="flex items-center shrink-0 gap-2">
            {/* Record */}
            <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-9">
              <Storefront size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
            </div>
            {/* Close */}
            <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-9">
              <X size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
            </div>
          </div>
        </div>
      </div>
      {/* Conversation */}
      <div className="flex flex-col grow basis-0 p-4 gap-3.5">
        {/* RFQ card */}
        <div className="flex items-center py-3 px-3.5 rounded-[12px] gap-3 bg-surface border border-solid border-line">
          <div className="flex items-center justify-center shrink-0 rounded-[10px] bg-sunken size-9">
            <Receipt size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
          </div>
          <div className="flex flex-col grow basis-0">
            <div className="font-medium text-ink text-base/[18px]">
              French terry hoodies · 12,000 pieces
            </div>
            <div className="text-ink-3 text-xs">
              Sent 18 Jul · quote promised by Monday
            </div>
          </div>
        </div>
        {/* Sample note */}
        <div className="flex items-center justify-center gap-1.5">
          <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
          <div className="text-ink-3 text-xs">
            Sample messages
          </div>
        </div>
        {/* Bubble · them */}
        <div className="flex flex-col items-start gap-1">
          <div className="max-w-[280px] py-2.5 px-3.5 rounded-br-pane-phone rounded-bl-sm bg-surface border border-solid border-line rounded-t-pane-phone">
            <div className="text-ink text-[15px]/[21px]">
              Thank you. We will send the quote by Monday.
            </div>
          </div>
          <div className="text-ink-3 text-[11px]/[14px]">
            11:20
          </div>
        </div>
        {/* Bubble · you */}
        <div className="flex flex-col items-end gap-1">
          <div className="max-w-[280px] py-2.5 px-3.5 rounded-br-sm rounded-bl-pane-phone bg-ink rounded-t-pane-phone">
            <div className="text-surface text-[15px]/[21px]">
              Thank you, Monday works. Can you share the size chart too?
            </div>
          </div>
          <div className="text-ink-3 text-[11px]/[14px]">
            11:22 · Read
          </div>
        </div>
      </div>
      {/* Composer */}
      <div className="flex flex-col bg-surface border-t border-t-line">
        {/* Composer row */}
        <div className="flex flex-col pt-2.5 pb-1 gap-2 px-4">
          {/* Field */}
          <div className="flex items-center min-h-12 p-1 rounded-[24px] gap-1 bg-surface border border-solid border-line">
            {/* Attach */}
            <div className="flex items-center justify-center shrink-0 rounded-full size-10">
              <Paperclip size={20} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="grow basis-0 text-ink-3 text-md">
              Message Thermax
            </div>
            {/* Send (disabled until typed) */}
            <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-10">
              <PaperPlaneTilt size={18} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <LockSimple size={13} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            <div className="text-ink-3 text-xs">
              Replies come here. Your email stays private.
            </div>
          </div>
        </div>
        
      </div>
    </div>);
}
