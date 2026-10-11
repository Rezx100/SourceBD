import { ArrowLeft, CaretDown, Envelope, Plus } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function TeamPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full relative flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            Team and roles
          </div>
          <div className="text-ink-3 text-sm line-clamp-1">
            3 people · 1 invite waiting
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pb-[120px] px-5">
        {/* People */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-4 pb-3.5">
            <div className="flex items-baseline gap-2">
              <div className="tracking-tight font-medium text-ink text-lg">
                People
              </div>
              <div className="text-ink-3 text-lg">
                3
              </div>
            </div>
          </div>
          <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
            <div className="flex items-center min-h-16 pr-3 pl-4 gap-3 py-2.5">
              <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
                <div className="font-semibold text-ink-2 text-sm/[16px]">
                  AM
                </div>
              </div>
              <div className="flex flex-col grow basis-0 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="font-medium text-ink text-md/[22px]">
                    Alex Morgan
                  </div>
                  <div className="font-medium text-ink-3 text-xs">
                    you
                  </div>
                </div>
                <div className="text-ink-3 text-sm">
                  Active now
                </div>
              </div>
              <div className="px-1">
                <div className="font-medium text-ink-2 text-base">
                  Owner
                </div>
              </div>
            </div>
            <div className="flex items-center min-h-16 pr-3 pl-4 gap-3 py-2.5 border-t border-t-line">
              <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
                <div className="font-semibold text-ink-2 text-sm/[16px]">
                  PS
                </div>
              </div>
              <div className="flex flex-col grow basis-0 min-w-0">
                <div className="font-medium text-ink text-md/[22px]">
                  Priya Shah
                </div>
                <div className="text-ink-3 text-sm">
                  Last active 9 Oct
                </div>
              </div>
              <div className="flex items-center h-11 shrink-0 pr-2.5 pl-3 rounded-lg gap-1 border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  Approver
                </div>
                <CaretDown size={14} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
            </div>
            <div className="flex items-center min-h-16 pr-3 pl-4 gap-3 py-2.5 border-t border-t-line">
              <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
                <div className="font-semibold text-ink-2 text-sm/[16px]">
                  TO
                </div>
              </div>
              <div className="flex flex-col grow basis-0 min-w-0">
                <div className="font-medium text-ink text-md/[22px]">
                  Tom Okafor
                </div>
                <div className="text-ink-3 text-sm">
                  Not yet signed in
                </div>
              </div>
              <div className="flex items-center h-11 shrink-0 pr-2.5 pl-3 rounded-lg gap-1 border border-solid border-line">
                <div className="font-medium text-ink text-base">
                  Editor
                </div>
                <CaretDown size={14} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
            </div>
          </div>
        </div>
        {/* Invites */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-6 pb-3.5">
            <div className="flex items-baseline gap-2">
              <div className="tracking-tight font-medium text-ink text-lg">
                Waiting
              </div>
              <div className="text-ink-3 text-lg">
                1
              </div>
            </div>
          </div>
          <div className="flex flex-col p-4 rounded-[10px] gap-2.5 border border-solid border-line">
            <div className="flex items-center gap-1.5">
              <Envelope size={16} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              <div className="font-medium text-ink-2 text-xs">
                Invite sent 9 Oct · ends 16 Oct
              </div>
            </div>
            <div className="font-medium text-ink text-md/[22px]">
              sam.lee@exampleapparel.co.uk
            </div>
            <div className="text-ink-2 text-sm">
              Joins as a Viewer
            </div>
            <div className="flex gap-2">
              <div className="flex items-center h-11 px-3.5 rounded-full bg-sunken">
                <div className="font-medium text-ink text-base">
                  Resend invite
                </div>
              </div>
              <div className="flex items-center h-11 px-3.5 rounded-full">
                <div className="font-medium text-ink-2 text-base">
                  Cancel invite
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Roles */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-6 pb-3.5">
            <div className="tracking-tight font-medium text-ink text-lg">
              What each role can do
            </div>
          </div>
          <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
            <div className="flex py-3 px-4 gap-2.5">
              <div className="w-24 shrink-0 font-medium text-ink text-base">
                Owner
              </div>
              <div className="grow basis-0 text-ink-2 text-sm/[20px]">
                Everything, plus the plan and the team
              </div>
            </div>
            <div className="flex py-3 px-4 gap-2.5 border-t border-t-line">
              <div className="w-24 shrink-0 font-medium text-ink text-base">
                Approver
              </div>
              <div className="grow basis-0 text-ink-2 text-sm/[20px]">
                Signs off quotes and the modern slavery statement
              </div>
            </div>
            <div className="flex py-3 px-4 gap-2.5 border-t border-t-line">
              <div className="w-24 shrink-0 font-medium text-ink text-base">
                Editor
              </div>
              <div className="grow basis-0 text-ink-2 text-sm/[20px]">
                Searches, saves suppliers, sends RFQs, accepts quotes
              </div>
            </div>
            <div className="flex py-3 px-4 gap-2.5 border-t border-t-line">
              <div className="w-24 shrink-0 font-medium text-ink text-base">
                Viewer
              </div>
              <div className="grow basis-0 text-ink-2 text-sm/[20px]">
                Reads records and downloads evidence. Can’t send RFQs.
              </div>
            </div>
          </div>
        </div>
        {/* Notes */}
        <div className="flex flex-col pt-4 gap-2">
          <div className="text-ink-3 text-xs">
            Each person still works in their own account for now.
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
            <div className="text-ink-3 text-xs">
              Sample team
            </div>
          </div>
        </div>
      </div>
      {/* Action bar */}
      <div className="fixed bottom-0 flex flex-col bg-surface border-t border-t-line inset-x-0">
        <div className="flex items-center h-16 py-2 px-4 gap-2 shrink-0">
          <div className="grow basis-0 h-12 flex items-center justify-center rounded-lg gap-2 bg-brand">
            <Plus size={18} weight="thin" className="shrink-0 text-surface" aria-hidden/>
            <div className="font-medium text-surface text-md/[20px]">
              Invite people
            </div>
          </div>
        </div>
        
      </div>
    </div>);
}
