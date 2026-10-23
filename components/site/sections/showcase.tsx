"use client";

// 7 · Showcase (the founder's videos of 22 Oct 2026, after mercury.com's "Everything you do with money" list): four
// things the record does for a buyer, one open at a time, each a part of the real app at reading size, composed in
// code from a capture of the admin account (PROVENANCE.md). None of them is shown anywhere else on the page.

import { FeatureTour, type Feature } from "./features";

export const ROWS: readonly Feature[] = [
  {
    title: "Filter the way you buy.",
    body: "Tick the certificate you need and the list narrows to the suppliers that hold it, the count changing as you tick.",
    link: ["How search works", "/product/search"],
    clip: "filters",
    says: "The search's Certificates menu: GOTS is ticked and 10,048 suppliers narrow to the 587 holding a valid GOTS certificate, then it is unticked.",
  },
  {
    title: "See who they already make for.",
    body: "Every record names the brands a factory ships to, from the brands' own supplier lists and from customs records.",
    link: ["Inside a record", "/product/records"],
    clip: "buyers",
    says: "Aboni Knitwear's buyers: ASOS, H&M and NEXT from the brands' own supplier lists, Inditex, NEW Yorker, Outerstuff, Style Revolution and Tesco from customs records.",
  },
  {
    title: "Know where their goods go.",
    body: "Customs records by market, then the latest shipments, each with its date, its goods, its buyer and its value.",
    link: ["Inside a record", "/product/records"],
    clip: "shipments",
    says: "Aboni Knitwear's exports by market, 62% of their value to the European Union, then its latest customs shipments, each with its date, goods, buyer and value.",
  },
  {
    title: "Every certificate, with its dates.",
    body: "Each certificate's number, its certifier and the day it lapses, read from the body that issued it. An expired one says so.",
    link: ["Inside the Compliance hub", "/product/compliance"],
    clip: "certificates",
    says: "Aboni Knitwear's four current certificates, OEKO-TEX, two GOTS and WRAP, each with its number, its issuer and its date, and a GOTS that ended on 4 Apr 2026.",
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
