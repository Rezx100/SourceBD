"use client";

// The top of the "Keys and the glossary" card: the app's own shortcut list, drawn from `SHORTCUTS` (a client
// module, so this reads it on the client side of the boundary), never an image of it.

import { SHORTCUTS } from "@/components/frame/shortcuts";

export function KeysCard() {
  return (
    <div className="flex h-[220px] flex-col overflow-hidden border-b border-line-subtle bg-canvas px-5 pt-[18px]">
      <p className="pb-2.5 text-[14px] font-medium leading-[18px] text-ink-strong">Keyboard shortcuts</p>
      <dl className="flex flex-col">
        {SHORTCUTS.slice(0, 5).map((s) => (
          <div key={s.keys.join()} className="flex items-baseline gap-3.5 border-t border-line-subtle py-2">
            <dt className="flex w-[84px] shrink-0 gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-sm border border-line-strong bg-surface-sunken px-1.5 font-mono text-[11px] leading-[14px] text-ink-strong">
                  {k}
                </kbd>
              ))}
            </dt>
            <dd className="truncate text-[13px] leading-[18px] text-ink-muted">{s.does}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
