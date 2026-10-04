// The parts of the inbox around its rows (Paper `10 · Messages`, `· empty`, `11 · Messages`): the
// list's head with its search and tabs, the rows, the empty teaching state, the failed read and the
// loading skeleton. Server components; the conversation is `conversation.tsx` and `thread-live.tsx`.

import { Clock, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ErrorPanel, Skeleton, buttonClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import { conversationsWords, listHref, threadHref, type ListState, type ShowTab, type ThreadItem } from "./words";

/** The list's own width beside a conversation: Paper's 360. */
const LIST_W = "w-[360px] max-lg:w-[300px] max-md:w-full";

export function InboxHead({ total, noReply, state }: { total: number; noReply: number | null; state: ListState }) {
  const tabs: { key: ShowTab; label: string }[] = [
    { key: "all", label: `All · ${total}` },
    ...(noReply === null ? [] : [{ key: "noreply" as const, label: `No reply yet · ${noReply}` }]),
  ];
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-line px-4 pb-3 pt-5 max-md:hidden">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Messages</h1>
      <form action="/app/messages" method="get" role="search" className="relative">
        {state.show !== "all" ? <input type="hidden" name="show" value={state.show} /> : null}
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={state.q}
          aria-label="Search conversations"
          placeholder="Search conversations"
          className="h-8 w-full rounded-sm border border-line-strong bg-surface pl-[34px] pr-2.5 text-base text-ink outline-none placeholder:text-ink-3 hover:border-ink-3 focus:border-brand focus:[box-shadow:inset_0_0_0_1px_theme(colors.brand)]"
        />
      </form>
      {tabs.length > 1 ? (
        <nav aria-label="Show" className="flex h-8 self-start overflow-clip rounded-sm border border-line-strong">
          {tabs.map((t, i) => (
            <Link
              key={t.key}
              href={listHref({ ...state, show: t.key })}
              prefetch={false}
              aria-current={t.key === state.show ? "true" : undefined}
              className={cn(
                "flex items-center px-3 text-sm leading-4 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                i > 0 && "border-l border-line-strong",
                t.key === state.show ? "bg-brand-tint font-semibold text-ink" : "font-medium text-ink-2",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

/** One row: the name and when, the newest line, and "RFQ · title" (with "No reply yet" when the last word is yours). */
export function InboxRows({ items, state, currentId }: { items: readonly ThreadItem[]; state: ListState; currentId: string | null }) {
  return (
    <ul>
      {items.map((i) => {
        const current = i.id === currentId;
        return (
          <li key={i.id}>
            <Link
              href={threadHref(i.id, state)}
              prefetch={false}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col gap-0.5 border-b border-l-2 border-line py-3 pl-3.5 pr-4 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand max-md:pl-[14px]",
                current ? "border-l-brand bg-brand-tint" : "border-l-transparent",
              )}
            >
              <span className="flex justify-between gap-2">
                <span className="min-w-0 text-base font-medium text-ink max-md:text-md">{i.name}</span>
                {i.when ? <span className="shrink-0 text-xs leading-5 text-ink-3 max-md:text-sm">{i.when}</span> : null}
              </span>
              {i.line ? <span className="line-clamp-2 text-base text-ink-2 max-md:text-md">{i.line}</span> : null}
              <span className="flex items-center gap-1.5 text-xs text-ink-3 max-md:text-sm">
                {i.noReply ? <Clock size={14} className="shrink-0" aria-hidden /> : null}
                {i.noReply ? `No reply yet · ${i.sub}` : i.sub}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** A tab or a search that matches nothing, in the list's own place. */
export function InboxNone({ state }: { state: ListState }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-8">
      <p className="text-md font-semibold text-ink">{state.q ? "No conversation matches that" : "No conversation is waiting on a reply"}</p>
      <p className="text-base text-ink-2">{state.q ? "Search by a supplier's name or the title of an RFQ." : "Every conversation here has a reply from the supplier."}</p>
      <Link href={listHref({ show: "all", q: "" })} prefetch={false} className="pt-2 text-base font-medium text-brand underline decoration-1 [text-underline-position:from-font]">
        Show all conversations
      </Link>
    </div>
  );
}

/** "3 conversations" under the list when a tab or a search is narrowing it. */
export function InboxFoot({ shown, total }: { shown: number; total: number }) {
  return shown === total ? null : <p className="px-4 py-3 text-sm text-ink-3">{`${conversationsWords(shown)} shown of ${total}`}</p>;
}

/** The list beside a conversation or the empty pane: head, rows, scroll inside. */
export function InboxColumn({ head, children, className }: { head?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label="Conversations" className={cn("flex min-h-0 shrink-0 flex-col border-r border-line bg-surface max-md:border-r-0", LIST_W, className)}>
      {head}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

const STEPS = [
  { title: "Send an RFQ", body: "To one supplier, or to up to 50 from your saved list." },
  { title: "Replies land here", body: "Each one under its RFQ, and the ones you have not answered marked." },
  { title: "Check them as you talk", body: "Certificates, RSC inspections and sources sit beside the thread." },
];

/** No conversations at all (`10 · Messages empty`, `11 · Messages empty`): what it is for and the way to start. */
export function InboxEmpty() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex max-w-prose flex-col gap-3 px-16 pb-0 pt-16 max-lg:px-8 max-lg:pt-10 max-md:gap-4 max-md:px-4 max-md:py-6">
        <p className="text-xs font-semibold text-ink-3 max-md:hidden">Messages</p>
        <h1 className="text-2xl font-semibold tracking-tighter text-ink max-md:text-xl">
          <span className="max-md:hidden">Talk to suppliers here, with their record beside you.</span>
          <span className="md:hidden">Supplier replies land here.</span>
        </h1>
        <p className="text-md text-ink-2">
          <span className="max-md:hidden">Send an RFQ and the supplier replies in this inbox. Contact details stay locked until then.</span>
          <span className="md:hidden">Send an RFQ. Replies and their records land here.</span>
        </p>
        <div className="flex gap-2 pt-2 max-md:flex-col max-md:pt-0">
          <Link href="/app" prefetch={false} className={buttonClass({ kind: "primary", size: "lg", className: "max-md:h-input-touch max-md:w-full" })}>
            Search suppliers
          </Link>
          <Link href="/app/rfqs/new" prefetch={false} className={buttonClass({ kind: "secondary", size: "lg", className: "max-md:h-input-touch max-md:w-full" })}>
            <span className="max-md:hidden">Send an RFQ to a saved supplier</span>
            <span className="md:hidden">Send an RFQ</span>
          </Link>
        </div>
      </div>
      <ol className="flex max-w-[912px] gap-4 px-16 pt-8 max-lg:px-8 max-md:hidden">
        {STEPS.map((s, n) => (
          <li key={s.title} className="flex flex-1 flex-col gap-2 border-t-2 border-ink p-5">
            <span className="font-mono text-sm text-ink-3">{n + 1}</span>
            <span className="text-md font-semibold text-ink">{s.title}</span>
            <span className="text-base text-ink-2">{s.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** `thread_list` failed. "No conversations yet" would be a claim about the account that a failed read cannot make. */
export function InboxError({ retryHref }: { retryHref: string }) {
  return (
    <div className="p-4">
      <ErrorPanel
        title="We couldn't load your conversations."
        retry={
          <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
            Try again
          </Link>
        }
      >
        Nothing has been lost. Your messages are safe.
      </ErrorPanel>
    </div>
  );
}

/** The right-hand side of the list page when a conversation has not been picked. */
export function PickPrompt() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-1 bg-subtle px-10 max-md:hidden">
      <p className="text-md font-semibold text-ink">Pick a conversation</p>
      <p className="text-base text-ink-2">Its messages, the RFQ and the supplier&apos;s record open here.</p>
    </div>
  );
}

export function InboxSkeleton() {
  const rows = [
    [220, 120],
    [180, 100],
    [260, 140],
    [200, 110],
  ];
  return (
    <div role="status" aria-busy="true" aria-label="Loading conversations" className="flex min-h-0 flex-1">
      <div className={cn("flex shrink-0 flex-col border-r border-line max-md:w-full max-md:border-r-0", LIST_W)}>
        <div className="flex shrink-0 flex-col gap-3 border-b border-line px-4 pb-3 pt-5 max-md:hidden">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Messages</h1>
          <Skeleton className="h-8 w-full" />
        </div>
        <div aria-hidden>
          {rows.map(([a, b], i) => (
            <div key={i} className="flex flex-col gap-2 border-b border-line px-4 py-3">
              <Skeleton className="h-3.5" style={{ width: a }} />
              <Skeleton tone="subtle" className="h-3" style={{ width: b }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
