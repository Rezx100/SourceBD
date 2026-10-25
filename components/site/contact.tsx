// Book a demo (B9e; Paper `30 Marketing · Contact sales`): what we can cover, beside the form that emails the founder.
// In the home page's design since 25 Oct 2026: the head on the day ground, then on the warm ground what we can cover
// as home's cards beside the form in a sunken panel.

import { ContactForm } from "@/components/site/contact-form";
import { HomeMain } from "@/components/site/home-main";
import { Band, FactList, PageHead } from "@/components/site/sections/inner";

export const CONTACT_META = { path: "/contact", title: "Book a demo — SourceBD", description: "Book a demo or ask a question. Your message goes to the founder by email: a walk through search and records, your compliance checks, or Enterprise terms." };

const COVER: [string, string][] = [
  ["A walk through search and records", "On your own product and HS codes, with real suppliers."],
  ["Your compliance checks", "Certificates, safety inspections and the UFLPA Entity List, source by source."],
  ["Enterprise terms", "Invoicing and a data processing agreement."],
];

export function Contact() {
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead tone="day" label="Book a demo" title="Book a demo or ask a question." lede="Tell us what you buy. Your message goes to the founder by email." />
      <Band id="cover" tone="warm" heading="What we can cover">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
          <FactList items={COVER.map(([title, body]) => ({ title, body }))} cols={1} />
          <div className="flex flex-col gap-6 rounded-frame bg-sunken p-6 md:p-8">
            <h2 className="font-display text-site-lead text-ink">Your message</h2>
            <ContactForm />
          </div>
        </div>
      </Band>
    </HomeMain>
  );
}
