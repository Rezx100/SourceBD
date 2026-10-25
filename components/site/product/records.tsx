// /product/records in the home page's design (the founder, 25 Oct 2026): the words of `PAGES["product/records"]`, the
// head on the night ground with a record recorded in the app's dark theme, home's grid of four on the warm ground (each
// a fresh walk through the light app, `clips.ts`), the four certificate states and the locked contact as home's cards
// on the day ground, and home's close.

import { CLIPS } from "@/components/site/clips";
import { HomeMain } from "@/components/site/home-main";
import { PAGES } from "@/components/site/pages";
import { Clip } from "@/components/site/sections/browser";
import { CardGrid, type GridCard } from "@/components/site/sections/card-grid";
import { CloseActions, Finale } from "@/components/site/sections/close";
import { FactCards, PageHead, type Fact } from "@/components/site/sections/inner";

export const RECORDS_KEY = "product/records";
const P = PAGES[RECORDS_KEY]!;
const C = CLIPS.records;
const row = (n: string) => P.blocks.find((b) => b.n === n)!;

/** The four states a certificate can be in, each with its date. A certificate is never called "active". */
export const STATES: Fact[] = [
  { title: "Expired", body: "With the date it ended. Expired comes first." },
  { title: "Expires in N days", body: "With the date it ends." },
  { title: "Valid until", body: "With the date." },
  { title: "Listed as valid", body: "When the body publishes no date." },
];

export function RecordsPage() {
  const [sources, certificates, safety, contacts] = [row("01"), row("02"), row("04"), row("05")];
  const cards: GridCard[] = [
    { title: sources.headline, body: sources.lede, clip: C.sources.file, says: C.sources.says },
    { title: "Every certificate, checked with its issuer.", body: "Soonest expiry first, each with its number, and the ones no longer current set apart.", clip: C.certificates.file, says: C.certificates.says },
    { title: "What it makes, as filed.", body: "The goods a supplier ships, by HS code, beside what it filed with its register.", clip: C.products.file, says: C.products.says },
    { title: "Every building it works from.", body: "Its office and factory pinned on the map, and its extension buildings, each with its workers.", clip: C.sites.file, says: C.sites.says },
  ];
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead label={`${P.group} · ${P.name}`} title={P.h1} lede={P.lede} picture={<Clip name={C.hero.file} says={C.hero.says} />}>
        <CloseActions />
      </PageHead>
      <CardGrid id="records-cards" tone="warm" heading="Everything on a record has a receipt." cards={cards} />
      <FactCards id="records-states" tone="day" heading={certificates.headline} lede="We never call a certificate “active”." items={STATES} cols={2} />
      <FactCards
        id="records-more"
        tone="day"
        heading="And what a record will not do."
        items={[
          { title: safety.headline, body: safety.lede },
          { title: contacts.headline, body: contacts.lede },
          { title: "No score on any supplier.", body: "We show what the registers say and when we read them. You decide what it means." },
        ]}
      />
      <Finale heading={P.close} />
    </HomeMain>
  );
}
