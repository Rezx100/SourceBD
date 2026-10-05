// Contact sales (B9e; Paper `30 Marketing · Contact sales`): what we can cover, beside the form that emails the founder.

import { ContactForm } from "@/components/site/contact-form";
import { Display, Label, Lede, wrap } from "@/components/site/parts";
import { cn } from "@/lib/utils";

export const CONTACT_META = { path: "/contact", title: "Contact sales — SourceBD", description: "Book a demo or ask a question. Your message goes to the founder by email: a walk through search and records, your compliance checks, or Enterprise terms." };

const COVER: [string, string][] = [
  ["A walk through search and records", "On your own product and HS codes, with real suppliers."],
  ["Your compliance checks", "Certificates, safety inspections and the UFLPA Entity List, source by source."],
  ["Enterprise terms", "Invoicing and a data processing agreement."],
];

export function Contact() {
  return (
    <main className="font-sans text-ink">
      <section className="py-20 max-md:py-10">
        <div className={cn(wrap, "grid gap-16 lg:grid-cols-[1fr_minmax(0,520px)] max-lg:gap-10")}>
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-6">
              <Label>Company · Contact sales</Label>
              <Display level={1} as="h1">
                Talk to us.
              </Display>
              <Lede>Tell us what you buy. Your message goes to the founder by email.</Lede>
            </div>
            <div className="flex flex-col gap-4">
              <p className="font-mono text-base text-ink-3">What we can cover</p>
              <dl className="flex flex-col gap-5">
                {COVER.map(([t, b]) => (
                  <div key={t} className="flex flex-col gap-1 border-t border-ink pt-3">
                    <dt className="text-lg font-semibold text-ink">{t}</dt>
                    <dd className="text-md text-ink-2">{b}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-8 max-sm:p-5">
            <h2 className="text-xl font-semibold text-ink">Book a demo or ask a question</h2>
            <ContactForm />
          </div>
        </div>
      </section>
    </main>
  );
}
