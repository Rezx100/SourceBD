// /app/settings/security on the v4 frame (row 6, Paper `10 · Settings · Security`): two-step sign-in (Supabase
// MFA, TOTP), the password row, where the account is signed in with Sign out for each other device and
// "Sign out everywhere else", and the SSO line. The two reads stand alone: a failed one is said in its own
// card and never drawn as "off" or "no other devices". The device list needs migration 0115; without it the
// card says it could not load them. Design only before this: no Audit log (nothing records it).

import { DevicesCard, PasswordRow, TwoStepCard } from "@/components/security/cards";
import { loadDevices, loadFactors } from "@/components/security/load";
import { SECURITY_COPY } from "@/components/security/model";
import { loadSettings } from "@/components/settings/load";
import { SettingsShell } from "@/components/settings/shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Security · SourceBD" };

export default async function SettingsSecurityPage() {
  const supabase = await createSupabaseServerClient();
  const [doc, factors, devices] = await Promise.all([loadSettings(supabase), loadFactors(supabase), loadDevices(supabase)]);
  return (
    <SettingsShell current="security" doc={doc} title="Security">
      <div className="flex flex-col gap-4">
        <TwoStepCard factors={factors} />
        <PasswordRow />
        <DevicesCard devices={devices} />
        <p className="px-1 text-sm text-ink-3">{SECURITY_COPY.sso}</p>
      </div>
    </SettingsShell>
  );
}
