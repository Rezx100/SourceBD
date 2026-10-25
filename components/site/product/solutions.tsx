// The two solutions pages in the home page's design (the founder, 25 Oct 2026): the words of `PAGES["solutions/*"]`,
// the head on the night ground with the team's first job recorded in the app's dark theme, home's grid of four on the
// warm ground, each card one of the team's jobs played by the product page's own clip (`clips.ts`, none twice on a
// page), and home's close with the team's outcome. The compliance teams' page keeps home's guide tiles.

import { CLIPS, type PageClip } from "@/components/site/clips";
import { HomeMain } from "@/components/site/home-main";
import { PAGES, type Page } from "@/components/site/pages";
import { Clip } from "@/components/site/sections/browser";
import { CardGrid } from "@/components/site/sections/card-grid";
import { CloseActions, Finale, Guides } from "@/components/site/sections/close";
import { PageHead } from "@/components/site/sections/inner";

export const SOURCING_KEY = "solutions/sourcing";
export const COMPLIANCE_TEAMS_KEY = "solutions/compliance";

/** One solutions page: its head's clip, and each row (by `n`) with the clip that shows it; a fourth card closes the grid where the page has three rows. */
function SolutionsPage({ p, slug, hero, media, extra, guides = false }: { p: Page; slug: string; hero: PageClip; media: Record<string, PageClip>; extra?: { title: string; body: string; clip: PageClip }; guides?: boolean }) {
  const cards = p.blocks.filter((b) => media[b.n]).map((b) => ({ title: b.headline, body: b.lede, clip: media[b.n]!.file, says: media[b.n]!.says }));
  if (extra) cards.push({ title: extra.title, body: extra.body, clip: extra.clip.file, says: extra.clip.says });
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead label={`${p.group} · ${p.name}`} title={p.h1} lede={p.lede} picture={<Clip name={hero.file} says={hero.says} />}>
        <CloseActions />
      </PageHead>
      <CardGrid id={`${slug}-cards`} tone="warm" heading={p.outcome ?? p.h1} cards={cards} />
      {guides ? <Guides /> : null}
      <Finale heading={p.close} />
    </HomeMain>
  );
}

export function SolutionsSourcingPage() {
  return (
    <SolutionsPage
      p={PAGES[SOURCING_KEY]!}
      slug="sourcing"
      hero={CLIPS.search.hero}
      media={{ "01": CLIPS.search.district, "02": CLIPS.records.certificates, "03": CLIPS.rfqs.review }}
      extra={{ title: "Keep every reply in one place.", body: "Suppliers answer in SourceBD, their record beside the conversation.", clip: CLIPS.rfqs.thread }}
    />
  );
}

export function SolutionsCompliancePage() {
  return (
    <SolutionsPage
      p={PAGES[COMPLIANCE_TEAMS_KEY]!}
      slug="compliance"
      hero={CLIPS.compliance.hero}
      media={{ "01": CLIPS.records.sources, "02": CLIPS.compliance.uflpa, "03": CLIPS.compliance.checks, "04": CLIPS.compliance.statement }}
      guides
    />
  );
}
