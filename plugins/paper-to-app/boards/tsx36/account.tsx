import { ArrowLeft, CaretRight, Cube, Hash, SignOut } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function AccountPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full min-h-dvh flex-col bg-surface text-xs">
      
      {/* Bar */}
      <div className="flex items-center h-14 shrink-0 px-4">
        {/* Back */}
        <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-2 gap-[22px] px-5">
        {/* Profile */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-[60px] h-[60px] shrink-0 rounded-full bg-sunken">
            <div className="flex font-semibold text-ink-2 text-lg/[24px]">
              AM
            </div>
          </div>
          <div className="flex flex-col grow basis-0 gap-0.5">
            <div className="tracking-tighter font-medium text-ink text-xl/[30px]">
              Alex Morgan
            </div>
            <div className="text-ink-3 text-sm/[16px]">
              Example Apparel Ltd · Buyer
            </div>
            {/* Sample note */}
            <div className="flex items-center pt-0.5 gap-1.5">
              <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
              <div className="text-ink-3 text-xs">
                Sample person and company
              </div>
            </div>
          </div>
        </div>
        {/* Group · Workspace */}
        <div className="flex flex-col rounded-[12px] overflow-clip border border-solid border-line">
          <div className="flex items-center min-h-[60px] px-4 gap-3">
            <Cube size={22} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
            <div className="flex flex-col grow basis-0">
              <div className="font-medium text-ink text-[15px]/[18px]">
                Products
              </div>
              <div className="text-ink-3 text-xs">
                4 products · only you see these
              </div>
            </div>
            <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
          </div>
          <div className="flex items-center min-h-[60px] px-4 gap-3 border-t border-t-line">
            <Hash size={22} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
            <div className="flex flex-col grow basis-0">
              <div className="font-medium text-ink text-[15px]/[18px]">
                HS codes
              </div>
              <div className="text-ink-3 text-xs">
                210 headings from EPB export records
              </div>
            </div>
            <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
          </div>
        </div>
        {/* Group · Settings */}
        <div className="flex flex-col rounded-[12px] overflow-clip border border-solid border-line">
          <div className="flex items-center justify-between min-h-[52px] px-4">
            <div className="text-ink text-[15px]/[18px]">
              Profile and company
            </div>
            <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
          </div>
          <div className="flex items-center justify-between min-h-[52px] px-4 border-t border-t-line">
            <div className="text-ink text-[15px]/[18px]">
              Team and roles
            </div>
            <div className="flex items-center gap-2">
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
          </div>
          <div className="flex items-center justify-between min-h-[52px] px-4 border-t border-t-line">
            <div className="text-ink text-[15px]/[18px]">
              Emails
            </div>
            <div className="flex items-center gap-2">
              <div className="text-ink-3 text-sm/[16px]">
                Sanctions always on
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
          </div>
          <div className="flex items-center justify-between min-h-[52px] px-4 border-t border-t-line">
            <div className="text-ink text-[15px]/[18px]">
              Security
            </div>
            <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
          </div>
          <div className="flex items-center justify-between min-h-[52px] px-4 border-t border-t-line">
            <div className="text-ink text-[15px]/[18px]">
              Plan and usage
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center h-[22px] rounded-full">
                <div className="flex text-ink-3 text-sm">
                  Free in the beta
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
          </div>
        </div>
        {/* Sign out */}
        <div className="flex items-center min-h-[52px] px-4 rounded-[12px] gap-3 border border-solid border-line">
          <SignOut size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
          <div className="text-ink text-[15px]/[18px]">
            Sign out of this device
          </div>
        </div>
      </div>
    </div>);
}
