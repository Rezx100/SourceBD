// The one record the film follows (handoff-home-film §1): Mondol Fabrics Ltd., read from production on 3 Oct
// 2026, as the Pane draws it: each row names its source, so its one-colour mark can be drawn beside the fact.
// `components/site/home.tsx` builds the old card's rows from these same facts for the page without the film.

import type { RecordRow } from "@/components/site/film/pane";

export const NAME = "Mondol Fabrics Ltd.";
export const LINE = "Factory · Gazipur";

export const SOURCES: RecordRow = { label: "Sources", value: "5 sources", marks: ["EPB", "RSC", "BGMEA", "BKMEA", "GOTS"], mono: "EPB 2798 · RSC 10861 · BGMEA 4002 · BKMEA 1004-B/2006 · GOTS-19020" };
export const BGMEA: RecordRow = { label: "BGMEA membership", value: "General member · reg. no. 4002", from: "From BGMEA · checked 24 Jul 2026", marks: ["BGMEA"] };
export const GOTS: RecordRow = { label: "GOTS certificate", value: "GOTS-19020 · valid until 15 Dec 2026", from: "GSCS International Ltd. · checked 26 Jun 2026", marks: ["GOTS"] };
export const SAFETY: RecordRow = { label: "Safety inspections", value: "Covered by RSC · factory 10861", from: "100% of initial items fixed · checked 24 Jul 2026", marks: ["RSC"] };

/** Each source, the number it files the factory under and the day we read it: chapter 02's list, in both the film and the page without it. */
export const SOURCE_DATES: readonly [source: string, filed: string][] = [
  ["BGMEA", "reg. no. 4002 · 24 Jul 2026"],
  ["EPB", "exporter 2798 · 14 Aug 2026"],
  ["BKMEA", "1004-B/2006 · 2 Aug 2026"],
  ["GOTS", "GOTS-19020 · 26 Jun 2026"],
  ["RSC", "factory 10861 · 24 Jul 2026"],
];
