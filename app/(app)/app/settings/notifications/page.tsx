// Settings — Notifications (Spec B10).
//
// Reads the three notification toggles via `settings_get` and mounts the
// notification-toggles client island. Each toggle change debounce-POSTs
// {action:'update_notifications', <key>:bool} to /api/v1/settings.

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { SettingsNotificationToggles } from "@/components/settings-notification-toggles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      <header>
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1 text-[11px] text-ink-tertiary hover:text-ink-primary"
        >
          <ArrowLeft size={12} />
          Back to settings
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Choose which emails you receive. Delivery jobs land with the Inngest
          + Resend wiring in a later phase; toggling here records your
          preference now so you&apos;re opted in (or out) when sending begins.
        </p>
      </header>

      <SettingsNotificationToggles initial={notifications} />
    </div>
  );
}
