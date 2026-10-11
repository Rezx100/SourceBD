import { BookmarkSimple, X } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function DLoadingPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full min-h-dvh relative flex-col bg-sunken text-xs">
      
      {/* Sheet */}
      <div className="flex flex-col grow basis-0 [box-shadow:#15181C2E_0px_12px_32px] bg-surface rounded-t-pane-phone">
        {/* Bar */}
        <div className="flex items-center justify-between h-[52px] px-1.5 relative shrink-0">
          <div className="flex items-center justify-center shrink-0 size-11">
            <X size={24} weight="thin" className="shrink-0 text-ink" aria-hidden/>
          </div>
          <div className="absolute top-1.5 left-[177px] w-9 h-1 rounded-full bg-line"/>
        </div>
        {/* Head skeleton */}
        <div className="flex flex-col pt-2 pb-5 gap-2.5 px-5">
          <div className="tracking-tighter font-medium text-ink text-2xl/[36px]">
            Square Apparels Limited
          </div>
          <div className="w-60 h-3.5 rounded-sm shrink-0 bg-sunken"/>
          <div className="flex pt-2 gap-2">
            <div className="w-[150px] h-8 rounded-full shrink-0 bg-sunken"/>
            <div className="w-[120px] h-8 rounded-full shrink-0 bg-sunken"/>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex h-12 px-3 overflow-clip gap-1 shrink-0 border-b border-b-line">
          {/* Tab · Overview (current) */}
          <div className="flex items-center shrink-0 px-2 relative">
            <div className="font-medium text-ink text-md/[20px]">
              Overview
            </div>
            {/* Indicator */}
            <div className="absolute -bottom-px h-0.5 rounded-tl-[2px] rounded-tr-[2px] bg-ink inset-x-2"/>
          </div>
          {/* Tab · Exports */}
          <div className="flex items-center shrink-0 px-2">
            <div className="font-medium text-ink-3 text-md/[20px]">
              Exports
            </div>
          </div>
          {/* Tab · Certificates */}
          <div className="flex items-center shrink-0 px-2 gap-1.5">
            <div className="font-medium text-ink-3 text-md/[20px]">
              Certificates
            </div>
          </div>
          {/* Tab · Safety */}
          <div className="flex items-center shrink-0 px-2 gap-1.5">
            <div className="font-medium text-ink-3 text-md/[20px]">
              Safety
            </div>
          </div>
          {/* Tab · Sites */}
          <div className="flex items-center shrink-0 px-2 gap-1.5">
            <div className="font-medium text-ink-3 text-md/[20px]">
              Sites
            </div>
          </div>
        </div>
        {/* Body skeleton */}
        <div className="flex flex-col pt-7 gap-3.5 px-5">
          <div className="w-24 h-5 rounded-sm shrink-0 bg-sunken"/>
          {/* Tiles */}
          <div className="flex flex-col rounded-lg overflow-clip border border-solid border-line">
            <div className="flex border-b border-b-line">
              <div className="flex flex-col grow basis-0 h-[120px] p-3.5 gap-2.5 border-r border-r-line">
                <div className="w-[90px] h-3 rounded-sm shrink-0 bg-sunken"/>
                <div className="w-[70px] h-6 rounded-sm shrink-0 bg-sunken"/>
              </div>
              <div className="flex flex-col grow basis-0 h-[120px] p-3.5 gap-2.5">
                <div className="w-[90px] h-3 rounded-sm shrink-0 bg-sunken"/>
                <div className="w-[50px] h-6 rounded-sm shrink-0 bg-sunken"/>
              </div>
            </div>
            <div className="flex">
              <div className="flex flex-col grow basis-0 h-[120px] p-3.5 gap-2.5 border-r border-r-line">
                <div className="w-[60px] h-3 rounded-sm shrink-0 bg-sunken"/>
                <div className="w-14 h-6 rounded-sm shrink-0 bg-sunken"/>
              </div>
              <div className="flex flex-col grow basis-0 h-[120px] p-3.5 gap-2.5">
                <div className="w-24 h-3 rounded-sm shrink-0 bg-sunken"/>
                <div className="w-[76px] h-6 rounded-sm shrink-0 bg-sunken"/>
              </div>
            </div>
          </div>
          <div className="flex pt-4 gap-3">
            <div className="rounded-full shrink-0 bg-sunken size-9"/>
            <div className="flex flex-col grow basis-0 gap-2">
              <div className="w-[220px] h-3.5 rounded-sm shrink-0 bg-sunken"/>
              <div className="w-[260px] h-3 rounded-sm shrink-0 bg-sunken"/>
            </div>
          </div>
          <div className="flex pt-2 gap-3">
            <div className="rounded-full shrink-0 bg-sunken size-9"/>
            <div className="flex flex-col grow basis-0 gap-2">
              <div className="w-[180px] h-3.5 rounded-sm shrink-0 bg-sunken"/>
              <div className="w-60 h-3 rounded-sm shrink-0 bg-sunken"/>
            </div>
          </div>
        </div>
      </div>
      {/* Action bar · waiting */}
      <div className="fixed bottom-0 flex items-center h-16 px-4 gap-2 bg-surface border-t border-t-line inset-x-0">
        <div className="flex items-center justify-center shrink-0 rounded-lg border border-solid border-line size-12">
          <BookmarkSimple size={24} weight="thin" className="shrink-0 text-disabled" aria-hidden/>
        </div>
        <div className="flex items-center justify-center grow basis-0 h-12 rounded-lg bg-sunken">
          <div className="font-medium text-disabled text-md/[20px]">
            Send RFQ
          </div>
        </div>
      </div>
    </div>);
}
