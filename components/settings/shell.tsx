// The frame every Settings page sits in (Paper `10 · Settings`, `11 · Settings`): from 768 a 248
// column of the two groups and the page beside it; on a phone the page alone, under a back link to
// the list, and the list itself at `/app/settings`. Also the failed read and the loading skeleton.
// Server components.

import { ArrowLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorPanel, Skeleton, buttonClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import type { SettingsDoc } from "./doc";
import { COMPANY_PHONE_HREF, SETTINGS_ERROR_BODY, SETTINGS_ERROR_TITLE, SETTINGS_GROUPS, SETTINGS_HOME, rowLine, settingsSubline, type SettingsKey } from "./words";

const FOCUS = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function SideNav({ current, doc }: { current: SettingsKey | null; doc: SettingsDoc | null }) {
  const sub = settingsSubline(doc);
  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-0.5 border-r border-line px-3 pb-4 pt-7 max-md:hidden">
      <p className="px-2.5 text-xl font-semibold tracking-tight text-ink">Settings</p>
      <p className="px-2.5 pb-4 pt-0.5 text-xs text-ink-3 [overflow-wrap:anywhere]">{sub ?? "Your account and company"}</p>
      <nav aria-label="Settings" className="flex flex-col gap-0.5">
        {SETTINGS_GROUPS.map((g, gi) => (
          <div key={g.title} className={cn("flex flex-col gap-0.5", gi > 0 && "pt-4")}>
            <p className="px-2.5 pb-1 pt-2 text-xs font-medium text-ink-3">{g.title}</p>
            {g.items.map((i) => {
              const on = i.key === current;
              return (
                <Link
                  key={i.key}
                  href={i.href}
                  prefetch={false}
                  aria-current={on ? "page" : undefined}
                  className={cn("flex h-9 items-center text-base", FOCUS, on ? "rounded-r-sm border-l-2 border-brand bg-brand-tint pl-2 pr-2.5 font-semibold text-ink" : "rounded-sm px-2.5 text-ink-2 hover:bg-sunken hover:text-ink")}
                >
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** The back link a phone page opens with: the list it came from. */
export function PhoneBack() {
  return (
    <Link href={SETTINGS_HOME} prefetch={false} className={cn("-ml-2 mb-1 flex h-11 w-fit items-center gap-1 rounded-sm px-2 text-md font-medium text-ink-2 md:hidden", FOCUS)}>
      <ArrowLeft size={20} aria-hidden />
      Settings
    </Link>
  );
}

/**
 * One Settings page: the navigation beside it, its title (the page's one `h1`) and what it is for.
 * `current` is null on the phone list, which has no page of its own.
 */
export function SettingsShell({ current, doc, title, caption, action, wide, children }: { current: SettingsKey | null; doc: SettingsDoc | null; title: string; caption?: ReactNode; action?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1">
      <SideNav current={current} doc={doc} />
      <div className="min-w-0 flex-1 px-8 pb-8 pt-7 max-md:px-4 max-md:pb-6 max-md:pt-2">
        <PhoneBack />
        <div className={cn("flex flex-col", wide ? "max-w-[920px]" : "max-w-[760px]")}>
          {action ? (
            <div className="flex items-end justify-between gap-4 pb-5 max-md:flex-col max-md:items-stretch max-md:gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-ink max-md:text-xl max-md:tracking-tight">{title}</h1>
                {caption ? <p className="pt-1 text-base text-ink-2 max-md:pt-2 max-md:text-md">{caption}</p> : null}
              </div>
              <div className="shrink-0">{action}</div>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-ink max-md:text-xl max-md:tracking-tight">{title}</h1>
              {caption ? <p className="pb-5 pt-1 text-base text-ink-2">{caption}</p> : <div className="pb-4" />}
            </>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

/** The phone's list (`11 · Settings · grouped list`): the groups, each row a name and what is in it. */
export function SettingsIndex({ doc }: { doc: SettingsDoc | null }) {
  const sub = settingsSubline(doc);
  return (
    <div className="md:hidden">
      <p className="px-4 pb-3 text-sm text-ink-3 [overflow-wrap:anywhere]">{sub ?? "Your account and company"}</p>
      {SETTINGS_GROUPS.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h2 className="px-4 pb-1 pt-4 text-xs font-medium text-ink-3">{g.title}</h2>
          <ul className="border-t border-line">
            {g.items.map((i) => (
              <li key={i.key} className="border-b border-line">
                <Link href={i.key === "company" ? COMPANY_PHONE_HREF : i.href} prefetch={false} className={cn("flex min-h-14 items-center gap-2 py-2 pl-4 pr-2", FOCUS)}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-md font-medium text-ink">{i.label}</span>
                    <span className="text-sm text-ink-3 [overflow-wrap:anywhere]">{rowLine(i.key, doc)}</span>
                  </span>
                  <span className="flex size-11 shrink-0 items-center justify-center">
                    <CaretRight size={20} className="text-ink-3" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** `settings_get` failed. Nothing here claims what the account holds. */
export function SettingsError({ retryHref }: { retryHref: string }) {
  return (
    <ErrorPanel
      title={SETTINGS_ERROR_TITLE}
      retry={
        <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
          Try again
        </Link>
      }
    >
      {SETTINGS_ERROR_BODY}
    </ErrorPanel>
  );
}

/** Settings while it loads: the navigation's silhouette and three fields from 768; the list's rows under it. */
export function SettingsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading settings" className="flex min-h-0 flex-1">
      <div className="flex w-[248px] shrink-0 flex-col gap-3 border-r border-line px-3 pb-4 pt-7 max-md:hidden">
        <p className="px-2.5 text-xl font-semibold tracking-tight text-ink">Settings</p>
        <Skeleton className="mx-2.5 h-3 w-[160px]" />
        {[110, 90, 130, 120, 100, 110].map((w, i) => (
          <Skeleton key={i} className="mx-2.5 h-3" style={{ width: w }} />
        ))}
      </div>
      <div className="min-w-0 flex-1 px-8 pt-7 max-md:px-0 max-md:pt-0" aria-hidden>
        <div className="flex max-w-[760px] flex-col gap-4 max-md:hidden">
          <Skeleton className="h-5 w-[180px]" />
          <Skeleton tone="subtle" className="h-3 w-[320px]" />
          <div className="flex gap-4 border-t border-line pt-5">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
          <Skeleton className="h-[72px]" />
        </div>
        <div className="md:hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex min-h-14 flex-col justify-center gap-1.5 border-b border-line px-4 py-2">
              <Skeleton className="h-3 w-[140px]" />
              <Skeleton tone="subtle" className="h-2.5 w-[200px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A titled block of a Settings page: its name, what it is for, then the fields; a hairline above all but the first. */
export function Section({ title, caption, children }: { title: string; caption?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 border-t border-line py-6 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-semibold text-ink">{title}</h2>
        {caption ? <p className="text-base text-ink-2">{caption}</p> : null}
      </div>
      {children}
    </section>
  );
}
