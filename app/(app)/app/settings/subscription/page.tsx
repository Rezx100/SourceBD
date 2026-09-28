// Settings · Subscription (/app/settings/subscription; /app/settings/plan
// redirects here).
//
// Read-only. The current plan from `settings_get`, what each tier includes,
// and billing, which is not set up: no prices, renewal date or credits until
// it is. No tier lists contact details: no plan unlocks them (founder, 25 Sep
// 2026) — they never reach a buyer page.

import { Badge } from "@/components/dashboard/chips";
import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";
import { ErrorNote, PageSection, Page } from "@/components/dashboard/page";
import { PLAN_NOTE, planLabel, type SettingsDoc, SettingsFrame, SettingsHeader } from "@/components/dashboard/settings";
import { Caption, Title } from "@/components/dashboard/type";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TierKey = "starter" | "growth" | "enterprise";

const TIERS: { key: TierKey; features: string[] }[] = [
  {
    key: "starter",
    features: ["Discover up to 50 suppliers per month", "Saved-supplier dashboard", "Compliance (UFLPA + MSA)"],
  },
  {
    key: "growth",
    features: ["Unlimited Discover", "Find-matches wizard", "RFQs + order tracking"],
  },
  {
    key: "enterprise",
    features: ["Everything in Growth", "Team seats + role-based access", "API access + bulk export", "Dedicated compliance review"],
  },
];

function Features({ items }: { items: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-base text-ink">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2">
          <Icon name="check" className="mt-[3px] text-ink-muted" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

async function SubscriptionPageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_get");
  const settings = error ? null : ((data ?? null) as SettingsDoc | null);
  const current: TierKey =
    settings?.plan_tier === "growth" ? "growth" : settings?.plan_tier === "enterprise" ? "enterprise" : "starter";
  const mine = TIERS.find((t) => t.key === current)!;

  return (
    <>
      <SettingsHeader settings={settings} />
      <SettingsFrame current="subscription">
        {settings ? (
          <>
            <PageSection title="Your plan">
              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Title>{planLabel(current)}</Title>
                  <Badge tone="type">Current</Badge>
                  <Caption>{PLAN_NOTE}</Caption>
                </div>
                <Features items={mine.features} />
              </div>
            </PageSection>

            <PageSection title="Other plans" caption="Available after the public beta">
              <div className="flex flex-col gap-5 p-4">
                {TIERS.filter((t) => t.key !== current).map((t) => (
                  <div key={t.key} className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                    <Title className="sm:w-32 sm:shrink-0">{planLabel(t.key)}</Title>
                    <Features items={t.features} />
                  </div>
                ))}
              </div>
            </PageSection>
          </>
        ) : (
          // Without the read we do not know the plan; naming one would be a guess.
          <ErrorNote>Could not load your plan. Reload the page to try again.</ErrorNote>
        )}

        <PageSection title="Billing" caption="Not set up yet">
          <div className="flex flex-col gap-3 p-4">
            <p className="m-0 max-w-prose text-base text-ink">
              Self-service plan changes, payment methods and invoices open here once billing is set up. Contact support to
              change your plan in the meantime.
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button href="/pricing">View pricing</Button>
              <Button disabled aria-describedby="manage-plan-note">
                Manage plan
              </Button>
              <Caption>
                <span id="manage-plan-note">Opens once billing is set up</span>
              </Caption>
            </div>
          </div>
        </PageSection>
      </SettingsFrame>
    </>
  );
}

export default async function SettingsSubscriptionPage() {
  return <Page>{await SubscriptionPageBody()}</Page>;
}
