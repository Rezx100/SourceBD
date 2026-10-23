"use client";

// The two solutions pages' tours (M4; since the founder's videos of 22 Oct 2026 an ordinary section that never holds
// the scroll): three of the home tour's items for a sourcing team (Find, Check, Ask) and, for a compliance team,
// Check, Watch and Screen, where Screen plays the UFLPA checks on the saved suppliers with the site's sanctioned example
// among them, its one row turning maroon. A client file because the item lists hold components.

import { DemoCompliance } from "@/components/site/demos";
import type { Frame } from "@/components/site/demos/stage";
import { TOUR, Tour, type TourItem } from "@/components/site/sections/tour";

function Screen(frame: Frame) {
  return <DemoCompliance view="screen" {...frame} />;
}

/** A home tour item under the short name these pages' headings use ("Find, check, ask"); the home names them in full. */
const of = (key: string, title: string): TourItem => ({ ...TOUR.find((t) => t.key === key)!, title });

const SOURCING: readonly TourItem[] = [of("find", "Find"), of("check", "Check"), of("ask", "Ask")];
const COMPLIANCE: readonly TourItem[] = [
  of("check", "Check"),
  of("watch", "Watch"),
  { key: "screen", icon: "shield", title: "Screen", body: "Every saved supplier is checked against the UFLPA Entity List and five more lists. A listing turns the row maroon everywhere and Send RFQ is refused.", href: "/product/compliance", Demo: Screen },
];

export function SourcingTour() {
  return <Tour id="sourcing-tour" items={SOURCING} heading="Find, check, ask. One sitting." />;
}

export function ComplianceTour() {
  return <Tour id="compliance-tour" items={COMPLIANCE} heading="Check, watch, screen. Every fact dated." />;
}
