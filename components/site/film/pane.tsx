// The Pane (handoff-home-film §3.3): the one surface the home film puts things on, in place of every bordered
// card. Two materials: `glass` where something live sits behind it (the planet, the map, an atmosphere), `solid`
// where the ground is plain or the text is dense. The materials are tokens (`paneMaterial`), drawn by `.pane` in
// app/ds.css; glass falls back to solid where a backdrop cannot be blurred and on the film's lite and still tiers.
// Never glass on glass, and at most three glass panes on screen. Server components.

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from "react";
import { SourceMark, hasSourceMark } from "@/components/patterns/source-mark";
import { cn } from "@/lib/utils";

export type PaneMaterial = "glass" | "solid";

type PaneProps<T extends ElementType> = { as?: T; material?: PaneMaterial; size?: "md" | "sm"; sheen?: boolean; className?: string; children?: ReactNode } & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/** `md` is the pane (radius 20, 16 on a phone; padding 24). `sm` is a label-sized one: a callout, a field. */
export function Pane<T extends ElementType = "div">({ as, material = "solid", size = "md", sheen, className, children, ...rest }: PaneProps<T>) {
  const As: ElementType = as ?? "div";
  return (
    <As className={cn("pane", material === "glass" && "pane-glass", sheen && "pane-sheen", size === "md" ? "rounded-pane p-6 max-sm:rounded-pane-phone max-sm:p-4" : "rounded-lg px-3 py-2", className)} {...rest}>
      {children}
    </As>
  );
}

/** A source's approved one-colour mark (`context/logos.lock.md`), else a two-letter mono stamp. The record sits screens down the page, so its marks are fetched when they near, not with the first screen. */
function Mark({ source }: { source: string }) {
  if (hasSourceMark(source)) return <SourceMark source={source} className="rec-mark" lazy />;
  return (
    <span aria-hidden className="rec-mark flex size-6 shrink-0 items-center justify-center rounded-md border border-line font-mono text-xs text-ink-2">
      {source.slice(0, 2).toUpperCase()}
    </span>
  );
}

export type RecordRow = {
  label: string;
  value: string;
  /** "From BGMEA · checked 24 Jul 2026". */
  from?: string;
  /** The numbers each source files it under, in mono. */
  mono?: string;
  /** The source the row comes from, or every source for the "Sources" row: their marks are drawn, in this order. */
  marks?: string[];
  /** A row that arrives at its moment in a scene (engine/chapters.ts turns it on); on the full tier it is unseen until then. */
  beat?: boolean;
  /** A row to watch: its value is amber. On the full tier it turns amber only once its day comes (`data-due`, written by the engine). */
  watch?: boolean;
};

/** A value's colour: ink, or amber for a row to watch; on the full tier amber waits for the row's day (`data-due`). */
const value = (watch?: boolean) => (watch ? "text-caution transition-colors duration-slow film-full:text-ink film-full:group-data-[due]/row:text-caution" : "text-ink");

/**
 * The supplier record, the film's protagonist: it gains a row per chapter and never leaves. `arriving` names the
 * row being stitched on (a green line sweeps its top edge, its mark stamps in, its words rise, and a green dot
 * stays at its left); every other row is still. One `<dt>` per row: `home.test.ts` counts them.
 */
