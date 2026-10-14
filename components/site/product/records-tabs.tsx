"use client";

// "Inside one record" on /product/records (M4): the record demo opened at three of its sections, one per tab. A
// client file because the tab list holds components: a value read from a client module by a server component is a
// reference, not an array (the 14 Oct trap), so the list and the tabs live on the same side.

import { DemoRecord } from "@/components/site/demos/record";
import { TabbedDemo, type DemoTab } from "@/components/site/sections/tabbed-demo";

const at = (tab: "certificates" | "sources" | "contact") =>
  function RecordAt({ className }: { className?: string }) {
    return <DemoRecord tab={tab} className={className} />;
  };

export const RECORD_TABS: readonly DemoTab[] = [
  { key: "certificates", label: "Certificates", Demo: at("certificates") },
  { key: "sources", label: "Sources", Demo: at("sources") },
  { key: "contact", label: "Contact", Demo: at("contact") },
];

export function RecordTabs() {
  return <TabbedDemo tabs={RECORD_TABS} label="Sections of the record" />;
}
