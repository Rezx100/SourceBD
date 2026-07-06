"use client";

// Append a milestone to an order (Spec B8). Buyer or claimed supplier.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <p className="text-[12px] text-ink-tertiary">
        Log a milestone
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-tertiary">
            Kind
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as (typeof KINDS)[number][0])}
            className={inputClass}
          >
            {KINDS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-tertiary">
            Occurred on
          </span>
          <input
            type="date"
            required
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-ink-tertiary">
          Label (optional)
        </span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={200}
          className={inputClass}
          placeholder="e.g. Cutting started"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-ink-tertiary">
          Notes (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={4000}
          rows={2}
          className={inputClass}
        />
      </label>
      {error ? <p className="text-sm text-sem-red">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Add milestone"}
        </Button>
      </div>
    </form>
  );
}

function isoToday() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const inputClass =
  "w-full rounded-input border border-hairline-strong bg-white px-3 py-2 text-[14px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent-indigo";
