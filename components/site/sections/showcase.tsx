// 7 · Showcase (Paper `Z12-0` / `Z6A-0`): three rows that alternate copy and the product, then rows 4 and 5 side by
// side. On a phone every row is the product first, then its words. Each picture is a demo on the snapshot's real
// records, on the weave every feature row stands on (critique 22 Oct, S2 and S3: the 3 Oct screenshots are gone):
// one RFQ reviewed before it goes, the quotes landing side by side, the certificates that end soon, the record's
// safety beside the results, and a reply under the RFQ it answers.

import type { ComponentType } from "react";
import { DemoCompliance, DemoQuotes, DemoRecord, DemoReview, DemoThread } from "@/components/site/demos";
import type { Frame } from "@/components/site/demos/stage";
import { cn } from "@/lib/utils";
import { H2, TextLink, measure } from "./ui";

type Row = { title: string; body: string; link: [string, string]; Demo: ComponentType<Frame> };

const Expiry = (f: Frame) => <DemoCompliance view="expiry" {...f} />;
const Safety = (f: Frame) => <DemoRecord tab="safety" {...f} />;

export const ROWS: Row[] = [
  {
    title: "Shortlist. Ask once. Compare.",
    body: "Save the suppliers you like. Send one RFQ and each gets its own copy. Quotes return side by side, with the record a click away.",
    link: ["How RFQs work", "/product/rfqs"],
    Demo: DemoReview,
  },
  {
    title: "Quotes beside the facts.",
    body: "Unit price, lead time and minimum order, each quote against the supplier's own record. Accept one and the order starts from there.",
    link: ["See a quote comparison", "/product/rfqs"],
    Demo: DemoQuotes,
  },
  {
    title: "The list changes. We check again.",
    body: "Expiring certificates, register changes and the UFLPA Entity List, checked against your saved suppliers. We say what we found, never “clear”.",
    link: ["Inside the Compliance hub", "/product/compliance"],
    Demo: Expiry,
  },
];

export const HALVES: Row[] = [
  {
    title: "Search, and never lose your place.",
    body: "Open a record beside the results. The list keeps its filters, its ticks and its page; the record carries its own tabs, and the arrow keys walk the list while the pane follows.",
    link: ["See the record pane", "/product/records"],
    Demo: Safety,
  },
  {
    title: "Every message beside its RFQ.",
    body: "A supplier's reply lands in Messages under the RFQ it answers: the date it was sent, the quantity, the ship-by date and the state of the quote on one line above the thread.",
    link: ["How messages work", "/product/rfqs"],
    Demo: DemoThread,
  },
];

function Copy({ row, half }: { row: Row; half: boolean }) {
  return (
    <div className={cn("flex flex-col", half ? "gap-2.5 md:px-1" : "gap-4")}>
      <h3 className={cn("text-site-title text-ink-strong", half ? "md:text-xl" : "md:text-site-h2-sm")}>{row.title}</h3>
      <p className={cn("text-site-body text-ink-muted", half ? "md:text-md" : "md:text-site-lede")}>{row.body}</p>
      <div className={half ? "pt-1" : "pt-2"}>
        <TextLink href={row.link[1]}>{row.link[0]}</TextLink>
      </div>
    </div>
  );
}

export function Showcase() {
  return (
    <section aria-labelledby="home-showcase" className="bg-surface py-14 md:py-section">
      <div className={cn(measure, "flex flex-col items-center gap-14 md:gap-24")}>
        <H2 id="home-showcase" className="text-center">
          Vetting used to be a chase.
          <br className="max-md:hidden" /> Now it is a record.
        </H2>
        {ROWS.map((row, i) => (
          <div key={row.title} className={cn("flex w-full flex-col-reverse gap-5 lg:items-center lg:justify-between lg:gap-[72px]", i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row")}>
            <div className="lg:w-[392px] lg:shrink-0">
              <Copy row={row} half={false} />
            </div>
            <div className="min-w-0 lg:max-w-[816px] lg:flex-1">
              <row.Demo stage="weave" />
            </div>
          </div>
        ))}
        <div className="grid w-full gap-14 lg:grid-cols-2 lg:gap-16">
          {HALVES.map((row) => (
            <div key={row.title} className="flex flex-col gap-5 md:gap-6">
              <row.Demo stage="weave" />
              <Copy row={row} half />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
