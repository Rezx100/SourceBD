// /app/settings/profile on the v4 frame (B7b, Paper `10 · Settings · Profile`): the name and picture,
// the email, the password, and Sign out. A failed `settings_get` is an error where the name and picture
// were (blank fields would let a save clear them); the email and the password need nothing from that
// read, so they stay.

import { SignOut } from "@phosphor-icons/react/dist/ssr";
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
      <Section title="Your name" caption="Suppliers see it in messages and orders." phoneHead={false}>
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
          doc?.email ? (
            <>
              <span className="max-md:hidden">Current: </span>
              <span className="md:hidden">Now </span>
              <span className="text-ink [overflow-wrap:anywhere] max-md:text-ink-3">{doc.email}</span>
            </>
          ) : (
            "Your current address could not be read."
          )
        }
      >
        <EmailForm />
      </Section>
      <Section title="Password" caption="At least 8 characters. Pick one you do not use elsewhere.">
        <PasswordForm />
      </Section>
      <Section title="Sign out" caption="Sign out of this device" phoneHead={false}>
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className={buttonClass({
              kind: "secondary",
              className: "max-md:-mx-2 max-md:-mt-3 max-md:h-auto max-md:min-h-[52px] max-md:w-[calc(100%+1rem)] max-md:justify-start max-md:gap-3 max-md:rounded-md max-md:border-0 max-md:bg-transparent max-md:px-2 max-md:text-md max-md:font-normal max-md:hover:bg-transparent max-md:active:bg-sunken",
            })}
          >
            <span className="flex w-6 shrink-0 justify-center md:hidden">
              <SignOut size={20} className="text-ink-2" aria-hidden />
            </span>
            <span className="max-md:hidden">Sign out</span>
            <span className="md:hidden">Sign out of this device</span>
          </button>
        </form>
      </Section>
    </SettingsShell>
  );
}
