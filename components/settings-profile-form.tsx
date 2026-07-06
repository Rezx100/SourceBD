"use client";

// SettingsProfileForm — Spec B10 client island.
//
// Controlled display-name input; POSTs {action:'update_profile'} to
// /api/v1/settings. Refreshes the server tree on success so the hub
// header picks up the new name on next visit.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";

const MAX = 120;
const INPUT =
  "w-full rounded-input border border-hairline-strong bg-white px-3 py-2 text-[14px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent-indigo";

export function SettingsProfileForm({
  initialDisplayName,
}: {
  initialDisplayName: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialDisplayName);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
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
      setOk(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Display name</CardTitle>
        <CardMeta>How you appear in messages and order activity</CardMeta>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12px] text-ink-tertiary">
              Display name
            </span>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, MAX))}
              placeholder="e.g. Jane Doe"
              maxLength={MAX}
              className={INPUT}
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="default" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            {ok ? (
              <span className="text-sm text-sem-green">Saved.</span>
            ) : null}
            {error ? (
              <span className="text-sm text-sem-red">{error}</span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
