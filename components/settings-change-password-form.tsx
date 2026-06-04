"use client";

// SettingsChangePasswordForm — Spec B10 client island.
//
// Controlled inputs for new password + confirm. POSTs
// {action:'change_password', new_password} to /api/v1/settings, which
// calls Supabase Auth updateUser({password}). Server enforces 8..200 chars
// (matches the F3 signup rule).

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";

const MIN = 8;
const INPUT =
  "w-full rounded-input border border-hairline-strong bg-white px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent-indigo";

export function SettingsChangePasswordForm() {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
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
        body: JSON.stringify({ action: "change_password", new_password: pwd }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? `Failed (${res.status})`);
        return;
      }
      setOk(true);
      setPwd("");
      setConfirm("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardMeta>Minimum {MIN} characters</CardMeta>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-ink-tertiary">
              New password
            </span>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              minLength={MIN}
              autoComplete="new-password"
              required
              className={INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-ink-tertiary">
              Confirm new password
            </span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={MIN}
              autoComplete="new-password"
              required
              className={INPUT}
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="default" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Update password"}
            </Button>
            {ok ? (
              <span className="text-sm text-sem-green">Password updated.</span>
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
