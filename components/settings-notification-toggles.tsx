"use client";

// SettingsNotificationToggles — Spec B10 client island.
//
// Three checkbox rows for the digest / RFQ-replies / saved-supplier-alerts
// booleans. Each change immediately POSTs a partial-patch
// {action:'update_notifications', <key>:bool} to /api/v1/settings.
// Optimistic update; rolls back on error.

import { useState, useTransition } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Notifications = {
  digest: boolean;
  rfq_replies: boolean;
  saved_alerts: boolean;
};

const ROWS: { key: keyof Notifications; label: string; meta: string }[] = [
  {
    key: "digest",
    label: "Weekly digest",
    meta: "Monday summary of new suppliers, cert updates, and sanctions changes across the corpus.",
  },
  {
    key: "rfq_replies",
    label: "RFQ replies",
    meta: "Email when a targeted supplier submits or revises a quote on one of your RFQs.",
  },
  {
    key: "saved_alerts",
    label: "Saved-supplier alerts",
    meta: "Cert expiry warnings, RSC remediation updates, and sanctions changes on suppliers you've saved.",
  },
];

export function SettingsNotificationToggles({
  initial,
}: {
  initial: Notifications;
}) {
  const [state, setState] = useState<Notifications>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<keyof Notifications | null>(null);
  const [, startTransition] = useTransition();

  function toggle(key: keyof Notifications) {
    const prev = state[key];
    const next = !prev;
    setState({ ...state, [key]: next });
    setError(null);
    setSavingKey(key);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "update_notifications",
            [key]: next,
          }),
        });
        if (!res.ok) {
          setState((s) => ({ ...s, [key]: prev }));
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          setError(body?.error ?? `Failed (${res.status})`);
        }
      } catch (e) {
        setState((s) => ({ ...s, [key]: prev }));
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        setSavingKey(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email preferences</CardTitle>
        <CardMeta>Changes save automatically</CardMeta>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {ROWS.map((row) => {
          const checked = state[row.key];
          const saving = savingKey === row.key;
          return (
            <label
              key={row.key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-card border border-hairline bg-surface-l1 p-3 transition hover:border-hairline-strong",
                checked && "border-accent-indigo/40 bg-bg-l0",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(row.key)}
                disabled={saving}
                className="mt-1 h-4 w-4 cursor-pointer accent-accent-indigo"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-ink-primary">
                  {row.label}
                </span>
                <span className="block text-xs text-ink-secondary">
                  {row.meta}
                </span>
              </span>
              {saving ? (
                <span className="text-[12px] text-ink-tertiary">
                  Saving…
                </span>
              ) : null}
            </label>
          );
        })}
        {error ? (
          <p className="text-sm text-sem-red">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
