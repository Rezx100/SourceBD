"use client";

// New order (Paper `10 · New order choose a supplier inline`, `· New order supplier chosen`,
// `11 · New order`). Two steps on one URL: with no supplier a search box with the suppliers the
// buyer asked for a price first, then their saved ones, then everyone; once a supplier is chosen
// (or an accepted quote seeds it) the form, with the order's value beside it as they type. A
// supplier that is sanctioned or unpublished never reaches the form (the page refuses it).

import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Link from "next/link";
import { useContext, useEffect, useId, useState, useSyncExternalStore } from "react";
import { Button, Field, Input, Select, buttonClass, fieldBox, fieldEdge } from "@/components/kit";
import { cn } from "@/lib/utils";
import { CURRENCIES, INCOTERMS, SHIP_TO, UNITS, orderMissing, orderPayload, orderValue, valueLine, type ChooserRow, type OrderFields } from "./new-model";
import { perUnit, unitWords } from "@/components/rfqs/words";

const textarea = cn(fieldBox, fieldEdge, "block min-h-16 px-2.5 py-1.5 text-base");

function useApplePlatform(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/i.test(typeof navigator === "undefined" ? "" : navigator.platform),
    () => false,
  );
}

type Found = { id: string; slug: string; name: string; line: string };

async function getJson(url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`read failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

const chooseHref = (id: string) => `/app/orders/new?supplier=${encodeURIComponent(id)}`;

function Row({ name, line, href, onChoose, active }: { name: string; line: string; href?: string; onChoose?: () => void; active?: boolean }) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-medium text-ink [overflow-wrap:anywhere]">{name}</span>
        <span className="text-xs text-ink-3 max-sm:text-sm">{line}</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-brand-ink max-sm:hidden">Choose</span>
    </>
  );
  const cls = cn("flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-brand-wash focus-visible:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus max-sm:min-h-14", active && "bg-brand-wash");
  return href ? (
    <Link href={href} prefetch={false} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onChoose} className={cls}>
      {body}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col border-b border-line py-1 last:border-b-0">
      <p className="px-3 pb-1 pt-2 text-xs font-semibold text-ink-3">{title}</p>
      {children}
    </div>
  );
}

/** Step one: choose who the order is with. */
export function SupplierChooser({ fromRfqs, total }: { fromRfqs: ChooserRow[]; total: number | null }) {
  const router = useContext(AppRouterContext);
  const id = useId();
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState<Found[] | "failed" | null>(null);
  const [found, setFound] = useState<Found[] | "failed" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getJson("/api/v1/saved").then(
      (j) => {
        if (!live) return;
        const rows = Array.isArray(j.rows) ? (j.rows as { id: string; slug: string; company_name: string; entity_type?: string | null; city?: string | null; district?: string | null }[]) : null;
        setSaved(rows ? rows.map((r) => ({ id: r.id, slug: r.slug, name: r.company_name, line: [r.entity_type === "factory" ? "Factory" : r.entity_type === "buying_house" ? "Buying house" : "Supplier", [r.city, r.district].filter(Boolean).join(", ") || "place not published"].join(" · ") })) : "failed");
      },
      () => live && setSaved("failed"),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setFound(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      getJson(`/api/discover/suggest?q=${encodeURIComponent(term)}`, ctrl.signal).then(
        (j) => {
          const list = (Array.isArray(j.suggestions) ? j.suggestions : []) as { type?: string; label: string; sublabel: string | null; slug: string }[];
          setFound(list.filter((s) => s.type === "company" && s.slug).map((s) => ({ id: "", slug: s.slug, name: s.label, line: s.sublabel ?? "place not published" })));
        },
        () => !ctrl.signal.aborted && setFound("failed"),
      );
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  /** A search result carries a slug, not an id: the server resolves it (and drops one that is unlisted). */
  async function chooseBySlug(slug: string) {
    setNote(null);
    try {
      const res = await fetch(`/api/v1/suppliers?slugs=${encodeURIComponent(slug)}`, { headers: { accept: "application/json" } });
      const j = (await res.json().catch(() => null)) as { rows?: { id: string; is_sanctioned?: boolean | null }[] } | null;
      const row = j?.rows?.[0];
      if (!res.ok || !row) return setNote("That supplier could not be opened just now. Try another or try again.");
      if (row.is_sanctioned) return setNote("That supplier is on a sanctions list. You can't place an order with it.");
      router?.push(chooseHref(row.id));
    } catch {
      setNote("That supplier could not be checked: no connection. Try again.");
    }
  }

  const term = q.trim().toLowerCase();
  const match = (r: { name: string }) => !term || r.name.toLowerCase().includes(term);
  const rfqRows = fromRfqs.filter(match);
  const savedRows = Array.isArray(saved) ? saved.filter(match) : [];
  const seen = new Set([...rfqRows, ...savedRows].map((r) => r.slug));
  const searchRows = Array.isArray(found) ? found.filter((r) => !seen.has(r.slug)) : [];
  return (
    <section aria-label="Supplier" className="flex w-full max-w-pane flex-col gap-2">
      <h2 className="text-md font-semibold text-ink">Supplier</h2>
      <label htmlFor={`${id}-q`} className="sr-only">
        Type a supplier&apos;s name
      </label>
      <Input id={`${id}-q`} type="search" icon={MagnifyingGlass} autoFocus placeholder="Type a supplier's name" value={q} onChange={(e) => setQ(e.target.value)} className="border-brand-ink max-sm:h-input-touch max-sm:text-md" />
      {note ? <p role="alert" className="text-sm font-medium text-danger">{note}</p> : null}
      <div className="flex flex-col overflow-clip rounded-md border border-line bg-surface">
        {rfqRows.length > 0 ? (
          <Group title="From your RFQs">
            {rfqRows.map((r) => (
              <Row key={r.slug} name={r.name} line={r.line} href={chooseHref(r.id)} />
            ))}
          </Group>
        ) : null}
        {savedRows.length > 0 ? (
          <Group title="Saved suppliers">
            {savedRows.map((r) => (
              <Row key={r.slug} name={r.name} line={r.line} href={chooseHref(r.id)} />
            ))}
          </Group>
        ) : null}
        {saved === "failed" ? <p className="border-b border-line px-3 py-3 text-sm text-ink-3">Your saved suppliers could not be read just now. Search instead.</p> : null}
        {term && searchRows.length > 0 ? (
          <Group title="From search">
            {searchRows.map((r) => (
              <Row key={r.slug} name={r.name} line={r.line} onChoose={() => void chooseBySlug(r.slug)} />
            ))}
          </Group>
        ) : null}
        {term && found === "failed" ? <p className="border-b border-line px-3 py-3 text-sm text-ink-3">The search could not run just now. Try again in a moment.</p> : null}
        {term && found !== null && found !== "failed" && rfqRows.length + savedRows.length + searchRows.length === 0 ? <p className="px-3 py-3 text-base text-ink-3">No supplier by that name.</p> : null}
        {!term && rfqRows.length + savedRows.length === 0 && saved !== null ? <p className="px-3 py-3 text-base text-ink-3">You have not asked or saved a supplier yet. Type a name to search.</p> : null}
        <p className="flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-brand-ink">
          <MagnifyingGlass size={16} aria-hidden />
          {total ? `Type to search all ${total.toLocaleString("en-GB")} suppliers` : "Type to search all suppliers"}
        </p>
      </div>
      <div className="rounded-md border border-dashed border-line-strong p-4">
        <p className="text-base font-medium text-ink-2">Product, quantity, price and shipping</p>
        <p className="text-base text-ink-3">These open once you choose a supplier.</p>
      </div>
    </section>
  );
}

export type OrderSeed = {
  supplierName: string;
  /** "Factory · Kashimpur, Gazipur". */
  supplierLine: string;
  how: { quoteId: string } | { supplierId: string };
};

export function OrderForm({ seed, prefill, cancelHref, backLabel, changeHref }: { seed: OrderSeed; prefill: Partial<OrderFields>; cancelHref: string; backLabel: string; changeHref: string | null }) {
  const router = useContext(AppRouterContext);
  const id = useId();
  const apple = useApplePlatform();
  const [f, setF] = useState<OrderFields>({ title: "", quantity: "", unit: "pcs", price: "", currency: "USD", po: "", incoterm: "", originPort: "", destinationPort: "", shipTo: "", shipBy: "", deliverBy: "", notes: "", ...prefill });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof OrderFields) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const missing = orderMissing(f);
  const value = orderValue(f.quantity, f.price, f.currency);
  const line = valueLine(f);

  async function create() {
    if (busy || missing.length > 0) return;
    setBusy(true);
    setError(null);
    let orderId: string | null = null;
    const failed = await (async () => {
      try {
        const res = await fetch("/api/v1/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(orderPayload(f, seed.how)) });
        const j = (await res.json().catch(() => null)) as { order_id?: string; detail?: string; error?: string } | null;
        if (res.ok && j?.order_id) {
          orderId = j.order_id;
          return null;
        }
        if (res.ok) return "The order may have been created, but we could not open it. Check your orders before trying again.";
        return j?.detail ?? j?.error ?? `The order could not be created (error ${res.status}).`;
      } catch (e) {
        return e instanceof Error ? e.message : "The order could not be created. Check your connection and try again.";
      }
    })();
    setBusy(false);
    if (failed || !orderId) return setError(failed);
    const next = `/app/orders?open=${encodeURIComponent(orderId)}`;
    if (router) {
      router.push(next);
      router.refresh();
    } else window.location.assign(next);
  }

  const size = "max-sm:h-input-touch max-sm:text-md";
  return (
    <section aria-label="New order" data-detail="" onKeyDown={(e) => ((e.metaKey || e.ctrlKey) && e.key === "Enter" ? (e.preventDefault(), void create()) : undefined)} className="flex min-h-0 flex-1 flex-col bg-surface">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-6">
        <Link href={cancelHref} prefetch={false} className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-base font-medium text-ink-2 outline-none hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:min-h-6">
          <ArrowLeft size={16} className="shrink-0" aria-hidden />
          {backLabel}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-ink">New order</h1>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:flex-row xl:overflow-visible">
        <form
          id={`${id}-form`}
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="flex min-w-0 flex-col gap-6 px-4 py-5 sm:px-6 xl:flex-1 xl:overflow-y-auto"
        >
          <div className="flex w-full max-w-pane flex-col gap-6">
            <section aria-label="Supplier" className="flex flex-col gap-2">
              <h2 className="text-md font-semibold text-ink">Supplier</h2>
              <div className="flex items-center gap-3 rounded-md border border-line py-2 pl-3 pr-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base font-medium text-ink [overflow-wrap:anywhere]">{seed.supplierName}</span>
                  <span className="text-xs text-ink-3 max-sm:text-sm">{seed.supplierLine}</span>
                </div>
                {changeHref ? (
                  <Link href={changeHref} prefetch={false} className={buttonClass({ kind: "secondary", className: "max-sm:h-input-touch" })}>
                    Change
                  </Link>
                ) : null}
              </div>
            </section>

            <section aria-label="What you're ordering" className="flex flex-col gap-3">
              <h2 className="text-md font-semibold text-ink">What you&apos;re ordering</h2>
              <Field label="Product · required">{(a) => <Input {...a} required value={f.title} onChange={(e) => set("title")(e.target.value)} maxLength={200} className={size} />}</Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <Field label="Quantity · required">
                  {(a) => (
                    <div className="flex gap-2">
                      <Input {...a} required type="number" min={1} step="any" inputMode="decimal" value={f.quantity} onChange={(e) => set("quantity")(e.target.value)} className={cn("min-w-0 flex-1 text-right", size)} />
                      <Select aria-label="Unit" value={f.unit} onValueChange={set("unit")} options={UNITS.map((u) => ({ value: u, label: unitWords(u) }))} className={cn("w-[120px] shrink-0", size)} />
                    </div>
                  )}
                </Field>
                <Field label={`Price per ${perUnit(f.unit)}`}>
                  {(a) => (
                    <div className="flex gap-2">
                      <Select aria-label="Currency" value={f.currency} onValueChange={set("currency")} options={CURRENCIES.map((c) => ({ value: c, label: c === "USD" ? "US$" : c }))} className={cn("w-24 shrink-0", size)} />
                      <Input {...a} type="number" min={0} step="any" inputMode="decimal" value={f.price} onChange={(e) => set("price")(e.target.value)} className={cn("min-w-0 flex-1 text-right", size)} />
                    </div>
                  )}
                </Field>
              </div>
              <Field label="PO number · optional" className="sm:max-w-[312px]">
                {(a) => <Input {...a} value={f.po} onChange={(e) => set("po")(e.target.value)} maxLength={64} className={cn("font-mono", size)} />}
              </Field>
            </section>

            <section aria-label="Shipping" className="flex flex-col gap-3">
              <h2 className="text-md font-semibold text-ink">Shipping</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <Field label="Incoterm">
                  {(a) => <Select {...a} value={f.incoterm || "none"} onValueChange={(v) => set("incoterm")(v === "none" ? "" : v)} options={[{ value: "none", label: "Not set" }, ...INCOTERMS.map((v) => ({ value: v, label: v }))]} className={size} />}
                </Field>
                <Field label="Ship to">
                  {(a) => (
                    <>
                      <Input {...a} list={`${id}-countries`} value={f.shipTo} onChange={(e) => set("shipTo")(e.target.value)} maxLength={64} placeholder="Country" className={size} />
                      <datalist id={`${id}-countries`}>
                        {SHIP_TO.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <Field label="From port">{(a) => <Input {...a} value={f.originPort} onChange={(e) => set("originPort")(e.target.value)} maxLength={128} className={size} />}</Field>
                <Field label="To port">{(a) => <Input {...a} value={f.destinationPort} onChange={(e) => set("destinationPort")(e.target.value)} maxLength={128} className={size} />}</Field>
                <Field label="Ship by">{(a) => <Input {...a} type="date" value={f.shipBy} onChange={(e) => set("shipBy")(e.target.value)} className={size} />}</Field>
                <Field label="Deliver by">{(a) => <Input {...a} type="date" value={f.deliverBy} onChange={(e) => set("deliverBy")(e.target.value)} className={size} />}</Field>
              </div>
              <Field label="Notes · optional">{(a) => <textarea {...a} className={textarea} value={f.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={4000} rows={3} />}</Field>
            </section>
          </div>
        </form>
        <aside aria-label="Order value" className="flex flex-col gap-3 border-t border-line bg-subtle px-4 py-5 sm:px-6 xl:w-details xl:shrink-0 xl:border-l xl:border-t-0">
          <h2 className="text-md font-semibold text-ink">Order value</h2>
          <p className={cn("text-2xl font-semibold tracking-tight [font-variant-numeric:tabular-nums]", value ? "text-ink" : "text-ink-3")}>{value ?? "Not priced yet"}</p>
          <p className="text-sm text-ink-2">{line ?? "Add a quantity and a price per piece and the value shows here."}</p>
          <div className="h-px bg-line" />
          <p className="text-sm text-ink-3">{seed.supplierName} sees this order and can log its own updates.</p>
        </aside>
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:sticky max-sm:bottom-0 max-sm:z-sticky sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
        <p role="status" aria-live="polite" className={cn("min-w-0 text-sm", error ? "text-danger" : missing.length ? "text-ink-3" : "text-ink-3")}>
          {error ?? (missing.length > 0 ? `Add ${missing.join(", ")} to create it.` : value ? `Order value ${value}.` : "Ready to create.")}
        </p>
        <div className="flex items-center gap-2">
          <Link href={cancelHref} prefetch={false} className={buttonClass({ kind: "secondary", size: "lg", className: "max-sm:h-12" })}>
            Cancel
          </Link>
          <Button type="submit" form={`${id}-form`} kind="primary" size="lg" disabled={missing.length > 0 || busy} loading={busy} loadingLabel="Creating" className="max-sm:h-12 max-sm:flex-1">
            Create order
            <span className="text-xs font-medium opacity-85 max-sm:hidden">{apple ? "⌘↵" : "Ctrl+Enter"}</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
