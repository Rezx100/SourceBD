// /product/search in the home page's design (the founder, 25 Oct 2026): the words of `PAGES["product/search"]`, the
// head on the night ground with the search as its one way in and the search recorded in the app's dark theme, home's
// grid of four on the warm ground (each a fresh walk through the light app, `clips.ts`), the six filters as home's cards
// on the day ground, and home's close.

import { CLIPS } from "@/components/site/clips";
import { HomeMain } from "@/components/site/home-main";
import { PAGES } from "@/components/site/pages";
import { Clip } from "@/components/site/sections/browser";
import { CardGrid, type GridCard } from "@/components/site/sections/card-grid";
import { Finale } from "@/components/site/sections/close";
import { FactCards, PageHead, SearchPill, type Fact } from "@/components/site/sections/inner";
import { withCommas, type SiteFacts } from "@/lib/site-facts";

export const SEARCH_KEY = "product/search";
const P = PAGES[SEARCH_KEY]!;
const C = CLIPS.search;

/** The six filters the page's own words name: nothing here the product does not have. */
const FILTERS: Fact[] = [
  { title: "Product or HS code", body: "A word from the products a supplier files, or the heading it exports under." },
  { title: "Certificate and its state", body: "GOTS, WRAP, OEKO-TEX and the rest, held today or lapsed, each with its date." },
  { title: "District", body: "Dhaka, Gazipur, Narayanganj, Chattogram: where the factory stands." },
  { title: "Workers", body: "From a minimum to a maximum, the figure the supplier filed with its register." },
  { title: "Brand supplier lists", body: "Named on a brand's published supplier list, as the brand filed it." },
  { title: "BGMEA or BKMEA member", body: "Listed by the trade body as a member, with the day its register was read." },
];

const CARDS: GridCard[] = [
  { title: "Find factories where you need them", body: "Tick a district and the list keeps the suppliers there, the count changing as you tick.", clip: C.district.file, says: C.district.says },
  { title: "Set the size you can work with", body: "Workers from a minimum to a maximum, the figure each supplier filed with its register.", clip: C.workers.file, says: C.workers.says },
  { title: "See who already makes for brands like yours", body: "Keep the suppliers a brand names on its own published supplier list.", clip: C.brands.file, says: C.brands.says },
  { title: "Open any record beside your list", body: "Check certificates, safety and sources, then move to the next row. You never lose your search.", clip: C.open.file, says: C.open.says },
];

export function SearchPage({ facts }: { facts: SiteFacts }) {
  const count = facts.suppliers !== null ? withCommas(facts.suppliers) : null;
  const h1 = count ? P.h1.replace("{n}", count) : P.h1Plain;
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead label={`${P.group} · ${P.name}`} title={h1} lede={P.lede} picture={<Clip name={C.hero.file} says={C.hero.says} />}>
        <SearchPill />
      </PageHead>
      <CardGrid id="search-cards" tone="warm" heading="Filters that match how you buy." cards={CARDS} />
      <FactCards id="search-filters" tone="day" heading="Six ways to narrow." lede="Each filter says how many suppliers you will get before you apply it." items={FILTERS} />
      <Finale heading={P.close} />
    </HomeMain>
  );
}
