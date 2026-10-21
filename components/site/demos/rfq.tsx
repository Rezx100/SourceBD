"use client";

// Ask (handoff-mercury-motion-sitewide.md §4.3): three suppliers are ticked, the ink bulk bar appears, the composer
// opens beside the list, its fields fill, "Sent to 3", and two quotes land side by side. The suppliers are the
// snapshot's; the RFQ's values and every quote are examples and are labelled so (the audit allows a labelled sample
// where no real quote exists yet). Drawn from the kit's bulk bar, the composer's words and `QuoteComparison`. Two
// more for the pages that said these in 3 Oct screenshots (critique 22 Oct): `DemoQuotes`, the two quotes landing in
// the comparison at full size, and `DemoReview`, one RFQ to the search's suppliers with a sanctioned example among
// them, refused until it is removed (the composer's own words, components/rfqs/composer-model.ts).

import { Check, X } from "@phosphor-icons/react";
import { BulkBar, bulkActionClass, bulkCloseClass, buttonClass } from "@/components/kit";
import { SampleLabel, SanctionBanner } from "@/components/patterns";
import { usd, vsTarget } from "@/components/patterns/words";
import type { CursorState, Step } from "@/components/site/motion";
import { displayName } from "@/lib/dashboard/facts";
import { motion } from "@/lib/design/tokens";
import { READ_AT, SANCTIONED_SAMPLE, SNAPSHOT } from "@/lib/marketing/demo-snapshot";
import { cn } from "@/lib/utils";
import { Bar, Demo, Field, Window, endOf, typed, type Frame } from "./stage";

const ROWS = SNAPSHOT.search.rows.slice(0, 5).map((r) => ({ slug: r.slug, name: displayName(r.name), line: [r.type, r.place].filter(Boolean).join(" · ") }));
const TARGETS = ROWS.slice(0, 3);

/** Every company the demo names. */
export const NAMES = ROWS.map((r) => r.name);

/** The example RFQ: labelled as such wherever it is drawn. */
export const RFQ = { product: "Men's cotton trousers", quantity: "12,000 pieces", target: "US$6.50 per piece", shipBy: "15 Jan 2027" };
const FIELDS: [string, string][] = [
  ["Product", RFQ.product],
  ["Quantity", RFQ.quantity],
  ["Target price", RFQ.target],
  ["Ship by", RFQ.shipBy],
];

type S = CursorState & { ticked: number; composer: boolean; typing: number; typed: string; sent: boolean; quotes: boolean };

const still = (over: Partial<S>): S => ({ ticked: 3, composer: true, typing: FIELDS.length, typed: "", sent: true, quotes: true, ...over });
const before = (over: Partial<S>): S => still({ composer: false, typing: 0, sent: false, quotes: false, ...over });

const steps: Step<S>[] = [{ at: 0, state: before({ ticked: 0 }) }];
let t = 500;
for (let i = 0; i < TARGETS.length; i++) {
  steps.push({ at: t, state: before({ ticked: i, cursor: `tick-${TARGETS[i]!.slug}` }) });
  steps.push({ at: t + motion.cursorMs, state: before({ ticked: i, cursor: `tick-${TARGETS[i]!.slug}`, click: true }) });
  steps.push({ at: t + motion.cursorMs + motion.clickMs, state: before({ ticked: i + 1, cursor: `tick-${TARGETS[i]!.slug}` }) });
  t += motion.cursorMs + motion.clickMs + 350;
}
steps.push({ at: t + 200, state: before({ cursor: "send-rfq" }) });
steps.push({ at: t + 200 + motion.cursorMs, state: before({ cursor: "send-rfq", click: true }) });
t += 200 + motion.cursorMs + motion.clickMs;
steps.push({ at: t, state: still({ typing: 0, sent: false, quotes: false }) });
t += 500;
for (let i = 0; i < FIELDS.length; i++) {
  const run = typed(FIELDS[i]![1], t, (typed) => still({ typing: i, typed, sent: false, quotes: false }));
  steps.push(...run);
  t = endOf(run) + 300;
}
steps.push({ at: t, state: still({ sent: false, quotes: false, cursor: "send" }) });
steps.push({ at: t + motion.cursorMs, state: still({ sent: false, quotes: false, cursor: "send", click: true }) });
steps.push({ at: t + motion.cursorMs + motion.clickMs, state: still({ quotes: false }) });
steps.push({ at: t + motion.cursorMs + motion.clickMs + 1200, state: still({}) });
export const STEPS = steps;

/** The example quotes, in the comparison's own words (`QuoteComparison`'s phone cards; its table needs a wider page than a demo gets). */
const TARGET = 6.5;
const QUANTITY = 12000;
export const QUOTES = [
  { supplier: TARGETS[0]!.name, price: 6.15, moq: 10000, leadDays: 45, validUntil: "30 Nov 2026", best: true },
  { supplier: TARGETS[1]!.name, price: 6.9, moq: 12000, leadDays: 38, validUntil: "22 Nov 2026", best: false },
];

