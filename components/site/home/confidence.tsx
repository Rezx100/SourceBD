"use client";

// 12 · Buy with confidence (Paper `1FLE-0` / `1FSG-0`): the night ground, four tabs, one panel at a time with its
// screen. Sanctions is the board's panel; the other three say what the Security and Compliance pages say
// (`components/site/trust.tsx`, `pages.tsx`). The sanctioned screen's company is the placeholder "Example Apparel
// Ltd": no real company is ever shown as sanctioned. Every panel is in the page (inactive ones `hidden`), so the
// words read with no script; arrow keys move between tabs (WAI-ARIA tabs, automatic activation).

import { useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { HomeIcon, type IconName } from "./icons";
import { Screen, Still, measure, type ScreenName } from "./ui";

type Panel = { tab: string; title: string; body: string; points?: [IconName, string][]; screen: ScreenName; alt: string };

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
    screen: "record-sanctioned",
    alt: "A placeholder supplier, Example Apparel Ltd, marked sanctioned in maroon, with Send RFQ refused",
  },
  {
    tab: "UFLPA list checks",
    title: "Every saved supplier, checked against the UFLPA Entity List.",
    body: "We check supplier names against the US DHS Entity List and give one of three answers: on the list, possible Xinjiang link, no link found. “No link found” is not a clearance, and entries added since our last read are said to be unchecked.",
    screen: "compliance",
    alt: "The Compliance hub with the UFLPA checks on saved suppliers and the day the list was read",
  },
  {
    tab: "Locked contacts",
    title: "Contacts stay locked until they are given.",
    body: "Contact details stay locked until the supplier or a register provides them. Locked is a state, not a blur. Send an RFQ and the supplier replies in Messages, under the RFQ it answers.",
    screen: "messages-thread",
    alt: "A supplier's reply in Messages under the RFQ it answers",
  },
  {
    tab: "Your data",
    title: "Your account, under UK GDPR.",
    body: "We follow UK GDPR for buyer accounts. The database runs on Supabase in AWS us-west-1, every page loads over HTTPS, and access is checked on the server for every request. A data processing agreement is on request; our UK ICO registration is pending.",
    screen: "settings-members",
    alt: "Settings in the app: the account, its plan and the team's members and roles",
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
    <section data-ground="night" aria-labelledby="home-confidence" className="bg-surface py-14 text-ink md:py-[120px]">
      <div className={cn(measure, "flex flex-col items-center gap-8 md:gap-12")}>
        <h2 id="home-confidence" className="text-center text-[34px] font-light leading-[40px] tracking-[-0.03em] text-ink md:text-[48px] md:leading-[56px]">
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
              className={cn("flex min-h-11 shrink-0 flex-col justify-end gap-3 px-4 pt-2 text-[15px] font-medium leading-5 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:text-[16px]", on === i ? "text-ink" : "text-ink-2 hover:text-ink")}
            >
              {p.tab}
              <span aria-hidden className={cn("h-0.5 rounded-sm", on === i ? "bg-brand" : "bg-transparent")} />
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
              <div className="flex flex-col gap-5 lg:w-[480px] lg:shrink-0">
                <h3 className="text-[24px] leading-[30px] tracking-[-0.02em] text-ink md:text-[30px] md:leading-[38px]">{p.title}</h3>
                <p className="text-[16px] leading-6 text-ink-2 md:text-[17px] md:leading-[27px]">{p.body}</p>
                {p.points ? (
                  <ul className="flex flex-col gap-2.5 border-t border-line pt-2">
                    {p.points.map(([icon, t]) => (
                      <li key={icon} className="flex gap-3 pt-2.5">
                        <HomeIcon name={icon} size={20} className="text-ink" />
                        <span className="text-[14px] leading-5 text-ink-2">{t}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="relative isolate flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-pane-phone px-4 py-6 md:rounded-pane md:p-8 lg:h-[500px]">
                <Still name="night-eyelet" sizes="(min-width: 1440px) 736px, 100vw" />
                <Screen name={p.screen} alt={p.alt} sizes="(min-width: 1440px) 672px, 90vw" className="mx-auto max-w-[672px] max-md:max-w-[318px]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
