// /product/compliance in the home page's design (the founder, 25 Oct 2026): the words of `PAGES["product/compliance"]`,
// the head on the night ground with the expiry watch recorded in the app's dark theme, home's grid of four on the warm
// ground (each a fresh walk through the light app, `clips.ts`), the lists we check with their entries and last full read
// from the site's live facts (`listCells`, the methodology table's words: the page prints no date of its own, critique
// 22 Oct, S12), home's guide tiles and home's close.

import { CLIPS } from "@/components/site/clips";
import { HomeMain } from "@/components/site/home-main";
import { PAGES } from "@/components/site/pages";
import { Clip } from "@/components/site/sections/browser";
import { CardGrid, type GridCard } from "@/components/site/sections/card-grid";
import { CloseActions, Finale, Guides } from "@/components/site/sections/close";
import { Band, PageHead, tabular } from "@/components/site/sections/inner";
import { TIERS } from "@/components/site/sources";
import { listCells, listsRead } from "@/components/site/trust";
import type { SiteFacts } from "@/lib/site-facts";

export const COMPLIANCE_KEY = "product/compliance";
const P = PAGES[COMPLIANCE_KEY]!;
const C = CLIPS.compliance;
const row = (n: string) => P.blocks.find((b) => b.n === n)!;
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

/** The lists we screen against, who keeps them and, when they were read, each one's entries and the day of its last full read. */
function ListsTable({ facts, now }: { facts: SiteFacts; now: number }) {
  const read = listsRead(facts);
  return (
    <div tabIndex={0} role="region" aria-label="The lists we check, scrolls sideways" className={tabular}>
      <table>
        <caption className="sr-only">The lists we check, who keeps them{read ? ", how many entries and when we last read them" : ""}</caption>
        <thead>
          <tr>
            <th scope="col">List</th>
            <th scope="col">Kept by</th>
            {read ? (
              <>
                <th scope="col" className="text-right">Entries</th>
                <th scope="col">Last read</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {LISTS.map((l) => {
            const cells = read ? listCells(facts.sources?.find((s) => s.code === l.code) ?? null, now) : null;
            return (
              <tr key={l.code}>
                <th scope="row">{l.name}</th>
                <td>{l.by}</td>
                {cells ? (
                  <>
                    <td className="text-right tabular-nums text-ink">{cells.entries}</td>
                    <td>{cells.read}</td>
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

export function CompliancePage({ facts, now = Date.now() }: { facts: SiteFacts; now?: number }) {
  const [uflpa, lists, statement] = [row("02"), row(""), row("03")];
  const cards: GridCard[] = [
    { title: uflpa.headline, body: uflpa.lede, clip: C.uflpa.file, says: C.uflpa.says },
    { title: "Sanctions lists, with the day we read them.", body: "Every supplier against the US, EU and UK lists, each with the day we read it. A supplier on one is marked everywhere.", clip: C.sanctions.file, says: C.sanctions.says },
    { title: statement.headline, body: statement.lede, clip: C.statement.file, says: C.statement.says },
    { title: "The checks on every record.", body: "Open any supplier and its checks are together: safety, certificates and sanctions, each one a click deeper.", clip: C.checks.file, says: C.checks.says },
  ];
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead label={`${P.group} · ${P.name}`} title={P.h1} lede={P.lede} picture={<Clip name={C.hero.file} says={C.hero.says} />}>
        <CloseActions />
      </PageHead>
      <CardGrid id="compliance-cards" tone="warm" heading="Your saved suppliers, checked for you." cards={cards} />
      <Band id="compliance-lists" tone="day" heading={lists.headline} lede={listsRead(facts) ? lists.lede : "The lists we screen against, and who keeps them. The product shows the day each list was last read."}>
        <ListsTable facts={facts} now={now} />
      </Band>
      <Guides />
      <Finale heading={P.close} />
    </HomeMain>
  );
}
