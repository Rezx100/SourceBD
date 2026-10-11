"use client";

// Recent shipments (Paper page 34, boards K1–K7): a paying reader's button that fetches a supplier's latest
// customs shipments once, then the table. Growth sees 15, Enterprise 25; the number on the button and the cut
// both come from the server (0141), never from this file. Starter sees the plans line instead. The table has
// three columns, not the board's five (founder, 11 Oct 2026: five were cramped in the 640 pane): date, the
// shipment (product, HS code, buyer and where it went), value with the weight under it. No unit price and no
// quantity: the records carry no quantity, and value over unit price is a price. The provider is never named.

import { ArrowClockwise } from "@phosphor-icons/react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/kit";
import { formatDay, revealRows, type ShipmentReveal, type ShipmentRevealState } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";

type Phase =
  | { at: "upgrade" }
  | { at: "offer"; shown: number; limit: number | null; used: number }
  | { at: "loading"; shown: number; limit: number | null; used: number }
  | { at: "shown"; reveal: ShipmentReveal }
  | { at: "used-up"; limit: number }
  | { at: "today"; limit: number }
  | { at: "failed"; shown: number; limit: number | null; used: number };

/** The first of next month, UTC, as "1 November": when a month's allowance starts again. */
export function resetsOn(now: Date): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

function start(s: ShipmentRevealState): Phase {
  if (s.state === "upgrade") return { at: "upgrade" };
  if (s.state === "shown") return { at: "shown", reveal: s.reveal };
  if (s.limit !== null && s.used >= s.limit) return { at: "used-up", limit: s.limit };
  return { at: "offer", shown: s.shown, limit: s.limit, used: s.used };
}

const HEAD = "px-3 py-2 text-left font-mono text-[11px] font-normal uppercase leading-4 tracking-[0.06em] text-ink-3";

function Frame({ level: H, lead, busy, children }: { level: "h2" | "h3"; lead: string; busy?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-subtle p-5" aria-busy={busy || undefined}>
      <div className="flex flex-col gap-1">
        <H id="recent-shipments-title" className="text-md font-semibold text-ink">
          Recent shipments
        </H>
        <p className="text-sm text-ink-2">{lead}</p>
      </div>
      <Placeholder />
      {children}
    </div>
  );
}

