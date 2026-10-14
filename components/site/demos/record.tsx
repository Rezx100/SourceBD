"use client";

// Check (handoff-mercury-motion-sitewide.md §4.3): the cursor opens Aboni Knitwear beside the list, the record pane
// slides in, the Certificates tab is chosen, and its rows arrive: the certificates held today, soonest expiry first,
// then the one that ended, each with the day its register was read. The pane is drawn as the record draws it
// (Paper page 37: name, type and place, the section tabs, the Certificates table's columns), from the snapshot.

import { Factory, MapPin } from "@phosphor-icons/react";
import { SourceMark } from "@/components/patterns";
import { certShort } from "@/components/patterns/words";
import { SECTIONS } from "@/components/record/desktop-words";
import type { CursorState, Step } from "@/components/site/motion";
import { displayName, formatCount, formatDay } from "@/lib/dashboard/facts";
import { certName } from "@/lib/dashboard/needs-attention";
import { motion } from "@/lib/design/tokens";
import { SNAPSHOT, TODAY } from "@/lib/marketing/demo-snapshot";
import { cn } from "@/lib/utils";
import { Bar, Demo, Window, endOf, streamed } from "./stage";

const { check, search } = SNAPSHOT;
const NAME = displayName(check.name);
const LIST = search.rows.slice(0, 5).map((r) => ({ slug: r.slug, name: displayName(r.name), line: [r.type, r.place].filter(Boolean).join(" · "), sources: r.sources }));

/** Every company the demo names. */
export const NAMES = [NAME, ...LIST.map((r) => r.name)];

/** The register each scheme is read from, for the row's receipt. */
const REGISTER: Record<string, { mark: string; name: string }> = { gots: { mark: "GOTS", name: "GOTS database" }, wrap: { mark: "WRAP", name: "WRAP register" }, oeko_tex: { mark: "OEKO_TEX", name: "OEKO-TEX buying guide" }, sa8000: { mark: "SA8000", name: "SAI register" } };

const rows = check.certs
  .map((c) => {
    const reg = REGISTER[c.kind] ?? { mark: c.kind.toUpperCase(), name: certName(c.kind, null) };
    const read = check.read[reg.mark === "OEKO_TEX" ? "OEKO-TEX" : reg.mark] ?? null;
    const ended = Boolean(c.expiresOn && c.expiresOn < SNAPSHOT.readAt);
    return { key: `${c.kind}-${c.number}`, mark: reg.mark, scheme: certName(c.kind, null), number: c.number, issuer: c.issuer, ended, state: ended ? `Ended ${formatDay(c.expiresOn)}` : certShort(c.expiresOn, TODAY), look: !ended && c.expiresOn !== null && certShort(c.expiresOn, TODAY).startsWith("Expires"), until: formatDay(c.expiresOn), receipt: read ? `${reg.name} · read ${formatDay(read)}` : reg.name, sort: c.expiresOn ?? "9999" };
  })
  .sort((a, b) => a.sort.localeCompare(b.sort));
const HELD = rows.filter((r) => !r.ended);
const ENDED = rows.filter((r) => r.ended);
const CERT_TAB = SECTIONS.find((s) => s.id === "certificates")!;

type S = CursorState & { open: boolean; tab: string; rows: number };

const still = (over: Partial<S>): S => ({ open: true, tab: "certificates", rows: rows.length, ...over });
const t0 = 700;
const t1 = t0 + motion.cursorMs + motion.clickMs + 600;
const t2 = t1 + motion.cursorMs + motion.clickMs + 300;
const streaming = streamed(rows.length, t2, (n) => still({ rows: n, cursor: `tab-${CERT_TAB.id}` }));
const t3 = endOf(streaming) + 600;
const LAST = ENDED[0] ?? HELD[HELD.length - 1];

export const STEPS: Step<S>[] = [
  { at: 0, state: still({ open: false, tab: "overview", rows: 0 }) },
  { at: t0, state: still({ open: false, tab: "overview", rows: 0, cursor: `row-${check.slug}` }) },
  { at: t0 + motion.cursorMs, state: still({ open: false, tab: "overview", rows: 0, cursor: `row-${check.slug}`, click: true }) },
  { at: t0 + motion.cursorMs + motion.clickMs, state: still({ tab: "overview", rows: 0, cursor: `row-${check.slug}` }) },
  { at: t1, state: still({ tab: "overview", rows: 0, cursor: `tab-${CERT_TAB.id}` }) },
  { at: t1 + motion.cursorMs, state: still({ tab: "overview", rows: 0, cursor: `tab-${CERT_TAB.id}`, click: true }) },
  ...streaming,
  ...(LAST ? [{ at: t3, state: still({ cursor: `cert-${LAST.key}` }) }] : []),
];

const COLS = "grid grid-cols-[minmax(0,1fr)_minmax(0,112px)_minmax(0,120px)] gap-x-4 [@container_(min-width:640px)]:grid-cols-[minmax(0,1fr)_minmax(0,124px)_minmax(0,120px)_minmax(0,1fr)]";

