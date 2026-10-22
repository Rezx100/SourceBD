// 15 · For suppliers: the factory floor before the shift, the copy and the three steps to a claimed record. Since the
// founder's video 3 of 22 Oct 2026 ("these images are not visible properly") the photograph shows: one translucent
// panel on its left with a scrim only behind it, the floor clear to the right, and the three steps under the
// photograph. Claiming is free: an email at the company's own domain approves it when the link is opened, any other
// address goes to a person (`supabase/migrations/0032_supplier_claims.sql`, `claim_initiate`).

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
    <section aria-labelledby="home-suppliers" className={cn(measure, "flex flex-col gap-10 pb-16 md:gap-14 md:pb-section")}>
      <div className="relative isolate flex min-h-[560px] items-end overflow-hidden rounded-card p-4 md:rounded-stage md:p-10 lg:aspect-[16/8] lg:items-center lg:p-14">
        <Still name="mill" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/45 via-ink/10 to-transparent lg:bg-gradient-to-r lg:from-ink/40 lg:via-ink/10 lg:via-35% lg:to-transparent lg:to-55%" />
        <div className="relative flex flex-col gap-5 rounded-card bg-surface/90 p-7 backdrop-blur-md md:p-9 lg:w-[440px]">
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
      </div>
      {/* The three steps reveal one after another, 120 ms apart. */}
      <Reveal as="ol" className="grid gap-8 md:grid-cols-3 md:gap-10">
        {STEPS.map(([icon, title, body], i) => (
          <li key={title} style={{ transitionDelay: `${i * 120}ms` }} className="flex gap-4 transition duration-slow motion-reduce:transition-none group-data-[reveal=wait]/reveal:translate-y-2 group-data-[reveal=wait]/reveal:opacity-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-surface text-ink-strong">
              <HomeIcon name={icon} />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-site-title font-medium text-ink-strong">
                <span className="mr-2 tabular-nums text-ink-subtle">{i + 1}</span>
                {title}
              </h3>
              <p className="text-site-body text-ink-muted">{body}</p>
            </div>
          </li>
        ))}
      </Reveal>
    </section>
  );
}
