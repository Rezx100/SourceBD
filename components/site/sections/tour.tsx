"use client";

// The tour (the founder's videos of 22 Oct 2026, after mercury.com's): what a buyer does, listed on the left, the real
// app doing it on the right (the home page's opening draws the list beside its own app, opening.tsx). It never holds
// the scroll. An item opens when it is clicked, or when the one before it has played to its end; an item with no
// recording holds for twice `motion.featureMs`. The split sections draw their lists with the same `Disclosure`.
//
// Since the founder's recording of 22 Oct 13:17 ("the sections must be animated, like this one" of mercury.com) an item
// opens with motion: its line grows from nothing to its height while its words rise in, and the one closing folds the
// same way (`Disclosure`). A closed item's words are inert and hidden from assistive technology; the server draws the
// first item open, so the list reads complete with no script.

import { useCallback, useEffect, useState, type ReactNode, type RefObject } from "react";
import { stillPreferred, useInView } from "@/components/site/motion";
import { motion } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import type { ScreenName } from "./browser";
import type { IconName } from "./icons";
import { TextLink, ring } from "./ui";

export type TourItem = { key: string; icon: IconName; title: string; body: string; href: string; screen?: ScreenName };

export const TOUR: readonly TourItem[] = [
  { key: "find", icon: "search", title: "Supplier search", body: "Search every verified garment supplier in Bangladesh by product, certificate or district.", href: "/product/search", screen: "find" },
  { key: "check", icon: "receipt", title: "Records you can check", body: "Open a supplier beside your results: certificates, inspections, exports and buyers, each with its source.", href: "/product/records", screen: "check" },
  { key: "ask", icon: "send", title: "RFQs and quotes", body: "Shortlist the ones you like and send one RFQ to up to 50 of them. Quotes come back side by side.", href: "/product/rfqs", screen: "ask" },
  { key: "watch", icon: "bell", title: "Compliance alerts", body: "We keep checking certificates and forced-labour lists across your saved suppliers and tell you what changed.", href: "/product/compliance", screen: "watch" },
];

/**
 * An item's words under its title: a grid row that grows from 0 to its content's height (320 ms) while the words rise
 * in, and folds back the same way. Closed, it is inert and hidden from assistive technology; reduced motion cuts.
 */
export function Disclosure({ id, open, className, children }: { id: string; open: boolean; className?: string; children: ReactNode }) {
  return (
    <div id={id} inert={!open} aria-hidden={!open} className={cn("grid transition-[grid-template-rows] duration-slow ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
      <div className="min-h-0 overflow-hidden">
        <div className={cn("transition-[opacity,transform] duration-slow ease-out motion-reduce:transition-none", open ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0", className)}>{children}</div>
      </div>
    </div>
  );
}

/**
 * The heading and the items, mercury.com's since the founder's walkthrough of 23 Oct 2026: a two-line headline, then
 * the items under hairlines, the open one with a dot, its rule drawn in the ink and its line under its name; one link
 * under the list (`more`), or, where a page asks (`links`, the solutions pages), each item's own way to its product
 * page. The rule over the open item fills as its recording plays (`bar`).
 */
export function TourList({ id, heading, items, active, onPick, bar, more, links = false }: { id?: string; heading: ReactNode; items: readonly TourItem[]; active: number; onPick: (i: number) => void; bar?: RefObject<HTMLSpanElement | null>; more?: readonly [string, string]; links?: boolean }) {
  return (
    <div className="flex flex-col">
      <h2 id={id} className="max-w-[440px] font-display text-xl text-ink md:text-site-lead">
        {heading}
      </h2>
      <ol className="mt-10 flex flex-col md:mt-16">
        {items.map((t, i) => {
          const on = i === active;
          return (
            <li key={t.key} className="relative border-t border-line">
              {on ? <span ref={bar} aria-hidden className="absolute -top-px left-0 h-px w-full origin-left scale-x-0 bg-ink" /> : null}
              <button
                type="button"
                aria-expanded={on}
                aria-controls={`tour-${t.key}`}
                onClick={() => onPick(i)}
                className={cn("relative flex min-h-11 w-full items-center text-left font-display text-site-item transition-colors duration-slow", ring, on ? "text-ink" : "text-ink-2 hover:text-ink")}
              >
                {on ? <span aria-hidden className="absolute -left-3.5 top-1/2 size-1 -translate-y-1/2 rounded-full bg-ink" /> : null}
                {t.title}
              </button>
              <Disclosure id={`tour-${t.key}`} open={on} className="flex flex-col items-start gap-2 pb-4">
                <p className="max-w-[432px] text-site-item text-ink-2">{t.body}</p>
                {links ? (
                  <TextLink href={t.href} className="min-h-8 font-normal text-site-item text-ink">
                    See how
                  </TextLink>
                ) : null}
              </Disclosure>
            </li>
          );
        })}
      </ol>
      {more ? (
        <TextLink href={more[1]} className="mt-4 w-fit font-display text-site-item text-ink">
          {more[0]}
        </TextLink>
      ) : null}
    </div>
  );
}

/** The tour's open item and its moving on: by the recording's end, or by time for an item with no recording while it is in view. */
export function useTour(count: number, items: readonly TourItem[], box: RefObject<Element | null>) {
  const [active, setActive] = useState(0);
  const next = useCallback(() => setActive((a) => (a + 1) % count), [count]);
  const seen = useInView(box, 0.4);
  const coded = !items[active]?.screen;
  useEffect(() => {
    if (!coded || !seen || stillPreferred()) return;
    const t = window.setTimeout(next, motion.featureMs * 2);
    return () => window.clearTimeout(t);
  }, [coded, seen, next, active]);
  return { active, setActive, next };
}
