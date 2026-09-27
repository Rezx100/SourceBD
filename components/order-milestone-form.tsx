"use client";

// Log a milestone on an order (Spec B8). Buyer or claimed supplier. Closed
// until asked for: "Log milestone" opens the form in place, and its Save is
// the screen's one primary only while the form is open.

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useContext, useEffect, useState } from "react";

import { Button } from "@/components/dashboard/controls";
import { Field, SelectInput, TextArea, TextInput } from "@/components/dashboard/fields";
import { Icon } from "@/components/dashboard/icons";
import { ErrorNote } from "@/components/dashboard/page";
import { Toast } from "@/components/dashboard/toast";

export function OrderMilestoneForm({
  orderId,
  kinds,
}: {
  orderId: string;
  /** `[value, label]` pairs, from `MILESTONE_KINDS` in the orders module. */
  kinds: readonly (readonly [string, string])[];
}) {
  // Not `useRouter()`, which throws outside a mounted app router (the render
  // tests draw this with no router at all).
  const router = useContext(AppRouterContext);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("production_started");
  const [label, setLabel] = useState("");
  const [occurredOn, setOccurredOn] = useState(isoToday);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 2500);
    return () => clearTimeout(t);
  }, [added]);

  function close() {
    setOpen(false);
    setLabel("");
    setNotes("");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        action: "add_milestone",
        order_id: orderId,
        kind,
        occurred_on: occurredOn,
      };
      if (label.trim()) payload.label = label.trim();
      if (notes.trim()) payload.notes = notes.trim();
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null;
        setError(j?.detail ?? j?.error ?? `error ${res.status}`);
        return;
      }
      close();
      setAdded(true);
      router?.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  const toast = added ? <Toast text="Milestone added" href={null} className="fixed z-[60]" /> : null;

  if (!open) {
    return (
      <div className="flex flex-col items-start">
        <Button onClick={() => setOpen(true)} aria-expanded={false}>
          <Icon name="plus" /> Log milestone
        </Button>
        {toast}
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit} aria-labelledby="milestone-form-title">
      <h3 id="milestone-form-title" className="m-0 text-sm font-semibold text-ink-strong">
        Log a milestone
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Kind" htmlFor="milestone-kind">
          <SelectInput id="milestone-kind" autoFocus value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Occurred on" htmlFor="milestone-date" required>
          <TextInput id="milestone-date" type="date" required value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        </Field>
      </div>
      <Field label="Label" htmlFor="milestone-label" hint="Optional">
        <TextInput
          id="milestone-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={200}
          placeholder="e.g. Cutting started"
        />
      </Field>
      <Field label="Notes" htmlFor="milestone-notes" hint="Optional">
        <TextArea id="milestone-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} rows={2} />
      </Field>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={busy}>
          Discard
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Add milestone
        </Button>
      </div>
      {toast}
    </form>
  );
}

function isoToday() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
