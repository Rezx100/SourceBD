"use client";

// Check (handoff-mercury-motion-sitewide.md §4.3): the cursor opens Aboni Knitwear beside the list, the record pane
// slides in, a section's tab is chosen, and its rows arrive. At Certificates (the home tour's Check): the
// certificates held today, soonest expiry first, then the one that ended, each with the day its register was read.
// At Sources (M4, the records page's tabs): every register that lists the record, in trust order, with its full name
// and the day it was read. At Contact: the locked card, as a reader the database has not entitled sees it; the
// snapshot holds no contact value, so nothing here could show one. At Safety (critique 22 Oct: the records page's
// safety row, a 3 Oct screenshot until now): each RSC row of the record, its status, the share of issues fixed, the
// training and the day the register was read, and the reports the register published. The pane is drawn as the
// record draws it (Paper page 37: name, type and place, the section tabs, the Certificates table's columns), from the
// snapshot. Its source count is the product's: the registers and certifiers that hold it, brand lists apart.

import { Factory, LockSimple, MapPin } from "@phosphor-icons/react";
import { Fragment, useLayoutEffect, useRef } from "react";
import { Unpublished } from "@/components/kit";
import { SourceMark, TIER_LABEL, tierOf } from "@/components/patterns";
import { ABSENT, certShort } from "@/components/patterns/words";
import { SECTIONS } from "@/components/record/desktop-words";
import type { CursorState, Step } from "@/components/site/motion";
import { displayName, formatCount, formatDay, rscStatusWords, rscTrainingWords } from "@/lib/dashboard/facts";
import { certName } from "@/lib/dashboard/needs-attention";
import { motion } from "@/lib/design/tokens";
import { BRAND_LIST, CERT_REGISTER, SNAPSHOT, TODAY, registerCount } from "@/lib/marketing/demo-snapshot";
import { sourceFullName } from "@/lib/source-full-names";
import { cn } from "@/lib/utils";
import { Bar, Demo, Window, endOf, streamed, type Frame } from "./stage";

const { check, search } = SNAPSHOT;
const NAME = displayName(check.name);
const asRow = (r: { slug: string; name: string; type: string; place: string | null; sources: number }) => ({ slug: r.slug, name: displayName(r.name), line: [r.type, r.place].filter(Boolean).join(" · "), sources: r.sources });
// The five rows beside the pane, the record's own among them whatever page of the search it sits on.
const LIST = [...(search.rows.some((r) => r.slug === check.slug) ? [] : [asRow({ ...check, sources: registerCount(check) })]), ...search.rows.map(asRow)].slice(0, 5);
/** The record's sources as the product counts them. */
const REGISTERS = registerCount(check);
const BRANDS = check.sources.filter((s) => s.startsWith("BRAND_")).length;

/** Every company the demo names. */
export const NAMES = [NAME, ...LIST.map((r) => r.name)];

const rows = check.certs
  .map((c) => {
    // A scheme with no register in the snapshot's set shows its name alone.
    const reg = CERT_REGISTER[c.kind] ?? { mark: c.kind.toUpperCase(), code: c.kind.toUpperCase(), name: certName(c.kind, null) };
    const read = check.read[reg.code] ?? null;
    const ended = Boolean(c.expiresOn && c.expiresOn < SNAPSHOT.readAt);
    // "GOTS · read 14 Oct 2026": the register's code (its mark stands beside it) and the day it was read; the pane is too narrow for the register's full name.
    return { key: `${c.kind}-${c.number}`, mark: reg.mark, scheme: certName(c.kind, null), number: c.number, issuer: c.issuer, ended, state: ended ? `Ended ${formatDay(c.expiresOn)}` : certShort(c.expiresOn, TODAY), look: !ended && c.expiresOn !== null && certShort(c.expiresOn, TODAY).startsWith("Expires"), until: formatDay(c.expiresOn), receipt: read ? `${reg.code} · read ${formatDay(read)}` : reg.name, sort: c.expiresOn ?? "9999" };
  })
  .sort((a, b) => a.sort.localeCompare(b.sort));
