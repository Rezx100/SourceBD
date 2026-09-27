"use client";

// The RFQ composer (enterprise pass, 27 Sep 2026): the one place a buyer
// writes to suppliers, opened INSIDE the shell — in the pane beside the
// results (`/app/discover?rfq=<ids>`), beside a record, or as the content
// region of `/app/rfqs/new` for a deep link. Never a page jump: the search,
// the selection and the open record stay where they were, and Close returns
// to them.
//
// Anatomy, after the founder's reference (27 Sep): the targets with their
// marks at the top; the product block; the message, drawn from the
// workspace's template with its facts filled in; the questions; a preview of
// what the RFQ will carry, beside the form where there is room; a footer that
// names what is still missing, saves a draft, and sends. ⌘↵ sends.
//
// Product truth: the server refuses a sanctioned target (`rfq_create`), so
// the composer withholds Send for one too and says why. No contact value
// ever reaches this component; the supplier is written to inside SourceBD.

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Link from "next/link";
import { useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { SourceMarkModel } from "@/lib/dashboard/source-tiers";
import type { TierRank } from "@/lib/design/tokens";
import { formatQuantity, formatDay, formatTime } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { Button, Checkbox, Kbd } from "./controls";
import { Field, SelectInput, TextArea, TextInput } from "./fields";
import { Icon } from "./icons";
import { LogoTile, SourceMarks } from "./marks";
import { SanctionBanner, Sheet, SheetBar, SheetScroll } from "./sheet";
import { SupplierPicker, targetFromRow, type SupplierRow } from "./supplier-picker";
import { Caption, Label } from "./type";

/** A supplier this RFQ goes to. Facts only; never a contact value. */
export type ComposerTarget = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  tier: TierRank;
  marks: SourceMarkModel[];
  place: string | null;
  type: string;
  sanctioned: boolean;
  sanctionSample?: boolean;
};

/** What the composer starts with: the line a buyer arrived from, or one of their own products. */
export type ComposerPrefill = {
  title?: string | null;
  description?: string | null;
  quantity?: string | null;
  unit?: string | null;
  targetPrice?: string | null;
  currency?: string | null;
  shipTo?: string | null;
  shipBy?: string | null;
  hs?: string | null;
  productId?: string | null;
  /** A saved draft's own message and questions; without them the workspace template and questions fill in. */
  message?: string | null;
  questions?: string[] | null;
};

/** The buyer's workspace, for the template's variables and the default questions. Null facts are named as missing, never invented. */
export type ComposerWorkspace = {
  companyName: string | null;
  userName: string | null;
  website: string | null;
  questions: string[];
  emailTemplate: string | null;
};

export const UNITS = ["pcs", "sets", "pairs", "dozens", "kg", "m"] as const;
export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "BDT"] as const;
export const SHIP_TO = ["United Kingdom", "United States", "Germany", "France", "Netherlands", "Italy", "Spain", "Canada", "Australia"] as const;

/** The five questions a first RFQ asks when the workspace has set none. */
export const DEFAULT_QUESTIONS = [
  "Unit price at this quantity, FOB Chattogram",
  "Minimum order quantity per colour",
  "Sample lead time and cost",
  "Which certificate scope this line ships under",
  "Payment terms you can offer",
] as const;

export const DEFAULT_TEMPLATE =
  "Dear {{supplier}},\n\nWe read your record on SourceBD and would like a quotation for the line below.\n\n{{product}}\n\nPlease answer the questions under the product. Reply inside SourceBD.\n\n{{user}}\n{{company}}\n{{website}}";

/**
 * Fill the template's variables from the facts on hand; a missing fact is
 * named in brackets so the buyer sees the gap before the supplier does.
 */
