"use client";

// The two solutions pages' pinned tours (M4, handoff-mercury-m4-onward.md §4.2): three of the home tour's items for
// a sourcing team (Find, Check, Ask) and, for a compliance team, Check, Watch and Screen, where Screen is the
// sanction vignette with a two-line body. A client file because the item lists hold components.

import { VignetteSanction } from "@/components/site/demos";
import { PinnedTour, TOUR, type TourItem } from "@/components/site/sections/tour";

const of = (key: string): TourItem => TOUR.find((t) => t.key === key)!;

const SOURCING: readonly TourItem[] = [of("find"), of("check"), of("ask")];
const COMPLIANCE: readonly TourItem[] = [
  of("check"),
  of("watch"),
  { key: "screen", icon: "shield", title: "Screen", body: "Every saved supplier is checked against the UFLPA Entity List and five more lists, each with the day it was read. A listing turns the row maroon on every surface and Send RFQ is refused.", href: "/product/compliance", Demo: VignetteSanction },
];

export function SourcingTour() {
  return <PinnedTour id="sourcing-tour" items={SOURCING} heading="Find, check, ask. One sitting." />;
}

export function ComplianceTour() {
  return <PinnedTour id="compliance-tour" items={COMPLIANCE} heading="Check, watch, screen. Every fact dated." />;
}
