"use client";

// Watch (handoff-mercury-motion-sitewide.md §4.3): the saved suppliers are checked one by one against the UFLPA
// Entity List, the three counts land with the list's own entry count and read, and the certificate expiry list
// groups what has lapsed, what ends within 30 days and what ends within 90, as the Compliance hub does
// (`components/compliance/words.ts` writes every line). The saved suppliers are the snapshot's records.

import { Clock, Scales, XCircle } from "@phosphor-icons/react";
import { buttonClass } from "@/components/kit";
import { UFLPA_WORDS, expiredHeading, uflpaCounts, uflpaSourceLine, within30Heading, within90Heading } from "@/components/compliance/words";
import type { CursorState, Step } from "@/components/site/motion";
import { daysUntil, displayName, formatDay } from "@/lib/dashboard/facts";
import { certName } from "@/lib/dashboard/needs-attention";
import { SNAPSHOT, TODAY } from "@/lib/marketing/demo-snapshot";
import { cn } from "@/lib/utils";
import { Bar, Demo, Window, endOf, streamed } from "./stage";

const SAVED = SNAPSHOT.saved.map((r) => ({ slug: r.slug, name: displayName(r.name), place: r.place, certs: r.certs }));

/** Every company the demo names. */
export const NAMES = SAVED.map((r) => r.name);

const COUNTS = uflpaCounts({ hits: 0, flags: 0, clear: SAVED.length });
const READ = uflpaSourceLine(SNAPSHOT.uflpa ? { list: "uflpa", entries_listed: SNAPSHOT.uflpa.entries, last_read: SNAPSHOT.uflpa.lastRead } : null, TODAY);

type Item = { key: string; when: string; cert: string; supplier: string; place: string | null; ask: string };
const items = SAVED.flatMap((r) =>
  r.certs
    .filter((c) => c.expiresOn)
    .map((c): Item & { days: number } => {
      const days = daysUntil(c.expiresOn, TODAY) ?? 0;
      return { key: `${r.slug}-${c.kind}-${c.number ?? c.expiresOn}`, days, when: `${days < 0 ? "Expired" : "Expires"} ${formatDay(c.expiresOn)}`, cert: certName(c.kind, c.number), supplier: r.name, place: r.place, ask: days < 0 ? "Ask for the new certificate" : "Ask for the renewal" };
    }),
);
const GROUPS = [
  { state: "expired" as const, heading: expiredHeading, items: items.filter((i) => i.days < 0).sort((a, b) => b.days - a.days) },
  { state: "expiring" as const, heading: within30Heading, items: items.filter((i) => i.days >= 0 && i.days <= 30).sort((a, b) => a.days - b.days) },
  { state: "expiring" as const, heading: within90Heading, items: items.filter((i) => i.days > 30 && i.days <= 90).sort((a, b) => a.days - b.days) },
].filter((g) => g.items.length > 0);

type S = CursorState & { checked: number; done: boolean; expiry: boolean };

const still = (over: Partial<S>): S => ({ checked: SAVED.length, done: true, expiry: true, ...over });
const checking = streamed(SAVED.length, 600, (checked) => still({ checked, done: false, expiry: false }));
const t1 = endOf(checking) + 500;
export const STEPS: Step<S>[] = [{ at: 0, state: still({ checked: 0, done: false, expiry: false }) }, ...checking, { at: t1, state: still({ expiry: false }) }, { at: t1 + 2200, state: still({}) }];

export function DemoCompliance({ className }: { className?: string }) {
  return (
    <Demo steps={STEPS} description={`The ${SAVED.length} saved suppliers checked against the UFLPA Entity List, no link found, and their certificates grouped by when they end.`} className={className}>
      {(s) => (
        <Window>
          <Bar title="Compliance">
            <span className="text-sm text-ink-3">
              {SAVED.length} saved {SAVED.length === 1 ? "supplier" : "suppliers"}
            </span>
          </Bar>
          {s.expiry ? (
            <div className="flex flex-col">
              <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-3">
                <p className="text-base font-semibold text-ink">Certificate expiry</p>
                <p className="text-xs text-ink-3">Ask suppliers for renewals before certificates expire.</p>
              </div>
              {GROUPS.map((g) => {
                const Glyph = g.state === "expired" ? XCircle : Clock;
                return (
                <section key={g.heading(0)} aria-label={g.heading(g.items.length)} className="animate-swap-in motion-reduce:animate-none">
                  <div className="flex h-8 items-center gap-2 bg-caution-tint px-4">
                    <Glyph size={16} weight="fill" className="shrink-0 text-caution-icon" aria-hidden />
                    <p className="text-sm font-semibold text-caution">{g.heading(g.items.length)}</p>
                  </div>
                  <ul>
                    {g.items.map((i) => (
                      <li key={i.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-line px-4 py-2 [@container_(min-width:640px)]:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <span className="text-sm font-medium text-caution">{i.when}</span>
                        <span className="text-sm text-ink">{i.cert}</span>
                        <span className="truncate text-sm text-ink">
                          {i.supplier}
                          {i.place ? <span className="text-ink-3"> · {i.place}</span> : null}
                        </span>
                        <span className={cn(buttonClass(), "col-start-2 row-span-2 row-start-1 [@container_(min-width:640px)]:col-start-4 [@container_(min-width:640px)]:row-span-1")}>{i.ask}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4">
              <div className="flex items-center gap-2">
                <Scales size={18} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
                <p className="text-base font-semibold text-ink">UFLPA checks</p>
                <p className="ml-auto text-sm tabular-nums text-ink-2">{s.done ? READ : `Checking ${s.checked} of ${SAVED.length}`}</p>
              </div>
              {s.done ? (
                <div className="flex gap-3 animate-swap-in motion-reduce:animate-none">
                  {COUNTS.map((c) => (
                    <div key={c.status} className="flex flex-1 flex-col gap-0.5 rounded-lg border border-line px-3 py-2.5">
                      <p className="text-xl font-semibold tabular-nums text-ink">{c.count}</p>
                      <p className="text-sm text-ink-2">{UFLPA_WORDS[c.status].label}</p>
                      <p className="text-xs text-ink-3">{UFLPA_WORDS[c.status].sub}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <ul className="flex flex-col">
                {SAVED.map((r, i) => {
                  const read = i < s.checked;
                  return (
                    <li key={r.slug} className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm">
                      <span className="truncate font-medium text-ink">{r.name}</span>
                      <span className={cn("shrink-0", read ? "text-ink-2" : "text-ink-3")}>{read ? UFLPA_WORDS.clear.label : i === s.checked ? "Checking…" : ""}</span>
                    </li>
                  );
                })}
              </ul>
              {s.done ? <p className="text-xs text-ink-3">“No link found” is not a clearance. Entries added since our last read are not checked.</p> : null}
            </div>
          )}
        </Window>
      )}
    </Demo>
  );
}
