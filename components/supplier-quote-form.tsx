"use client";

// Supplier quote composer (Spec S4). POSTs `{action:"submit_quote", ...}`
// to `/api/v1/rfqs`, which forwards to the SECURITY DEFINER
// `rfq_quote_submit` RPC. The RPC upserts on (rfq_id, supplier_id), so
// the same form serves first-submit and edit-resubmit; status is reset
// to `submitted` on each call. Server is the security boundary — there
// is no direct INSERT against `rfq_quotes` from the client.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FormGrid } from "@/components/ui/form-grid";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";

export type SupplierQuoteFormInitial = {
  unit_price: number;
  currency: string;
  lead_time_days: number | null;
  moq: number | null;
  valid_until: string | null;
  notes: string | null;
  status: "submitted" | "accepted" | "rejected" | "withdrawn";
};

export interface SupplierQuoteFormProps {
  rfqId: string;
  rfqCurrency: string;
  quantityUnit: string;
  disabled?: boolean;
  initial?: SupplierQuoteFormInitial | null;
}

export function SupplierQuoteForm({
  rfqId,
  rfqCurrency,
  quantityUnit,
  disabled,
  initial,
}: SupplierQuoteFormProps) {
  const router = useRouter();
  const [unitPrice, setUnitPrice] = useState<string>(
    initial?.unit_price != null ? String(initial.unit_price) : "",
  );
  const [currency, setCurrency] = useState<string>(
    (initial?.currency ?? rfqCurrency ?? "USD").toUpperCase(),
  );
  const [leadTime, setLeadTime] = useState<string>(
    initial?.lead_time_days != null ? String(initial.lead_time_days) : "",
  );
  const [moq, setMoq] = useState<string>(
    initial?.moq != null ? String(initial.moq) : "",
  );
  const [validUntil, setValidUntil] = useState<string>(
    initial?.valid_until ?? "",
  );
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const payload: Record<string, unknown> = {
        action: "submit_quote",
        rfq_id: rfqId,
        unit_price: Number(unitPrice),
        currency: currency.trim().toUpperCase() || rfqCurrency,
      };
      if (leadTime.trim()) payload.lead_time_days = Number(leadTime);
      if (moq.trim()) payload.moq = Number(moq);
      if (validUntil.trim()) payload.valid_until = validUntil.trim();
      if (notes.trim()) payload.notes = notes.trim();

      const res = await fetch("/api/v1/rfqs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => null)) as
        | { quote_id?: string; detail?: string; error?: string }
        | null;
      if (!res.ok || !j?.quote_id) {
        setError(j?.detail ?? j?.error ?? `error ${res.status}`);
        return;
      }
      setOk(initial ? "Quote updated." : "Quote submitted.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  const isEdit = !!initial;

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {disabled ? (
        <p className="rounded-input border border-hairline-strong bg-surface-l1 px-3 py-2 text-[12px] text-ink-secondary">
          This RFQ is no longer open for quotes.
        </p>
      ) : null}

      <FormGrid cols={2}>
        <Field label="Unit price" required>
          <input
            required
            type="number"
            min={0}
            step="any"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            disabled={disabled || busy}
            className={inputClass}
            placeholder="e.g. 2.85"
          />
        </Field>
        <Field label="Currency">
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            disabled={disabled || busy}
            className={inputClass}
          />
        </Field>
      </FormGrid>

      <p className="text-[11px] text-ink-tertiary">
        Quoted per {quantityUnit}.
      </p>

      <FormGrid cols={3}>
        <Field label="Lead time (days)">
          <input
            type="number"
            min={0}
            step={1}
            value={leadTime}
            onChange={(e) => setLeadTime(e.target.value)}
            disabled={disabled || busy}
            className={inputClass}
          />
        </Field>
        <Field label="MOQ">
          <input
            type="number"
            min={0}
            step="any"
            value={moq}
            onChange={(e) => setMoq(e.target.value)}
            disabled={disabled || busy}
            className={inputClass}
          />
        </Field>
        <Field label="Valid until">
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            disabled={disabled || busy}
            className={inputClass}
          />
        </Field>
      </FormGrid>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={4000}
          rows={4}
          disabled={disabled || busy}
          className={inputClass}
          placeholder="Inclusions, exclusions, payment terms, packaging…"
        />
      </Field>

      {error ? <p className="text-sm text-sem-red">{error}</p> : null}
      {ok ? <p className="text-sm text-sem-green">{ok}</p> : null}

      <StickyActionBar>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={disabled || busy}
        >
          {busy ? "Submitting…" : isEdit ? "Update quote" : "Submit quote"}
        </Button>
      </StickyActionBar>
    </form>
  );
}

const inputClass =
  "w-full rounded-input border border-hairline-strong bg-white px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent-indigo disabled:cursor-not-allowed disabled:bg-surface-l1 disabled:text-ink-tertiary";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-tertiary">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