const HELD = rows.filter((r) => !r.ended);
const ENDED = rows.filter((r) => r.ended);
const CERT_TAB = SECTIONS.find((s) => s.id === "certificates")!;

/** The record's sources in trust order, each with its full name and the day it was read (a brand list carries no read day in the snapshot). */
const SOURCES = [...check.sources]
  .sort((a, b) => tierOf(a) - tierOf(b))
  .map((code) => ({ code, label: BRAND_LIST[code] ?? code, name: BRAND_LIST[code] ? `${BRAND_LIST[code]} supplier list` : (sourceFullName(code) ?? code), tier: TIER_LABEL[tierOf(code)], read: formatDay(check.read[code] ?? null) }));

/** The record's RSC rows as its Safety section words them: the mother's row under the record's own name. */
const REPORT_WORDS: Record<string, string> = { fire: "Fire", structural: "Structural", electrical: "Electrical", boiler: "Boiler", cap: "Action plan" };
const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);
const SAFETY = (check.rsc ?? []).map((r, i) => ({
  key: `${r.building ?? "main"}-${i}`,
  name: r.building ? displayName(r.building) : NAME,
  status: cap(rscStatusWords(r.status)),
  fixed: r.progress,
  training: cap(rscTrainingWords(r.training)?.replace(/^training /, "") ?? null),
  read: formatDay(r.readOn),
  reports: r.reports.map((x) => REPORT_WORDS[x] ?? x),
}));

/** The sections the demo can open the record at; the tour's Check opens the certificates. */
export type RecordTab = "certificates" | "sources" | "contact" | "safety";

type S = CursorState & { open: boolean; tab: string; rows: number };

const t0 = 700;
const t1 = t0 + motion.cursorMs + motion.clickMs + 600;
const t2 = t1 + motion.cursorMs + motion.clickMs + 300;
const LAST = ENDED[0] ?? HELD[HELD.length - 1];
const COUNT: Record<RecordTab, number> = { certificates: rows.length, sources: SOURCES.length, contact: 1, safety: Math.max(1, SAFETY.length) };

/** The scene for one section: open the record, choose the tab, let its rows arrive, then rest on the last one. */
function stepsFor(tab: RecordTab): Step<S>[] {
  const n = COUNT[tab];
  const still = (over: Partial<S>): S => ({ open: true, tab, rows: n, ...over });
  const streaming = streamed(n, t2, (shown) => still({ rows: shown, cursor: `tab-${tab}` }));
  const t3 = endOf(streaming) + 600;
  return [
    { at: 0, state: still({ open: false, tab: "overview", rows: 0 }) },
    { at: t0, state: still({ open: false, tab: "overview", rows: 0, cursor: `row-${check.slug}` }) },
    { at: t0 + motion.cursorMs, state: still({ open: false, tab: "overview", rows: 0, cursor: `row-${check.slug}`, click: true }) },
    { at: t0 + motion.cursorMs + motion.clickMs, state: still({ tab: "overview", rows: 0, cursor: `row-${check.slug}` }) },
    { at: t1, state: still({ tab: "overview", rows: 0, cursor: `tab-${tab}` }) },
    { at: t1 + motion.cursorMs, state: still({ tab: "overview", rows: 0, cursor: `tab-${tab}`, click: true }) },
    ...streaming,
    ...(tab === "certificates" && LAST ? [{ at: t3, state: still({ cursor: `cert-${LAST.key}` }) }] : []),
  ];
}

export const STEPS: Step<S>[] = stepsFor("certificates");
const SCENES: Record<RecordTab, Step<S>[]> = { certificates: STEPS, sources: stepsFor("sources"), contact: stepsFor("contact"), safety: stepsFor("safety") };

const DESCRIPTION: Record<RecordTab, string> = {
  certificates: `${NAME}'s record opened beside the search results at its Certificates section: ${HELD.length} held today, ${ENDED.length} ended, each with the day its register was read.`,
  sources: `${NAME}'s record opened beside the search results at its Sources section: ${REGISTERS} registers and certifiers and ${BRANDS} brand lists in trust order, each with its full name and the day it was read.`,
  safety: `${NAME}'s record opened beside the search results at its Safety section: ${SAFETY.length} RSC ${SAFETY.length === 1 ? "record" : "records"}, each with its status, the share of safety issues fixed, the worker safety training and the day the RSC was read.`,
  contact: `${NAME}'s record opened beside the search results at its Contact section: the details are locked, the supplier replies to an RFQ in Messages, and no value is shown.`,
};

