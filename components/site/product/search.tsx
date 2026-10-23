// /product/search (M4, handoff-mercury-m4-onward.md §4.2): the words of `PAGES["product/search"]`, pinned by
// `pages.test.ts`, in the home page's frame. The hero plays the Find demo on the cotton stage with the live count under
// it; the six filters the page's own words name sit in a grid; the filters row draws the filter pane, the record row
// plays Check beside the results, the results row shows three of the table's rows (critique 22 Oct: no 3 Oct
// screenshot); then, on the night ground, one search narrowed twice in three stacked steps and the other three
// products; the FAQ's four answers about search; the close.

import { DemoFilters, DemoRecord, DemoSearch } from "@/components/site/demos";
import { SearchFirst } from "@/components/site/demos/search";
import { PageMain } from "@/components/site/motion";
import { PAGES } from "@/components/site/pages";
import { Closing } from "@/components/site/sections/closing";
import { CrossSell } from "@/components/site/sections/cross-sell";
import { FAQ_ITEMS } from "@/components/site/sections/faq-items";
import { Faq } from "@/components/site/sections/faq";
import { HairlineGrid, type GridItem } from "@/components/site/sections/hairline-grid";
import { FeatureRow, H2, HeroActions, HeroCentered, Lede, Section, Stage, measure } from "@/components/site/sections/ui";
import { readDay, withCommas, type SiteFacts } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { SearchSteps } from "./search-slides";

export const SEARCH_KEY = "product/search";
const P = PAGES[SEARCH_KEY]!;
const row = (n: string) => P.blocks.find((b) => b.n === n)!;

/** The six filters the page's own words name (row 01): nothing here the product does not have. */
const FILTERS: GridItem[] = [
  { title: "Product or HS code", body: "A word from the products a supplier files, or the heading it exports under." },
  { title: "Certificate and its state", body: "GOTS, WRAP, OEKO-TEX and the rest, held today or lapsed, each with its date." },
  { title: "District", body: "Dhaka, Gazipur, Narayanganj, Chattogram: where the factory stands." },
  { title: "Workers", body: "From a minimum to a maximum, the figure the supplier filed with its register." },
  { title: "Brand supplier lists", body: "Named on a brand's published supplier list, as the brand filed it." },
  { title: "BGMEA or BKMEA member", body: "Listed by the trade body as a member, with the day its register was read." },
];

export function SearchPage({ facts }: { facts: SiteFacts }) {
  const count = facts.suppliers !== null ? withCommas(facts.suppliers) : null;
  const updated = readDay(facts.latestRead);
  const h1 = count ? P.h1.replace("{n}", count) : P.h1Plain;
  const [filters, records, results] = [row("01"), row("02"), row("03")];
  return (
    <PageMain id={null} className="font-sans text-ink-strong antialiased">
      <div data-tone="paper">
        <HeroCentered
          label={`${P.group} · ${P.name}`}
          title={h1}
          lede={P.lede}
          stage={
            <DemoSearch
              stage="swatches"
              eager
              after={
                count ? (
                  <p className="text-sm text-ink-subtle">
                    {count} published suppliers{updated ? ` · updated ${updated}` : ""}
                  </p>
                ) : null
              }
            />
          }
        >
          <HeroActions center search />
        </HeroCentered>

        <HairlineGrid id="search-filters" title="Six ways to narrow." lede="Each filter says how many suppliers you will get before you apply it." items={FILTERS} tone="subtle" />
        <FeatureRow label={filters.label} headline={filters.headline} lede={filters.lede} media={<DemoFilters stage="rail" />} />
        <FeatureRow
          label={records.label}
          headline={records.headline}
          lede={records.lede}
          flip
          tone="subtle"
          media={<DemoRecord stage="rail" />}
        />
        {/* The rows at the table's own width, so every column the words name is drawn. */}
        <Section label={results.label} headline={results.headline} lede={results.lede}>
          <Stage still="rail">
            <SearchFirst />
          </Stage>
        </Section>
      </div>

      <div data-tone="dark">
        <section aria-labelledby="search-common" className={cn(measure, "flex flex-col gap-10 py-14 md:gap-14 md:py-section")}>
          <div className="flex flex-col gap-4">
            <H2 id="search-common">One search, narrowed twice.</H2>
            <Lede>The words first, then a district, then a size. Each chip keeps the rows that answer it; the count and the pages follow.</Lede>
          </div>
          <SearchSteps />
        </section>
        <CrossSell current={`/${SEARCH_KEY}`} />
      </div>

      <div data-tone="paper">
        {/* Four of the home's answers: where the facts come from, paid placement, freshness, buying houses (the scoring answer names what we never do, which the no-score guard reads as a claim). */}
        <Faq id="search-faq" title="Questions about search." items={FAQ_ITEMS(facts).filter((i) => /facts come from|pay|fresh|buying houses/.test(i.q))} />
      </div>

      <div data-tone="dark">
        <Closing headline={P.close} lede="Free during beta. No card needed." />
      </div>
    </PageMain>
  );
}
