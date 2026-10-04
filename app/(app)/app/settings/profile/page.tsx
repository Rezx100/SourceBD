// /app/settings/profile on the v4 frame (B7b, Paper `10 · Settings · Profile`): the name and picture,
// the email, the password, and Sign out. A failed `settings_get` is an error where the name and picture
// were (blank fields would let a save clear them); the email and the password need nothing from that
// read, so they stay.

import { ErrorPanel, buttonClass } from "@/components/kit";
import Link from "next/link";
import { loadSettings } from "@/components/settings/load";
import { EmailForm, NameForm, PasswordForm } from "@/components/settings/profile-forms";
import { Section, SettingsShell } from "@/components/settings/shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profile · SourceBD" };

export default async function SettingsProfilePage() {
  const doc = await loadSettings(await createSupabaseServerClient());
  return (
    <SettingsShell current="profile" doc={doc} title="Profile">
      <Section title="Your name" caption="Suppliers see it in messages and orders.">
        {doc ? (
          <NameForm initialName={doc.display_name ?? ""} initialAvatarUrl={doc.avatar_url ?? null} email={doc.email ?? ""} />
        ) : (
          <ErrorPanel
            title="We couldn't load your profile."
            retry={
              <Link href="/app/settings/profile" prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
                Try again
              </Link>
            }
          >
            Nothing has changed. Your name and picture are safe.
          </ErrorPanel>
        )}
      </Section>
      <Section
        title="Email"
        caption={
          <>
            Current: <span className="text-ink [overflow-wrap:anywhere]">{doc?.email || "not shown"}</span>
          </>
        }
      >
        <EmailForm />
      </Section>
      <Section title="Password" caption="At least 8 characters. Pick one you do not use elsewhere.">
        <PasswordForm />
      </Section>
      <Section title="Sign out" caption="Sign out of this device">
        <form action="/auth/sign-out" method="post">
          <button type="submit" className={buttonClass({ kind: "secondary", className: "max-md:h-input-touch max-md:w-full" })}>
            Sign out
          </button>
        </form>
      </Section>
    </SettingsShell>
  );
}
