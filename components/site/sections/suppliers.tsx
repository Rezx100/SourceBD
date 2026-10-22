// 15 · For suppliers: the factory floor before the shift (the founder's video of 22 Oct 2026: the cloth behind it
// meant nothing), the copy panel and the three steps to a claimed record. Claiming is free: an email at the company's
// own domain approves it when the link is opened, any other address goes to a person
// (`supabase/migrations/0032_supplier_claims.sql`, `claim_initiate`).

import { ButtonLink } from "@/components/kit";
import { cn } from "@/lib/utils";
import { HomeIcon, type IconName } from "./icons";
import { Reveal } from "./reveal";
import { Still, TextLink, measure } from "./ui";

export const STEPS: [IconName, string, string][] = [
  ["search", "Find your company", "Search by name, BGMEA number or EPB number."],
  ["receipt", "Ask to claim it", "Give an email at your company. If its domain matches the company's, opening our link approves the claim; if not, a person reviews it."],
  ["send", "Keep it current and answer RFQs", "Update your profile, quote on buyers' RFQs and reply in Messages, at no cost."],
];

export function ForSuppliers() {
  return (
    <section aria-labelledby="home-suppliers" className={cn(measure, "pb-16 md:pb-section")}>
      <div className="relative isolate flex flex-col gap-4 overflow-hidden rounded-card p-4 md:rounded-stage md:p-14 lg:flex-row lg:items-stretch lg:gap-6">
        <Still name="mill" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ink/35 to-transparent" />
        <div className="relative flex flex-col justify-center gap-5 rounded-card bg-surface p-7 shadow-window md:p-10 lg:w-[480px] lg:shrink-0">
          <p className="text-site-body font-medium text-ink-subtle">For suppliers</p>
          <h2 id="home-suppliers" className="text-site-h2-sm font-light text-ink-strong md:text-site-h2">
            Your record is already here.
          </h2>
          <p className="text-md text-ink-muted md:text-site-lede">Bangladesh factories and buying houses are listed from the registers already. Claim yours and answer RFQs from buyers, at no cost.</p>
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <ButtonLink href="/signup?role=supplier" prefetch={false} kind="primary" size="lg" className="h-11 rounded-frame px-5 text-site-body">
              Claim your record
            </ButtonLink>
            <TextLink href="/suppliers" className="px-4">
              How claiming works
            </TextLink>
          </div>
        </div>
        {/* The three steps reveal one after another, 120 ms apart. */}
        <Reveal as="ol" className="relative flex flex-col justify-center rounded-card bg-surface/95 px-7 py-3 shadow-window md:px-9 lg:ml-auto lg:w-[480px]">
          {STEPS.map(([icon, title, body], i) => (
            <li key={title} style={{ transitionDelay: `${i * 120}ms` }} className={cn("flex gap-4 py-5 transition duration-slow motion-reduce:transition-none group-data-[reveal=wait]/reveal:translate-y-2 group-data-[reveal=wait]/reveal:opacity-0", i > 0 && "border-t border-line-subtle")}>
              <HomeIcon name={icon} className="text-ink-strong" />
              <div className="flex flex-col gap-1">
                <h3 className="text-site-title font-medium text-ink-strong">{title}</h3>
                <p className="text-site-body text-ink-muted">{body}</p>
              </div>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