export function DemoRecord({ className }: { className?: string }) {
  return (
    <Demo steps={STEPS} description={`${NAME}'s record opened beside the search results at its Certificates section: ${HELD.length} held today, ${ENDED.length} ended, each with the day its register was read.`} className={className}>
      {(s) => (
        <Window>
          <Bar title={`${search.chips.join(" · ")} · ${formatCount(search.total)} suppliers`} />
          <div className="relative flex min-h-0 flex-1">
            <ul className={cn("flex w-full shrink-0 flex-col [@container_(min-width:640px)]:w-[38%]", s.open && "[@container_(max-width:639px)]:hidden")}>
              {LIST.map((r) => {
                const open = s.open && r.slug === check.slug;
                return (
                  <li key={r.slug} data-cursor={`row-${r.slug}`} className={cn("flex items-start justify-between gap-3 border-b border-l-2 border-b-line px-3 py-2.5", open ? "border-l-ink bg-sunken" : "border-l-transparent")}>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-base font-medium text-ink">{r.name}</span>
                      <span className="truncate text-xs text-ink-3">{r.line}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-3">{r.sources} sources</span>
                  </li>
                );
              })}
            </ul>
            <section
              aria-label="Supplier record"
              className={cn("absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface transition-transform duration-slow ease-out motion-reduce:transition-none [@container_(min-width:640px)]:w-[62%]", s.open ? "translate-x-0" : "translate-x-full")}
            >
              <header className="flex flex-col gap-0.5 px-5 pb-2.5 pt-3.5">
                <p className="text-lg font-semibold tracking-tight text-ink">{NAME}</p>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                  <span className="flex items-center gap-1.5">
                    <Factory size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
                    {check.type}
                  </span>
                  {check.place ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
                      {check.place}
                    </span>
                  ) : null}
                  <span>{check.sources.length} sources</span>
                </p>
              </header>
              <nav aria-label="Record sections" className="flex shrink-0 gap-2.5 overflow-hidden border-b border-line px-5">
                {SECTIONS.map((t) => {
                  const on = t.id === s.tab;
                  return (
                    <span key={t.id} data-cursor={`tab-${t.id}`} className={cn("flex h-10 shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium", on ? "text-ink [box-shadow:inset_0_-2px_0_theme(colors.ink)]" : "text-ink-3")}>
                      {t.label}
                      {t.id === CERT_TAB.id ? <span className="text-xs font-normal text-ink-3 tabular-nums">{HELD.length}</span> : null}
                    </span>
                  );
                })}
              </nav>
              {s.tab === CERT_TAB.id ? (
                <div role="table" aria-label="Certificates" className="flex flex-col px-2 pt-3 tabular-nums">
                  <div role="row" className={cn(COLS, "h-8 border-b border-line px-3 text-xs font-medium text-ink-3")}>
                    <span role="columnheader">Certificate</span>
                    <span role="columnheader">State</span>
                    <span role="columnheader">Valid until</span>
                    <span role="columnheader" className="[@container_(max-width:639px)]:hidden">Read</span>
                  </div>
                  {[...HELD, ...ENDED].slice(0, s.rows).map((c, i) => (
                    <div key={c.key} role="rowgroup" className="contents">
                      {i === HELD.length ? (
                        <div role="row" className="flex h-9 items-end border-b border-line px-3 pb-1.5 text-xs font-medium text-ink-3">
                          <span role="cell">No longer current · not counted above</span>
                        </div>
                      ) : null}
                      <div role="row" data-cursor={`cert-${c.key}`} className={cn(COLS, "min-h-14 animate-swap-in items-center border-b border-line px-3 py-2 motion-reduce:animate-none", s.cursor === `cert-${c.key}` && "bg-sunken")}>
                        <span role="cell" className="flex min-w-0 items-center gap-2.5">
                          <SourceMark source={c.mark} />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-base font-medium text-ink">{c.scheme}</span>
                            {c.number ? <span className="truncate font-mono text-xs text-ink-3">{c.number}</span> : null}
                          </span>
                        </span>
                        <span role="cell" className={cn("text-sm", c.look ? "font-medium text-caution" : c.ended ? "text-ink-3" : "text-ink")}>
                          {c.state}
                        </span>
                        <span role="cell" className={cn("text-sm", c.ended ? "text-ink-3" : "text-ink")}>
                          {c.until ?? <span className="text-xs text-ink-3">No end date published</span>}
                        </span>
                        <span role="cell" className="truncate text-xs text-ink-2 [@container_(max-width:639px)]:hidden">
                          {c.receipt}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3 px-5 pt-4">
                  <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
                    {[
                      ["Workers", formatCount(check.workers) ?? "Not published"],
                      ["Sources", String(check.sources.length)],
                      ["Certificates", String(HELD.length)],
                    ].map(([k, v], i) => (
                      <div key={k} className={cn("flex flex-col gap-1 px-3 py-3", i > 0 && "border-l border-line")}>
                        <span className="text-xs text-ink-3">{k}</span>
                        <span className="text-lg font-medium tabular-nums text-ink">{v}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-ink-3">{"Overview · the record's own figures, each from the register that filed it."}</p>
                </div>
              )}
            </section>
          </div>
        </Window>
      )}
    </Demo>
  );
}
