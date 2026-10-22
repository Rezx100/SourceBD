"use client";

// The home's four moments (the founder's videos of 22 Oct 2026, a grid of four after mercury.com's): four parts of one
// real record that answer a buyer's first questions (how big, who vouches for it, is it safe, where does each fact
// come from), each animated in code from a capture of the admin account and filling its card (PROVENANCE.md).

import { FeatureGrid, type Feature } from "./features";

export const VIGNETTES_TITLE = "Four moments from a day's sourcing.";

export const MOMENTS: readonly Feature[] = [
  {
    title: "Size them up in one look",
    body: "Factory types, workforce, women and men, sewing machines and capacity, each from the register that filed it.",
    clip: "keyfacts",
    says: "Aboni Knitwear's key facts: dyeing, knit, packaging and woven; 3,314 workers, 1,558 women and 1,756 men; 850 sewing machines; 1,000,000 pieces a month.",
  },
  {
    title: "Every membership, from its register",
    body: "EPB, BGMEA, BKMEA and BGAPMEA numbers, each read from the body that holds it.",
    clip: "memberships",
    says: "Aboni Knitwear's memberships: EPB BD04293, BGAPMEA 597, BGMEA General 3498 and BKMEA 625 - B/2002, each with the day it was read.",
  },
  {
    title: "Safety, as RSC found it",
    body: "RSC inspections, how much of each remediation plan is fixed, and the inspection reports to open.",
    clip: "safety",
    says: "Aboni Knitwear's two buildings in the RSC programme: 100% of safety issues fixed, the initial plan completed, worker safety training completed, and the fire, structural, electrical and boiler reports.",
  },
  {
    title: "Every source, in trust order",
    body: "The government register first, then RSC, the industry bodies, the certifiers, the brands' own lists and customs records.",
    clip: "sources",
    says: "Aboni Knitwear's eleven sources in trust order: EPB; RSC; BGAPMEA, BGMEA and BKMEA; GOTS, OEKO-TEX and WRAP; ASOS, H&M and NEXT's lists; Bangladesh customs exports.",
  },
];

export function VignetteGrid() {
  return <FeatureGrid id="home-vignettes" heading={VIGNETTES_TITLE} items={MOMENTS} />;
}