const COLS = "grid grid-cols-[minmax(0,1fr)_minmax(0,96px)_minmax(0,96px)] gap-x-3 [@container_(min-width:640px)]:grid-cols-[minmax(0,1fr)_minmax(0,120px)_minmax(0,96px)]";
const SAFETY_COLS = "grid grid-cols-[minmax(0,1fr)_minmax(0,80px)_minmax(0,88px)] gap-x-3";

/**
 * The record's section tabs. The strip clips what does not fit (a phone's pane, the tour's), so it scrolls itself to
 * the tab the cursor is heading for before the stage measures the cursor's target: a child's layout effect runs
 * before its parent's.
 */
function SectionNav({ active, toward }: { active: string; toward: string }) {
  const nav = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = nav.current;
    const tab = el?.querySelector<HTMLElement>(`[data-cursor="tab-${toward}"]`);
    if (el && tab) el.scrollLeft = Math.max(0, tab.offsetLeft - el.offsetLeft - 20);
  }, [toward]);
  return (
    <nav ref={nav} aria-label="Record sections" className="flex shrink-0 gap-2.5 overflow-hidden border-b border-line px-5">
      {SECTIONS.map((t) => {
        const on = t.id === active;
        return (
          <span key={t.id} data-cursor={`tab-${t.id}`} className={cn("flex h-10 shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium", on ? "text-ink [box-shadow:inset_0_-2px_0_theme(colors.ink)]" : "text-ink-3")}>
            {t.label}
            {t.id === CERT_TAB.id ? <span className="text-xs font-normal text-ink-3 tabular-nums">{HELD.length}</span> : null}
          </span>
        );
      })}
    </nav>
  );
}

/** The Contact section as a reader the database has not entitled sees it (components/record/desktop.tsx): locked, with no count claimed. */
export function ContactLocked({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg bg-sunken p-4", className)}>
      <LockSimple size={20} weight="thin" className="shrink-0 text-ink-2" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-md font-medium text-ink">Contact details are locked</p>
        <p className="text-base text-ink-2">Send an RFQ and the supplier replies in Messages.</p>
      </div>
    </div>
  );
}

