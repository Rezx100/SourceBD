"use client";

// SettingsChangePasswordForm — Spec B10 client island.
//
// Controlled inputs for current password, new password + confirm. POSTs
// {action:'change_password', current_password, new_password} to
// /api/v1/settings, which checks the current password (ST-03) and then calls
// Supabase Auth updateUser({password}). Server enforces 8..200 chars
// (matches the F3 signup rule).

import Link from "next/link";
import { useId, useState, useTransition } from "react";

import { Field, TextInput } from "@/components/dashboard/fields";
import { PageSection } from "@/components/dashboard/page";
import { FormActions, FormError } from "@/components/dashboard/settings";
import { useFlash } from "@/components/dashboard/use-flash";

const MIN = 8;

export function SettingsChangePasswordForm() {
  const id = useId();
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFlash(null);
    if (pwd.length < MIN) {
      setError(`Password must be at least ${MIN} characters.`);
      return;
    }
    if (pwd !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/v1/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          current_password: current,
          new_password: pwd,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? `Failed (${res.status})`);
        return;
      }
      setFlash("Password updated.");
      setCurrent("");
      setPwd("");
      setConfirm("");
    });
  }

  return (
    <PageSection title="Password" caption={`Minimum ${MIN} characters`}>
      <form onSubmit={onSubmit}>
        <div className="flex flex-col gap-3 p-4">
          <Field
            label="Current password"
            htmlFor={`${id}-current`}
            hint={
              <>
                Forgotten it, or always signed in with an email link?{" "}
                <Link href="/forgot-password" className="link">
                  Reset it by email
                </Link>
                .
              </>
            }
          >
            <TextInput
              id={`${id}-current`}
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
              aria-invalid={error ? true : undefined}
              className="max-w-sm"
            />
          </Field>
          <Field label="New password" htmlFor={`${id}-new`}>
            <TextInput
              id={`${id}-new`}
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              minLength={MIN}
              autoComplete="new-password"
              required
              aria-invalid={error ? true : undefined}
              className="max-w-sm"
            />
          </Field>
          <Field label="Confirm new password" htmlFor={`${id}-confirm`}>
            <TextInput
              id={`${id}-confirm`}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={MIN}
              autoComplete="new-password"
              required
              aria-invalid={error ? true : undefined}
              className="max-w-sm"
            />
          </Field>
          <FormError>{error}</FormError>
        </div>
        <FormActions pending={pending} label="Update password" flash={flash} />
      </form>
    </PageSection>
  );
}
