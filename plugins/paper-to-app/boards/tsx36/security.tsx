import { ArrowLeft, CaretRight, DeviceMobile, Globe, Key, ShieldWarning } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function SecurityPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            Security
          </div>
          <div className="text-ink-3 text-sm line-clamp-1">
            Sign-in and devices
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-2 pb-12 gap-3 px-5">
        {/* Two-step */}
        <div className="flex flex-col p-4 rounded-[10px] gap-2.5 border border-solid border-line">
          <div className="flex items-center gap-1.5">
            <ShieldWarning size={16} weight="thin" className="shrink-0 text-caution-icon" aria-hidden/>
            <div className="font-medium text-caution text-xs">
              Off
            </div>
          </div>
          <div className="font-medium text-ink text-md/[22px]">
            Two-step sign-in
          </div>
          <div className="text-ink-2 text-sm">
            Ask for a code from an authenticator app each time you sign in.
          </div>
          <div className="flex items-center h-11 self-start px-3.5 rounded-full shrink-0 bg-sunken">
            <div className="font-medium text-ink text-base">
              Turn on
            </div>
          </div>
        </div>
        {/* Password */}
        <div className="flex items-center min-h-[60px] py-2 px-4 rounded-[10px] gap-3 border border-solid border-line">
          <div className="w-6 flex justify-center shrink-0">
            <Key size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
          </div>
          <div className="flex flex-col grow basis-0">
            <div className="text-ink text-md/[22px]">
              Password
            </div>
            <div className="text-ink-3 text-sm">
              Change it on your Profile
            </div>
          </div>
          <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
        </div>
        {/* Devices */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-3 pb-3.5">
            <div className="flex items-baseline gap-2">
              <div className="tracking-tight font-medium text-ink text-lg">
                Where you’re signed in
              </div>
              <div className="text-ink-3 text-lg">
                2
              </div>
            </div>
          </div>
          <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
            <div className="flex items-center min-h-16 pr-3 pl-4 gap-3 py-2.5">
              <div className="w-6 flex justify-center shrink-0">
                <DeviceMobile size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex flex-col grow basis-0">
                <div className="text-ink text-md/[22px]">
                  Safari on iPhone
                </div>
                <div className="text-ink-3 text-sm">
                  This phone · active now
                </div>
              </div>
            </div>
            <div className="flex items-center min-h-16 pr-3 pl-4 gap-3 py-2.5 border-t border-t-line">
              <div className="w-6 flex justify-center shrink-0">
                <Globe size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex flex-col grow basis-0">
                <div className="text-ink text-md/[22px]">
                  Chrome on Windows
                </div>
                <div className="text-ink-3 text-sm">
                  Last active 9 Oct
                </div>
              </div>
              <div className="flex items-center h-11 shrink-0 px-3.5 rounded-full bg-sunken">
                <div className="font-medium text-ink text-base">
                  Sign out
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col pt-4 gap-2">
          <div className="text-ink-3 text-xs">
            Single sign-on (SAML) comes with Enterprise.
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
            <div className="text-ink-3 text-xs">
              Sample devices
            </div>
          </div>
        </div>
      </div>
    </div>);
}