export function RecordPane({ name, line, rows, state, arriving, material = "solid", sheen, className }: { name: string; line: string; rows: RecordRow[]; state?: string; arriving?: string; material?: PaneMaterial; sheen?: boolean; className?: string }) {
  return (
    <Pane as="figure" material={material} sheen={sheen} aria-label={`Supplier record: ${name}`} className={cn("flex w-full max-w-[400px] flex-col gap-4", className)}>
      <div className="flex flex-col gap-1">
        <figcaption className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-ink-3">Supplier record</span>
          {state ? <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-ink">{state}</span> : null}
        </figcaption>
        <p className="text-xl font-semibold tracking-tight text-ink">{name}</p>
        <p className="text-base text-ink-3">{line}</p>
      </div>
      {rows.length ? (
        <dl className="flex flex-col">
          {rows.map((r) => {
            const many = (r.marks?.length ?? 0) > 1;
            return (
              <div key={r.label} data-row={r.label} data-beat={r.beat ? "" : undefined} data-watch={r.watch ? "" : undefined} className={cn("group/row flex gap-3 border-t border-line py-3", arriving === r.label && "rec-arrive")}>
                {r.marks?.length === 1 ? <Mark source={r.marks[0]!} /> : null}
                <div className="rec-words flex min-w-0 flex-1 flex-col gap-0.5">
                  <dt className="text-xs text-ink-3">{r.label}</dt>
                  {many ? (
                    <dd className="flex flex-wrap items-center gap-1.5 py-1">
                      {r.marks!.map((s) => (
                        <Mark key={s} source={s} />
                      ))}
                      <span className={cn("pl-1 text-base font-semibold", value(r.watch))}>{r.value}</span>
                    </dd>
                  ) : (
                    <dd className={cn("text-base font-semibold", value(r.watch))}>{r.value}</dd>
                  )}
                  {r.from ? <dd className="text-xs text-ink-3">{r.from}</dd> : null}
                  {r.mono ? (
                    <dd className="font-mono text-xs text-ink-3">
                      {/* A number never breaks inside itself: each item holds together, the line breaks at the separators. */}
                      {r.mono.split(" · ").map((item, i) => (
                        <span key={item}>
                          {i ? " · " : ""}
                          <span className="whitespace-nowrap">{item}</span>
                        </span>
                      ))}
                    </dd>
                  ) : null}
                </div>
              </div>
            );
          })}
        </dl>
      ) : null}
    </Pane>
  );
}

/** A note beside the scene: the map's honesty line, or two sources that differ (`tone="caution"`). */
export function NotePane({ eyebrow, title, children, tone = "plain", material = "solid", className }: { eyebrow: string; title?: string; children?: ReactNode; tone?: "plain" | "caution"; material?: PaneMaterial; className?: string }) {
  return (
    <Pane material={material} className={cn("flex flex-col items-start gap-1.5", className)}>
      {tone === "caution" ? <p className="rounded-sm bg-caution-tint px-2 py-0.5 text-sm font-semibold text-caution">{eyebrow}</p> : <p className="text-xs text-ink-3">{eyebrow}</p>}
      {title ? <p className="text-md font-semibold text-ink">{title}</p> : null}
      {children ? <div className="text-base text-ink-2">{children}</div> : null}
    </Pane>
  );
}

/** A certificate running out: the day, what it is, when, whose, and the next step. */
export function AlertPane({ when, title, due, subject, from, action, material = "solid", className }: { when: string; title: string; due: string; subject: string; from?: string; action?: string; material?: PaneMaterial; className?: string }) {
  return (
    <Pane material={material} className={cn("flex flex-col items-start gap-2.5", className)}>
      <p className="font-mono text-xs text-ink-3">{when}</p>
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="rounded-sm bg-caution-tint px-2 py-0.5 text-sm font-medium text-caution">{due}</p>
      <p className="text-base text-ink">{subject}</p>
      {from ? <p className="text-sm text-ink-3">{from}</p> : null}
      {/* The next step, in words: nothing here is pressed, so nothing looks pressable. */}
      {action ? <p className="mt-1 text-base font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]">{action}</p> : null}
    </Pane>
  );
}

/** The search, as a pane: it runs on public Discover, as the hero's form does today. The pane wears the field's focus ring. */
export function FieldPane({ id, placeholder = "Supplier, product or certificate", material = "solid", className }: { id: string; placeholder?: string; material?: PaneMaterial; className?: string }) {
  return (
    <Pane as="form" action="/discover" method="get" role="search" material={material} size="sm" className={cn("flex h-[60px] w-full max-w-[560px] items-center gap-3 rounded-pane-phone py-0 pl-4 pr-2 has-[input:focus-visible]:outline has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus", className)}>
      <MagnifyingGlass size={20} className="shrink-0 text-ink-3" aria-hidden />
      <label htmlFor={id} className="sr-only">
        Search suppliers, products or certificates
      </label>
      <input id={id} name="q" type="search" autoComplete="off" placeholder={placeholder} className="h-11 min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-3" />
      <button type="submit" className="h-11 shrink-0 rounded-lg bg-brand px-5 text-base font-semibold text-surface hover:bg-brand-hover active:bg-brand-active">
        Search
      </button>
    </Pane>
  );
}

/** A label on the planet or the map: the place and its count, as DOM, never as map glyphs. */
export function Callout({ place, figure, on, material = "glass", className }: { place: string; figure?: string; on?: boolean; material?: PaneMaterial; className?: string }) {
  return (
    <Pane material={material} size="sm" className={cn("inline-flex items-baseline gap-2 font-mono text-sm", on ? "text-ink" : "text-ink-3", className)}>
      <span className={cn(on && "font-semibold")}>{place}</span>
      {figure ? <span className="text-ink">{figure}</span> : null}
    </Pane>
  );
}

/**
 * Real screens, staged (§3.8): behind them an atmosphere (our own drawn backdrop, or a still), on it one `Screen`
 * per step, under it the caption. On the full tier the screens sit on one another and the step's own shows
 * (`.stage-screen` in app/ds.css); on the other tiers they stand in a column. The app has no dark theme, so the
 * screens are light in both themes and the caption says so.
 */
export function ScreenStage({ atmosphere, caption, children, className, ...rest }: { atmosphere?: ReactNode; caption: string; children: ReactNode; className?: string } & Record<`data-${string}`, string>) {
  return (
    <figure className={cn("flex flex-col gap-3", className)} {...rest}>
      <div className="relative isolate overflow-hidden rounded-pane bg-sunken px-10 py-12 [perspective:1800px] max-sm:rounded-pane-phone max-sm:px-4 max-sm:py-6">
        {/* Painted first, under the windows (each a positioned pane): the scale has no negative layer and needs none. */}
        {atmosphere ? (
          <div aria-hidden className="absolute inset-0 [&>*]:size-full [&>*]:object-cover">
            {atmosphere}
          </div>
        ) : null}
        <div className="flex flex-col gap-6 film-full:relative film-full:aspect-[1440/900]">{children}</div>
      </div>
      <figcaption className="font-mono text-xs text-ink-3">{caption}</figcaption>
    </figure>
  );
}

/**
 * One window on the stage: a real screen in a pane with no chrome, tilted a little by the scroll (`--p`, written
 * on it). `on`: the step shown first on the full tier (the engine moves it). `cursor`: where the drawn cursor
 * arrives and presses, as a share of the screen's width and height; a spotlight opens on that part as it comes
 * (`--cursor`, written on the three parts). With nothing written the cursor rests on the button, pressed.
 */
export function Screen({ on, cursor, focus, children, className }: { on?: boolean; cursor?: { x: number; y: number }; focus?: { x: number; y: number }; children: ReactNode; className?: string }) {
  const at = cursor ? ({ left: `${cursor.x}%`, top: `${cursor.y}%` } as CSSProperties) : undefined;
  return (
    <div data-screen data-on={on ? "" : undefined} className={cn("stage-screen", className)}>
      <Pane data-window className="stage-window overflow-hidden p-0 max-sm:p-0">
        {/* Under 1024px a whole screen is too small to read: the window shows the part the step is about, upright, at readable size. */}
        <div className={cn(focus && "max-lg:aspect-[3/4] max-lg:overflow-hidden max-lg:[&>img]:size-full max-lg:[&>img]:object-cover")} style={focus ? ({ "--focus": `${focus.x}% ${focus.y}%` } as CSSProperties) : undefined}>
          {children}
        </div>
        {cursor ? (
          <>
            <span data-cursor aria-hidden className="stage-spot pointer-events-none absolute inset-0 max-lg:hidden" style={{ "--sx": `${cursor.x}%`, "--sy": `${cursor.y}%` } as CSSProperties} />
            <span data-cursor aria-hidden className="stage-press pointer-events-none absolute size-10 rounded-full border-2 border-brand-ink max-lg:hidden" style={at} />
            {/* The arrow's tip (5, 3 in its box) sits on the point. */}
            <svg data-cursor aria-hidden viewBox="0 0 24 24" className="stage-cursor pointer-events-none absolute -ml-[5px] -mt-[3px] size-6 fill-ink stroke-surface max-lg:hidden" style={at}>
              <path d="M5 3l14 8-6.2 1.6L9.6 19z" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </>
        ) : null}
      </Pane>
    </div>
  );
}
