// Settings — Plan (Spec B10).
//
// Read-only. Surfaces the current plan tier from `settings_get` and what each
// tier includes. "Manage plan" stays disabled until Stripe billing lands in
// Phase 5 (phases.md line 100, M2) — no prices, renewal date or credits here
// until billing exists.

import { Badge } from "@/components/dashboard/chips";
import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";
import { ErrorNote, PageSection, Page } from "@/components/dashboard/page";
import { SAVING, type SettingsDoc, SettingsFrame, SettingsHeader } from "@/components/dashboard/settings";
import { Title } from "@/components/dashboard/type";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TierKey = "starter" | "growth" | "enterprise";

const TIERS: { key: TierKey; label: string; features: string[] }[] = [
  {
    key: "starter",
    label: "Starter",
    features: [
      "Discover up to 50 suppliers per month",
      "Saved-supplier dashboard",
      "Compliance (UFLPA + MSA)",
    ],
  },
  {
    key: "growth",
    label: "Growth",
    features: [
      "Unlimited Discover",
      "Find-matches wizard",
      "RFQs + order tracking",
      "Contact reveal on verified suppliers",
    ],
  },
  {
    key: "enterprise",
    label: "Enterprise",
    features: [
      "Everything in Growth",
      "Team seats + role-based access",
      "API access + bulk export",
      "Dedicated compliance review",
    ],
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

async function SettingsPlanPageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_get");
  const settings = error ? null : ((data ?? null) as SettingsDoc | null);
  const current: TierKey =
    settings?.plan_tier === "growth"
      ? "growth"
      : settings?.plan_tier === "enterprise"
        ? "enterprise"
        : "starter";
  const mine = TIERS.find((t) => t.key === current)!;

  return (
    <>
      <SettingsHeader settings={settings} />
      <SettingsFrame current="plan">
        {settings ? (
          <>
            <PageSection title="Your plan">
              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Title>{mine.label}</Title>
                  <Badge tone="type">Current</Badge>
                </div>
                <Features items={mine.features} />
              </div>
            </PageSection>

            <PageSection title="Other plans">
              <div className="flex flex-col divide-y divide-line-subtle">
                {TIERS.filter((t) => t.key !== current).map((t) => (
                  <div key={t.key} className="flex flex-col gap-2 p-4 sm:flex-row sm:gap-6">
                    <Title className="sm:w-32 sm:shrink-0">{t.label}</Title>
                    <Features items={t.features} />
                  </div>
                ))}
              </div>
            </PageSection>
          </>
        ) : (
          // Without the read we do not know the plan; saying "Starter" would be a guess.
          <ErrorNote>Could not load your plan. Reload the page to try again.</ErrorNote>
        )}

        <PageSection title="Billing" caption="Not set up yet">
          <div className="flex flex-col gap-3 p-4">
            <p className="m-0 text-base text-ink">
              Self-service plan changes, payment methods, and invoices will open here once billing is set up. Contact
              support to change your plan in the meantime.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button href="/pricing">View pricing</Button>
              <Button
                disabled
                title="Available once billing is set up"
                className={SAVING}
              >
                Manage plan
              </Button>
            </div>
          </div>
        </PageSection>
      </SettingsFrame>
    </>
  );
}

export default async function SettingsPlanPage() {
  return <Page>{await SettingsPlanPageBody()}</Page>;
}