/** The table's shape before the reveal: its heads and three sunken rows, for sighted readers only. */
function Placeholder() {
  return (
    <div aria-hidden className="overflow-clip rounded-md border border-line bg-surface">
      <div className="flex gap-3 bg-subtle">
        <span className={cn(HEAD, "hidden w-24 shrink-0 sm:block")}>Date</span>
        <span className={cn(HEAD, "grow")}>Shipment</span>
        <span className={cn(HEAD, "w-28 shrink-0 text-right")}>Value</span>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 border-t border-line px-3 py-3.5">
          <span className="hidden w-[84px] shrink-0 sm:block">
            <span className="block h-2.5 w-16 rounded-[3px] bg-sunken" />
          </span>
          <span className="flex grow flex-col gap-1.5">
            <span className={cn("block h-2.5 rounded-[3px] bg-sunken", ["w-40", "w-36", "w-44"][i])} />
            <span className={cn("block h-2.5 rounded-[3px] bg-sunken", ["w-28", "w-24", "w-32"][i])} />
          </span>
          <span className="flex w-28 shrink-0 justify-end">
            <span className={cn("block h-2.5 rounded-[3px] bg-sunken", ["w-16", "w-14", "w-[60px]"][i])} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** K6 and K7's white box: a sentence, a smaller line, one action on the right. */
function Box({ title, line, action }: { title: string; line: string; action?: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-base font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-3">{line}</p>
      </div>
      {action}
    </div>
  );
}

function Table({ reveal, level: H }: { reveal: ShipmentReveal; level: "h2" | "h3" }) {
  const rows = revealRows(reveal.records);
  const fetched = `Fetched ${formatDay(reveal.fetched_at) ?? "recently"} · Bangladesh customs`;
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <H id="recent-shipments-title" tabIndex={-1} className="text-md font-semibold text-ink focus:outline-none">
          Recent shipments
        </H>
        <p className="text-base text-ink-2">No garment shipments under this name in the customs records for this window.</p>
        <p className="text-xs text-ink-3">{fetched}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <H id="recent-shipments-title" tabIndex={-1} className="text-md font-semibold text-ink focus:outline-none">
          Latest {rows.length} {rows.length === 1 ? "shipment" : "shipments"}
        </H>
        <p className="text-xs text-ink-3">{fetched}</p>
      </div>
      <div className="overflow-clip rounded-md border border-line">
        <table className="w-full border-collapse [font-variant-numeric:tabular-nums]">
          <caption className="sr-only">Latest shipments, newest first</caption>
          <thead className="bg-subtle">
            <tr>
              <th scope="col" className={cn(HEAD, "hidden w-[108px] sm:table-cell")}>
                Date
              </th>
              <th scope="col" className={HEAD}>
                Shipment
              </th>
              <th scope="col" className={cn(HEAD, "w-28 text-right")}>
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line align-top">
                <td className="hidden px-3 py-2.5 text-sm text-ink sm:table-cell">{r.date}</td>
                <td className="px-3 py-2.5">
                  <span className="block text-xs text-ink-3 sm:hidden">{r.date}</span>
                  <span className="block text-sm font-medium text-ink [overflow-wrap:anywhere]">
                    {r.product}
                    {r.hs ? <span className="ml-2 font-mono text-xs font-normal text-ink-3">{r.hs}</span> : null}
                  </span>
                  {r.buyerTo ? <span className="block text-xs text-ink-2 [overflow-wrap:anywhere]">{r.buyerTo}</span> : null}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="block text-sm font-semibold text-ink">{r.value ?? "Not filed"}</span>
                  {r.weight ? <span className="block text-xs text-ink-3">{r.weight}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-3">Buyer names as on the customs record, often an agent. Weight is gross, as declared.</p>
    </div>
  );
}

export function ShipmentRevealSection({ slug, initial, level = "h3" }: { slug: string; initial: ShipmentRevealState; level?: "h2" | "h3" }) {
  const [phase, setPhase] = useState<Phase>(() => start(initial));

  async function reveal() {
    if (phase.at !== "offer" && phase.at !== "failed") return;
    const { shown, limit, used } = phase;
    setPhase({ at: "loading", shown, limit, used });
    try {
      const res = await fetch(`/api/v1/suppliers/${encodeURIComponent(slug)}/shipments`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { reveal?: ShipmentReveal; error?: string; limit?: number };
      if (res.ok && body.reveal && Array.isArray(body.reveal.records)) {
        setPhase({ at: "shown", reveal: body.reveal });
        // The button is gone: the reader lands on the table's heading, not at the top of the page.
        return requestAnimationFrame(() => document.getElementById("recent-shipments-title")?.focus());
      }
      if (res.status === 403) return setPhase({ at: "upgrade" });
      if (res.status === 429 && typeof body.limit === "number") {
        return setPhase(/today/i.test(body.error ?? "") ? { at: "today", limit: body.limit } : { at: "used-up", limit: body.limit });
      }
      setPhase({ at: "failed", shown, limit, used });
    } catch {
      setPhase({ at: "failed", shown, limit, used });
    }
  }

  let body: React.ReactNode;
  switch (phase.at) {
    case "shown":
      body = <Table reveal={phase.reveal} level={level} />;
      break;
    case "upgrade":
      body = (
        <Frame level={level} lead="Latest shipments from Bangladesh customs.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base text-ink">Growth shows the latest 15, Enterprise 25.</p>
            <ButtonLink href="/pricing" prefetch={false}>
              Compare plans
            </ButtonLink>
          </div>
        </Frame>
      );
      break;
    case "used-up":
      body = (
        <Frame level={level} lead="Latest shipments from Bangladesh customs.">
          <Box
            title={`All ${phase.limit} suppliers used this month`}
            line={`Resets ${resetsOn(new Date())}`}
            action={
              <ButtonLink href="/pricing" prefetch={false}>
                Compare plans
              </ButtonLink>
            }
          />
        </Frame>
      );
      break;
    case "today":
      body = (
        <Frame level={level} lead="Latest shipments from Bangladesh customs.">
          <Box title={`All ${phase.limit} for today used`} line="Try again tomorrow." />
        </Frame>
      );
      break;
    case "failed":
      body = (
        <Frame level={level} lead="Latest shipments from Bangladesh customs.">
          <Box
            title="Couldn’t load. Try again shortly."
            line="Nothing was used."
            action={
              <Button icon={ArrowClockwise} onClick={reveal}>
                Try again
              </Button>
            }
          />
        </Frame>
      );
      break;
    default: {
      const loading = phase.at === "loading";
      const left = phase.limit === null ? null : Math.max(0, phase.limit - phase.used);
      body = (
        <Frame level={level} lead={loading ? "Reading Bangladesh customs records." : "Latest shipments from Bangladesh customs."} busy={loading}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button
              kind="secondary"
              loading={loading}
              loadingLabel="Getting shipments…"
              onClick={reveal}
              className={cn(!loading && "border-ink bg-ink font-semibold text-surface hover:border-ink-2 hover:bg-ink-2 active:border-ink active:bg-ink")}
            >
              See the latest {phase.shown} shipments
            </Button>
            <p className="text-xs text-ink-3" aria-live="polite">
              {loading ? "Under 10 seconds" : left === null ? null : `${left} of ${phase.limit} left this month`}
            </p>
          </div>
        </Frame>
      );
    }
  }

  return (
    <section id="recent-shipments" aria-labelledby="recent-shipments-title" className="scroll-mt-4">
      {body}
    </section>
  );
}