export function DemoRecord({ tab = "certificates", ...frame }: Frame & { tab?: RecordTab }) {
  return (
    <Demo {...frame} steps={SCENES[tab]} description={DESCRIPTION[tab]}>
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
                  <span>{REGISTERS} sources</span>
                </p>
              </header>
              <SectionNav active={s.tab} toward={s.cursor?.startsWith("tab-") ? s.cursor.slice(4) : s.tab} />
              {s.tab === CERT_TAB.id ? (
                <div role="table" aria-label="Certificates" className="flex flex-col px-2 pt-3 tabular-nums">
                  <div role="row" className={cn(COLS, "h-8 border-b border-line px-3 text-xs font-medium text-ink-3")}>
                    <span role="columnheader">Certificate</span>
                    <span role="columnheader">State</span>
                    <span role="columnheader">Valid until</span>
                  </div>
                  {[...HELD, ...ENDED].slice(0, s.rows).map((c, i) => (
                    <Fragment key={c.key}>
                      {i === HELD.length ? (
                        <div role="row" className="flex h-9 items-end border-b border-line px-3 pb-1.5 text-xs font-medium text-ink-3">
                          <span role="cell">No longer current · not counted above</span>
                        </div>
                      ) : null}
                      <div role="row" data-cursor={`cert-${c.key}`} className={cn(COLS, "min-h-14 animate-swap-in items-center border-b border-line px-3 py-2 motion-reduce:animate-none", s.cursor === `cert-${c.key}` && "bg-sunken")}>
                        <span role="cell" className="flex min-w-0 items-center gap-2.5">
                          <SourceMark source={c.mark} />
                          <span className="flex min-w-0 flex-col">
                            <span className="flex min-w-0 items-baseline gap-1.5">
                              <span className="text-base font-medium text-ink">{c.scheme}</span>
                              {c.number ? <span className="truncate font-mono text-xs text-ink-3">{c.number}</span> : null}
                            </span>
                            <span className="truncate text-xs text-ink-2">{c.receipt}</span>
                          </span>
                        </span>
                        <span role="cell" className={cn("text-sm", c.look ? "font-medium text-caution" : c.ended ? "text-ink-3" : "text-ink")}>
                          {c.state}
                        </span>
                        <span role="cell" className={cn("text-sm", c.ended ? "text-ink-3" : "text-ink")}>
                          {c.until ?? <span className="text-xs text-ink-3">No end date published</span>}
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              ) : s.tab === "sources" ? (
                <div role="table" aria-label="Sources" className="flex flex-col px-2 pt-3">
                  <div role="row" className="flex h-8 items-center justify-between border-b border-line px-3 text-xs font-medium text-ink-3">
                    <span role="columnheader">Source · highest trust first</span>
                    <span role="columnheader">Last read</span>
                  </div>
                  {SOURCES.slice(0, s.rows).map((src, i) => (
                    <Fragment key={src.code}>
                      {i === 0 || SOURCES[i - 1]!.tier !== src.tier ? (
                        <div role="row" className="flex h-8 items-end px-3 pb-1 text-xs font-medium text-ink-3">
                          <span role="cell">{src.tier}</span>
                        </div>
                      ) : null}
                      <div role="row" className="flex min-h-12 animate-swap-in items-center justify-between gap-3 border-b border-line px-3 py-2 motion-reduce:animate-none">
                        <span role="cell" className="flex min-w-0 items-center gap-2.5">
                          <SourceMark source={src.code} />
                          <span className="flex min-w-0 flex-col">
                            <span className="text-base font-medium text-ink">{src.label}</span>
                            <span className="truncate text-xs text-ink-2">{src.name}</span>
                          </span>
                        </span>
                        <span role="cell" className="shrink-0 text-sm text-ink tabular-nums">
                          {src.read ?? <Unpublished>{ABSENT.dated}</Unpublished>}
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              ) : s.tab === "safety" ? (
                <div role="table" aria-label="Safety" className="flex flex-col px-2 pt-3">
                  <div role="row" className={cn(SAFETY_COLS, "h-8 border-b border-line px-3 text-xs font-medium text-ink-3")}>
                    <span role="columnheader">Building · RSC</span>
                    <span role="columnheader">Issues fixed</span>
                    <span role="columnheader">Training</span>
                  </div>
                  {SAFETY.length ? (
                    SAFETY.slice(0, s.rows).map((b) => (
                      <div key={b.key} role="row" className={cn(SAFETY_COLS, "min-h-14 animate-swap-in items-center border-b border-line px-3 py-2 motion-reduce:animate-none")}>
                        <span role="cell" className="flex min-w-0 items-center gap-2.5">
                          <SourceMark source="RSC" />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-base font-medium text-ink">{b.name}</span>
                            <span className="truncate text-xs text-ink-2">{[b.status, b.read ? `read ${b.read}` : null].filter(Boolean).join(" · ")}</span>
                          </span>
                        </span>
                        <span role="cell" className="text-sm tabular-nums text-ink">{b.fixed !== null ? `${b.fixed}%` : <Unpublished />}</span>
                        <span role="cell" className="text-sm text-ink">{b.training ?? <Unpublished />}</span>
                      </div>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-sm text-ink-3">Not in the RSC programme</p>
                  )}
                  {SAFETY[0]?.reports.length && s.rows >= SAFETY.length ? (
                    <p className="animate-swap-in px-3 pt-2.5 text-xs text-ink-3 motion-reduce:animate-none">Inspection reports on the register: {SAFETY[0].reports.join(", ")}</p>
                  ) : null}
                </div>
              ) : s.tab === "contact" ? (
                <div className="flex flex-col gap-3 px-5 pt-4">
                  <p className="text-base font-semibold text-ink">Contact</p>
                  {s.rows > 0 ? <ContactLocked className="animate-swap-in motion-reduce:animate-none" /> : null}
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
