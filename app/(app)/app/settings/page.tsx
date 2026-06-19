// Settings hub — Spec B10 (/app/settings).
//
// Server component. Reads the caller's settings via `settings_get` and
// renders three navigation cards (Profile / Plan / Notifications) plus a
// header with email + current plan badge.

import Link from "next/link";
import {
  ArrowRight,
  BellSimple,
  CreditCard,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";

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

function planLabel(tier: string | null): string {
  if (tier === "growth") return "Growth";
  if (tier === "enterprise") return "Enterprise";
  return "Starter";
}

export default async function SettingsHubPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_get");
  const settings = (data ?? null) as SettingsDoc | null;

  const enabledCount = settings
    ? Number(settings.notifications.digest) +
      Number(settings.notifications.rfq_replies) +
      Number(settings.notifications.saved_alerts)
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="Account"
        title="Settings"
        description={
          settings?.email ? (
            <>
              Signed in as{" "}
              <span className="font-semibold text-ink-primary">
                {settings.email}
              </span>
              {" · "}
              {planLabel(settings.plan_tier)} plan
            </>
          ) : (
            "Manage your profile, plan, and notification preferences."
          )
        }
      />
      {error ? (
        <p className="text-sm text-sem-red">
          Could not load settings: {error.message}
        </p>
      ) : null}

      <FormGrid cols={3}>
        <NavCard
          href="/app/settings/profile"
          icon={<UserCircle size={20} weight="duotone" />}
          title="Account profile"
          meta="Display name · email · password"
          body="Update how you appear in messages and orders. Change your sign-in email or password."
        />
        <NavCard
          href="/app/settings/plan"
          icon={<CreditCard size={20} weight="duotone" />}
          title="Plan"
          meta={`Current: ${planLabel(settings?.plan_tier ?? null)}`}
          body="View your current plan. Billing portal opens with Stripe in a later spec."
        />
        <NavCard
          href="/app/settings/notifications"
          icon={<BellSimple size={20} weight="duotone" />}
          title="Notifications"
          meta={`${enabledCount} of 3 enabled`}
          body="Choose which weekly digests, RFQ replies, and saved-supplier alerts you receive."
        />
      </FormGrid>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardMeta>End your session on this device</CardMeta>
        </CardHeader>
        <CardContent className="pt-0">
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="rounded-input border border-hairline-strong bg-surface-l1 px-3 py-2 text-sm font-medium text-ink-primary transition hover:bg-surface-l2"
            >
              Sign out
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function NavCard({
  href,
  icon,
  title,
  meta,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  meta: string;
  body: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition group-hover:border-brand-forest/40 group-hover:shadow-l1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-forest-soft text-brand-forest">{icon}</span>
            <ArrowRight
              size={16}
              className="text-ink-tertiary transition group-hover:translate-x-0.5 group-hover:text-brand-forest"
            />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardMeta>{meta}</CardMeta>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-ink-secondary">{body}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
