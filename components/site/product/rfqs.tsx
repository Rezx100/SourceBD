// /product/rfqs in the home page's design (the founder, 25 Oct 2026): the words of `PAGES["product/rfqs"]`, the head on
// the night ground with an RFQ recorded in the app's dark theme, home's grid of four on the warm ground (each a fresh
// walk through the light app, `clips.ts`), and home's close.

import { CLIPS } from "@/components/site/clips";
import { HomeMain } from "@/components/site/home-main";
import { PAGES } from "@/components/site/pages";
import { Clip } from "@/components/site/sections/browser";
import { CardGrid, type GridCard } from "@/components/site/sections/card-grid";
import { CloseActions, Finale } from "@/components/site/sections/close";
import { FactCards, PageHead } from "@/components/site/sections/inner";

export const RFQS_KEY = "product/rfqs";
const P = PAGES[RFQS_KEY]!;
const C = CLIPS.rfqs;
const row = (n: string) => P.blocks.find((b) => b.n === n)!;

export function RfqsPage() {
  const many = row("03");
  const cards: GridCard[] = [
    { title: many.headline, body: "Tick the suppliers you saved and write one request. Review every supplier before it goes.", clip: C.review.file, says: C.review.says },
    { title: "Quotes line up against your target.", body: "Each quote shows how far it is above or under your target, and an MOQ above your quantity is flagged.", clip: C.quotes.file, says: C.quotes.says },
    { title: "Replies in one inbox.", body: "Suppliers answer in SourceBD, their record beside the conversation.", clip: C.thread.file, says: C.thread.says },
    { title: "Ask from any record.", body: "Contact details stay locked. Send an RFQ from the record and the supplier replies in Messages.", clip: C.contact.file, says: C.contact.says },
  ];
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead label={`${P.group} · ${P.name}`} title={P.h1} lede={P.lede} picture={<Clip name={C.hero.file} says={C.hero.says} />}>
        <CloseActions />
      </PageHead>
      <CardGrid id="rfqs-cards" tone="warm" heading="Ask fifty factories in the time it takes to ask one." cards={cards} />
      <FactCards
        id="rfqs-rules"
        tone="day"
        heading="Sent with care."
        items={[
          { title: "Up to 50 suppliers per RFQ", body: "One request, one review, one send." },
          { title: "Screened before it goes", body: "A supplier on the UFLPA Entity List can’t receive an RFQ." },
          { title: "Replies stay in SourceBD", body: "Contact details are locked; suppliers answer in one thread each." },
        ]}
      />
      <Finale heading={P.close} />
    </HomeMain>
  );
}
