// Order timeline (`03 Patterns · 9`, a sample state): done, now and planned milestones in one
// column, each with its date and who logged it. A planned date that has passed says how late it
// is, in words. Done filled check; now a brand ring; planned a dashed circle (caution when late).
// Phone: done milestones fold into one line; what is late and what is happening now stay open.
// Server-safe; the fold is a native `<details>`.

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { formatDay } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { lateWords } from "./words";

export type Milestone = {
  name: string;
  status: "done" | "now" | "planned";
  /** ISO date: when it was done or started, or when it is planned. */
  on: string;
  /** "Logged by you", "Planned by Aboni Knitwear Ltd. · not logged yet" */
  byline: string;
};

function Dot({ m, late }: { m: Milestone; late: boolean }) {
  if (m.status === "done") return <CheckCircle size={20} weight="fill" className="shrink-0 text-ink-2" aria-hidden />;
  if (m.status === "now")
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-brand-tint" aria-hidden>
        <span className="size-2 rounded-full bg-brand" />
      </span>
    );
  return <span className={cn("size-5 shrink-0 rounded-full border-2 border-dashed", late ? "border-caution-icon" : "border-line-strong")} aria-hidden />;
}

function Item({ m, today, last }: { m: Milestone; today: Date; last: boolean }) {
  const late = m.status === "planned" ? lateWords(m.on, today) : null;
  return (
    <li className="flex gap-3" aria-current={m.status === "now" ? "step" : undefined}>
      <span className="flex w-5 shrink-0 flex-col items-center">
        <Dot m={m} late={!!late} />
        {last ? null : <span className={cn("w-0.5 flex-1", m.status === "done" ? "bg-line-strong" : "bg-line")} aria-hidden />}
      </span>
      <span className={cn("flex flex-1 justify-between gap-3", !last && "pb-4")}>
        <span className="flex flex-col">
          <span className={cn("text-md sm:text-base", m.status === "now" ? "font-semibold text-ink" : m.status === "done" ? "font-medium text-ink" : "font-medium text-ink-2")}>{m.name}</span>
          <span className="text-sm text-ink-3 sm:text-xs">{m.byline}</span>
        </span>
        <span className="flex flex-col items-end text-sm sm:leading-5">
          <span className={cn("w-max", m.status === "now" ? "font-medium text-ink" : "text-ink-2")}>
            {m.status === "planned" ? "Planned " : ""}
            {formatDay(m.on)}
          </span>
          {late ? <span className="text-sm font-medium text-caution sm:text-xs">{late}</span> : null}
        </span>
      </span>
    </li>
  );
}

export function Timeline({ items, today, className }: { items: Milestone[]; today: Date; className?: string }) {
  const done = items.filter((m) => m.status === "done");
  const open = items.filter((m) => m.status !== "done");
  const lastDone = done[done.length - 1];
  return (
    <div className={cn("w-full rounded-lg border border-line px-5 py-4 max-sm:p-4", className)}>
      <ol className="max-sm:hidden">
        {items.map((m, i) => (
          <Item key={`${m.name}-${i}`} m={m} today={today} last={i === items.length - 1} />
        ))}
      </ol>
      <div className="sm:hidden">
        {done.length ? (
          <details className="group">
            <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-md bg-subtle px-3 text-md text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              <span>
                {done.length} {done.length === 1 ? "milestone" : "milestones"} done · last {formatDay(lastDone?.on)}
              </span>
              <span className="text-base font-medium text-brand underline decoration-1 [text-underline-position:from-font] group-open:hidden">Show</span>
              <span className="hidden text-base font-medium text-brand underline decoration-1 [text-underline-position:from-font] group-open:inline">Hide</span>
            </summary>
            <ol className="pt-4">
              {done.map((m, i) => (
                <Item key={`${m.name}-${i}`} m={m} today={today} last={false} />
              ))}
            </ol>
          </details>
        ) : null}
        <ol className={done.length ? "pt-4" : ""}>
          {open.map((m, i) => (
            <Item key={`${m.name}-${i}`} m={m} today={today} last={i === open.length - 1} />
          ))}
        </ol>
      </div>
    </div>
  );
}
