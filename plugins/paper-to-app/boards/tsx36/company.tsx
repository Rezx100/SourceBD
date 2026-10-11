import { ArrowLeft, CaretDown, Check } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function CompanyPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full relative flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            Company details
          </div>
          <div className="text-ink-3 text-sm line-clamp-1">
            Suppliers see the name and website on every RFQ
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-2 pb-[140px] gap-4 px-5">
        <div className="flex flex-col gap-1.5">
          <div className="font-medium text-ink-2 text-sm">
            Company name
          </div>
          <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
            <div className="text-ink text-md/[22px]">
              Example Apparel Ltd
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-medium text-ink-2 text-sm">
            Website
          </div>
          <div className="flex items-center h-12 px-3.5 rounded-lg gap-px shrink-0 border border-solid border-ink">
            <div className="text-ink text-md/[22px]">
              https://exampleapparel.co.uk
            </div>
            <div className="w-[1.5px] h-5 shrink-0 bg-ink"/>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-medium text-ink-2 text-sm">
            Company type
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center h-9 pr-3.5 pl-2.5 rounded-full gap-1.5 bg-ink">
              <Check size={16} weight="thin" className="shrink-0 text-surface" aria-hidden/>
              <div className="font-medium text-surface text-base">
                Brand
              </div>
            </div>
            <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
              <div className="font-medium text-ink text-base">
                Retailer
              </div>
            </div>
            <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
              <div className="font-medium text-ink text-base">
                Importer
              </div>
            </div>
            <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
              <div className="font-medium text-ink text-base">
                Agent
              </div>
            </div>
            <div className="flex items-center h-9 px-3.5 rounded-full border border-solid border-line">
              <div className="font-medium text-ink text-base">
                Other
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-medium text-ink-2 text-sm">
            What you sell
          </div>
          <div className="flex items-start h-24 py-3 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
            <div className="text-ink text-md/[22px]">
              Women’s jersey dresses and loungewear, own label, about 40 styles a season.
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-medium text-ink-2 text-sm">
            Who you sell to
          </div>
          <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
            <div className="text-ink text-md/[22px]">
              UK high-street retail
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-medium text-ink-2 text-sm">
            Employees
          </div>
          <div className="flex items-center justify-between h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
            <div className="text-ink text-md/[22px]">
              11–50
            </div>
            <CaretDown size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
          <div className="text-ink-3 text-xs">
            Sample company
          </div>
        </div>
      </div>
      {/* Save bar */}
      <div className="fixed bottom-0 flex flex-col bg-surface border-t border-t-line inset-x-0">
        <div className="flex items-center pt-2.5 gap-1.5 px-4">
          <div className="shrink-0 rounded-full bg-caution-icon size-2"/>
          <div className="font-medium text-caution text-xs">
            Unsaved change: website
          </div>
        </div>
        <div className="flex items-center h-16 py-2 px-4 gap-2 shrink-0">
          <div className="flex items-center justify-center h-12 shrink-0 px-[18px] rounded-lg border border-solid border-line">
            <div className="font-medium text-ink text-md/[20px]">
              Discard
            </div>
          </div>
          <div className="grow basis-0 h-12 flex items-center justify-center rounded-lg bg-brand">
            <div className="font-medium text-surface text-md/[20px]">
              Save changes
            </div>
          </div>
        </div>
        
      </div>
    </div>);
}
