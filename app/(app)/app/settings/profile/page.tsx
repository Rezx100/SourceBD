// Settings — Account profile (Spec B10).
//
// Reads the caller's settings via `settings_get` and mounts three client
// islands: display-name form, change-email form, change-password form.
// All three POST to /api/v1/settings.

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { SettingsProfileForm } from "@/components/settings-profile-form";
import { SettingsChangeEmailForm } from "@/components/settings-change-email-form";
import { SettingsChangePasswordForm } from "@/components/settings-change-password-form";
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

export default async function SettingsProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("settings_get");
  const settings = (data ?? null) as SettingsDoc | null;

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
          Account profile
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Update your display name, change your sign-in email, or set a new
          password.
        </p>
      </header>

      <SettingsProfileForm
        initialDisplayName={settings?.display_name ?? ""}
      />

      <SettingsChangeEmailForm currentEmail={settings?.email ?? ""} />

      <SettingsChangePasswordForm />
    </div>
  );
}
