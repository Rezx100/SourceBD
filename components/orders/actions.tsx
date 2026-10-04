"use client";

// What a buyer or supplier does to an order (Paper `10 · Order detail`, `· Cancel order confirm`):
// Add update (log a step: buyer or the supplier), and in the "..." menu Edit details and Cancel
// order (the buyer's). All three post to /api/v1/orders and refresh; each is a dialog on a desktop
// and a bottom sheet on a phone. The server enforces who may do what; the page only withholds the
// control a person cannot use, and Cancel is not offered once goods are on their way (OR-02).

import { DotsThree, Plus } from "@phosphor-icons/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useContext, useEffect, useState, type ReactNode } from "react";
import { Button, Dialog, DialogClose, Field, IconButton, Input, Menu, MenuItem, Select, Sheet, fieldBox, fieldEdge } from "@/components/kit";
import { useIsPhone } from "@/components/kit/use-phone";
import { cn } from "@/lib/utils";
import { MILESTONE_KINDS, STATUS_WORDS, type OrderStatus } from "./words";

const textarea = cn(fieldBox, fieldEdge, "block min-h-16 px-2.5 py-1.5 text-base");

/** The POST behind each action: null when it worked, else the words to show. Never throws. */
export async function postOrder(body: Record<string, unknown>, send: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await send("/api/v1/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const j = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null;
    return j?.detail ?? j?.error ?? `The change could not be saved (error ${res.status}).`;
  } catch (e) {
    return e instanceof Error ? e.message : "The change could not be saved. Check your connection and try again.";
  }
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** A dialog on a desktop, a bottom sheet on a phone, with the same body and footer. */
function Overlay({ open, onOpenChange, title, children, footer, confirm = false }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; footer: ReactNode; confirm?: boolean }) {
  const phone = useIsPhone();
  return phone ? (
    <Sheet open={open} onOpenChange={onOpenChange} kind={confirm ? "confirm" : "sheet"} title={title} footer={footer}>
      {children}
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange} kind={confirm ? "confirm" : "form"} title={title} footer={footer}>
      {children}
    </Dialog>
  );
}

function useAfter() {
  const router = useContext(AppRouterContext);
  return () => router?.refresh();
}

export function AddUpdate({ orderId, size = "md", full = false }: { orderId: string; size?: "md" | "touch"; full?: boolean }) {
  const refresh = useAfter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("production_started");
  const [on, setOn] = useState(today);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = size === "touch";
  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failed = await postOrder({ action: "add_milestone", order_id: orderId, kind, occurred_on: on, ...(label.trim() ? { label: label.trim() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) });
    setBusy(false);
    if (failed) return setError(failed);
    setOpen(false);
    setLabel("");
    setNotes("");
    refresh();
  }
  return (
    <>
      <Button kind="primary" size={size} icon={Plus} full={full} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        Add update
      </Button>
      <Overlay
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title="Add an update"
        footer={
          <>
            <DialogClose asChild>
              <Button kind="secondary" size={phone ? "touch" : "md"} full={phone} disabled={busy}>
                Not now
              </Button>
            </DialogClose>
            <Button kind="primary" size={phone ? "touch" : "md"} full={phone} loading={busy} loadingLabel="Saving" disabled={!on} onClick={() => void save()}>
              Add update
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-ink">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Step">{(a) => <Select {...a} value={kind} onValueChange={setKind} options={MILESTONE_KINDS.map(([v, l]) => ({ value: v, label: l }))} size={phone ? "touch" : "md"} />}</Field>
            <Field label="Date · required">{(a) => <Input {...a} type="date" required value={on} onChange={(e) => setOn(e.target.value)} size={phone ? "touch" : "md"} />}</Field>
          </div>
          <Field label="Label" help="Optional. Names the step in your words.">
            {(a) => <Input {...a} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} placeholder="e.g. Cutting started" size={phone ? "touch" : "md"} />}
          </Field>
          <Field label="Notes">{(a) => <textarea {...a} className={textarea} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} rows={2} />}</Field>
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </Overlay>
    </>
  );
}

