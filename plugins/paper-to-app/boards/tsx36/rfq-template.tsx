import { ArrowLeft, CaretDown, Plus, Trash, WarningCircle } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function RfqTemplatePhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            RFQ template
          </div>
          <div className="text-ink-3 text-sm line-clamp-1">
            How every new RFQ starts
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pb-12 px-5">
        {/* Message */}
        <div className="flex flex-col gap-3">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-4 pb-0.5">
            <div className="tracking-tight font-medium text-ink text-lg">
              Opening message
            </div>
          </div>
          <div className="flex items-start py-3 px-3.5 rounded-lg border border-solid border-line-strong">
            <div className="whitespace-pre-wrap text-ink text-[15px]/[22px]">
              Dear [Supplier name] team,<br /><br />We are [Your company], a UK clothing brand. We would like a quote for [Product]. You can see more about us at [Your website].<br /><br />Kind regards,<br />[Your name]
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center h-11 px-3.5 rounded-full gap-1.5 bg-sunken">
              <Plus size={16} weight="thin" className="shrink-0 text-ink" aria-hidden/>
              <div className="font-medium text-ink text-base">
                Insert fill-in
              </div>
            </div>
            <div className="flex items-center h-11 px-3.5 rounded-full bg-sunken">
              <div className="font-medium text-ink text-base">
                Save message
              </div>
            </div>
          </div>
          <div className="text-ink-3 text-xs">
            Fill-ins in [brackets] become real names on each RFQ. You can still edit the message there.
          </div>
        </div>
        {/* Preview */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-6 pb-3.5">
            <div className="tracking-tight font-medium text-ink text-lg">
              Preview
            </div>
            <div className="flex items-center gap-1">
              <div className="text-ink-3 text-sm">
                with Mondol Fabrics
              </div>
              <CaretDown size={12} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
          </div>
          <div className="flex flex-col py-3.5 px-4 rounded-[10px] gap-2.5 bg-subtle">
            <div className="text-ink-2 text-base">
              Dear Mondol Fabrics Ltd. team, we are Example Apparel Ltd, a UK clothing brand. We would like a quote for Women’s knitted dresses. You can see more about us at
            </div>
            <div className="flex items-center h-7 self-start px-2.5 rounded-md shrink-0 bg-caution-tint border border-dashed border-caution-icon">
              <div className="font-medium text-caution text-sm">
                Your website · missing
              </div>
            </div>
          </div>
          <div className="flex items-center pt-2.5 gap-1.5">
            <WarningCircle size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
            <div className="font-medium text-caution text-xs">
              1 gap: add your website in Company details
            </div>
          </div>
        </div>
        {/* Questions */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-6 pb-3.5">
            <div className="flex items-baseline gap-2">
              <div className="tracking-tight font-medium text-ink text-lg">
                Questions
              </div>
              <div className="text-ink-3 text-lg">
                3
              </div>
            </div>
            <div className="text-ink-3 text-sm">
              Up to 20, in this order
            </div>
          </div>
          <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
            <div className="flex items-center min-h-[60px] pr-1 pl-4 gap-2 py-2">
              <div className="w-5 shrink-0 font-medium tabular-nums text-ink-3 text-base">
                1
              </div>
              <div className="grow basis-0 text-ink text-[15px]/[22px]">
                What is your MOQ per colour?
              </div>
              <div className="flex items-center justify-center shrink-0 size-11">
                <CaretDown size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex items-center justify-center shrink-0 size-11">
                <Trash size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
            </div>
            <div className="flex items-center min-h-[60px] pr-1 pl-4 gap-2 py-2 border-t border-t-line">
              <div className="w-5 shrink-0 font-medium tabular-nums text-ink-3 text-base">
                2
              </div>
              <div className="grow basis-0 text-ink text-[15px]/[22px]">
                Which mill makes the fabric?
              </div>
              <div className="flex items-center justify-center shrink-0 size-11">
                <CaretDown size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex items-center justify-center shrink-0 size-11">
                <Trash size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
            </div>
            <div className="flex items-center min-h-[60px] pr-1 pl-4 gap-2 py-2 border-t border-t-line">
              <div className="w-5 shrink-0 font-medium tabular-nums text-ink-3 text-base">
                3
              </div>
              <div className="grow basis-0 text-ink text-[15px]/[22px]">
                Lead time for 3,000 pieces?
              </div>
              <div className="flex items-center justify-center shrink-0 size-11">
                <CaretDown size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex items-center justify-center shrink-0 size-11">
                <Trash size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
            </div>
          </div>
          <div className="flex items-center pt-3 gap-2">
            <div className="flex items-center h-11 px-3.5 rounded-full gap-1.5 bg-sunken">
              <Plus size={16} weight="thin" className="shrink-0 text-ink" aria-hidden/>
              <div className="font-medium text-ink text-base">
                Add question
              </div>
            </div>
            <div className="flex items-center h-11 px-3.5 rounded-full bg-sunken">
              <div className="font-medium text-ink text-base">
                Save questions
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center pt-4 gap-1.5">
          <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
          <div className="text-ink-3 text-xs">
            Sample template; the supplier is real
          </div>
        </div>
      </div>
    </div>);
}
