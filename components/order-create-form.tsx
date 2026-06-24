"use client";

// Order compose form (Spec B8). Submits to /api/v1/orders with action=create.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormGrid } from "@/components/ui/form-grid";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";

export type OrderSeed =
  | {
      mode: "from_quote";
      accepted_quote_id: string;
      supplier_id: string;
      supplier_name: string;
      product_title: string;
      quantity: number;
      quantity_unit: string;
      unit_price: number;
      currency: string;
      ship_to_country: string | null;
      target_ship_date: string | null;
    }
  | {
      mode: "manual";
      supplier_id: string;
      supplier_name: string;
    };

const INCOTERMS = ["", "FOB", "CIF", "EXW", "DDP", "DAP"] as const;

export function OrderCreateForm({ seed }: { seed: OrderSeed }) {
  const router = useRouter();
  const fromQuote = seed.mode === "from_quote";

  const [title, setTitle] = useState(fromQuote ? seed.product_title : "");
  const [quantity, setQuantity] = useState(
    fromQuote ? String(seed.quantity) : "",
  );
  const [unit, setUnit] = useState(fromQuote ? seed.quantity_unit : "pcs");
  const [unitPrice, setUnitPrice] = useState(
    fromQuote ? String(seed.unit_price) : "",
  );
  const [currency, setCurrency] = useState(fromQuote ? seed.currency : "USD");
  const [poNumber, setPoNumber] = useState("");
  const [incoterm, setIncoterm] = useState("");
  const [originPort, setOriginPort] = useState("");
  const [destinationPort, setDestinationPort] = useState("");
  const [shipToCountry, setShipToCountry] = useState(
    fromQuote ? seed.ship_to_country ?? "" : "",
  );
  const [targetShipDate, setTargetShipDate] = useState(
    fromQuote ? seed.target_ship_date ?? "" : "",
  );
  const [targetDeliveryDate, setTargetDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        action: "create",
        currency: currency.trim().toUpperCase() || "USD",
      };
      if (fromQuote) {
        payload.accepted_quote_id = seed.accepted_quote_id;
      } else {
        payload.supplier_id = seed.supplier_id;
      }
      if (title.trim()) payload.product_title = title.trim();
      if (quantity.trim()) payload.quantity = Number(quantity);
      if (unit.trim()) payload.quantity_unit = unit.trim();
      if (unitPrice.trim()) payload.unit_price = Number(unitPrice);
      if (poNumber.trim()) payload.po_number = poNumber.trim();
      if (incoterm.trim()) payload.incoterm = incoterm.trim();
      if (originPort.trim()) payload.origin_port = originPort.trim();
      if (destinationPort.trim()) payload.destination_port = destinationPort.trim();
      if (shipToCountry.trim()) payload.ship_to_country = shipToCountry.trim();
      if (targetShipDate.trim()) payload.target_ship_date = targetShipDate.trim();
      if (targetDeliveryDate.trim()) {
        payload.target_delivery_date = targetDeliveryDate.trim();
      }
      if (notes.trim()) payload.notes = notes.trim();

      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => null)) as
        | { order_id?: string; detail?: string; error?: string }
        | null;
      if (!res.ok || !j?.order_id) {
        setError(j?.detail ?? j?.error ?? `error ${res.status}`);
        return;
      }
      router.push(`/app/orders/${j.order_id}`);
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
        <CardTitle>
          {fromQuote
            ? `Create order from accepted quote — ${seed.supplier_name}`
            : `New order to ${seed.supplier_name}`}
        </CardTitle>
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

          <FormGrid cols={3}>
            <Field label="Unit price (optional)">
              <input
                type="number"
                min={0}
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
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
            <Field label="PO number (optional)">
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                maxLength={64}
                className={inputClass}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Incoterm">
              <select
                value={incoterm}
                onChange={(e) => setIncoterm(e.target.value)}
                className={inputClass}
              >
                {INCOTERMS.map((v) => (
                  <option key={v} value={v}>
                    {v || "—"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Origin port">
              <input
                type="text"
                value={originPort}
                onChange={(e) => setOriginPort(e.target.value)}
                maxLength={128}
                className={inputClass}
              />
            </Field>
            <Field label="Destination port">
              <input
                type="text"
                value={destinationPort}
                onChange={(e) => setDestinationPort(e.target.value)}
                maxLength={128}
                className={inputClass}
              />
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Ship to country">
              <input
                type="text"
                value={shipToCountry}
                onChange={(e) => setShipToCountry(e.target.value)}
                maxLength={64}
                className={inputClass}
              />
            </Field>
            <Field label="Target ship date">
              <input
                type="date"
                value={targetShipDate}
                onChange={(e) => setTargetShipDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Target delivery date">
              <input
                type="date"
                value={targetDeliveryDate}
                onChange={(e) => setTargetDeliveryDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </FormGrid>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={4000}
              rows={3}
              className={inputClass}
            />
          </Field>

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
              {busy ? "Creating…" : "Create order"}
            </Button>
          </StickyActionBar>
        </form>
      </CardContent>
    </Card>
  );
}

const inputClass =
  "w-full rounded-input border border-hairline-strong bg-white px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent-indigo";

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
        {required ? <span className="text-sem-red"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