export function DemoRfq(frame: Frame) {
  return (
    <Demo {...frame} steps={STEPS} description={`Three suppliers ticked from the results and one example RFQ sent to them from the pane beside the list; two example quotes come back side by side, labelled as examples.`}>
      {(s) => (
        <Window>
          {s.quotes ? (
            <QuotesPanel landed={QUOTES.length} />
          ) : (
            <>
              {s.ticked > 0 ? (
                <div className="shrink-0 p-3">
                  <BulkBar
                    summary={`${s.ticked} ${s.ticked === 1 ? "supplier" : "suppliers"} selected`}
                    clear={
                      <span aria-hidden className={bulkCloseClass}>
                        <X size={16} />
                      </span>
                    }
                  >
                    <span className={cn(bulkActionClass(), "[@container_(max-width:639px)]:hidden")}>Save</span>
                    <span className={cn(bulkActionClass(), "[@container_(max-width:639px)]:hidden")}>Download CSV</span>
                    <span data-cursor="send-rfq" className={bulkActionClass(true)}>
                      Send RFQ to {s.ticked} {s.ticked === 1 ? "supplier" : "suppliers"}
                    </span>
                  </BulkBar>
                </div>
              ) : (
                <Bar title={`${SNAPSHOT.search.chips.join(" · ")} · ${SNAPSHOT.search.total} suppliers`} />
              )}
              <div className="relative flex min-h-0 flex-1">
                <ul className={cn("flex w-full shrink-0 flex-col [@container_(min-width:640px)]:w-[40%]", s.composer && "[@container_(max-width:639px)]:hidden")}>
                  {ROWS.map((r, i) => {
                    const on = i < s.ticked;
                    return (
                      <li key={r.slug} className={cn("flex items-center gap-3 border-b border-l-2 border-b-line px-3 py-2.5", on ? "border-l-ink bg-sunken" : "border-l-transparent")}>
                        <span data-cursor={`tick-${r.slug}`} className={cn("flex size-4 shrink-0 items-center justify-center rounded-sm border", on ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface")} aria-hidden>
                          {on ? <Check size={12} weight="bold" /> : null}
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-base font-medium text-ink">{r.name}</span>
                          <span className="truncate text-xs text-ink-3">{r.line}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <section
                  aria-label="RFQ composer"
                  className={cn("absolute inset-y-0 right-0 flex w-full flex-col gap-4 border-l border-line bg-surface p-5 transition-transform duration-slow ease-out motion-reduce:transition-none [@container_(min-width:640px)]:w-[60%]", s.composer ? "translate-x-0" : "translate-x-full")}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-lg font-semibold tracking-tight text-ink">{s.sent ? `Sent to ${TARGETS.length}` : "New RFQ"}</p>
                    <SampleLabel>Example RFQ</SampleLabel>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-ink-2">
                      To · {TARGETS.length} suppliers <span className="font-normal text-ink-3">· you can add up to 50</span>
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {TARGETS.map((r) => (
                        <li key={r.slug} className="flex h-6 items-center rounded-md bg-sunken px-2 text-sm font-medium text-ink">
                          {r.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="grid grid-cols-1 gap-3 [@container_(min-width:640px)]:grid-cols-2">
                    {FIELDS.map(([label, value], i) => (
                      <Field key={label} label={label} value={i < s.typing ? value : i === s.typing ? s.typed : ""} placeholder={label === "Product" ? "What are you buying?" : ""} typing={i === s.typing && !s.sent} />
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
                    <p className="text-sm text-ink-3">{s.sent ? "Each supplier gets its own copy and replies in Messages." : "A supplier sees the target price."}</p>
                    <span data-cursor="send" className={buttonClass({ kind: "primary", className: s.sent ? "pointer-events-none" : "" })}>
                      {s.sent ? "Sent" : `Send to ${TARGETS.length}`}
                    </span>
                  </div>
                </section>
              </div>
            </>
          )}
        </Window>
      )}
    </Demo>
  );
}

/** The comparison as the RFQ draws it: the example RFQ's line, the quotes that have landed (the rest under a fade), and the supplier that has not replied. */
function QuotesPanel({ landed }: { landed: number }) {
  return (
    <section aria-label="Quotes" className="flex flex-col gap-4 p-5">
      <SampleLabel>Example quotes · the suppliers are real, every figure is an example</SampleLabel>
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="text-lg font-semibold text-ink">{RFQ.product}</h3>
        <p className="text-sm text-ink-2">
          {QUANTITY.toLocaleString("en-GB")} pieces · ship by {RFQ.shipBy} · target {usd(TARGET)} per piece
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 [@container_(min-width:640px)]:grid-cols-2">
        {QUOTES.map((q, i) => (
          <article key={q.supplier} className={cn("flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 transition-opacity duration-slow motion-reduce:transition-none", i >= landed && "opacity-40")}>
            <h4 className="text-md font-medium text-ink">{q.supplier}</h4>
            <p className="flex items-baseline gap-2">
              <span className="text-xl font-semibold tracking-tight text-ink">{usd(q.price)}</span>
              <span className="text-sm text-ink-2">per piece · {vsTarget(q.price, TARGET).replace(/^On target$/, "on target").replace(/ (under|over)$/, " $1 target")}</span>
            </p>
            <p className="text-sm text-ink-2">
              MOQ {q.moq.toLocaleString("en-GB")} pieces · {q.leadDays} days · valid until {q.validUntil}
            </p>
            <span className={buttonClass({ kind: q.best ? "primary" : "secondary", className: "self-start" })}>Accept quote</span>
          </article>
        ))}
      </div>
      <p className="text-sm text-ink-3">
        {TARGETS[2]!.name} · No reply yet · RFQ sent {READ_AT}
      </p>
    </section>
  );
}

type Q = CursorState & { landed: number };
export const QUOTE_STEPS: Step<Q>[] = [
  { at: 0, state: { landed: 0 } },
  { at: 900, state: { landed: 1 } },
  { at: 2100, state: { landed: 2 } },
];

/** Two example quotes landing side by side, each against the target: the comparison at full size. */
export function DemoQuotes(frame: Frame) {
  return (
    <Demo {...frame} steps={QUOTE_STEPS} description="Two example quotes landing side by side in the RFQ, each against the target price, and a third supplier that has not replied. The suppliers are real; every figure is an example.">
      {(s) => (
        <Window className="min-h-0">
          <QuotesPanel landed={s.landed} />
        </Window>
      )}
    </Demo>
  );
}

/** The search's suppliers as one RFQ's recipients, with the sanctioned example among them. */
const RECIPIENTS = SNAPSHOT.search.rows.map((r) => displayName(r.name));
const SANCTIONED_AT = 2;

type R = CursorState & { removed: boolean };
export const REVIEW_STEPS: Step<R>[] = [
  { at: 0, state: { removed: false } },
  { at: 1400, state: { removed: false, cursor: "remove" } },
  { at: 1400 + motion.cursorMs, state: { removed: false, cursor: "remove", click: true } },
  { at: 1400 + motion.cursorMs + motion.clickMs, state: { removed: true } },
];

/**
 * One RFQ, reviewed before it goes: the search's suppliers are the recipients, with "Example Apparel Ltd", the site's
 * sanctioned example, among them; the composer refuses to send in its own words until it is removed, then sends to
 * the rest. Up to 50 suppliers can be added.
 */
export function DemoReview(frame: Frame) {
  const n = RECIPIENTS.length;
  return (
    <Demo {...frame} steps={REVIEW_STEPS} description={`An example RFQ to ${n} suppliers from a search, reviewed before it goes: ${SANCTIONED_SAMPLE}, an example company on a sanctions screen, blocks the send until it is removed.`}>
      {(s) => {
        const to = s.removed ? n : n + 1;
        return (
          <Window>
            <Bar title="New RFQ">
              <SampleLabel>Example RFQ · {SANCTIONED_SAMPLE} is an example company</SampleLabel>
            </Bar>
            {s.removed ? null : <SanctionBanner title={`This supplier is on a sanctions screen: ${SANCTIONED_SAMPLE}.`} detail="Remove them to send this RFQ. RFQs cannot be sent to a sanctioned supplier." />}
            <div className="flex flex-1 flex-col gap-3 p-5">
              <p className="text-sm font-medium text-ink-2">
                To · {to} suppliers <span className="font-normal text-ink-3">· you can add up to 50</span>
              </p>
              <ul className="flex flex-col rounded-md border border-line">
                {[...RECIPIENTS.slice(0, SANCTIONED_AT), ...(s.removed ? [] : [SANCTIONED_SAMPLE]), ...RECIPIENTS.slice(SANCTIONED_AT)].slice(0, 6).map((name) => {
                  const listed = name === SANCTIONED_SAMPLE;
                  return (
                    <li key={name} className={cn("flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0", listed && "bg-sanction-tint")}>
                      <span className="truncate text-sm font-medium text-ink">
                        {name}
                        {listed ? <span className="font-normal text-sanction"> · sanctioned</span> : null}
                      </span>
                      <span data-cursor={listed ? "remove" : undefined} className="shrink-0 text-sm font-medium text-ink-2 underline decoration-1">
                        Remove
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-ink-3">{to > 6 ? `and ${to - 6} more · ` : ""}Each supplier gets its own copy. No supplier sees who else you asked.</p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
              <p className={cn("text-sm", s.removed ? "text-ink-3" : "text-sanction")}>{s.removed ? `Sends to ${n} suppliers.` : "RFQs cannot be sent to a sanctioned supplier"}</p>
              <span className={buttonClass({ kind: "primary", className: s.removed ? "" : "pointer-events-none opacity-50" })}>Send to {to} suppliers</span>
            </div>
          </Window>
        );
      }}
    </Demo>
  );
}
