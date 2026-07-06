// Settings — Plan (Spec B10).
//
// Read-only. Surfaces the current plan tier from `settings_get` and lists
// the per-tier feature matrix. The "Manage plan" CTA is disabled until
// Stripe billing lands in Phase 5 (phases.md line 100, M2).

import Link from "next/link";
import { ArrowLeft, Check } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FormGrid } from "@/components/ui/form-grid";
import { PageHeader } from "@/components/ui/page-kit";

export const dynamic = "force-dynamic";

type SettingsDoc = {
  email: string | null;
  display_name: string | null;
  role: string | null;
  plan_tier: string | null;
  created_at: string | null;
  notifications: {
    digest: boolean;
    rfq_replies: boolean;
    saved_alerts: boolean;
  };
};

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

function planLabel(tier: string | null): string {
  if (tier === "growth") return "Growth";
  if (tier === "enterprise") return "Enterprise";
  return "Starter";
}

export default async function SettingsPlanPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("settings_get");
  const settings = (data ?? null) as SettingsDoc | null;
  const current: TierKey =
    settings?.plan_tier === "growth"
      ? "growth"
      : settings?.plan_tier === "enterprise"
        ? "enterprise"
        : "starter";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-4">
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-tertiary transition-colors hover:text-ink-primary"
        >
          <ArrowLeft size={17} weight="bold" aria-hidden />
          Back to settings
        </Link>
        <PageHeader
          kicker="Settings"
          title="Plan"
          description={
            <>
              You are currently on the{" "}
              <Badge tone="active">{planLabel(current)}</Badge> plan.
            </>
          }
        />
      </div>

      <FormGrid cols={3}>
        {TIERS.map((tier) => {
          const isCurrent = tier.key === current;
          return (
            <Card
              key={tier.key}
              className={
                isCurrent ? "border-accent-indigo shadow-l1" : undefined
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{tier.label}</CardTitle>
                  {isCurrent ? <Badge tone="active">Current</Badge> : null}
                </div>
                <CardMeta>
                  {isCurrent ? "Your active plan" : "Available"}
                </CardMeta>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-sm text-ink-secondary">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check
                        size={16}
                        weight="bold"
                        className="mt-0.5 shrink-0 text-sem-green"
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </FormGrid>

      <Card>
        <CardHeader>
          <CardTitle>Manage billing</CardTitle>
          <CardMeta>
            Stripe billing portal ships in a later spec (Phase 5)
          </CardMeta>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-sm text-ink-secondary">
            Self-service plan changes, payment methods, and invoices will
            open here once Stripe is wired. Contact support to change your
            plan in the meantime.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/pricing">View pricing</Link>
            </Button>
            <Button type="button" variant="default" size="sm" disabled>
              Manage plan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
