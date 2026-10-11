import { ArrowLeft, Boat, FileText } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function CustomsEmptyPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            Tex Town Ltd.
          </div>
          <div className="text-ink-3 text-sm">
            Customs records
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-6 pb-12 gap-5 px-5">
        <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-12">
          <Boat size={24} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col gap-2">
          <div className="tracking-tighter font-medium text-ink text-xl/[30px]">
            We have no customs records for this supplier yet
          </div>
          <div className="text-ink-2 text-[15px]/[22px]">
            We haven’t looked it up. That says nothing about whether it exports; it only means we have no receipt to show.
          </div>
        </div>
        <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
          <div className="flex items-center min-h-12 py-3 px-4 gap-2.5">
            <div className="w-[120px] shrink-0 text-ink-2 text-base">
              Checked so far
            </div>
            <div className="grow basis-0 text-right font-medium tabular-nums flex justify-end flex-wrap text-ink text-base">
              303 suppliers
            </div>
          </div>
          <div className="flex items-center min-h-12 py-3 px-4 gap-2.5 border-t border-t-line">
            <div className="w-[120px] shrink-0 text-ink-2 text-base">
              With records
            </div>
            <div className="grow basis-0 text-right font-medium tabular-nums flex justify-end flex-wrap text-ink text-base">
              114 of them
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-ink-3 text-xs">
            Other facts on Tex Town’s record, such as its GOTS certificate, come from their own sources.
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            <FileText size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            <div className="text-ink-3 text-xs">
              Customs records Sep 2024 – Aug 2026 · read 10–11 Oct
            </div>
          </div>
        </div>
      </div>
    </div>);
}