export function fillTemplate(
  template: string,
  vars: { supplier: string; product: string; user: string | null; company: string | null; website: string | null },
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const pick = (v: string | null, label: string) => {
    if (v && v.trim()) return v.trim();
    missing.push(label);
    return `[${label}]`;
  };
  const text = template
    .replaceAll("{{supplier}}", vars.supplier)
    .replaceAll("{{product}}", vars.product)
    .replaceAll("{{user}}", pick(vars.user, "your name"))
    .replaceAll("{{company}}", pick(vars.company, "company name"))
    .replaceAll("{{website}}", pick(vars.website, "website"));
  return { text, missing };
}

/** `a`, `a or b`, `a, b or c`. */
function listOr(items: string[]): string {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

/** What is still required before Send: the words the footer says. */
export function missingFields(v: { title: string; quantity: string; unit: string; targets: number }): string[] {
  const out: string[] = [];
  if (!v.title.trim()) out.push("product title");
  if (!(Number(v.quantity) >= 1)) out.push("quantity");
  if (!v.unit.trim()) out.push("unit");
  if (v.targets === 0) out.push("a supplier");
  return out;
}

export function RfqComposer({
  targets: initialTargets,
  prefill = {},
  workspace,
  closeHref,
  backHref,
  addHref,
  mode = "pane",
  draftId: initialDraftId = null,
}: {
  targets: ComposerTarget[];
  prefill?: ComposerPrefill;
  workspace: ComposerWorkspace | null;
  /** Where Close returns to: the search, or the record this came from. */
  closeHref: string;
  /** "Back to the record", when the composer replaced a record in the pane. */
  backHref?: string | null;
  /** Where to add suppliers: the results beside the pane, or the search. */
  addHref?: string | null;
  mode?: "pane" | "page";
  draftId?: string | null;
}) {
  const router = useContext(AppRouterContext);
  const id = useId();
  const [targets, setTargets] = useState(initialTargets);
  const [title, setTitle] = useState(prefill.title ?? "");
  const [description, setDescription] = useState(prefill.description ?? "");
  const [quantity, setQuantity] = useState(prefill.quantity ?? "");
  const [unit, setUnit] = useState(prefill.unit ?? "pcs");
  const [targetPrice, setTargetPrice] = useState(prefill.targetPrice ?? "");
  const [currency, setCurrency] = useState(prefill.currency ?? "USD");
  const [shipTo, setShipTo] = useState(prefill.shipTo ?? "");
  const [shipBy, setShipBy] = useState(prefill.shipBy ?? "");
  const baseQuestions = prefill.questions?.length ? prefill.questions : workspace?.questions?.length ? workspace.questions : [...DEFAULT_QUESTIONS];
  const [questions, setQuestions] = useState<{ text: string; on: boolean }[]>(baseQuestions.map((text) => ({ text, on: true })));
  const [newQuestion, setNewQuestion] = useState("");
  const [messageEdited, setMessageEdited] = useState<string | null>(prefill.message?.trim() ? prefill.message : null);
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [picking, setPicking] = useState(false);
  const [pickNote, setPickNote] = useState<string | null>(null);

  /**
   * The picker's choices, resolved on the server: a typeahead result has no id
   * and no source tags, and only the server knows today's sanction flag and
   * whether the supplier is still published. Anything it does not return is
   * left out, and the buyer is told how many.
   */
  async function confirmPicked(picked: ComposerTarget[]) {
    setPicking(false);
    const ids = picked.map((t) => t.id).filter(Boolean);
    const slugs = picked.filter((t) => !t.id).map((t) => t.slug);
    const qs = new URLSearchParams();
    if (ids.length) qs.set("ids", ids.join(","));
    if (slugs.length) qs.set("slugs", slugs.join(","));
    try {
      const res = await fetch(`/api/v1/suppliers?${qs.toString()}`, { headers: { accept: "application/json" } });
      const json = (await res.json().catch(() => null)) as { rows?: SupplierRow[]; error?: string } | null;
      if (!res.ok || !Array.isArray(json?.rows)) {
        setPickNote(json?.error ?? "The suppliers could not be checked just now. Nothing was added; try again.");
        return;
      }
      const byId = new Map(json.rows.map((r) => [r.id, r]));
      const bySlug = new Map(json.rows.map((r) => [r.slug, r]));
      const resolved = picked
        .map((t) => (t.id ? byId.get(t.id) : bySlug.get(t.slug)))
        .filter((r): r is SupplierRow => Boolean(r))
        .map(targetFromRow);
      const dropped = picked.length - resolved.length;
      setTargets(resolved.slice(0, 50));
      setPickNote(dropped > 0 ? `${dropped} ${dropped === 1 ? "supplier is" : "suppliers are"} no longer listed and ${dropped === 1 ? "was" : "were"} left out.` : null);
    } catch {
      setPickNote("The suppliers could not be checked — no connection. Nothing was added; try again.");
    }
  }

  const sanctioned = targets.filter((t) => t.sanctioned);
  const productLine = [title.trim() || "[product]", Number(quantity) >= 1 ? formatQuantity(Number(quantity), unit) : null, targetPrice ? `target ${targetPrice} ${currency}` : null, shipBy ? `ship by ${formatDay(shipBy) ?? shipBy}` : null]
    .filter(Boolean)
    .join(" · ");
  const filled = useMemo(
    () =>
      fillTemplate(workspace?.emailTemplate?.trim() || DEFAULT_TEMPLATE, {
        supplier: targets.length === 1 ? targets[0]!.name : "supplier",
        product: productLine,
        user: workspace?.userName ?? null,
        company: workspace?.companyName ?? null,
        website: workspace?.website ?? null,
      }),
    [workspace, targets, productLine],
  );
  const message = messageEdited ?? filled.text;
  const missing = missingFields({ title, quantity, unit, targets: targets.length });
  const blocked = sanctioned.length > 0 || missing.length > 0 || busy !== null;
  const asked = questions.filter((q) => q.on).map((q) => q.text);

  function payload(): Record<string, unknown> {
    const p: Record<string, unknown> = {
      product_title: title.trim(),
      product_description: description.trim() || undefined,
      quantity: Number(quantity),
      quantity_unit: unit.trim(),
      currency,
      target_supplier_ids: targets.map((t) => t.id),
      message: message.trim() || undefined,
      questions: asked,
    };
    if (targetPrice.trim()) p.target_unit_price = Number(targetPrice);
    if (shipTo.trim()) p.ship_to_country = shipTo.trim();
    if (shipBy.trim()) p.ship_by = shipBy.trim();
    if (prefill.productId) p.product_id = prefill.productId;
    return p;
  }

  async function post(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> {
    try {
      const res = await fetch("/api/v1/rfqs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      return { ok: res.ok, status: res.status, json };
    } catch {
      return { ok: false, status: 0, json: null };
    }
  }

  /** The sentence for a refused send: the server's own reason where it gave one, in plain words otherwise. */
  function refusal(status: number, json: Record<string, unknown> | null): string {
    const detail = typeof json?.detail === "string" ? json.detail : typeof json?.error === "string" ? json.error : null;
    if (status === 0) return "Could not reach SourceBD — no connection. Your draft is still here; try again.";
    if (status === 401 || status === 403) return "Sign in with a buyer account to send an RFQ.";
    if (status === 429) return "Too many RFQs in the last minute. Wait a minute and send again.";
    if (detail && /not published|sanction/i.test(detail)) return "One of these suppliers cannot receive an RFQ any more. Remove it and send again.";
    return detail ? `Could not send: ${detail}` : "Could not send this RFQ. Nothing was sent; try again in a moment.";
  }

  async function send() {
    if (blocked) return;
    setBusy("send");
    setError(null);
    const r = await post({ action: "create", ...payload(), draft_id: draftId ?? undefined });
    setBusy(null);
    const rfqId = typeof r.json?.rfq_id === "string" ? r.json.rfq_id : null;
    if (!r.ok || !rfqId) {
      setError(refusal(r.status, r.json));
      return;
    }
    // Stay where the buyer was: the search (or the record) comes back with a
    // toast saying the RFQ went, and a link to it.
    // In the pane: back to the search (or record) it sat beside, which says
    // "RFQ sent" with a link. As a page: the new RFQ, open beside the list.
    const sep = closeHref.includes("?") ? "&" : "?";
    const next = mode === "page" ? `/app/rfqs?open=${encodeURIComponent(rfqId)}` : `${closeHref}${sep}sent=${encodeURIComponent(rfqId)}`;
    if (router) {
      router.replace(next, { scroll: false });
      router.refresh();
    } else {
      window.location.assign(next);
    }
  }

  async function saveDraft() {
    setBusy("draft");
    setError(null);
    const r = await post({ action: "save_draft", draft_id: draftId ?? undefined, payload: payload() });
    setBusy(null);
    const newId = typeof r.json?.draft_id === "string" ? r.json.draft_id : null;
    if (!r.ok || !newId) {
      setError(r.status === 0 ? "Could not save the draft — no connection." : "Could not save the draft. It is still here; try again in a moment.");
      return;
    }
    setDraftId(newId);
    setDraftSavedAt(`${formatTime(new Date().toISOString())} UTC`);
  }

  function onKey(e: KeyboardEvent<HTMLFormElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  }

  // The footer's status is a live region; it must exist before the first change.
  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>("input, textarea")?.focus({ preventScroll: true });
  }, []);

  const context = [
    targets.length === 1 ? `to ${targets[0]!.name}` : `to ${targets.length} suppliers`,
    prefill.hs ? `HS ${prefill.hs}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (picking) {
    return (
      <Sheet label="Select suppliers" mode={mode}>
        <SupplierPicker selected={targets} onClose={() => setPicking(false)} onConfirm={(picked) => void confirmPicked(picked)} />
      </Sheet>
    );
  }

  return (
    <Sheet label="New RFQ" mode={mode}>
      <SheetBar>
        {backHref ? (
          <Button variant="ghost" size="sm" href={backHref} clientNav scroll={false}>
            <Icon name="chev-l" /> Record
          </Button>
        ) : null}
        <Label className="text-ink-strong">New RFQ</Label>
        <Caption className="min-w-0 [overflow-wrap:anywhere]">{context}</Caption>
        <span className="ml-auto flex items-center gap-2">
          {draftSavedAt ? <Caption>Draft saved {draftSavedAt}</Caption> : null}
          <Button variant="ghost" icon size="sm" aria-label="Close" href={closeHref} clientNav scroll={false}>
            <Icon name="x" />
          </Button>
        </span>
      </SheetBar>
      {sanctioned.length > 0 ? (
        <>
          <SanctionBanner sample={sanctioned.every((t) => t.sanctionSample)} />
          <div className="border-b border-line-subtle px-6 py-2 text-sm text-sanction-ink">
            {sanctioned.length === 1 ? "This supplier is" : `${sanctioned.length} of these suppliers are`} on a sanctions screen:{" "}
            {sanctioned.map((t) => t.name).join(", ")}. Remove {sanctioned.length === 1 ? "it" : "them"} to send this RFQ.
          </div>
        </>
      ) : null}
      <SheetScroll measure={mode === "page"}>
        <form id={`${id}-form`} ref={formRef} onSubmit={(e) => { e.preventDefault(); void send(); }} onKeyDown={onKey} className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-6">
            {/* Who it goes to */}
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <Label className="text-ink-strong">To</Label>
                <Caption>{targets.length} {targets.length === 1 ? "supplier" : "suppliers"} · up to 50</Caption>
                <Button size="sm" className="ml-auto" onClick={() => setPicking(true)}>
                  <Icon name="plus" /> Add suppliers
                </Button>
              </div>
              {pickNote ? <Caption className="text-caution-ink">{pickNote}</Caption> : null}
              {targets.length === 0 ? (
                <p className="m-0 rounded-md border border-dashed border-quiet-line px-4 py-3 text-sm text-quiet-ink">
                  No supplier yet. Add them from your saved suppliers, a search or a recent RFQ
                  {addHref && mode === "pane" ? ", or tick them in the results beside this" : ""}.
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col divide-y divide-line-subtle rounded-md bg-surface-sunken p-0">
                  {targets.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                      <LogoTile initials={t.initials} tier={t.tier} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-medium text-ink-strong [overflow-wrap:anywhere]">{t.name}</span>
                          <SourceMarks marks={t.marks.slice(0, 6)} caption="none" sm />
                          {t.sanctioned ? <span className="text-xs font-medium text-sanction-ink">Sanctioned{t.sanctionSample ? " · sample" : ""}</span> : null}
                        </span>
                        <Caption>{[t.type, t.place].filter(Boolean).join(" · ")}</Caption>
                      </span>
                      <Button variant="ghost" icon size="sm" aria-label={`Remove ${t.name}`} onClick={() => setTargets((xs) => xs.filter((x) => x.id !== t.id))}>
                        <Icon name="x" small />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* The product */}
            <section className="flex flex-col gap-4">
              <Label className="text-ink-strong">Product</Label>
              <Field label="Product title" htmlFor={`${id}-title`} required>
                <TextInput id={`${id}-title`} required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Men's knitted piqué polo, 220 gsm" />
              </Field>
              <Field label="Description" htmlFor={`${id}-desc`} hint="Fabric, sizes, colours, packaging, certifications required.">
                <TextArea id={`${id}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={3} aria-describedby={`${id}-desc-hint`} />
              </Field>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Quantity" htmlFor={`${id}-qty`} required>
                  <TextInput id={`${id}-qty`} required type="number" min={1} step="any" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </Field>
                <Field label="Unit" htmlFor={`${id}-unit`} required>
                  <SelectInput id={`${id}-unit`} value={unit} onChange={(e) => setUnit(e.target.value)}>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Target unit price" htmlFor={`${id}-price`}>
                  <TextInput id={`${id}-price`} type="number" min={0} step="any" inputMode="decimal" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
                </Field>
                <Field label="Currency" htmlFor={`${id}-ccy`}>
                  <SelectInput id={`${id}-ccy`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Ship to" htmlFor={`${id}-shipto`}>
                  <TextInput id={`${id}-shipto`} list={`${id}-countries`} value={shipTo} onChange={(e) => setShipTo(e.target.value)} maxLength={64} placeholder="Country" />
                  <datalist id={`${id}-countries`}>
                    {SHIP_TO.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Ship by" htmlFor={`${id}-shipby`}>
                  <TextInput id={`${id}-shipby`} type="date" value={shipBy} onChange={(e) => setShipBy(e.target.value)} />
                </Field>
              </div>
            </section>

            {/* The message */}
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <Label className="text-ink-strong">Message</Label>
                <Caption>from your workspace template · the supplier reads it inside SourceBD</Caption>
                {messageEdited !== null ? (
                  <button type="button" onClick={() => setMessageEdited(null)} className="ml-auto text-xs font-medium text-brand-ink hover:underline">
                    Reset to template
                  </button>
                ) : null}
              </div>
              <TextArea id={`${id}-msg`} aria-label="Message" value={message} onChange={(e) => setMessageEdited(e.target.value)} rows={8} maxLength={8000} />
              {filled.missing.length > 0 && messageEdited === null ? (
                <Caption className="text-caution-ink">
                  Your workspace has no {listOr(filled.missing.map((m) => m.replace(/^your /, "")))} yet, so the template shows {filled.missing.length === 1 ? "it" : "them"} in brackets.{" "}
                  <Link href="/app/settings/workspace" prefetch={false} className="underline">
                    Fill them in Settings
                  </Link>
                  .
                </Caption>
              ) : null}
            </section>

            {/* The questions */}
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <Label className="text-ink-strong">Questions</Label>
                <Caption>
                  {asked.length} of {questions.length} asked
                </Caption>
              </div>
              <ul className="m-0 flex list-none flex-col divide-y divide-line-subtle p-0">
                {questions.map((q, i) => (
                  <li key={`${i}-${q.text}`} className="flex min-h-9 items-center gap-2.5 py-1 text-sm">
                    <Checkbox on={q.on} label={q.text} onToggle={() => setQuestions((qs) => qs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} />
                    <span className={cn("flex-1", !q.on && "text-ink-subtle")}>{q.text}</span>
                    <Button variant="ghost" icon size="sm" aria-label={`Remove question: ${q.text}`} onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>
                      <Icon name="x" small />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <TextInput
                  aria-label="Add a question"
                  placeholder="Add a question"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  maxLength={200}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newQuestion.trim()) {
                      e.preventDefault();
                      setQuestions((qs) => [...qs, { text: newQuestion.trim(), on: true }]);
                      setNewQuestion("");
                    }
                  }}
                />
                <Button
                  disabled={!newQuestion.trim() || questions.length >= 20}
                  onClick={() => {
                    setQuestions((qs) => [...qs, { text: newQuestion.trim(), on: true }]);
                    setNewQuestion("");
                  }}
                >
                  <Icon name="plus" /> Add
                </Button>
              </div>
            </section>
          </div>

          {/* The preview: what the RFQ will carry, beside the form where there is room */}
          <section className="flex flex-col gap-3 xl:sticky xl:top-0 xl:self-start" aria-label="Preview">
            <div className="flex items-center gap-2">
              <Label className="text-ink-strong">What this RFQ carries</Label>
              <Caption className="ml-auto">stored on the RFQ</Caption>
            </div>
            <div className="flex flex-col gap-2 rounded-md bg-surface-sunken p-4 text-sm text-ink">
              <Caption>To {targets.length === 0 ? "—" : targets.map((t) => t.name).join(", ")}</Caption>
              <Label className="text-ink-strong">
                RFQ · {title.trim() || "[product]"}
                {Number(quantity) >= 1 ? ` · ${formatQuantity(Number(quantity), unit)}` : ""}
                {shipBy ? ` · ship by ${formatDay(shipBy) ?? shipBy}` : ""}
              </Label>
              <p className="m-0 whitespace-pre-wrap text-sm leading-[22px] [overflow-wrap:anywhere]">{message}</p>
              {asked.length > 0 ? (
                <ol className="m-0 flex list-decimal flex-col gap-0.5 pl-5 text-sm">
                  {asked.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              ) : null}
              <Caption>
                1 product line · {asked.length} {asked.length === 1 ? "question" : "questions"}
              </Caption>
            </div>
            <Caption>Your email and phone are not shared. The supplier answers inside SourceBD, with the record attached.</Caption>
          </section>
        </form>
      </SheetScroll>
      <div className="glass flex shrink-0 flex-wrap items-center gap-2 border-t border-line-subtle px-6 py-3">
        <span role="status" aria-live="polite" className={cn("inline-flex min-w-0 flex-1 items-center gap-1 text-xs", error ? "text-danger-ink" : sanctioned.length > 0 ? "text-sanction-ink" : missing.length > 0 ? "text-caution-ink" : "text-ink-subtle")}>
          {error ? (
            <>
              <Icon name="warn" small /> {error}
            </>
          ) : sanctioned.length > 0 ? (
            <>
              <Icon name="warn" small /> RFQs cannot be sent to a sanctioned supplier
            </>
          ) : missing.length > 0 ? (
            <>
              <Icon name="warn" small /> Still needed: {missing.join(", ")}
            </>
          ) : (
            <>Ready to send to {targets.length === 1 ? targets[0]!.name : `${targets.length} suppliers`}</>
          )}
        </span>
        <Button type="button" onClick={() => void saveDraft()} loading={busy === "draft"} disabled={busy !== null}>
          Save draft
        </Button>
        <Button type="submit" form={`${id}-form`} variant="primary" disabled={blocked} loading={busy === "send"} aria-describedby={`${id}-send-hint`}>
          <Icon name="send" /> Send RFQ <Kbd>⌘↵</Kbd>
        </Button>
        <span id={`${id}-send-hint`} className="sr-only">
          Sends to every supplier listed. Command or Control plus Enter also sends.
        </span>
      </div>
    </Sheet>
  );
}
