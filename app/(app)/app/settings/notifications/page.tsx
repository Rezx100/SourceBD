// Settings — Notifications (Spec B10).
//
// Reads the three notification toggles via `settings_get` and mounts the
// notification-toggles client island. Each toggle change debounce-POSTs
// {action:'update_notifications', <key>:bool} to /api/v1/settings.

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { SettingsNotificationToggles } from "@/components/settings-notification-toggles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

export default async function SettingsNotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("settings_get");
  const settings = (data ?? null) as SettingsDoc | null;
  const notifications = settings?.notifications ?? {
    digest: true,
    rfq_replies: true,
    saved_alerts: true,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
          title="Notifications"
          description="Choose which emails you receive. Delivery jobs land with the Inngest + Resend wiring in a later phase; toggling here records your preference now so you’re opted in (or out) when sending begins."
        />
      </div>

      <SettingsNotificationToggles initial={notifications} />
    </div>
  );
}
