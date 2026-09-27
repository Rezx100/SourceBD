"use client";

// RFQ compose form (Spec B7). Submits to /api/v1/rfqs with action=create.
// Drawn in the dashboard kit: a Product and a Details section, then a sticky
// footer that counts the required fields still empty.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/dashboard/controls";
import { Field, TextArea, TextInput } from "@/components/dashboard/fields";
import { ErrorNote, PageSection } from "@/components/dashboard/page";
import { Caption } from "@/components/dashboard/type";

export interface RfqCreateFormProps {
  supplierId: string;
  supplierName: string;
  /**
   * The product line the buyer arrived from (§3.4: "prefills the composer's
   * product block with the HS code"). The line sheet's Send RFQ carries it;
   * every other entry point leaves it unset and the field starts empty.
   */
  initialTitle?: string;
}

/** How many of the three required fields (title, quantity ≥ 1, unit) are still empty. */
export function missingRequired(v: { title: string; quantity: string; unit: string }): number {
  return [v.title.trim() !== "", Number(v.quantity) >= 1, v.unit.trim() !== ""].filter((ok) => !ok).length;
}

export function RfqCreateForm({ supplierId, supplierName, initialTitle }: RfqCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [targetPrice, setTargetPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [shipTo, setShipTo] = useState("");
  const [shipBy, setShipBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = missingRequired({ title, quantity, unit });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        action: "create",
        product_title: title.trim(),
        product_description: description.trim() || undefined,
        quantity: Number(quantity),
        quantity_unit: unit.trim(),
        target_supplier_ids: [supplierId],
        currency: currency.trim().toUpperCase() || "USD",
      };
      if (targetPrice.trim()) payload.target_unit_price = Number(targetPrice);
      if (shipTo.trim()) payload.ship_to_country = shipTo.trim();
      if (shipBy.trim()) payload.ship_by = shipBy.trim();

      const res = await fetch("/api/v1/rfqs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => null)) as
        | { rfq_id?: string; detail?: string; error?: string }
        | null;
      if (!res.ok || !j?.rfq_id) {
        setError(j?.detail ?? j?.error ?? `error ${res.status}`);
        return;
      }
      router.push(`/app/rfqs/${j.rfq_id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex min-w-0 flex-col gap-5" onSubmit={onSubmit}>
      <PageSection title="Product">
        <div className="flex flex-col gap-4 p-4">
          <Field label="Product title" htmlFor="rfq-title" required>
            <TextInput
              id="rfq-title"
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. 100% cotton t-shirts, 180gsm"
            />
          </Field>
          <Field label="Description" htmlFor="rfq-description" hint="Fabric, sizes, colours, packaging, certifications required.">
            <TextArea
              id="rfq-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={4}
              aria-describedby="rfq-description-hint"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Quantity" htmlFor="rfq-quantity" required>
              <TextInput
                id="rfq-quantity"
                required
                type="number"
                min={1}
                step="any"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label="Unit" htmlFor="rfq-unit" required>
              <TextInput
                id="rfq-unit"
                required
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                maxLength={32}
              />
            </Field>
          </div>
        </div>
      </PageSection>

      <PageSection title="Details" caption="Optional">
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <Field label="Target unit price" htmlFor="rfq-target-price">
            <TextInput
              id="rfq-target-price"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
            />
          </Field>
          <Field label="Currency" htmlFor="rfq-currency">
            <TextInput
              id="rfq-currency"
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
            />
          </Field>
          <Field label="Ship to country" htmlFor="rfq-ship-to">
            <TextInput
              id="rfq-ship-to"
              type="text"
              value={shipTo}
              onChange={(e) => setShipTo(e.target.value)}
              maxLength={64}
            />
          </Field>
          <Field label="Ship by" htmlFor="rfq-ship-by">
            <TextInput id="rfq-ship-by" type="date" value={shipBy} onChange={(e) => setShipBy(e.target.value)} />
          </Field>
        </div>
      </PageSection>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-md border border-line-subtle bg-surface px-4 py-3">
        <span className="flex min-w-0 flex-1 flex-col" aria-live="polite">
          <span className="text-sm font-medium text-ink-strong">
            {missing === 0
              ? "Ready to send"
              : `${missing} required ${missing === 1 ? "field" : "fields"} missing`}
          </span>
          <Caption className="[overflow-wrap:anywhere]">To {supplierName}</Caption>
        </span>
        <Button variant="ghost" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Sending…" : "Send RFQ"}
        </Button>
      </div>
    </form>
  );
}
