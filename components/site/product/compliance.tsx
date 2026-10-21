// /product/compliance (M4, handoff-mercury-m4-onward.md §4.2): the words of `PAGES["product/compliance"]`, pinned by
// `pages.test.ts`, in the home page's frame. The hero's screenshot is now the Watch demo on the cotton stage (the
// saved suppliers checked against the UFLPA Entity List, the certificates grouped by when they end); the four
// moments follow as on the home; the needs-attention row plays the expiry vignette, the UFLPA row keeps its 3 Oct
// screen, the lists table reads its figures and dates from the site's live facts, the statement keeps its words; then
// the other three products and the close on the night ground. No sanctions row: the page's words hold none.

import { DemoCompliance, VignetteExpiry } from "@/components/site/demos";
import { TIERS } from "@/components/site/sources";
import { ToneShift } from "@/components/site/motion";
import { Figure, PAGES } from "@/components/site/pages";
import { Closing } from "@/components/site/sections/closing";
import { CrossSell } from "@/components/site/sections/cross-sell";
import { FeatureRow, HeroActions, HeroCentered, Section } from "@/components/site/sections/ui";
import { readDay, withCommas, type SiteFacts } from "@/lib/site-facts";
import { VignetteGrid } from "@/components/site/sections/vignettes";

export const COMPLIANCE_KEY = "product/compliance";
const P = PAGES[COMPLIANCE_KEY]!;
const row = (n: string) => P.blocks.find((b) => b.n === n)!;
const label = (b: { label: string }) => b.label;

/** The page's names for the six lists (longer than the methodology table's), each with its source code in the live facts. */
const LIST_NAMES: Record<string, string> = {
  UFLPA: "UFLPA Entity List",
  OFAC: "Specially Designated Nationals (SDN) list",
  UK_OFSI: "Consolidated list of financial sanctions targets",
  EU_SANC: "EU sanctions map",
  US_WRO: "Withhold Release Orders and Findings",
  ILAB: "List of Goods Produced by Child Labor or Forced Labor",
};
const LISTS = (TIERS.find((t) => t.key === "tier5_regulatory")?.sources ?? []).map((s) => ({ code: s.code, name: LIST_NAMES[s.code] ?? s.name, by: s.full }));

/**
 * The lists we screen against, who keeps them and, from the site's live facts, each one's entries and the day of its
 * last full read: the page prints no date of its own (critique 22 Oct, S12). A list with entries and no full read
 * says so; with no facts read, only the names and keepers are drawn.
 */
function ListsTable({ facts }: { facts: SiteFacts }) {
  const read = facts.sources !== null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="sr-only">The lists we check, who keeps them{read ? ", how many entries and when we last read them in full" : ""}</caption>
        <thead>
          <tr className="border-b border-ink text-sm text-ink-3">
            <th scope="col" className="py-2 pr-4 font-medium">List</th>
            <th scope="col" className="py-2 pr-4 font-medium">Kept by</th>
            {read ? (
              <>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Entries</th>
                <th scope="col" className="py-2 font-medium">Last full read</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {LISTS.map((l) => {
            const f = facts.sources?.find((s) => s.code === l.code);
            return (
              <tr key={l.code} className="align-top text-md">
                <th scope="row" className="py-3 pr-4 font-semibold text-ink">{l.name}</th>
                <td className="py-3 pr-4 text-ink-2">{l.by}</td>
                {read ? (
                  <>
                    <td className="py-3 pr-4 text-right tabular-nums text-ink">{f && f.records > 0 ? withCommas(f.records) : <span className="text-ink-3">Not read yet</span>}</td>
                    <td className="py-3 text-ink-2">{f?.latest ? readDay(f.latest) : f && f.records > 0 ? "Read in part, no full read yet" : "Not read yet"}</td>
                  </>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CompliancePage({ facts }: { facts: SiteFacts }) {
  const [attention, uflpa, lists, statement] = [row("01"), row("02"), row(""), row("03")];
  return (
    <ToneShift id={null} initial="paper" className="font-sans text-ink-strong antialiased">
      <div data-tone="paper">
        <HeroCentered
          label={`${P.group} · ${P.name}`}
          title={P.h1}
          lede={P.lede}
          stage={<DemoCompliance stage="hero-cotton" eager />}
        >
          <HeroActions center />
        </HeroCentered>

        <VignetteGrid />

        <FeatureRow
          label={label(attention)}
          headline={attention.headline}
          lede={attention.lede}
          tone="subtle"
          media={<VignetteExpiry stage="weave" />}
        />
        {uflpa.shot ? <FeatureRow label={label(uflpa)} headline={uflpa.headline} lede={uflpa.lede} flip media={<Figure shot={uflpa.shot} still="weave" sizes="(min-width: 1440px) 720px, 100vw" />} /> : null}
        <Section label={label(lists)} headline={lists.headline} lede={facts.sources !== null ? lists.lede : "The lists we screen against, and who keeps them. The product shows the day each list was last read."} tone="subtle">
          <ListsTable facts={facts} />
        </Section>
        <Section label={label(statement)} headline={statement.headline} lede={statement.lede} />
      </div>

      <div data-tone="dark">
        <CrossSell current={`/${COMPLIANCE_KEY}`} />
        <Closing headline={P.close} lede="Free during beta. No card needed." />
      </div>
    </ToneShift>
  );
}
