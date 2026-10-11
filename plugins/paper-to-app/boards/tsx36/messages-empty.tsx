import { BookmarkSimple, ChatCircle, Lock } from "@phosphor-icons/react/dist/ssr";

// Generated from Paper by paper-to-app/convert.cjs. Replace sample copy with route data.
export function MessagesEmptyPhone() {
  return (<div className="[overflow-wrap:anywhere] flex overflow-clip w-full min-h-dvh relative flex-col bg-surface text-xs">
      
      {/* Page head */}
      <div className="flex items-center justify-between pt-2 px-5">
        <div className="tracking-tighter font-medium text-ink text-2xl/[36px]">
          Messages
        </div>
        <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-9">
          <div className="flex font-semibold text-ink-2 text-sm/[16px]">
            AM
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-col pt-14 pb-[104px] gap-5 px-5">
        <div className="flex items-center justify-center rounded-full shrink-0 bg-sunken size-12">
          <ChatCircle size={24} weight="thin" className="shrink-0 text-ink-2" aria-hidden/>
        </div>
        <div className="flex flex-col gap-2">
          <div className="tracking-tighter font-medium text-ink text-xl/[30px]">
            No messages yet
          </div>
          <div className="text-ink-2 text-[15px]/[22px]">
            A thread opens when you send an RFQ or message a supplier from its record. Replies land here.
          </div>
        </div>
        <div className="flex items-center py-2.5 px-3 rounded-lg gap-2 bg-subtle">
          <Lock size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden/>
          <div className="text-ink-2 text-sm">
            Only you and the supplier see a thread.
          </div>
        </div>
        <div className="flex items-center justify-center h-11 self-start px-3.5 rounded-full gap-1.5 shrink-0 bg-sunken">
          <BookmarkSimple size={16} weight="thin" className="shrink-0 text-ink" aria-hidden/>
          <div className="font-medium text-ink text-base">
            Open your saved suppliers
          </div>
        </div>
      </div>
      
    </div>);
}
