// The frame every Settings page sits in (Paper `10 · Settings`, `11 · Settings`): from 768 a 248
// column of the two groups and the page beside it; on a phone the page alone, under a back link to
// the list, and the list itself at `/app/settings`. Also the failed read and the loading skeleton.
// Server components.

import { ArrowLeft, Buildings, CaretRight, CreditCard, Envelope, Lock, Note, User, Users } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorPanel, Skeleton, buttonClass, ringInset } from "@/components/kit";
import { LinkPending } from "@/components/patterns/link-pending";
import { cn } from "@/lib/utils";
import type { SettingsDoc } from "./doc";
import { COMPANY_PHONE_HREF, PHONE_LINES, SETTINGS_ERROR_BODY, SETTINGS_ERROR_TITLE, SETTINGS_GROUPS, SETTINGS_HOME, phoneLabel, rowCaution, rowLine, settingsSubline, type RowFacts, type SettingsKey } from "./words";

const FOCUS = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

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
                  className={cn("flex h-9 items-center text-base", FOCUS, on ? "rounded-r-sm border-l-2 border-brand-ink bg-brand-tint pl-2 pr-2.5 font-semibold text-ink" : "rounded-sm px-2.5 text-ink-2 hover:bg-sunken hover:text-ink")}
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

/**
 * A phone page's head (Paper `11 · Settings · …`, "Compact head"): back to the list, the page's name
 * and what it holds. `data-detail` tells the frame to hide its own bar and the tab bar, as a record's
 * head does, so the name is drawn once. The name is the `h1`'s twin for the eye only: the `h1` stays
 * in the page for a screen reader.
 */
function PhoneHead({ title, line }: { title: string; line?: ReactNode }) {
  return (
    <div data-detail="" className="-mx-5 flex min-h-14 items-center gap-3 px-4 pb-2.5 pt-1.5 md:hidden">
      <Link href={SETTINGS_HOME} aria-label="Back to Settings" className={cn("-m-1 flex size-11 shrink-0 items-center justify-center rounded-full [&:active>span]:bg-line", FOCUS)}>
        <span className="flex size-9 items-center justify-center rounded-full bg-sunken">
          <ArrowLeft size={17} className="text-ink-2" aria-hidden />
        </span>
      </Link>
      <div className="flex min-w-0 grow basis-0 flex-col">
        <p aria-hidden className="text-xl/[30px] font-semibold tracking-[-0.025em] text-ink">
          {title}
        </p>
        {line ? <p className="line-clamp-1 text-sm text-ink-3">{line}</p> : null}
      </div>
    </div>
  );
}

/**
 * One Settings page: the navigation beside it, its title (the page's one `h1`) and what it is for.
 * On a phone the compact head stands in for the title and the caption (`line` replaces Paper's
 * default line under the name), and `phoneAction` is a bar at the foot (Paper's "Invite people").
 */
export function SettingsShell({
  current,
  doc,
  title,
  caption,
  line,
  action,
  phoneAction,
  wide,
  desktopOnly,
  children,
}: {
  current: SettingsKey | null;
  doc: SettingsDoc | null;
  title: string;
  caption?: ReactNode;
  line?: ReactNode;
  action?: ReactNode;
  phoneAction?: ReactNode;
  wide?: boolean;
  /** Drawn from 768 only (`/app/settings`, whose phone page is the list): no phone head, whose `data-detail` would hide the frame's bar. */
  desktopOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1">
      <SideNav current={current} doc={doc} />
      <div className={cn("min-w-0 flex-1 px-8 pb-8 pt-7 max-md:px-5 max-md:pt-0", phoneAction ? "max-md:flex max-md:flex-col max-md:pb-0" : "max-md:pb-12")}>
        {desktopOnly ? null : <PhoneHead title={current ? phoneLabel(current) : title} line={line ?? (current ? PHONE_LINES[current] : undefined)} />}
        <div className={cn("flex flex-col", wide ? "max-w-[920px]" : "max-w-[760px]", phoneAction && "max-md:pb-8")}>
          {action ? (
            <div className="flex items-end justify-between gap-4 pb-5 max-md:block max-md:p-0">
              <div className="min-w-0 max-md:sr-only">
                <h1 className="text-lg font-semibold text-ink">{title}</h1>
                {caption ? <p className="pt-1 text-base text-ink-2">{caption}</p> : null}
              </div>
              <div className="shrink-0 max-md:hidden">{action}</div>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-ink max-md:sr-only">{title}</h1>
              {caption ? <p className="pb-5 pt-1 text-base text-ink-2 max-md:hidden">{caption}</p> : <div className="pb-4 max-md:hidden" />}
            </>
          )}
          {children}
        </div>
        {phoneAction ? (
          // `mt-auto` on the phone's column: a short page still ends with the bar at the foot of the screen.
          <div className="sticky bottom-0 z-raised -mx-5 mt-auto flex min-h-16 items-center gap-2 border-t border-line bg-surface px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">{phoneAction}</div>
        ) : null}
      </div>
    </div>
  );
}

