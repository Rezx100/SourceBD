"use client";

// Append a milestone to an order (Spec B8). Buyer or claimed supplier.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/dashboard/controls";
import { Field, SelectInput, TextArea, TextInput } from "@/components/dashboard/fields";
import { ErrorNote } from "@/components/dashboard/page";
import { Toast } from "@/components/dashboard/toast";

const KINDS = [
  ["po_issued", "PO issued"],
  ["materials_sourced", "Materials sourced"],
  ["production_started", "Production started"],
  ["qc_passed", "QC passed"],
  ["shipped", "Shipped"],
  ["customs_cleared", "Customs cleared"],
  ["delivered", "Delivered"],
  ["custom", "Custom"],
] as const;

export function OrderMilestoneForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("production_started");
  const [label, setLabel] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => isoToday());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 2500);
    return () => clearTimeout(t);
  }, [added]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
        const j = (await res.json().catch(() => null)) as
          | { detail?: string; error?: string }
          | null;
        setError(j?.detail ?? j?.error ?? `error ${res.status}`);
        return;
      }
      setLabel("");
      setNotes("");
      setAdded(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit} aria-labelledby="milestone-form-title">
      <h3 id="milestone-form-title" className="m-0 text-sm font-semibold text-ink-strong">
        Log a milestone
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Kind" htmlFor="milestone-kind">
          <SelectInput
            id="milestone-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as (typeof KINDS)[number][0])}
          >
            {KINDS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Occurred on" htmlFor="milestone-date" required>
          <TextInput
            id="milestone-date"
            type="date"
            required
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
          />
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
        <TextArea
          id="milestone-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={4000}
          rows={2}
        />
      </Field>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Add milestone"}
        </Button>
      </div>
      {added ? <Toast text="Milestone added" href={null} className="fixed z-[60]" /> : null}
    </form>
  );
}

function isoToday() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
