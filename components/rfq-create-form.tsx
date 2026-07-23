"use client";

// RFQ compose form (Spec B7). Submits to /api/v1/rfqs with action=create.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormGrid } from "@/components/ui/form-grid";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";

export interface RfqCreateFormProps {
  supplierId: string;
  supplierName: string;
}

export function RfqCreateForm({ supplierId, supplierName }: RfqCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [targetPrice, setTargetPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [shipTo, setShipTo] = useState("");
  const [shipBy, setShipBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <Card>
      <CardHeader>
        <CardTitle>New RFQ to {supplierName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label="Product title" required>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className={inputClass}
              placeholder="e.g. 100% cotton t-shirts, 180gsm"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={4}
              className={inputClass}
              placeholder="Fabric, sizes, colours, packaging, certifications required."
            />
          </Field>

          <FormGrid cols={2}>
            <Field label="Quantity" required>
              <input
                required
                type="number"
                min={1}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Unit" required>
              <input
                required
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                maxLength={32}
                className={inputClass}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Target unit price (optional)">
              <input
                type="number"
                min={0}
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Currency">
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                className={inputClass}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={2}>
            <Field label="Ship to country (optional)">
              <input
                type="text"
                value={shipTo}
                onChange={(e) => setShipTo(e.target.value)}
                maxLength={64}
                className={inputClass}
              />
            </Field>
            <Field label="Ship by (optional)">
              <input
                type="date"
                value={shipBy}
                onChange={(e) => setShipBy(e.target.value)}
                className={inputClass}
              />
            </Field>
          </FormGrid>

          {error ? <p className="text-sm text-sem-red">{error}</p> : null}

          <StickyActionBar>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? "Sending…" : "Send RFQ"}
            </Button>
          </StickyActionBar>
        </form>
      </CardContent>
    </Card>
  );
}

const inputClass =
  "w-full rounded-input border border-hairline-strong bg-white px-3 py-2 text-[14px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent-indigo";

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
      <span className="text-[12px] text-ink-tertiary">
        {label}
        {required ? <span className="text-sem-red"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
