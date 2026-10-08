// The help layer (critique of 8 Oct 2026, item 6: for three runs nothing defined RSC, a tier, "fixed"
// or a mark's "+3" on hover or focus). One map of term to one sentence, so a word is defined once and
// `Define` (components/kit/define.tsx) draws it the same everywhere: the record strip's labels, the
// Sources tab's group headings, the pending legend, the stale read, the certificate cell's "+N" and
// the bodies' names. No help page (founder, 24 Sep 2026: no Help button until a help page exists).
// Pure: a test reads every label the record draws and checks it resolves here.

export const GLOSSARY: Readonly<Record<string, string>> = {
  // The summary strip's five labels.
  Sanctions: "Whether this company or its people appear on the sanctions and watch lists SourceBD reads; \u201cNot listed\u201d is what those lists held on the day they were read.",
  Certificates: "The certificates the certification bodies list for this company, each with its own expiry date; the count is how many, the words say which need a look.",
  RSC: "The RMG Sustainability Council, the industry-led programme that inspects Bangladesh garment factories for fire, electrical and structural safety and tracks what is fixed.",
  Workers: "The number of production workers the company itself filed; where a register holds a different figure it is shown under this one, with its source.",
  Sources: "The registers, certification bodies and brand lists that filed something about this company; every fact on the record names its source.",
  // Words inside the strip and the panels.
  fixed: "The share of the safety findings from RSC inspections that the factory has closed, as RSC last recorded it.",
  "Source pending": "The record holds this fact, but the register that filed it is not linked to it yet; the dashed document marks it until the link is made.",
  "stale read": "The hourglass: SourceBD has not re-read this source for more than 90 days, so the fact stands as last read and the words say how old that read is.",
  more: "More certificates than the cell has room for; the record\u2019s Certificates tab lists every one with its date.",
  // The trust tiers, as the Sources tab groups them (`tierWords` in lib/dashboard/source-tiers.ts).
  "Government register": "A record kept by a Bangladesh government body (EPB, DIFE, RJSC, BEPZA, BIN): the most trusted source, read as filed.",
  "Industry-led programme": "RSC, the factory safety programme run by the industry; ranked with the government registers for what it inspects.",
  "Industry body": "A trade association\u2019s own member list (BGMEA, BKMEA, BGAPMEA, BTMA): trusted after the government registers.",
  "Certification body": "A body that certifies a factory to a standard (GOTS, WRAP, OEKO-TEX): trusted for its own certificates and their dates.",
  "Brand disclosure list": "A brand\u2019s published supplier list: shows who sources from this company and is cross-checked against the registers, never the only source of a fact.",
  "Foreign regulator": "A US, UK or EU regulator\u2019s list (trade enforcement, import holds): read for what it says about this company, below the Bangladesh registers.",
  "Cross-check only": "A source SourceBD uses to confirm a fact another source filed, never to add a fact on its own.",
  // The results table and the RFQ composer (critique of 8 Oct 2026, round 3, item 5).
  FOB: "Free on board: the price covers the goods loaded on the ship at the named port (Chattogram); freight and insurance from there are the buyer\u2019s.",
  // The bodies behind the marks.
  EPB: "The Export Promotion Bureau, the government\u2019s register of Bangladesh exporters and what they export.",
  BGMEA: "The Bangladesh Garment Manufacturers and Exporters Association, the woven and knit garment makers\u2019 trade body and member register.",
  BKMEA: "The Bangladesh Knitwear Manufacturers and Exporters Association, the knitwear makers\u2019 trade body and member register.",
  BGAPMEA: "The Bangladesh Garment Accessories and Packaging Manufacturers and Exporters Association, the accessories and packaging makers\u2019 trade body.",
  BTMA: "The Bangladesh Textile Mills Association, the spinning, weaving and dyeing mills\u2019 trade body and member register.",
  GOTS: "The Global Organic Textile Standard: certifies organic fibre processing from field to finished garment; each certificate carries an expiry date.",
  WRAP: "Worldwide Responsible Accredited Production: certifies a factory\u2019s social compliance and safety; Gold and Platinum are its levels.",
  "OEKO-TEX": "OEKO-TEX Standard 100: certifies that a textile product was tested for harmful substances; a label check, renewed yearly.",
};

/** The sentence for a term, or null when the glossary has none (a test keeps every drawn label covered). */
export const define = (term: string): string | null => GLOSSARY[term] ?? null;
