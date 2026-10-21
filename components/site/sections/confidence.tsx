"use client";

// 12 · Buy with confidence (Paper `1FLE-0` / `1FSG-0`): the night ground, four tabs, one panel at a time with the
// product beside it, on the night material (critique 22 Oct: the 3 Oct screenshots are gone). Sanctions plays the
// UFLPA checks with the site's sanctioned example, "Example Apparel Ltd", turning maroon (captioned as an example: no
// real company is ever shown as sanctioned); UFLPA the checks alone; Locked contacts the record at its Contact
// section. Your data has no product picture that is true of it, so it stands in words. The other three say what
// the Security and Compliance pages say (`components/site/trust.tsx`, `pages.tsx`). Every panel is in the page
// (inactive ones `hidden`), so the words read with no script; arrow keys move between tabs (WAI-ARIA tabs,
// automatic activation).

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { DemoCompliance, DemoRecord } from "@/components/site/demos";
import { cn } from "@/lib/utils";
import { HomeIcon, type IconName } from "./icons";
import { measure } from "./ui";

type Panel = { tab: string; title: string; body: string; points?: [IconName, string][]; demo: ReactNode };

export const PANELS: Panel[] = [
  {
    tab: "Sanctions",
    title: "A sanctioned supplier is marked on every surface.",
    body: "The record carries a maroon warning on the list, in the pane and on the full page, and Send RFQ is refused. The record stays readable, so your due diligence can still see what the lists hold and when we read them.",
    points: [
      ["listcheck", "UFLPA: every saved supplier is checked against the US DHS Entity List; entries added since our last read are said to be unchecked."],
      ["lock", "Contacts stay locked until the supplier or a register provides them. Locked is a state, not a blur."],
      ["shield", "Your data: UK GDPR for buyer accounts, a DPA on request, ICO registration pending."],
    ],
    demo: <DemoCompliance view="screen" stage="night" />,
  },
  {
    tab: "UFLPA list checks",
    title: "Every saved supplier, checked against the UFLPA Entity List.",
    body: "We check supplier names against the US DHS Entity List and give one of three answers: on the list, possible Xinjiang link, no link found. “No link found” is not a clearance, and entries added since our last read are said to be unchecked.",
    demo: <DemoCompliance view="uflpa" stage="night" />,
  },
  {
    tab: "Locked contacts",
    title: "Contacts stay locked until they are given.",
    body: "Contact details stay locked until the supplier or a register provides them. Locked is a state, not a blur. Send an RFQ and the supplier replies in Messages, under the RFQ it answers.",
    demo: <DemoRecord tab="contact" stage="night" />,
  },
  {
    tab: "Your data",
    title: "Your account, under UK GDPR.",
    body: "We follow UK GDPR for buyer accounts. The database runs on Supabase in AWS us-west-1, every page loads over HTTPS, and access is checked on the server for every request. A data processing agreement is on request; our UK ICO registration is pending.",
    demo: null,
  },
];

export function Confidence() {
  const [on, setOn] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const to = e.key === "ArrowRight" ? (i + 1) % PANELS.length : e.key === "ArrowLeft" ? (i - 1 + PANELS.length) % PANELS.length : e.key === "Home" ? 0 : e.key === "End" ? PANELS.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    setOn(to);
    tabs.current[to]?.focus();
  };
  return (
    <section data-ground="night" aria-labelledby="home-confidence" className="bg-surface py-14 text-ink md:py-section">
      <div className={cn(measure, "flex flex-col items-center gap-8 md:gap-12")}>
        <h2 id="home-confidence" className="text-center text-site-h1-sm font-light text-ink md:text-site-h2">
          Buy with confidence.
        </h2>
        <div role="tablist" aria-label="Buy with confidence" className="flex w-full gap-1 overflow-x-auto border-b border-line">
          {PANELS.map((p, i) => (
            <button
              key={p.tab}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`confidence-tab-${i}`}
              aria-selected={on === i}
              aria-controls={`confidence-panel-${i}`}
              tabIndex={on === i ? 0 : -1}
              onClick={() => setOn(i)}
              onKeyDown={(e) => move(e, i)}
              className={cn("flex min-h-11 shrink-0 flex-col justify-end gap-3 px-4 pt-2 text-site-body font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:text-md", on === i ? "text-ink" : "text-ink-2 hover:text-ink")}
            >
              {p.tab}
              <span aria-hidden className={cn("h-0.5 rounded-sm", on === i ? "bg-ink" : "bg-transparent")} />
            </button>
          ))}
        </div>
        {PANELS.map((p, i) => (
          <div
            key={p.tab}
            role="tabpanel"
            id={`confidence-panel-${i}`}
            aria-labelledby={`confidence-tab-${i}`}
            hidden={on !== i}
            className="w-full animate-fade motion-reduce:animate-none"
          >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16">
              <div className={cn("flex flex-col gap-5", p.demo ? "lg:w-[480px] lg:shrink-0" : "lg:max-w-[720px]")}>
                <h3 className="text-xl text-ink md:text-site-h2-sm">{p.title}</h3>
                <p className="text-md text-ink-2 md:text-site-lede">{p.body}</p>
                {p.points ? (
                  <ul className="flex flex-col gap-2.5 border-t border-line pt-2">
                    {p.points.map(([icon, t]) => (
                      <li key={icon} className="flex gap-3 pt-2.5">
                        <HomeIcon name={icon} size={20} className="text-ink" />
                        <span className="text-base text-ink-2">{t}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {p.demo ? <div className="min-w-0 flex-1">{p.demo}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
