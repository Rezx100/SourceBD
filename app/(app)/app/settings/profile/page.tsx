// Settings — Account profile (Spec B10).
//
// Reads the caller's settings via `settings_get` and mounts three client
// islands: display-name form, change-email form, change-password form.
// All three POST to /api/v1/settings.

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { SettingsAvatarForm } from "@/components/settings-avatar-form";
import { SettingsProfileForm } from "@/components/settings-profile-form";
import { SettingsChangeEmailForm } from "@/components/settings-change-email-form";
import { SettingsChangePasswordForm } from "@/components/settings-change-password-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-kit";

export const dynamic = "force-dynamic";

type SettingsDoc = {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
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
          title="Account profile"
          description="Update your display name and picture, change your sign-in email, or set a new password."
        />
      </div>

      <SettingsAvatarForm
        initialAvatarUrl={settings?.avatar_url ?? null}
        displayName={settings?.display_name ?? ""}
        email={settings?.email ?? ""}
      />

      <SettingsProfileForm
        initialDisplayName={settings?.display_name ?? ""}
      />

      <SettingsChangeEmailForm currentEmail={settings?.email ?? ""} />

      <SettingsChangePasswordForm />
    </div>
  );
}
