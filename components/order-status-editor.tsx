"use client";

// Buyer-only inline editor for order status / freight / logistics.
// Submits to /api/v1/orders with action=update.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/dashboard/controls";
import { Field, SelectInput, TextArea, TextInput } from "@/components/dashboard/fields";
import { ErrorNote } from "@/components/dashboard/page";
import { Toast } from "@/components/dashboard/toast";

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

  // The "Order saved" toast clears itself.
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 2500);
    return () => clearTimeout(t);
  }, [ok]);

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

  // Wide enough for two columns in the side card, four on a full-width row.
  const grid = "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3";
  return (
    <form className="flex flex-col gap-4" onSubmit={onSave} aria-label="Update order">
      <div className={grid}>
        <Field label="Status" htmlFor="order-status">
          <SelectInput id="order-status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Incoterm" htmlFor="order-edit-incoterm">
          <SelectInput id="order-edit-incoterm" value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
            {INCOTERMS.map((v) => (
              <option key={v} value={v}>
                {v || "—"}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="PO number" htmlFor="order-edit-po">
          <TextInput id="order-edit-po" type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} maxLength={64} />
        </Field>
        <Field label="Origin port" htmlFor="order-edit-origin">
          <TextInput id="order-edit-origin" type="text" value={originPort} onChange={(e) => setOriginPort(e.target.value)} maxLength={128} />
        </Field>
        <Field label="Destination port" htmlFor="order-edit-destination">
          <TextInput
            id="order-edit-destination"
            type="text"
            value={destinationPort}
            onChange={(e) => setDestinationPort(e.target.value)}
            maxLength={128}
          />
        </Field>
        <Field label="Ship to country" htmlFor="order-edit-ship-to">
          <TextInput id="order-edit-ship-to" type="text" value={shipTo} onChange={(e) => setShipTo(e.target.value)} maxLength={64} />
        </Field>
        <Field label="Target ship" htmlFor="order-edit-target-ship">
          <TextInput id="order-edit-target-ship" type="date" value={targetShip} onChange={(e) => setTargetShip(e.target.value)} />
        </Field>
        <Field label="Target delivery" htmlFor="order-edit-target-delivery">
          <TextInput
            id="order-edit-target-delivery"
            type="date"
            value={targetDelivery}
            onChange={(e) => setTargetDelivery(e.target.value)}
          />
        </Field>
        <Field label="Actual ship" htmlFor="order-edit-actual-ship">
          <TextInput id="order-edit-actual-ship" type="date" value={actualShip} onChange={(e) => setActualShip(e.target.value)} />
        </Field>
        <Field label="Actual delivery" htmlFor="order-edit-actual-delivery">
          <TextInput
            id="order-edit-actual-delivery"
            type="date"
            value={actualDelivery}
            onChange={(e) => setActualDelivery(e.target.value)}
          />
        </Field>
        <Field label="Carrier" htmlFor="order-edit-carrier">
          <TextInput id="order-edit-carrier" type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={128} />
        </Field>
        <Field label="Tracking #" htmlFor="order-edit-tracking">
          <TextInput id="order-edit-tracking" type="text" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={128} />
        </Field>
      </div>

      <Field label="Notes" htmlFor="order-edit-notes">
        <TextArea id="order-edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} rows={3} />
      </Field>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={cancelBusy || busy}>
          {cancelBusy ? "Cancelling…" : "Cancel order"}
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
      {ok ? <Toast text="Order saved" href={null} className="fixed z-[60]" /> : null}
    </form>
  );
}
