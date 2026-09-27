// Settings overview — Spec B10 (/app/settings).
//
// Server component. Reads the caller's settings via `settings_get` and draws
// the settings frame (sub-navigation on the left) with an account summary
// and the sign-out form.

import Link from "next/link";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/dashboard/controls";
import { DetailList, ErrorNote, PageSection } from "@/components/dashboard/page";
import { planLabel, type SettingsDoc, SettingsFrame, SettingsHeader } from "@/components/dashboard/settings";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function RowLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} prefetch={false} className="ml-2 text-sm font-medium text-brand-ink hover:underline">
      {children}
    </Link>
  );
}

async function SettingsHubPageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_get");
  const settings = error ? null : ((data ?? null) as SettingsDoc | null);

  const enabledCount = settings
    ? Number(settings.notifications.digest) +
      Number(settings.notifications.rfq_replies) +
      Number(settings.notifications.saved_alerts)
    : 0;

  return (
    <>
      <SettingsHeader settings={settings} />

      <SettingsFrame current="overview">
        {error ? <ErrorNote>Could not load your settings. Reload the page to try again.</ErrorNote> : null}

        {settings ? (
          <PageSection title="Account">
            <DetailList
              rows={[
                { label: "Email", value: settings.email || "—" },
                {
                  label: "Display name",
                  value: (
                    <>
                      {settings.display_name || <span className="text-ink-muted">Not set</span>}
                      <RowLink href="/app/settings/profile">Edit</RowLink>
                    </>
                  ),
                },
                {
                  label: "Plan",
                  value: (
                    <>
                      {planLabel(settings.plan_tier)}
                      <RowLink href="/app/settings/plan">View plan</RowLink>
                    </>
                  ),
                },
                {
                  label: "Notifications",
                  value: (
                    <>
                      {enabledCount} of 3 emails on
                      <RowLink href="/app/settings/notifications">Change</RowLink>
                    </>
                  ),
                },
              ]}
            />
          </PageSection>
        ) : null}

        <PageSection title="Session" caption="End your session on this device">
          <form action="/auth/sign-out" method="post" className="p-4">
            <Button type="submit">Sign out</Button>
          </form>
        </PageSection>
      </SettingsFrame>
    </>
  );
}

// The kit's shell on every buyer page (one sidebar, one topbar), read in the
// same wave as the page's own data.
export default async function SettingsHubPage() {
  const supabase = await createSupabaseServerClient();
  const [shell, body] = await Promise.all([loadBuyerShell(supabase, "/app/settings"), SettingsHubPageBody()]);
  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Settings">
      {body}
    </AppShell>
  );
}
