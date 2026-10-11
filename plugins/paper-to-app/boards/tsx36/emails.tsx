import { ArrowLeft, Check, Info, Lock } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function EmailsPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            Emails
          </div>
          <div className="text-ink-3 text-sm line-clamp-1">
            What we email you about
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-2 pb-12 px-5">
        <div className="flex py-2.5 px-3 rounded-lg gap-2 bg-subtle">
          <Info size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
          <div className="text-ink-2 text-sm">
            Sending starts later in the beta. Your choices are saved now.
          </div>
        </div>
        {/* Switches */}
        <div className="flex flex-col pt-2">
          <div className="flex items-center min-h-[72px] py-3 gap-3 border-b border-b-line">
            <div className="flex flex-col grow basis-0 gap-0.5">
              <div className="text-ink text-md/[22px]">
                Quotes
              </div>
              <div className="text-ink-3 text-sm">
                When a supplier sends or changes a quote
              </div>
            </div>
            <div className="w-11 h-[26px] shrink-0 rounded-full relative bg-ink">
              <div className="left-[21px] top-[3px] rounded-full absolute bg-surface size-5"/>
            </div>
          </div>
          <div className="flex items-center min-h-[72px] py-3 gap-3 border-b border-b-line">
            <div className="flex flex-col grow basis-0 gap-0.5">
              <div className="text-ink text-md/[22px]">
                Saved suppliers
              </div>
              <div className="text-ink-3 text-sm">
                Certificate expiry and RSC safety updates
              </div>
            </div>
            <div className="w-11 h-[26px] shrink-0 rounded-full relative bg-ink">
              <div className="left-[21px] top-[3px] rounded-full absolute bg-surface size-5"/>
            </div>
          </div>
          <div className="flex items-center min-h-[72px] py-3 gap-3 border-b border-b-line">
            <div className="flex flex-col grow basis-0 gap-0.5">
              <div className="text-ink text-md/[22px]">
                Weekly summary
              </div>
              <div className="text-ink-3 text-sm">
                Every Monday: new suppliers, certificate and sanctions changes
              </div>
            </div>
            <div className="w-11 h-[26px] shrink-0 rounded-full relative bg-sunken border border-solid border-line">
              <div className="left-0.5 top-0.5 rounded-full absolute [box-shadow:#15181C33_0px_1px_2px] bg-surface size-5"/>
            </div>
          </div>
          <div className="flex items-center min-h-[72px] py-3 gap-3">
            <div className="flex flex-col grow basis-0 gap-0.5">
              <div className="text-ink text-md/[22px]">
                Sanctions on a saved supplier
              </div>
              <div className="text-ink-3 text-sm">
                Always sent, so a listing never goes unseen
              </div>
            </div>
            <div className="flex items-center shrink-0 gap-1.5">
              <Lock size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
              <div className="text-ink-3 text-sm">
                Always on
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center pt-3 gap-1.5">
          <Check size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
          <div className="text-ink-3 text-xs">
            Saved as you switch · to alex@exampleapparel.co.uk
          </div>
        </div>
        <div className="flex items-center pt-2 gap-1.5">
          <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
          <div className="text-ink-3 text-xs">
            Sample choices and address
          </div>
        </div>
      </div>
    </div>);
}
