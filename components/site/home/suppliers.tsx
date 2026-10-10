// 15 · For suppliers (Paper `1FXA-0` / `1G0M-0`): the cutting table, the copy panel and the three steps to a claimed
// record. Claiming is free; the claim is checked against the registers before the record changes hands.

import { ButtonLink } from "@/components/kit";
import { cn } from "@/lib/utils";
import { HomeIcon, type IconName } from "./icons";
import { Still, TextLink, measure } from "./ui";

export const STEPS: [IconName, string, string][] = [
  ["search", "Find your company", "Search by name, BGMEA number or EPB number. Buildings and units are listed under their mother company."],
  ["receipt", "Ask to claim it", "A short form; an admin checks the request against the registers before the record is yours."],
  ["send", "Correct it and answer RFQs", "Fix your details, add products, and reply to buyers in Messages at no cost."],
];

export function ForSuppliers() {
  return (
    <section aria-labelledby="home-suppliers" className={cn(measure, "pb-14 md:pb-[120px]")}>
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-pane-phone p-4 md:rounded-[24px] md:p-16 lg:flex-row lg:items-center lg:gap-16">
        <Still name="cutting-table" />
        <div className="relative flex flex-col gap-5 rounded-[16px] border border-ink-strong/10 bg-surface/90 p-6 md:p-8 lg:w-[480px] lg:shrink-0">
          <p className="text-[15px] font-medium leading-[18px] text-ink-subtle">For suppliers</p>
          <h2 id="home-suppliers" className="text-[32px] font-light leading-[38px] tracking-[-0.03em] text-ink-strong md:text-[44px] md:leading-[52px]">
            Your record is already here.
          </h2>
          <p className="text-[16px] leading-6 text-ink-muted md:text-[17px] md:leading-[27px]">
            Bangladesh factories and buying houses are listed from the registers already. Claim your record, correct it and answer RFQs, at no cost.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <ButtonLink href="/suppliers" prefetch={false} kind="primary" size="lg" className="h-11 rounded-[10px] px-5 text-[15px]">
              Claim your record
            </ButtonLink>
            <TextLink href="/suppliers" className="px-4">
              How claiming works
            </TextLink>
          </div>
        </div>
        <ol className="relative flex flex-col rounded-[16px] border border-ink-strong/10 bg-surface/90 px-6 py-2 md:px-7 lg:w-[560px]">
          {STEPS.map(([icon, title, body], i) => (
            <li key={title} className={cn("flex gap-4 py-5", i > 0 && "border-t border-line-subtle")}>
              <HomeIcon name={icon} className="text-ink-strong" />
              <div className="flex flex-col gap-1">
                <h3 className="text-[17px] font-medium leading-[22px] text-ink-strong">
                  {i + 1} · {title}
                </h3>
                <p className="text-[15px] leading-[22px] text-ink-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
