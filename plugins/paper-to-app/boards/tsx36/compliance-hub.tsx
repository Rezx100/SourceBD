import { CaretRight, Clock, FileText, Hourglass, Scales, ShieldCheck, XCircle } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function ComplianceHubPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full relative flex-col bg-surface text-xs">
      
      {/* Page head */}
      <div className="flex items-center justify-between pt-2 px-5">
        <div className="tracking-tighter font-medium text-ink text-2xl/[36px]">
          Compliance
        </div>
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <div className="font-semibold text-ink-2 text-sm/[16px]">
            AM
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-3 pb-[104px] px-5">
        {/* Summary */}
        <div className="flex flex-col pb-1 gap-3">
          <div className="text-ink-2 text-[15px]/[22px]">
            Your 11 saved suppliers, checked four ways.
          </div>
          {/* Headline pill */}
          <div className="flex items-center h-7 self-start pr-2.5 pl-2 rounded-full gap-1.5 shrink-0 bg-danger-tint">
            <XCircle size={16} weight="thin" className="shrink-0 text-danger" aria-hidden/>
            <div className="font-medium text-danger text-sm">
              Needs action · expired certificates
            </div>
          </div>
          {/* Evidence pack button */}
          <div className="flex items-center justify-center h-11 px-3.5 rounded-full gap-1.5 shrink-0 bg-sunken">
            <FileText size={16} weight="thin" className="shrink-0 text-ink" aria-hidden/>
            <div className="font-medium text-ink text-base">
              Download an evidence pack
            </div>
          </div>
        </div>
        {/* Status section */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-6 pb-3.5">
            <div className="tracking-tight font-medium text-ink text-lg">
              Status
            </div>
            <div className="text-ink-3 text-sm">
              4 checks
            </div>
          </div>
          {/* Ledger */}
          <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
            {/* Row · Certificates */}
            <div className="flex items-center min-h-12 py-3 px-4 gap-2.5">
              <Hourglass size={18} weight="thin" className="shrink-0 text-danger" aria-hidden/>
              <div className="w-24 shrink-0 text-ink-2 text-base">
                Certificates
              </div>
              <div className="flex flex-col items-end grow basis-0">
                <div className="text-right font-medium flex justify-end flex-wrap text-danger text-base">
                  7 of 8 expired
                </div>
                <div className="text-right flex justify-end flex-wrap text-ink-3 text-xs">
                  1 more ends 15 Oct
                </div>
              </div>
            </div>
            {/* Row · UFLPA */}
            <div className="flex items-center min-h-12 py-3 px-4 gap-2.5 border-t border-t-line">
              <Scales size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              <div className="w-24 shrink-0 text-ink-2 text-base">
                UFLPA
              </div>
              <div className="flex flex-col items-end grow basis-0">
                <div className="text-right font-medium flex justify-end flex-wrap text-ink text-base">
                  No link found
                </div>
                <div className="text-right flex justify-end flex-wrap text-ink-3 text-xs">
                  Not a clearance · list read 8 Oct
                </div>
              </div>
            </div>
            {/* Row · Sanctions */}
            <div className="flex items-center min-h-12 py-3 px-4 gap-2.5 border-t border-t-line">
              <ShieldCheck size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              <div className="w-24 shrink-0 text-ink-2 text-base">
                Sanctions
              </div>
              <div className="flex flex-col items-end grow basis-0">
                <div className="text-right font-medium flex justify-end flex-wrap text-ink text-base">
                  None of 11 listed
                </div>
                <div className="text-right flex justify-end flex-wrap text-ink-3 text-xs">
                  UK, EU, US lists · read 6–11 Oct
                </div>
              </div>
            </div>
            {/* Row · Statements */}
            <div className="flex items-center min-h-12 py-3 px-4 gap-2.5 border-t border-t-line">
              <FileText size={18} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              <div className="w-24 shrink-0 text-ink-2 text-base">
                Statement
              </div>
              <div className="flex flex-col items-end grow basis-0">
                <div className="text-right font-medium flex justify-end flex-wrap text-ink text-base">
                  Not drafted
                </div>
                <div className="text-right flex justify-end flex-wrap text-ink-3 text-xs">
                  Built from your 11 suppliers
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Needs a look */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-6 pb-3.5">
            <div className="flex items-baseline gap-2">
              <div className="tracking-tight font-medium text-ink text-lg">
                Needs a look
              </div>
              <div className="text-ink-3 text-lg">
                3
              </div>
            </div>
          </div>
          {/* Cards */}
          <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
            {/* Card · Certificates */}
            <div className="flex flex-col p-4 gap-2.5">
              <div className="flex items-center gap-1.5">
                <Hourglass size={16} weight="thin" className="shrink-0 text-danger" aria-hidden/>
                <div className="grow basis-0 font-medium text-danger text-xs">
                  Certificates · newest expiry 8 Oct
                </div>
                <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              </div>
              <div className="font-medium text-ink text-md/[22px]">
                Ask Mondol Intimates for its new GOTS certificate
              </div>
              <div className="text-ink-2 text-sm">
                Its GOTS ended 8 Oct. Six older ones are on Alerts, and Tex Town’s ends 15 Oct.
              </div>
              <div className="text-ink-3 text-xs">
                Opens Alerts
              </div>
            </div>
            {/* Card · Certificates */}
            <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
              <div className="flex items-center gap-1.5">
                <Clock size={16} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
                <div className="grow basis-0 font-medium text-caution text-xs">
                  UFLPA · read 8 Oct, 3 days ago
                </div>
                <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              </div>
              <div className="font-medium text-ink text-md/[22px]">
                Entries added to the US list since 8 Oct are not checked yet
              </div>
              <div className="text-ink-2 text-sm">
                Our match is only as new as our last read of the forced-labour list (UFLPA). Keep your own checks too.
              </div>
              <div className="text-ink-3 text-xs">
                Opens UFLPA checks
              </div>
            </div>
            {/* Card · Certificates */}
            <div className="flex flex-col p-4 gap-2.5 border-t border-t-line">
              <div className="flex items-center gap-1.5">
                <FileText size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
                <div className="grow basis-0 font-medium text-ink-2 text-xs">
                  Modern slavery statement
                </div>
                <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              </div>
              <div className="font-medium text-ink text-md/[22px]">
                Draft your statement from these 11 suppliers
              </div>
              <div className="text-ink-2 text-sm">
                UK Modern Slavery Act, section 54. We write the supply chain part; you confirm what only you know.
              </div>
              <div className="text-ink-3 text-xs">
                Nothing leaves your phone
              </div>
            </div>
          </div>
        </div>
        {/* Notes */}
        <div className="flex flex-col pt-4 gap-2">
          <div className="flex items-center gap-1.5">
            <FileText size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            <div className="text-ink-3 text-xs">
              WRAP read 10 Oct · GOTS has no read date
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
            <div className="text-ink-3 text-xs">
              Sample saved list; certificates and list reads are real
            </div>
          </div>
        </div>
      </div>
      
    </div>);
}
