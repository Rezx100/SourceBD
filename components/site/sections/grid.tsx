// 11 · Platform grid (Paper `1EXN-0` / `1F9A-0`): eight things a sourcing desk needs, as a two-column hairline list
// with no icons (critique 22 Oct: the bordered grid of icon, title and line read as cheap cards), on the paper ground.

import { HairlineGrid, type GridItem } from "./hairline-grid";

export const GRID: GridItem[] = [
  { title: "Saved searches and alerts", body: "Save a search; new matches arrive by email every Monday." },
  { title: "Export CSV", body: "Download any results page or your saved list as a file." },
  { title: "HS headings and product lines", body: "Every heading we track, with the suppliers who export it." },
  { title: "Team and roles", body: "Owner, approver, editor and viewer; invites by email." },
  { title: "Expiry dates", body: "Every certificate with a date, grouped by when it lapses." },
  { title: "Modern slavery statement", body: "A section 54 draft composed from your saved suppliers, in your browser." },
  { title: "Evidence pack", body: "Certificates, UFLPA checks and sources for your saved list, in one CSV file." },
  { title: "Notifications", body: "Replies, quotes and expiry alerts by email, each one a setting." },
];

export function PlatformGrid() {
  return <HairlineGrid id="home-grid" title="Everything else a sourcing desk needs." items={GRID} center />;
}
