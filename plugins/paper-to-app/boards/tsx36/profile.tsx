import { ArrowLeft, SignOut } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function ProfilePhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            Profile
          </div>
          <div className="text-ink-3 text-sm line-clamp-1">
            Name, picture, email and password
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pb-12 px-5">
        {/* Your name */}
        <div className="flex flex-col pt-4 pb-6 gap-4 border-b border-b-line">
          <div className="flex items-center gap-3.5">
            <div className="w-[60px] h-[60px] flex items-center justify-center shrink-0 rounded-full bg-sunken">
              <div className="font-semibold text-ink-2 text-lg/[24px]">
                AM
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center h-11 px-3.5 rounded-full bg-sunken">
                <div className="font-medium text-ink text-base">
                  Upload picture
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-ink-2 text-sm">
              Display name
            </div>
            <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
              <div className="text-ink text-md/[22px]">
                Alex Morgan
              </div>
            </div>
            <div className="text-ink-3 text-xs">
              Suppliers see it in messages and orders.
            </div>
          </div>
        </div>
        {/* Email */}
        <div className="flex flex-col py-6 gap-3 border-b border-b-line">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium text-ink text-md/[22px]">
              Email
            </div>
            <div className="text-ink-3 text-sm">
              Now alex@exampleapparel.co.uk
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-ink-2 text-sm">
              New email
            </div>
            <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong">
              <div className="text-ink-3 text-md/[22px]">
                name@company.com
              </div>
            </div>
            <div className="text-ink-3 text-xs">
              We email a link to the new address. Click it to confirm.
            </div>
          </div>
          <div className="flex items-center h-11 self-start px-3.5 rounded-full shrink-0 bg-sunken">
            <div className="font-medium text-ink text-base">
              Send link
            </div>
          </div>
        </div>
        {/* Password */}
        <div className="flex flex-col py-6 gap-3 border-b border-b-line">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium text-ink text-md/[22px]">
              Password
            </div>
            <div className="text-ink-3 text-sm">
              At least 8 characters. Pick one you don’t use elsewhere.
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-ink-2 text-sm">
              Current password
            </div>
            <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong"/>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-ink-2 text-sm">
              New password
            </div>
            <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong"/>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="font-medium text-ink-2 text-sm">
              Confirm new password
            </div>
            <div className="flex items-center h-12 px-3.5 rounded-lg shrink-0 border border-solid border-line-strong"/>
          </div>
          <div className="flex items-center h-11 self-start px-3.5 rounded-full shrink-0 bg-sunken">
            <div className="font-medium text-ink text-base">
              Update password
            </div>
          </div>
        </div>
        {/* Sign out */}
        <div className="flex items-center min-h-[52px] pt-3 gap-3">
          <div className="w-6 flex justify-center shrink-0">
            <SignOut size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
          </div>
          <div className="text-ink text-md/[22px]">
            Sign out of this device
          </div>
        </div>
        <div className="flex items-center pt-3 gap-1.5">
          <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
          <div className="text-ink-3 text-xs">
            Sample person
          </div>
        </div>
      </div>
    </div>);
}