export type EditInitial = {
  status: OrderStatus;
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

const INCOTERMS = ["FOB", "CIF", "EXW", "DDP", "DAP"];
const STATUS_OPTIONS = (["draft", "in_production", "shipped", "in_transit", "delivered"] as const).map((s) => ({ value: s, label: STATUS_WORDS[s].label }));

/** The body `order_update` takes: every field as typed (an empty one clears it). */
export function editPatch(f: Record<keyof EditInitial, string>): Record<string, string> {
  return { ...f };
}

function EditForm({ orderId, initial, open, onOpenChange }: { orderId: string; initial: EditInitial; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refresh = useAfter();
  const phone = useIsPhone();
  const start = (): Record<keyof EditInitial, string> => ({
    status: initial.status === "cancelled" ? "draft" : initial.status,
    incoterm: initial.incoterm ?? "",
    origin_port: initial.origin_port ?? "",
    destination_port: initial.destination_port ?? "",
    ship_to_country: initial.ship_to_country ?? "",
    target_ship_date: initial.target_ship_date ?? "",
    target_delivery_date: initial.target_delivery_date ?? "",
    actual_ship_date: initial.actual_ship_date ?? "",
    actual_delivery_date: initial.actual_delivery_date ?? "",
    carrier_name: initial.carrier_name ?? "",
    tracking_number: initial.tracking_number ?? "",
    po_number: initial.po_number ?? "",
    notes: initial.notes ?? "",
  });
  const [f, setF] = useState(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every open starts from the order as it is now, not as it was when the page first drew.
  useEffect(() => {
    if (open) setF(start());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a fresh open resets the form
  }, [open]);
  const set = (k: keyof EditInitial) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const size = phone ? "touch" : "md";
  const text = (k: keyof EditInitial, label: string, max = 128, type = "text") => <Field label={label}>{(a) => <Input {...a} type={type} value={f[k]} onChange={(e) => set(k)(e.target.value)} maxLength={max} size={size} />}</Field>;
  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failed = await postOrder({ action: "update", order_id: orderId, patch: editPatch(f) });
    setBusy(false);
    if (failed) return setError(failed);
    onOpenChange(false);
    refresh();
  }
  return (
    <Overlay
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title="Edit order details"
      footer={
        <>
          <DialogClose asChild>
            <Button kind="secondary" size={phone ? "touch" : "md"} full={phone} disabled={busy}>
              Discard
            </Button>
          </DialogClose>
          <Button kind="primary" size={phone ? "touch" : "md"} full={phone} loading={busy} loadingLabel="Saving" onClick={() => void save()}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto text-ink">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Status">{(a) => <Select {...a} value={f.status} onValueChange={set("status")} options={STATUS_OPTIONS} size={size} />}</Field>
          <Field label="Incoterm">{(a) => <Select {...a} value={f.incoterm || "none"} onValueChange={(v) => set("incoterm")(v === "none" ? "" : v)} options={[{ value: "none", label: "Not set" }, ...INCOTERMS.map((v) => ({ value: v, label: v }))]} size={size} />}</Field>
          {text("po_number", "PO number", 64)}
          {text("ship_to_country", "Ship to", 64)}
          {text("origin_port", "From port")}
          {text("destination_port", "To port")}
          {text("target_ship_date", "Ship by", 10, "date")}
          {text("target_delivery_date", "Deliver by", 10, "date")}
          {text("actual_ship_date", "Left on", 10, "date")}
          {text("actual_delivery_date", "Delivered on", 10, "date")}
          {text("carrier_name", "Carrier")}
          {text("tracking_number", "Tracking number")}
        </div>
        <Field label="Notes">{(a) => <textarea {...a} className={textarea} value={f.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={4000} rows={3} />}</Field>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Overlay>
  );
}

function CancelOrder({ orderId, title, summary, supplier, open, onOpenChange }: { orderId: string; title: string; summary: string; supplier: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refresh = useAfter();
  const phone = useIsPhone();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancel() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failed = await postOrder({ action: "cancel", order_id: orderId });
    setBusy(false);
    if (failed) return setError(failed);
    onOpenChange(false);
    refresh();
  }
  const keep = (
    <DialogClose asChild>
      <Button kind="secondary" size={phone ? "touch" : "md"} full={phone} data-autofocus disabled={busy}>
        Keep order
      </Button>
    </DialogClose>
  );
  const go = (
    <Button kind="danger" size={phone ? "touch" : "md"} full={phone} loading={busy} loadingLabel="Cancelling" onClick={() => void cancel()}>
      Cancel order
    </Button>
  );
  return (
    <Overlay open={open} onOpenChange={(o) => !busy && onOpenChange(o)} title={title} confirm footer={phone ? <>{go}{keep}</> : <>{keep}{go}</>}>
      <div className="flex flex-col gap-2 text-base text-ink-2">
        <p>{summary}</p>
        <p>
          {supplier} sees the order as cancelled. You can&apos;t undo this.
        </p>
        <p className="text-sm text-ink-3">Once an order has shipped, it can&apos;t be cancelled here.</p>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Overlay>
  );
}

/** The "..." menu: Edit details and, while goods have not left, Cancel order. */
export function OrderMenu({
  orderId,
  initial,
  edit,
  cancel,
  cancelTitle,
  cancelSummary,
  supplier,
  size = 32,
}: {
  orderId: string;
  initial: EditInitial;
  edit: boolean;
  cancel: boolean;
  cancelTitle: string;
  cancelSummary: string;
  supplier: string;
  size?: 32 | 44;
}) {
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  if (!edit && !cancel) return null;
  return (
    <>
      <Menu align="end" trigger={<IconButton icon={DotsThree} label="More actions" size={size} />}>
        {edit ? <MenuItem onSelect={() => setEditing(true)}>Edit details</MenuItem> : null}
        {cancel ? <MenuItem onSelect={() => setCancelling(true)}>Cancel order</MenuItem> : null}
      </Menu>
      {edit ? <EditForm orderId={orderId} initial={initial} open={editing} onOpenChange={setEditing} /> : null}
      {cancel ? <CancelOrder orderId={orderId} title={cancelTitle} summary={cancelSummary} supplier={supplier} open={cancelling} onOpenChange={setCancelling} /> : null}
    </>
  );
}
