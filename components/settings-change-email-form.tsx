"use client";

// SettingsChangeEmailForm — Spec B10 client island.
//
// POSTs {action:'change_email', new_email} to /api/v1/settings, which
// calls Supabase Auth updateUser({email}); Supabase sends a confirmation
// email to the new address. The email change does not take effect until
// the user clicks the confirmation link.

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";

const INPUT =
  "w-full rounded-input border border-hairline-strong bg-white px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent-indigo";

export function SettingsChangeEmailForm({
  currentEmail,
}: {
  currentEmail: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
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
      setInfo(body?.info ?? "Confirmation email sent.");
      setEmail("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change email</CardTitle>
        <CardMeta>
          Current: <span className="text-ink-primary">{currentEmail || "—"}</span>
        </CardMeta>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
              New email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className={INPUT}
            />
          </label>
          <p className="text-xs text-ink-tertiary">
            We&apos;ll send a confirmation link to the new address. Your email
            won&apos;t change until you click it.
          </p>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="default" size="sm" disabled={pending}>
              {pending ? "Sending…" : "Send confirmation"}
            </Button>
            {info ? (
              <span className="text-sm text-sem-green">{info}</span>
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
