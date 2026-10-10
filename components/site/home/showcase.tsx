// 7 · Showcase (Paper `Z12-0` / `Z6A-0`): three rows that alternate copy and screen, then rows 4 and 5 side by side.
// On a phone every row is the screen first, then its words. Each screen is the app as shipped (b4b85e8).

import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { H2, Screen, Still, TextLink, measure, type ScreenName, type StillName } from "./ui";

type Row = { title: string; body: string; link: [string, string]; screen: ScreenName; phone?: ScreenName; alt: string; still: StillName; at: string };

export const ROWS: Row[] = [
  {
    title: "Shortlist. Ask once. Compare.",
    body: "Save the suppliers you like. Send one RFQ and each gets its own copy. Quotes return side by side, with the record a click away.",
    link: ["How RFQs work", "/product/rfqs"],
    screen: "saved-selected",
    alt: "Saved suppliers with three picked and Send one RFQ ready",
    still: "hero-cotton",
    at: "object-left-bottom",
  },
  {
    title: "Quotes beside the facts.",
    body: "Unit price, lead time and minimum order, each quote against the supplier's own record. Accept one and the order starts from there.",
    link: ["See a quote comparison", "/product/rfqs"],
    screen: "rfq-detail",
    alt: "An RFQ for men's cotton trousers with two quotes side by side",
    still: "thread-cones",
    at: "object-[50%_78%]",
  },
  {
    title: "The list changes. We check again.",
    body: "Expiring certificates, register changes and the UFLPA Entity List, checked against your saved suppliers. We say what we found, never “clear”.",
    link: ["Inside the Compliance hub", "/product/compliance"],
    screen: "compliance",
    alt: "The Compliance hub: certificates that need attention, UFLPA checks and expiry dates",
    still: "weave",
    at: "object-center",
  },
];

export const HALVES: Row[] = [
  {
    title: "Search, and never lose your place.",
    body: "Open a record beside the results. The list keeps its filters, its ticks and its page; the record carries its own tabs, and the arrow keys walk the list while the pane follows.",
    link: ["See the record pane", "/product/records"],
    screen: "record",
    phone: "results",
    alt: "Search results with Aboni Knitwear Ltd's record open in the pane beside them",
    still: "thread-cone",
    at: "object-center",
  },
  {
    title: "Every message beside its RFQ.",
    body: "A supplier's reply lands in Messages under the RFQ it answers: the date it was sent, the quantity, the ship-by date and the state of the quote on one line above the thread.",
    link: ["How messages work", "/product/rfqs"],
    screen: "messages-thread",
    alt: "A message thread with a supplier under the RFQ it answers",
    still: "carton",
    at: "object-[50%_40%]",
  },
];

function Stage({ row, wide, delay = 0 }: { row: Row; wide: boolean; delay?: number }) {
  // The screen rises 16 px and fades in once as its row scrolls in.
  return (
    <Reveal className={cn("relative isolate flex items-center justify-center overflow-hidden rounded-pane-phone px-4 py-6 md:rounded-pane", wide ? "md:p-12 lg:h-[560px]" : "md:p-8 lg:h-[420px]")}>
      <Still name={row.still} className={row.at} sizes={wide ? "(min-width: 1440px) 816px, 100vw" : "(min-width: 1440px) 608px, 100vw"} />
      <Screen name={row.screen} phone={row.phone} alt={row.alt} sizes={wide ? "(min-width: 1440px) 720px, 90vw" : "(min-width: 1440px) 544px, 90vw"} className={cn("mx-auto transition duration-reveal ease-out motion-reduce:transition-none max-md:max-w-[318px] group-data-[reveal=wait]/reveal:translate-y-4 group-data-[reveal=wait]/reveal:opacity-0", delay ? "delay-[120ms]" : "", wide ? "max-w-[720px]" : "max-w-[544px]")} />
    </Reveal>
  );
}

function Copy({ row, half }: { row: Row; half: boolean }) {
  return (
    <div className={cn("flex flex-col", half ? "gap-2.5 md:px-1" : "gap-4")}>
      <h3 className={cn("text-[20px] leading-[30px] tracking-[-0.02em] text-ink-strong", half ? "md:text-[24px]" : "md:text-[30px] md:leading-[38px]")}>{row.title}</h3>
      <p className={cn("text-[15px] leading-[23px] text-ink-muted", half ? "md:text-[16px] md:leading-6" : "md:text-[17px] md:leading-[27px]")}>{row.body}</p>
      <div className={half ? "pt-1" : "pt-2"}>
        <TextLink href={row.link[1]}>{row.link[0]}</TextLink>
      </div>
    </div>
  );
}

export function Showcase() {
  return (
    <section aria-labelledby="home-showcase" className="bg-brand-wash py-14 md:py-[120px]">
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
              <Stage row={row} wide />
            </div>
          </div>
        ))}
        <div className="grid w-full gap-14 lg:grid-cols-2 lg:gap-16">
          {HALVES.map((row, i) => (
            <div key={row.title} className="flex flex-col gap-5 md:gap-6">
              <Stage row={row} wide={false} delay={i} />
              <Copy row={row} half />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
