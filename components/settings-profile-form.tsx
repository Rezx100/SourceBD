"use client";

// SettingsProfileForm — Spec B10 client island.
//
// Controlled display-name input; POSTs {action:'update_profile'} to
// /api/v1/settings. Refreshes the server tree on success so the hub
// header picks up the new name on next visit.

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Field, TextInput } from "@/components/dashboard/fields";
import { PageSection } from "@/components/dashboard/page";
import { FormActions, FormError } from "@/components/dashboard/settings";
import { useFlash } from "@/components/dashboard/use-flash";

const MAX = 120;

export function SettingsProfileForm({
  initialDisplayName,
}: {
  initialDisplayName: string;
}) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(initialDisplayName);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          display_name: value.trim() || null,
        }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(detail?.error ?? `Failed (${res.status})`);
        return;
      }
      setFlash("Display name saved");
      router.refresh();
    });
  }

  return (
    <PageSection title="Display name" caption="How you appear in messages and order activity">
      <form onSubmit={onSubmit}>
        <div className="flex flex-col gap-3 p-4">
          <Field label="Display name" htmlFor={`${id}-name`} hint={`Up to ${MAX} characters`}>
            <TextInput
              id={`${id}-name`}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, MAX))}
              placeholder="e.g. Jane Doe"
              maxLength={MAX}
              autoComplete="name"
              aria-invalid={error ? true : undefined}
              className="max-w-sm"
            />
          </Field>
          <FormError>{error}</FormError>
        </div>
        <FormActions pending={pending} label="Save" flash={flash} />
      </form>
    </PageSection>
  );
}
