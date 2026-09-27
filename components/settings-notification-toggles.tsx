"use client";

// SettingsNotificationToggles — Spec B10 client island.
//
// Three switch rows for the digest / RFQ-replies / saved-supplier-alerts
// booleans. Each change immediately POSTs a partial-patch
// {action:'update_notifications', <key>:bool} to /api/v1/settings.
// Optimistic update; rolls back on error.

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useContext, useState, useTransition } from "react";

import { Switch } from "@/components/dashboard/fields";
import { PageSection } from "@/components/dashboard/page";
import { FormError } from "@/components/dashboard/settings";
import { Toast } from "@/components/dashboard/toast";
import { useFlash } from "@/components/dashboard/use-flash";

type Notifications = {
  digest: boolean;
  rfq_replies: boolean;
  saved_alerts: boolean;
};

export const NOTIFICATION_ROWS: { key: keyof Notifications; label: string; meta: string }[] = [
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
  const [flash, setFlash] = useFlash();
  const [, startTransition] = useTransition();
  // Visited pages are kept for 30s (`staleTimes`); refresh so a return
  // visit does not show the old state.
  // Not `useRouter()`, which throws outside a mounted app router (the route tests draw this with none).
  const router = useContext(AppRouterContext);

  function toggle(key: keyof Notifications) {
    const prev = state[key];
    const next = !prev;
    setState({ ...state, [key]: next });
    setError(null);
    setFlash(null);
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
        if (res.ok) {
          const label = NOTIFICATION_ROWS.find((r) => r.key === key)?.label ?? "Preference";
          setFlash(`${label} turned ${next ? "on" : "off"}`);
          router?.refresh();
        } else {
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
    <PageSection title="Email preferences" caption="Changes save automatically">
      <div className="flex flex-col divide-y divide-line-subtle px-4">
        {NOTIFICATION_ROWS.map((row) => (
          <Switch
            key={row.key}
            label={row.label}
            description={savingKey === row.key ? `${row.meta} Saving…` : row.meta}
            checked={state[row.key]}
            onChange={() => toggle(row.key)}
            disabled={savingKey === row.key}
          />
        ))}
      </div>
      {error ? (
        <div className="border-t border-line-subtle px-4 py-3">
          <FormError>{error}</FormError>
        </div>
      ) : null}
      {flash ? <Toast text={flash} href={null} className="fixed z-[60]" /> : null}
    </PageSection>
  );
}
