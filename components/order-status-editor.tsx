"use client";

// Buyer-only inline editor for order status / freight / logistics.
// Submits to /api/v1/orders with action=update.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";

type OrderStatus =
  | "draft"
  | "in_production"
  | "shipped"
  | "in_transit"
  | "delivered";

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in_production", label: "In production" },
  { value: "shipped", label: "Shipped" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
];

const INCOTERMS = ["", "FOB", "CIF", "EXW", "DDP", "DAP"] as const;

export interface OrderStatusEditorProps {
  orderId: string;
  initial: {
    status: OrderStatus | "cancelled";
    incoterm: string | null;
    origin_port: string | null;
    destination_port: string | null;
    ship_to_country: string | null;
    target_ship_date: string | null;
    target_delivery_date: string | null;
    actual_ship_date: string | null;
    actual_delivery_date: string | null;
    carrier_name: string | null;
    tracking_number: string | null;
    po_number: string | null;
    notes: string | null;
  };
}

export function OrderStatusEditor({ orderId, initial }: OrderStatusEditorProps) {
  const router = useRouter();
  const initStatus: OrderStatus =
    initial.status === "cancelled" ? "draft" : initial.status;
  const [status, setStatus] = useState<OrderStatus>(initStatus);
  const [incoterm, setIncoterm] = useState(initial.incoterm ?? "");
  const [originPort, setOriginPort] = useState(initial.origin_port ?? "");
  const [destinationPort, setDestinationPort] = useState(
    initial.destination_port ?? "",
  );
  const [shipTo, setShipTo] = useState(initial.ship_to_country ?? "");
  const [targetShip, setTargetShip] = useState(initial.target_ship_date ?? "");
  const [targetDelivery, setTargetDelivery] = useState(
    initial.target_delivery_date ?? "",
  );
  const [actualShip, setActualShip] = useState(initial.actual_ship_date ?? "");
  const [actualDelivery, setActualDelivery] = useState(
    initial.actual_delivery_date ?? "",
  );
  const [carrier, setCarrier] = useState(initial.carrier_name ?? "");
  const [tracking, setTracking] = useState(initial.tracking_number ?? "");
  const [poNumber, setPoNumber] = useState(initial.po_number ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  const [busy, setBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const patch: Record<string, unknown> = {
        status,
        incoterm,
        origin_port: originPort,
        destination_port: destinationPort,
        ship_to_country: shipTo,
        target_ship_date: targetShip,
        target_delivery_date: targetDelivery,
        actual_ship_date: actualShip,
        actual_delivery_date: actualDelivery,
        carrier_name: carrier,
        tracking_number: tracking,
        po_number: poNumber,
        notes,
      };
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", order_id: orderId, patch }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as
          | { detail?: string; error?: string }
          | null;
        setError(j?.detail ?? j?.error ?? `error ${res.status}`);
        return;
      }
      setOk(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    const yes = window.confirm("Cancel this order? This cannot be undone.");
    if (!yes) return;
    setCancelBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel", order_id: orderId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as
          | { detail?: string; error?: string }
          | null;
        setError(j?.detail ?? j?.error ?? `error ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update order</CardTitle>
        <CardMeta>Buyer-only</CardMeta>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSave}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
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
            <Field label="PO number">
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                maxLength={64}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <Field label="Ship to country">
              <input
                type="text"
                value={shipTo}
                onChange={(e) => setShipTo(e.target.value)}
                maxLength={64}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Target ship">
              <input
                type="date"
                value={targetShip}
                onChange={(e) => setTargetShip(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Target delivery">
              <input
                type="date"
                value={targetDelivery}
                onChange={(e) => setTargetDelivery(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Actual ship">
              <input
                type="date"
                value={actualShip}
                onChange={(e) => setActualShip(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Actual delivery">
              <input
                type="date"
                value={actualDelivery}
                onChange={(e) => setActualDelivery(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Carrier">
              <input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                maxLength={128}
                className={inputClass}
              />
            </Field>
            <Field label="Tracking #">
              <input
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                maxLength={128}
                className={inputClass}
              />
            </Field>
          </div>

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
          {ok ? <p className="text-sm text-sem-green">Saved.</p> : null}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={cancelBusy || busy}
            >
              {cancelBusy ? "Cancelling…" : "Cancel order"}
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const inputClass =
  "w-full rounded-input border border-hairline-strong bg-white px-3 py-2 text-[14px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent-indigo";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-ink-tertiary">
        {label}
      </span>
      {children}
    </label>
  );
}
