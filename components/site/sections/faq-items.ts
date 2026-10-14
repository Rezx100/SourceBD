// The six answers every home page gives (the Mercury page and the film), with the live counts where they were read.

import { readDay, type SiteFacts } from "@/lib/site-facts";

export const FAQ_ITEMS = (f: SiteFacts) => [
  {
    q: "Where do the facts come from?",
    a: `From ${f.sourcesListed ?? "our"} public sources${f.sourcesWithRecords !== null ? `, ${f.sourcesWithRecords} of them holding supplier records` : ""}: government bodies and RSC, trade bodies such as BGMEA and BKMEA, certification bodies, brand supplier lists and the UFLPA Entity List. Each fact shows its source and the date we read it.`,
  },
  { q: "Do you score or rank suppliers?", a: "No. We show what each source says and when we read it. There is no grade, rating or star on any supplier." },
  { q: "Can a supplier pay to appear higher?", a: "No. No supplier pays to rank higher or look better." },
  { q: "How fresh is each fact?", a: `Each fact shows the date we read its source.${readDay(f.latestRead) ? ` The latest register read was ${readDay(f.latestRead)}.` : ""}` },
  { q: "How do I contact a supplier?", a: "Contact details stay locked. Send an RFQ and the supplier replies in Messages." },
  { q: "Do you list buying houses too?", a: "Yes. Search can be narrowed to factories or to buying houses." },
];
