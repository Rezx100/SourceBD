"use client";

// SettingsChangeEmailForm — Spec B10 client island.
//
// POSTs {action:'change_email', new_email} to /api/v1/settings, which
// calls Supabase Auth updateUser({email}); Supabase sends a confirmation
// email to the new address. The email change does not take effect until
// the user clicks the confirmation link.

import { useId, useState, useTransition } from "react";

import { Field, TextInput } from "@/components/dashboard/fields";
import { PageSection } from "@/components/dashboard/page";
import { FormActions, FormError } from "@/components/dashboard/settings";
import { useFlash } from "@/components/dashboard/use-flash";

export function SettingsChangeEmailForm({
  currentEmail,
}: {
  currentEmail: string;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash(6000);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "change_email", new_email: email }),
      });
      const body = (await res.json().catch(() => null)) as
        | { error?: string; info?: string }
        | null;
      if (!res.ok) {
        setError(body?.error ?? `Failed (${res.status})`);
        return;
      }
      setFlash(body?.info ?? "Confirmation email sent.");
      setEmail("");
    });
  }

  return (
    <PageSection
      title="Email"
      caption={
        <>
          Current: <span className="text-ink [overflow-wrap:anywhere]">{currentEmail || "—"}</span>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <div className="flex flex-col gap-3 p-4">
          <Field
            label="New email"
            htmlFor={`${id}-email`}
            hint="We'll send a confirmation link to the new address. Your email won't change until you click it."
          >
            <TextInput
              id={`${id}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              aria-invalid={error ? true : undefined}
              className="max-w-sm"
            />
          </Field>
          <FormError>{error}</FormError>
        </div>
        <FormActions pending={pending} label="Send confirmation" pendingLabel="Sending…" flash={flash} />
      </form>
    </PageSection>
  );
}