const ROW_ICONS: Record<SettingsKey, Icon> = { profile: User, security: Lock, emails: Envelope, company: Buildings, team: Users, templates: Note, plan: CreditCard };

/**
 * The phone's list (Paper `11 · Settings`): who is signed in, then the two groups as cards, each row a
 * name and what is in it. The frame's bar carries the title. `facts` are the Security and Team reads.
 */
export function SettingsIndex({ doc, facts }: { doc: SettingsDoc | null; facts?: RowFacts }) {
  return (
    <div className="px-5 pb-12 md:hidden">
      <p className="line-clamp-1 text-sm text-ink-3 [overflow-wrap:anywhere]">{doc?.email ? `Signed in as ${doc.email}` : "Your account and company"}</p>
      {SETTINGS_GROUPS.map((g, gi) => (
        <section key={g.title} aria-label={g.title}>
          <h2 className={cn("pb-3.5 text-lg font-medium tracking-tight text-ink", gi === 0 ? "pt-4" : "pt-6")}>{g.title}</h2>
          <ul className="overflow-clip rounded-[10px] border border-line">
            {g.items.map((i, ii) => {
              const G = ROW_ICONS[i.key];
              return (
                <li key={i.key} className={ii > 0 ? "border-t border-line" : undefined}>
                  <Link href={i.key === "company" ? COMPANY_PHONE_HREF : i.href} className={cn("flex min-h-[60px] items-center gap-3 px-4 py-2 active:bg-sunken", ringInset)}>
                    <span className="flex w-6 shrink-0 justify-center">
                      <G size={20} className="text-ink-2" aria-hidden />
                    </span>
                    <span className="flex min-w-0 grow basis-0 flex-col">
                      <span className="text-md/[22px] text-ink">{phoneLabel(i.key)}</span>
                      <span className={cn("text-sm [overflow-wrap:anywhere]", rowCaution(i.key, facts) ? "text-caution" : "text-ink-3")}>{rowLine(i.key, doc, facts)}</span>
                    </span>
                    <LinkPending />
                    <CaretRight size={16} className="shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              );
            })}
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
export function Section({ title, caption, phoneHead = true, className, children }: { title: string; caption?: ReactNode; /** false: Paper's phone board draws no head here (it is still read out). */ phoneHead?: boolean; className?: string; children: ReactNode }) {
  // On a phone the page's first block sits under the compact head with no hairline (Paper `11 · Profile`);
  // `first-of-type`, because the page's `h1` comes before it.
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3 border-t border-line py-6 first:border-t-0 first:pt-0 max-md:first-of-type:border-t-0 max-md:first-of-type:pt-4", className)}>
      <div className={cn("flex flex-col gap-0.5", !phoneHead && "max-md:sr-only")}>
        <h2 className="text-md font-semibold text-ink max-md:font-medium max-md:leading-[22px]">{title}</h2>
        {caption ? <p className="text-base text-ink-2 max-md:text-sm max-md:text-ink-3">{caption}</p> : null}
      </div>
      {children}
    </section>
  );
}
