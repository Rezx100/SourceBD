// The real app's pictures on the inner pages (the founder, 25 Oct 2026: "every app picture is the current /app,
// recorded fresh"): each a walk through the signed-in app recorded by the grid kit (E:\SourceBD-marketing\grid\rec,
// `shots.py` p_* walks, cut by `cards.py`) in home's glass-clip look, encoded by scripts/home-assets.mjs into
// public/site/<page>/clip-<name>.mp4|webm|webp, one row each in public/site/home/PROVENANCE.md. A head's picture is the
// app in its dark theme on the night ground (as home's tour flows are), a card's the light app (as home's grids are).
// `says` is the sentence a screen reader gets in its place. No page plays one twice, and none plays a clip of home's
// (`components/site/rollout.test.ts`, `components/site/pages.test.ts`).

export type PageClip = { file: string; says: string };

const at = (page: string, name: string, says: string): PageClip => ({ file: `/site/${page}/clip-${name}`, says });

export const CLIPS = {
  search: {
    hero: at("search", "hero", "The search in the dark theme: denim is typed, 324 suppliers are listed, and the list is scrolled."),
    district: at("search", "district", "The search's Location menu: Gazipur is ticked and the 10,048 suppliers narrow to the 1,957 there."),
    workers: at("search", "workers", "The search's filters: Workers and founding year opens and 1000 is typed as the fewest workers."),
    brands: at("search", "brands", "The search's filters: Brand supplier lists opens and H&M is ticked, which keeps the 164 suppliers named on H&M's own list."),
    open: at("search", "open", "A search for mondol: Mondol Fabrics' row is pointed at and its record opens beside the list, the list still there."),
  },
  records: {
    hero: at("records", "hero", "Mondol Fabrics' record in the dark theme, read from the top: a factory in Gazipur, its key facts, then its EPB, BGMEA and BKMEA memberships, each with the day it was read."),
    sources: at("records", "sources", "Mondol Fabrics' five sources, highest trust first: EPB, the government register; RSC; BGMEA and BKMEA; then GOTS, the certification body."),
    certificates: at("records", "certificates", "Tex Town's three certificates, soonest expiry first, each with its listing or certificate number; below them, set apart, a GOTS licence no longer current."),
    products: at("records", "products", "Mondol Fabrics' products: the 28 product codes on its EPB exporter page, each with its HS heading, then the 13 products it filed as its own."),
    sites: at("records", "sites", "Mondol Fabrics' two sites, its office and its factory, pinned on a street map, then its one extension building with its 600 workers."),
  },
  rfqs: {
    hero: at("rfqs", "hero", "The New RFQ page in the dark theme, read from the top: up to 50 suppliers, the product, its quantity and target price, and what each supplier gets."),
    quotes: at("rfqs", "quotes", "The RFQs page before any is sent: one RFQ to up to 50 suppliers, their quotes lined up against your target price, each above or under it, an MOQ above your quantity flagged."),
    thread: at("rfqs", "thread", "The Messages page before any reply: talk to suppliers with their record beside you; send an RFQ, the replies land here, and you check them as you talk."),
    review: at("rfqs", "review", "From the saved list, Send one RFQ opens a new request with the three ticked suppliers in its To line, up to 50 allowed, nothing typed or sent."),
    contact: at("rfqs", "contact", "Mondol Fabrics' contact panel: the details are locked; send an RFQ and the supplier replies in Messages."),
  },
  compliance: {
    hero: at("compliance", "hero", "Certificate expiry across the saved suppliers in the dark theme: two expired, four within 30 days, four in 31 to 90 days, each with its ask for a renewal; then the expired two alone."),
    uflpa: at("compliance", "uflpa", "The UFLPA checks on the 18 saved suppliers: none on the UFLPA Entity List, none with a possible Xinjiang link, no link found for 18, entries added since the last read said to be unchecked; then the suppliers, A to Z."),
    sanctions: at("compliance", "sanctions", "Modele De Capital's sanctions panel: not listed, and each list it was checked against, US Treasury (OFAC), US Labor (ILAB), the European Union and UK (OFSI), with the day it was last read."),
    statement: at("compliance", "statement", "The modern slavery statement drafted from the 18 saved suppliers under section 54 of the UK Modern Slavery Act: each section's claims to confirm counted, each marked Confirm in the draft, ten to confirm before it can be downloaded."),
    checks: at("compliance", "checks", "Tex Town's checks: one building behind on its RSC repairs at 91% of issues fixed, three certificates on file with none expiring, and not listed on any sanctions list."),
  },
} as const;

/** The suppliers page's head: a record as buyers see it, the records page's own take. */
export const SUPPLIER_CLIP: PageClip = CLIPS.records.hero;

/** Every clip file an inner page may play: none of home's (`clip-*` and `app-*` under /site/home). */
export const PAGE_CLIP_FILES: readonly string[] = Object.values(CLIPS).flatMap((p) => Object.values(p).map((c) => c.file));
