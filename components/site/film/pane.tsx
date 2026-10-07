// The Pane (handoff-home-film §3.3): the surface the home film puts its search and its staged screens on. Two
// materials: `glass` where something live sits behind it (the planet), `solid` where the ground is plain. The
// materials are tokens (`paneMaterial`), drawn by `.pane` in app/ds.css; glass falls back to solid where a backdrop
// cannot be blurred and on the film's lite and still tiers. The record card, the notes, the alert and the callouts
// that floated beside the scenes are gone (founder's video, 7 Oct 2026: "these cards need to be killed"). Server
// components.

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from "react";
import { buttonClass } from "@/components/kit/button-class";
import { cn } from "@/lib/utils";

export type PaneMaterial = "glass" | "solid";

type PaneProps<T extends ElementType> = { as?: T; material?: PaneMaterial; size?: "md" | "sm"; className?: string; children?: ReactNode } & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/** `md` is the pane (radius 20, 16 on a phone; padding 24). `sm` is a field-sized one. */
export function Pane<T extends ElementType = "div">({ as, material = "solid", size = "md", className, children, ...rest }: PaneProps<T>) {
  const As: ElementType = as ?? "div";
  return (
    <As className={cn("pane", material === "glass" && "pane-glass", size === "md" ? "rounded-pane p-6 max-sm:rounded-pane-phone max-sm:p-4" : "rounded-lg px-3 py-2", className)} {...rest}>
      {children}
    </As>
  );
}

/**
 * The search, as the hero and the close draw it: it runs on public Discover, as every marketing search does. The
 * button is the kit's primary button, the nav's own (founder's video: "the buttons are recreated"). The pane wears
 * the field's focus ring, since the field itself has no outline.
 */
export function SearchField({ id, placeholder = "Supplier, product or certificate", material = "solid", className }: { id: string; placeholder?: string; material?: PaneMaterial; className?: string }) {
  return (
    <Pane as="form" action="/discover" method="get" role="search" material={material} size="sm" className={cn("flex h-[60px] w-full max-w-[560px] items-center gap-3 rounded-pane-phone py-0 pl-4 pr-2 has-[input:focus-visible]:outline has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus", className)}>
      <MagnifyingGlass size={20} className="shrink-0 text-ink-3" aria-hidden />
      <label htmlFor={id} className="sr-only">
        Search suppliers, products or certificates
      </label>
      <input id={id} name="q" type="search" autoComplete="off" placeholder={placeholder} className="h-11 min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-3" />
      <button type="submit" className={buttonClass({ kind: "primary", size: "lg", className: "h-11 px-5" })}>
        Search
      </button>
    </Pane>
  );
}

/**
 * Real screens, staged (§3.8): behind them an atmosphere, on it one `Screen` per step, under it the caption. On the
 * full tier the screens sit on one another and the step's own shows (`.stage-screen` in app/ds.css); on the other
 * tiers they stand in a column. The app has no dark theme, so the screens are light in both themes.
 */
export function ScreenStage({ atmosphere, caption, children, className, ...rest }: { atmosphere?: ReactNode; caption: string; children: ReactNode; className?: string } & Record<`data-${string}`, string>) {
  return (
    <figure className={cn("flex flex-col gap-3", className)} {...rest}>
      <div className="relative isolate overflow-hidden rounded-pane bg-sunken px-10 py-12 [perspective:1800px] max-sm:rounded-pane-phone max-sm:px-4 max-sm:py-6">
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
 * One window on the stage: a real screen in a pane with no chrome. `on`: the step shown first on the full tier (the
 * engine moves it). `cursor`: where the drawn cursor arrives and presses, as a share of the screen's width and
 * height (`--cursor`, written on its parts). With nothing written the cursor rests on the button, pressed.
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
