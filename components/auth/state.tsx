// The parts of an auth page that read nothing: the 56 bar, the heading, and the page that is one message
// (Paper `20 Onboarding` S4 to S9: kicker, title, a line, two actions, a note). Safe in a server or a
// client component, so the error boundary can use them.

import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/kit";
import { cn } from "@/lib/utils";
import { AuthLink, authLinkClass } from "./link";

/** The top bar: the wordmark, and one line at the right ("Already have an account? Sign in"). */
export function AuthBar({ lead, link, border }: { lead?: string; link: ReactNode; border?: boolean }) {
  return (
    <div className={cn("flex h-14 shrink-0 items-center justify-between px-4 sm:px-10", border && "border-b border-line")}>
      <Link href="/" className="text-md font-semibold tracking-tight text-brand">
        SourceBD
      </Link>
      <div className="flex items-center gap-1.5 text-base">
        {lead ? <span className="text-ink-3 max-sm:hidden">{lead}</span> : null}
        <span className={authLinkClass}>{link}</span>
      </div>
    </div>
  );
}

export function Heading({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl sm:tracking-tighter">{title}</h1>
      {sub ? <p className="text-md text-ink-2">{sub}</p> : null}
    </div>
  );
}

export type StateAction = { label: string; href: string; secondary?: boolean };

/**
 * A page that is one message: the bar with a border, then a column 544 wide, centred. The first action
 * is the button and the second a link; `primary` replaces the button when it must do something (Try again).
 */
export function StatePage({
  barLink,
  kicker,
  title,
  body,
  actions,
  primary,
  note,
  children,
}: {
  barLink: ReactNode;
  kicker: string;
  title: string;
  body: ReactNode;
  actions?: StateAction[];
  primary?: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  const buttons = actions ?? [];
  return (
    <div className="flex min-h-dvh flex-col bg-surface font-sans text-ink antialiased">
      <AuthBar link={barLink} border />
      <main id="main-content" className="mx-auto flex w-full max-w-prose flex-1 flex-col justify-center gap-5 px-4 pb-14">
        <p className="text-sm font-medium text-ink-3">{kicker}</p>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl sm:tracking-tighter">{title}</h1>
        <p className="text-md text-ink-2">{body}</p>
        {children}
        {primary || buttons.length ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            {primary}
            {buttons.map((a) => {
              const away = /^https?:/.test(a.href) ? ({ target: "_blank", rel: "noopener noreferrer" } as const) : {};
              return a.secondary ? (
                <AuthLink key={a.label} href={a.href} className="max-sm:inline-flex max-sm:min-h-11 max-sm:items-center" {...away}>
                  {a.label}
                </AuthLink>
              ) : (
                <ButtonLink key={a.label} href={a.href} prefetch={false} kind="primary" size="lg" className="max-sm:h-input-touch max-sm:text-md" {...away}>
                  {a.label}
                </ButtonLink>
              );
            })}
          </div>
        ) : null}
        {note ? <p className="text-sm text-ink-3">{note}</p> : null}
      </main>
    </div>
  );
}
