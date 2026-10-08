// The one record the film follows (handoff-home-film §1): Mondol Fabrics Ltd., read from production on 3 Oct
// 2026. Each fact names its source, so its one-colour mark can be drawn beside it. The film shows these facts as the
// product shows them (the record's own rows); `components/site/home.tsx` builds the page-without-the-film's card
// from the same facts.

export type Fact = {
  label: string;
  value: string;
  /** "From BGMEA · checked 24 Jul 2026". */
  from?: string;
  /** The numbers each source files it under, in mono. */
  mono?: string;
  /** The sources the fact comes from: their marks are drawn, in this order. */
  marks?: string[];
  /** A fact to watch: its value turns amber when its day comes. */
  watch?: boolean;
};

export const NAME = "Mondol Fabrics Ltd.";
export const LINE = "Factory · Gazipur";
export const LINE_FULL = "Factory · Kashimpur, Gazipur";

export const SOURCES: Fact = { label: "Sources", value: "5 sources", marks: ["EPB", "RSC", "BGMEA", "BKMEA", "GOTS"], mono: "EPB 2798 · RSC 10861 · BGMEA 4002 · BKMEA 1004-B/2006 · GOTS-19020" };
export const BGMEA: Fact = { label: "BGMEA membership", value: "General member · reg. no. 4002", from: "From BGMEA · checked 24 Jul 2026", marks: ["BGMEA"] };
export const GOTS: Fact = { label: "GOTS certificate", value: "GOTS-19020 · valid until 15 Dec 2026", from: "GSCS International Ltd. · checked 26 Jun 2026", marks: ["GOTS"] };
export const SAFETY: Fact = { label: "Safety inspections", value: "Covered by RSC · factory 10861", from: "100% of initial items fixed · checked 24 Jul 2026", marks: ["RSC"] };

/** Each source, the number it files the factory under and the day we read it: chapter 02's list, in both the film and the page without it. */
export const SOURCE_DATES: readonly [source: string, filed: string][] = [
  ["BGMEA", "reg. no. 4002 · 24 Jul 2026"],
  ["EPB", "exporter 2798 · 14 Aug 2026"],
  ["BKMEA", "1004-B/2006 · 2 Aug 2026"],
  ["GOTS", "GOTS-19020 · 26 Jun 2026"],
  ["RSC", "factory 10861 · 24 Jul 2026"],
];

/** The site comes from the registers' address: an area, not a building. */
export const SITE: Fact = { label: "Site", value: "Nayapara, Kashimpur, Gazipur", from: "Factory · approximate location", marks: ["BGMEA", "BKMEA"] };
export const EXPORTS: Fact = { label: "Export records", value: "Coming in v2" };
/** The same certificate, now the one to watch. */
export const GOTS_DUE: Fact = { ...GOTS, value: "GOTS-19020 · expires 15 Dec 2026", watch: true };
export const UFLPA: Fact = { label: "UFLPA Entity List", value: "No link found", from: "US DHS · our copy from 14 May 2026" };
export const RFQ: Fact = { label: "RFQ", value: "Waiting for a quote", from: "Sent 3 Oct 2026" };
