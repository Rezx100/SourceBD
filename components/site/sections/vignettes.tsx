"use client";

// The home's four moments (since the founder's videos of 22 Oct 2026, a grid of four after mercury.com's): the search
// as it is typed, playing, and three still parts of a real record that answer a buyer's first questions: how big, who
// vouches for it, and whether it is on a forced-labour list. In the place the looping vignettes held.

import { Cut, LiveCut } from "./browser";
import { FeatureGrid, type Feature } from "./features";

export const VIGNETTES_TITLE = "Four moments from a day's sourcing.";

export const MOMENTS: readonly Feature[] = [
  { title: "Search the way you think", body: "A product, a certificate or a district. Suggestions arrive as you type.", picture: <LiveCut name="find" box={[236, 70, 1188, 400]} /> },
  { title: "Size them up in one look", body: "Export value, shipments, buyers and the biggest market, from two years of customs records.", picture: <Cut name="exports" /> },
  { title: "Every membership, from its register", body: "EPB, BGMEA, BKMEA and BGAPMEA numbers, each read from the body that holds it.", picture: <Cut name="memberships" /> },
  { title: "Forced-labour lists, checked", body: "Every saved supplier against the UFLPA Entity List. We say what we found, never “clear”.", picture: <Cut name="uflpa" className="mx-auto max-w-[340px]" /> },
];

export function VignetteGrid() {
  return <FeatureGrid id="home-vignettes" heading={VIGNETTES_TITLE} items={MOMENTS} />;
}
