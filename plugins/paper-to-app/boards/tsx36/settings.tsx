import { ArrowLeft, Buildings, CaretRight, CreditCard, Envelope, Lock, Note, User, Users } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function SettingsPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full flex-col bg-surface text-xs">
      
      {/* Compact head */}
      <div className="flex items-center min-h-14 pt-1.5 pb-2.5 gap-3 px-4">
        {/* Back */}
        <div className="flex items-center justify-center shrink-0 rounded-full bg-sunken size-9">
          <ArrowLeft size={17} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col grow basis-0 min-w-0">
          <div className="tracking-[-0.025em] font-semibold text-ink text-xl/[30px]">
            Settings
          </div>
          <div className="text-ink-3 text-sm line-clamp-1">
            Signed in as alex@exampleapparel.co.uk
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pb-12 px-5">
        {/* Your account */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-4 pb-3.5">
            <div className="tracking-tight font-medium text-ink text-lg">
              Your account
            </div>
          </div>
          <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
            <div className="flex items-center min-h-[60px] py-2 px-4 gap-3">
              <div className="w-6 flex justify-center shrink-0">
                <User size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex flex-col grow basis-0">
                <div className="text-ink text-md/[22px]">
                  Profile
                </div>
                <div className="text-ink-3 text-sm">
                  Name, picture, email, password
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="flex items-center min-h-[60px] py-2 px-4 gap-3 border-t border-t-line">
              <div className="w-6 flex justify-center shrink-0">
                <Lock size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex flex-col grow basis-0">
                <div className="text-ink text-md/[22px]">
                  Security
                </div>
                <div className="text-caution text-sm">
                  Two-step sign-in is off
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="flex items-center min-h-[60px] py-2 px-4 gap-3 border-t border-t-line">
              <div className="w-6 flex justify-center shrink-0">
                <Envelope size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex flex-col grow basis-0">
                <div className="text-ink text-md/[22px]">
                  Emails
                </div>
                <div className="text-ink-3 text-sm">
                  Quotes, saved suppliers, weekly summary
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
          </div>
        </div>
        {/* Your company */}
        <div className="flex flex-col">
          {/* Section head */}
          <div className="flex items-baseline justify-between pt-6 pb-3.5">
            <div className="tracking-tight font-medium text-ink text-lg">
              Your company
            </div>
          </div>
          <div className="flex flex-col rounded-[10px] overflow-clip border border-solid border-line">
            <div className="flex items-center min-h-[60px] py-2 px-4 gap-3">
              <div className="w-6 flex justify-center shrink-0">
                <Buildings size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex flex-col grow basis-0">
                <div className="text-ink text-md/[22px]">
                  Company details
                </div>
                <div className="text-ink-3 text-sm">
                  Example Apparel Ltd · Brand
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="flex items-center min-h-[60px] py-2 px-4 gap-3 border-t border-t-line">
              <div className="w-6 flex justify-center shrink-0">
                <Users size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex flex-col grow basis-0">
                <div className="text-ink text-md/[22px]">
                  Team and roles
                </div>
                <div className="text-ink-3 text-sm">
                  3 people · 1 invite waiting
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="flex items-center min-h-[60px] py-2 px-4 gap-3 border-t border-t-line">
              <div className="w-6 flex justify-center shrink-0">
                <Note size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex flex-col grow basis-0">
                <div className="text-ink text-md/[22px]">
                  RFQ template
                </div>
                <div className="text-ink-3 text-sm">
                  Opening message and questions
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
            <div className="flex items-center min-h-[60px] py-2 px-4 gap-3 border-t border-t-line">
              <div className="w-6 flex justify-center shrink-0">
                <CreditCard size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
              </div>
              <div className="flex flex-col grow basis-0">
                <div className="text-ink text-md/[22px]">
                  Plan and usage
                </div>
                <div className="text-ink-3 text-sm">
                  Free in the beta
                </div>
              </div>
              <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
            </div>
          </div>
        </div>
        {/* Notes */}
        <div className="flex items-center pt-4 gap-1.5">
          <div className="w-3.5 h-0 shrink-0 border-b [border-bottom-style:dashed] border-b-line-strong"/>
          <div className="text-ink-3 text-xs">
            Sample person and company
          </div>
        </div>
      </div>
    </div>);
}
