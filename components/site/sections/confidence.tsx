// 12 · Buy with confidence (the founder's videos of 22 Oct 2026: no tabs that shift the layout, and in video 3 the
// container, loupe and padlock photographs "look irrelevant"). The night ground under a photograph of a northern
// European port, then three cards, each one panel of the real app, cut from a capture and held still (his recording of
// 22 Oct 13:17: "you don't have to animate this section, just use static images", a glass edge, no dark shadow, the
// page round the panel hidden): a record's sanctions lists with the day each was read (no supplier on the site is
// sanctioned today, so no sanctioned record exists to show), the UFLPA checks across the saved list, a record's contact
// details locked. The data line closes the section. The words are what the Security and Compliance pages say
// (`components/site/trust.tsx`, `pages.tsx`).

import { cn } from "@/lib/utils";
import { AppStill } from "./browser";
import { HomeIcon } from "./icons";
import { Still, TextLink, measure } from "./ui";

export const CARDS: { still: string; says: string; title: string; body: string }[] = [
  { still: "sanctions", says: "A record's sanctions panel: not listed, read for every supplier, with the day each list was read: US Treasury (OFAC) 8 Oct, US Labor (ILAB) 16 Oct, European Union 6 Oct, UK (OFSI) 6 Oct.", title: "Every supplier, checked against sanctions lists.", body: "US, EU and UK lists, each with the day we read it. A supplier on one is marked maroon everywhere and Send RFQ is refused." },
  { still: "uflpa", says: "The Compliance hub's UFLPA checks on the saved list: none on the UFLPA Entity List, none with a possible Xinjiang link, no link found for 18 suppliers.", title: "Forced-labour lists, checked for you.", body: "Every saved supplier against the UFLPA Entity List. Entries added since our last read are said to be unchecked." },
  { still: "locked", says: "A public record's contact panel: the contact details are locked, with Sign up to contact.", title: "Contacts stay locked until they are given.", body: "Contact details open only when the supplier or a register provides them. Locked is a state, not a blur." },
];

export function Confidence() {
  return (
    <section data-tone="dark" aria-labelledby="home-confidence" className="py-16 md:py-section">
      <div className={cn(measure, "flex flex-col gap-6 md:gap-8")}>
        <div className="relative isolate flex aspect-[4/5] items-end overflow-hidden rounded-card sm:aspect-[16/9] md:rounded-stage lg:aspect-[21/9]">
          <Still name="port" sizes="(min-width: 1440px) 1280px, 100vw" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[rgb(var(--mk-ground-night))] via-[rgb(var(--mk-ground-night)/0.35)] to-transparent" />
          <div className="relative flex max-w-[620px] flex-col gap-4 p-6 md:p-12">
            <h2 id="home-confidence" className="text-site-h2-sm font-light text-ink md:text-site-h1">
              Buy with confidence.
            </h2>
            <p className="text-md text-ink-2 md:text-site-lede">Every shipment you place starts with a supplier you checked. These checks are done for you, on every record.</p>
          </div>
        </div>
        <ul className="grid gap-6 md:grid-cols-3 md:gap-8">
          {CARDS.map((c) => (
            <li key={c.title} className="flex flex-col overflow-hidden rounded-card bg-surface">
              <div className="relative aspect-[4/3]">
                <AppStill name={c.still} says={c.says} />
              </div>
              <div className="flex flex-col gap-2 p-6 md:p-7">
                <h3 className="text-site-title font-medium text-ink">{c.title}</h3>
                <p className="text-site-body text-ink-2">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-site-body text-ink-2">
          <HomeIcon name="shield" size={20} className="text-ink" />
          Your account is held under UK GDPR, with a data processing agreement on request.
          <TextLink href="/security" className="min-h-8 text-ink">
            How we keep it safe
          </TextLink>
        </p>
      </div>
    </section>
  );
}
