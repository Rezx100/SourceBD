"use client";

// Order compose form (Spec B8). Submits to /api/v1/orders with action=create.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/dashboard/controls";
import { Field, SelectInput, TextArea, TextInput } from "@/components/dashboard/fields";
import { ErrorNote } from "@/components/dashboard/page";

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
      // The new order, open beside the orders it joins.
      router.push(`/app/orders?open=${encodeURIComponent(j.order_id)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col rounded-md border border-line-subtle bg-surface"
      onSubmit={onSubmit}
      aria-label={fromQuote ? `Order from accepted quote — ${seed.supplier_name}` : `New order to ${seed.supplier_name}`}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <h2 className="m-0 text-title font-semibold text-ink-strong">Product</h2>
        <Field label="Product title" htmlFor="order-title" required>
          <TextInput
            id="order-title"
            required
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Quantity" htmlFor="order-quantity" required>
            <TextInput
              id="order-quantity"
              required
              type="number"
              min={1}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
          <Field label="Unit" htmlFor="order-unit" required>
            <TextInput
              id="order-unit"
              required
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={32}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Unit price" htmlFor="order-unit-price" hint="Optional">
            <TextInput
              id="order-unit-price"
              type="number"
              min={0}
              step="any"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </Field>
          <Field label="Currency" htmlFor="order-currency">
            <TextInput
              id="order-currency"
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
            />
          </Field>
          <Field label="PO number" htmlFor="order-po" hint="Optional">
            <TextInput
              id="order-po"
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              maxLength={64}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-line-subtle p-4 sm:p-5">
        <h2 className="m-0 text-title font-semibold text-ink-strong">Shipping</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Incoterm" htmlFor="order-incoterm">
            <SelectInput id="order-incoterm" value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
              {INCOTERMS.map((v) => (
                <option key={v} value={v}>
                  {v || "—"}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Origin port" htmlFor="order-origin">
            <TextInput
              id="order-origin"
              type="text"
              value={originPort}
              onChange={(e) => setOriginPort(e.target.value)}
              maxLength={128}
            />
          </Field>
          <Field label="Destination port" htmlFor="order-destination">
            <TextInput
              id="order-destination"
              type="text"
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              maxLength={128}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Ship to country" htmlFor="order-ship-to">
            <TextInput
              id="order-ship-to"
              type="text"
              value={shipToCountry}
              onChange={(e) => setShipToCountry(e.target.value)}
              maxLength={64}
            />
          </Field>
          <Field label="Target ship date" htmlFor="order-target-ship">
            <TextInput
              id="order-target-ship"
              type="date"
              value={targetShipDate}
              onChange={(e) => setTargetShipDate(e.target.value)}
            />
          </Field>
          <Field label="Target delivery date" htmlFor="order-target-delivery">
            <TextInput
              id="order-target-delivery"
              type="date"
              value={targetDeliveryDate}
              onChange={(e) => setTargetDeliveryDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes" htmlFor="order-notes">
          <TextArea
            id="order-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={4000}
            rows={3}
          />
        </Field>
      </div>

      {error ? <ErrorNote className="mx-4 mb-4 sm:mx-5">{error}</ErrorNote> : null}

      <div className="flex items-center justify-end gap-2 border-t border-line-subtle px-4 py-3 sm:px-5">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Creating…" : "Create order"}
        </Button>
      </div>
    </form>
  );
}
