"use client";

// 7 · Showcase (since the founder's videos of 22 Oct 2026, the home's feature list after mercury.com's): four things the
// record does for a buyer, one open at a time, each shown by a part of the real app on the product panel. It replaced
// three long alternating rows and two halves that a visitor had to scroll through one by one.

import { AppVideo, BrowserFrame, Cut, LiveCut, SCREENS } from "./browser";
import { FeatureTour, type Feature } from "./features";

export const ROWS: readonly Feature[] = [
  {
    title: "Shortlist. Ask once. Compare.",
    body: "Save the suppliers you like and send one RFQ to as many as 50. Each gets its own copy, and the quotes come back side by side.",
    link: ["How RFQs work", "/product/rfqs"],
    picture: <LiveCut name="saved" box={[236, 180, 1188, 560]} />,
  },
  {
    title: "See who they already make for.",
    body: "Every record names the brands a factory ships to, from the brands' own supplier lists and from customs records.",
    link: ["Inside a record", "/product/records"],
    picture: <Cut name="buyers" />,
  },
  {
    title: "The list changes. We check again.",
    body: "Certificates that lapse and names that appear on forced-labour lists, checked across your saved suppliers.",
    link: ["Inside the Compliance hub", "/product/compliance"],
    picture: <Cut name="attention" className="mx-auto max-w-[520px]" />,
  },
  {
    title: "Never lose your place.",
    body: "Open a record beside your results. Your search, your filters and your ticks stay exactly where you left them.",
    link: ["See the record pane", "/product/records"],
    picture: (
      <BrowserFrame url={SCREENS.check.url}>
        <AppVideo name="check" />
      </BrowserFrame>
    ),
  },
];

export function Showcase() {
  return (
    <FeatureTour
      id="home-showcase"
      heading={
        <>
          Vetting used to be a chase. <span className="text-ink-subtle">Now it is a record.</span>
        </>
      }
      items={ROWS}
    />
  );
}
