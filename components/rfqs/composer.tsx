"use client";

// The RFQ composer (Paper `10 · RFQ composer` for one supplier and for fifty, `· Review all 50`,
// `11 · RFQ composer`). One component for the full page (`/app/rfqs/new`) and for the pane beside
// the results or a record (`/app/discover?rfq=`): the suppliers it goes to, what is being asked
// (product, details, quantity, target price, ship by and to), the questions, and a preview of what
// each supplier gets with the message from the workspace's template. A footer says what is still
// missing, saves a draft and sends; Ctrl+Enter (Cmd+Enter on a Mac) sends and the button says so.
//
// Product truth: the server refuses a sanctioned or an unpublished target (`rfq_create`), so the
// composer withholds Send for a sanctioned one and says why. No contact value reaches this
// component; the supplier is written to inside SourceBD. A supplier sees the buyer's target price
// (the RFQ carries it), so the form says so instead of offering a switch the product cannot keep;
// nothing here attaches a file, because no file is stored.

import { ArrowLeft, LockSimple, Plus, X } from "@phosphor-icons/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Link from "next/link";
import { useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { ComposerPrefill, ComposerTarget, ComposerWorkspace } from "@/components/dashboard/rfq-composer";
import { Button, Dialog, DialogClose, Field, IconButton, Input, Select, buttonClass, fieldBox, fieldEdge } from "@/components/kit";
import { SanctionBanner } from "@/components/patterns";
import { formatDay, formatTime, nameSecondLine, splitQualifier } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import {
  CURRENCIES,
  DEFAULT_QUESTIONS,
  DEFAULT_TEMPLATE,
  LISTED_TARGETS,
  MAX_QUESTIONS,
  MAX_TARGETS,
  SHIP_TO,
  UNITS,
  afterPick,
  buildPayload,
  fillTemplate,
  leftoverPlaceholders,
  listAnd,
  missingFields,
  neededWords,
  refusalWords,
  sendWords,
  targetSummary,
  typeCounts,
} from "./composer-model";
import { SupplierPicker, resolvePicked } from "./picker";
import { money, perUnit, quantityWords, unitWords } from "./words";

const textarea = cn(fieldBox, fieldEdge, "block min-h-16 px-2.5 py-1.5 text-base");

function useApplePlatform(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/i.test(typeof navigator === "undefined" ? "" : navigator.platform),
    () => false,
  );
}

/** "Add suppliers" is one button; the suppliers are listed by name up to five, and summarised beyond. */
function Targets({
  targets,
  onRemove,
  onAdd,
  onReview,
  note,
}: {
  targets: ComposerTarget[];
  onRemove: (t: ComposerTarget) => void;
  onAdd: () => void;
  onReview: () => void;
  note: string | null;
}) {
  const listed = targets.length > 0 && targets.length <= LISTED_TARGETS;
  const places = [...new Set(targets.map((t) => t.place).filter((p): p is string => Boolean(p)))].slice(0, 4);
  return (
    <section aria-label="Suppliers" className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-md font-semibold text-ink">To</h2>
        <p className="text-sm text-ink-3">
          {targets.length} {targets.length === 1 ? "supplier" : "suppliers"} · you can add up to {MAX_TARGETS}
        </p>
      </div>
      {note ? <p className="text-sm font-medium text-caution">{note}</p> : null}
      {targets.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-line-strong p-4">
          <p className="text-base text-ink-2">No supplier yet. Add them from your saved suppliers, a search or a recent RFQ.</p>
          <Button kind="secondary" icon={Plus} onClick={onAdd} className="max-sm:h-input-touch max-sm:text-md">
            Add suppliers
          </Button>
        </div>
      ) : listed ? (
        <div className="flex flex-col rounded-md border border-line">
          {targets.map((t) => (
            <div key={t.slug} className="flex items-center gap-3 border-b border-line py-2 pl-3 pr-2 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-medium text-ink [overflow-wrap:anywhere]" title={t.name}>
                  {splitQualifier(t.name).base}
                </span>
                <span className="text-xs text-ink-3 max-sm:text-sm">
                  {[nameSecondLine(t.name, t.type, t.place), t.sanctioned ? "sanctioned" : "contact details locked"].filter(Boolean).join(" · ")}
                </span>
              </div>
              {targets.length > 1 || t.sanctioned ? (
                <span className="max-sm:hidden">
                  <IconButton icon={X} label={`Remove ${t.name}`} kind="quiet" onClick={() => onRemove(t)} />
                </span>
              ) : null}
              {targets.length > 1 || t.sanctioned ? (
                <span className="sm:hidden">
                  <IconButton icon={X} label={`Remove ${t.name}`} kind="quiet" size={44} onClick={() => onRemove(t)} />
                </span>
              ) : null}
            </div>
          ))}
          <div className="border-t border-line p-2">
            <Button kind="secondary" icon={Plus} onClick={onAdd} className="max-sm:h-input-touch max-sm:text-md max-sm:w-full">
              Add suppliers
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-md border border-line p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-base font-medium text-ink">{targetSummary(targets)}</p>
            <p className="text-sm text-ink-3">{[typeCounts(targets), places.length ? `in ${listAnd(places)}` : null].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button kind="secondary" onClick={onReview} className="max-sm:h-input-touch max-sm:text-md">
              Review all {targets.length}
            </Button>
            <Button kind="secondary" icon={Plus} onClick={onAdd} className="max-sm:h-input-touch max-sm:text-md">
              Add
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** The list inside "Review all": every supplier by name with a way to take one out, and a search over them. */
export function ReviewBody({ targets, onRemove, q = "", onQuery }: { targets: ComposerTarget[]; onRemove: (t: ComposerTarget) => void; q?: string; onQuery?: (q: string) => void }) {
  const shown = targets.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <Input type="search" aria-label={`Find in these ${targets.length}`} placeholder={`Find in these ${targets.length}`} value={q} onChange={(e) => onQuery?.(e.target.value)} />
      <ul className="-mb-2 max-h-80 overflow-y-auto border-t border-line">
        {shown.map((t) => (
          <li key={t.slug} className="flex items-center gap-3 border-b border-line py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-medium text-ink [overflow-wrap:anywhere]">{t.name}</span>
              <span className="text-xs text-ink-3">{[t.type, t.place, t.sanctioned ? "sanctioned" : null].filter(Boolean).join(" · ")}</span>
            </span>
            <Button kind="quiet" onClick={() => onRemove(t)} aria-label={`Remove ${t.name}`}>
              Remove
            </Button>
          </li>
        ))}
        {shown.length === 0 ? <li className="py-3 text-base text-ink-3">No supplier by that name in this RFQ.</li> : null}
      </ul>
    </>
  );
}

/** `912-0`: every supplier by name in a dialog. */
function ReviewAll({ open, onOpenChange, targets, onRemove }: { open: boolean; onOpenChange: (open: boolean) => void; targets: ComposerTarget[]; onRemove: (t: ComposerTarget) => void }) {
  const [q, setQ] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      kind="form"
      title={`${targets.length} ${targets.length === 1 ? "supplier gets" : "suppliers get"} this RFQ`}
      footer={
        <DialogClose asChild>
          <Button kind="primary">Done</Button>
        </DialogClose>
      }
    >
      <ReviewBody targets={targets} onRemove={onRemove} q={q} onQuery={setQ} />
    </Dialog>
  );
}

export function RfqComposer({
  targets: initialTargets,
  prefill = {},
  workspace,
  closeHref,
  backHref,
  backLabel,
  mode = "pane",
  draftId: initialDraftId = null,
}: {
  targets: ComposerTarget[];
  prefill?: ComposerPrefill;
  workspace: ComposerWorkspace | null;
  /** Where Close returns to: the search, the record or the supplier this came from. */
  closeHref: string;
  /** "Record", when the composer replaced a record in the pane. */
  backHref?: string | null;
  /** The page's back link: "Back to Aboni Knitwear Ltd.", "Back to RFQs". */
  backLabel?: string;
  mode?: "pane" | "page";
  draftId?: string | null;
}) {
  const router = useContext(AppRouterContext);
  const id = useId();
  const apple = useApplePlatform();
  const page = mode === "page";
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
  const [questions, setQuestions] = useState<string[]>([...baseQuestions]);
  const [newQuestion, setNewQuestion] = useState("");
  const [messageEdited, setMessageEdited] = useState<string | null>(prefill.message?.trim() ? prefill.message : null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [pickNote, setPickNote] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function confirmPicked(picked: ComposerTarget[]) {
    setPicking(false);
    const r = await resolvePicked(picked, MAX_TARGETS);
    const next = afterPick(targets, r);
    setTargets(next.targets);
    setPickNote(next.note);
  }

  const sanctioned = targets.filter((t) => t.sanctioned);
  const per = perUnit(unit);
  const productLine = [title.trim() || "[product]", Number(quantity) >= 1 ? quantityWords(Number(quantity), unit) : null, targetPrice ? `target ${targetPrice} ${currency}` : null, shipBy ? `ship by ${formatDay(shipBy) ?? shipBy}` : null].filter(Boolean).join(" · ");
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
  const missing = [...missingFields({ title, quantity, unit, targets: targets.length }), ...leftoverPlaceholders(message).map((label) => `${label} in the message`)];
  const blocked = sanctioned.length > 0 || missing.length > 0 || busy !== null;
  const words = sendWords(targets);

  function payload() {
    return buildPayload({ title, description, quantity, unit, targetPrice, currency, shipTo, shipBy, message, questions, targetIds: targets.map((t) => t.id), productId: prefill.productId });
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

  async function send() {
    if (blocked) return;
    setBusy("send");
    setError(null);
    const r = await post({ action: "create", ...payload(), draft_id: draftId ?? undefined });
    setBusy(null);
    const rfqId = typeof r.json?.rfq_id === "string" ? r.json.rfq_id : null;
    if (!r.ok || !rfqId) {
      setError(refusalWords(r.status, r.json));
      return;
    }
    // In the pane: back to the search (or record) it sat beside, which says "RFQ sent" with a
    // link. As a page: the new RFQ, open beside the list.
    const sep = closeHref.includes("?") ? "&" : "?";
    const next = page ? `/app/rfqs?open=${encodeURIComponent(rfqId)}` : `${closeHref}${sep}sent=${encodeURIComponent(rfqId)}`;
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
      setError(r.status === 0 ? "Could not save the draft: no connection." : "Could not save the draft. It is still here; try again in a moment.");
      return;
    }
    setDraftId(newId);
    setDraftSavedAt(`${formatTime(new Date().toISOString())} UTC`);
  }

  function onKey(e: KeyboardEvent<HTMLElement>) {
    // A dialog is portalled out of the form but its keys still bubble here: only a key typed in the composer itself sends.
    if (!e.currentTarget.contains(e.target as Node)) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  }

  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>("input, textarea")?.focus({ preventScroll: true });
  }, []);

  function addQuestion() {
    const q = newQuestion.trim();
    if (!q || questions.length >= MAX_QUESTIONS) return;
    setQuestions((qs) => [...qs, q]);
    setNewQuestion("");
  }

  const remove = (t: ComposerTarget) => setTargets((xs) => xs.filter((x) => x.slug !== t.slug));
  const status = error
    ? { text: error, tone: "text-danger" }
    : sanctioned.length > 0
      ? { text: "RFQs cannot be sent to a sanctioned supplier", tone: "text-sanction" }
      : missing.length > 0
        ? { text: neededWords(missing), tone: "text-danger" }
        : draftSavedAt
          ? { text: `Draft saved ${draftSavedAt}. ${words.sends}`, tone: "text-ink-3" }
          : { text: words.sends, tone: "text-ink-3" };
  const Heading = page ? "h1" : "h2";
  const single = targets.length === 1 ? targets[0]!.name : null;

  const root = (children: React.ReactNode) =>
    page ? (
      <section aria-label="New RFQ" data-detail="" onKeyDown={onKey} className="flex min-h-0 flex-1 flex-col bg-surface">
        {children}
      </section>
    ) : (
      <section data-record-pane="" aria-label="New RFQ" tabIndex={-1} onKeyDown={onKey} className="flex min-h-0 flex-1 flex-col bg-surface outline-none">
        {children}
      </section>
    );

  return root(
    <>
      {page ? (
        <header className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-6">
          <Link href={closeHref} prefetch={false} className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-base font-medium text-ink-2 outline-none hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-6">
            <ArrowLeft size={16} className="shrink-0" aria-hidden />
            {backLabel ?? "Back"}
          </Link>
          <Heading className="text-xl font-semibold tracking-tight text-ink">New RFQ</Heading>
        </header>
      ) : (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            {backHref ? (
              <Link href={backHref} scroll={false} prefetch={false} className="inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                Record
              </Link>
            ) : null}
            <Heading className="text-xl font-semibold tracking-tight text-ink">New RFQ</Heading>
          </div>
          <Link href={closeHref} scroll={false} prefetch={false} aria-label="Close" className={cn(buttonClass({ kind: "quiet", size: "icon-32" }), "shrink-0 max-xl:hidden")}>
            <X size={20} aria-hidden />
          </Link>
        </header>
      )}

      {sanctioned.length > 0 ? (
        <SanctionBanner
          title={`${sanctioned.length === 1 ? "This supplier is" : `${sanctioned.length} of these suppliers are`} on a sanctions screen: ${sanctioned.map((t) => t.name).join(", ")}.`}
          detail={`Remove ${sanctioned.length === 1 ? "it" : "them"} to send this RFQ. RFQs cannot be sent to a sanctioned supplier.`}
        />
      ) : null}

      <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", page && "xl:flex-row xl:overflow-visible")}>
        <form
          id={`${id}-form`}
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className={cn("flex min-w-0 flex-col gap-6 px-4 py-5 sm:px-6", page ? "xl:flex-1 xl:overflow-y-auto" : "")}
        >
          <div className="flex w-full max-w-pane flex-col gap-6">
            <Targets targets={targets} onRemove={remove} onAdd={() => setPicking(true)} onReview={() => setReviewing(true)} note={pickNote} />

            <section aria-label="What you're asking for" className="flex flex-col gap-3">
              <h2 className="text-md font-semibold text-ink">What you&apos;re asking for</h2>
              <Field label="Product · required">
                {(a) => <Input {...a} required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Men's knitted piqué polo, 220 gsm" />}
              </Field>
              <Field label="Details">
                {(a) => <textarea {...a} className={textarea} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={3} />}
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                <Field label="Quantity · required">
                  {(a) => (
                    <div className="flex gap-2">
                      <Input {...a} required type="number" min={1} step="any" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 24,000" className="min-w-0 flex-1 text-right max-sm:h-input-touch max-sm:text-md" />
                      <UnitSelect value={unit} onChange={setUnit} />
                    </div>
                  )}
                </Field>
                <Field label={`Target price per ${per}`} help="Suppliers see your target price.">
                  {(a) => (
                    <div className="flex gap-2">
                      <Select aria-label="Currency" value={currency} onValueChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c === "USD" ? "US$" : c }))} className="w-24 shrink-0 max-sm:h-input-touch max-sm:text-md" />
                      <Input {...a} type="number" min={0} step="any" inputMode="decimal" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} className="min-w-0 flex-1 text-right max-sm:h-input-touch max-sm:text-md" />
                    </div>
                  )}
                </Field>
                <Field label="Ship by">{(a) => <Input {...a} type="date" value={shipBy} onChange={(e) => setShipBy(e.target.value)} className="max-sm:h-input-touch max-sm:text-md" />}</Field>
                <Field label="Ship to">
                  {(a) => (
                    <>
                      <Input {...a} list={`${id}-countries`} value={shipTo} onChange={(e) => setShipTo(e.target.value)} maxLength={64} placeholder="Country" className="max-sm:h-input-touch max-sm:text-md" />
                      <datalist id={`${id}-countries`}>
                        {SHIP_TO.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
              </div>
            </section>

            <section aria-label="Questions" className="flex flex-col gap-2">
              <h2 className="text-md font-semibold text-ink">Questions · {questions.length}</h2>
              <ul className="flex flex-col gap-2">
                {questions.map((q, i) => (
                  <li key={`${i}-${q}`} className="flex min-h-10 items-center rounded-sm border border-line pl-3">
                    <span className="min-w-0 flex-1 py-2 text-base text-ink [overflow-wrap:anywhere]">{q}</span>
                    <span className="flex size-10 shrink-0 items-center justify-center max-sm:size-11">
                      <IconButton icon={X} label={`Remove question: ${q}`} kind="quiet" size={32} onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} className="max-sm:size-11" />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  aria-label="Add a question"
                  placeholder="e.g. Sample lead time and cost"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  maxLength={200}
                  className="min-w-0 flex-1 max-sm:h-input-touch max-sm:text-md"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newQuestion.trim()) {
                      e.preventDefault();
                      addQuestion();
                    }
                  }}
                />
                <Button kind="secondary" disabled={!newQuestion.trim() || questions.length >= MAX_QUESTIONS} onClick={addQuestion} className="max-sm:h-input-touch max-sm:text-md">
                  Add question
                </Button>
              </div>
            </section>
          </div>
        </form>

        <aside aria-label="Preview" className={cn("flex flex-col gap-3 border-t border-line bg-subtle px-4 py-5 sm:px-6", page ? "xl:w-details xl:shrink-0 xl:overflow-y-auto xl:border-l xl:border-t-0" : "")}>
          <h2 className="text-md font-semibold text-ink">{single ? `What ${single} gets` : "What each supplier gets"}</h2>
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <p className="text-xs text-ink-3">RFQ from {workspace?.userName ?? "you"}, on SourceBD</p>
            <p className="text-base font-semibold text-ink [overflow-wrap:anywhere]">{title.trim() || "[product]"}</p>
            <dl className="flex flex-col gap-1 text-sm">
              {([
                ["Quantity", Number(quantity) >= 1 ? quantityWords(Number(quantity), unit) : "Not set yet"],
                ["Target", targetPrice.trim() && Number(targetPrice) > 0 ? `${money(Number(targetPrice), currency)} per ${per}` : "Not set"],
                ["Ship by", shipBy ? (formatDay(shipBy) ?? shipBy) : "Not set"],
                ["Ship to", shipTo.trim() || "Not set"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className={cn("text-right", v.startsWith("Not set") ? "text-ink-3" : "text-ink-2")}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="h-px bg-line" />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-ink-3">Message · {messageEdited === null ? "from your RFQ template" : "edited here"}</p>
                {editing ? (
                  <button type="button" onClick={() => setEditing(false)} className="min-h-6 rounded-sm text-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:decoration-2 max-sm:min-h-11">
                    Done
                  </button>
                ) : (
                  <button type="button" onClick={() => setEditing(true)} className="min-h-6 rounded-sm text-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:decoration-2 max-sm:min-h-11">
                    Edit
                  </button>
                )}
              </div>
              {editing ? (
                <>
                  <textarea aria-label="Message" value={message} onChange={(e) => setMessageEdited(e.target.value)} rows={8} maxLength={8000} className={textarea} />
                  {messageEdited !== null ? (
                    <button type="button" onClick={() => setMessageEdited(null)} className="min-h-6 w-fit rounded-sm text-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:decoration-2 max-sm:min-h-11">
                      Reset to template
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-ink-2 [overflow-wrap:anywhere]">{message}</p>
              )}
            </div>
            <p className="text-xs text-ink-3">
              Then your {questions.length} {questions.length === 1 ? "question" : "questions"}, each with a space to answer.
            </p>
          </div>
          {leftoverPlaceholders(message).length > 0 ? (
            <div role="note" className="flex flex-col gap-1 rounded-md bg-caution-tint p-3 text-sm text-caution">
              <p className="font-medium">
                {listAnd(leftoverPlaceholders(message).map((l) => l.replace(/^your /, "")))} {leftoverPlaceholders(message).length === 1 ? "is" : "are"} missing, so it shows in [brackets].
              </p>
              <Link href="/app/settings/workspace" prefetch={false} className="inline-flex min-h-6 w-fit items-center text-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] max-sm:min-h-11">
                Add it in Settings
              </Link>
            </div>
          ) : null}
          <p className="flex items-start gap-2 text-sm text-ink-3">
            <LockSimple size={16} className="mt-0.5 shrink-0" aria-hidden />
            Each supplier gets its own copy. No supplier sees who else you asked.
          </p>
        </aside>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:sticky max-sm:bottom-0 max-sm:z-sticky sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
        <p role="status" aria-live="polite" className={cn("min-w-0 text-sm", status.tone)}>
          {status.text}
        </p>
        <div className="flex items-center gap-2">
          <Button kind="secondary" size="lg" onClick={() => void saveDraft()} loading={busy === "draft"} loadingLabel="Saving" disabled={busy !== null} className="max-sm:h-12">
            Save draft
          </Button>
          <Button type="submit" form={`${id}-form`} kind="primary" size="lg" disabled={blocked} loading={busy === "send"} loadingLabel="Sending" aria-describedby={`${id}-send-hint`} className="max-sm:h-12 max-sm:flex-1">
            {words.send}
            <span className="text-xs font-medium opacity-85 max-sm:hidden">{apple ? "⌘↵" : "Ctrl+Enter"}</span>
          </Button>
          <span id={`${id}-send-hint`} className="sr-only">
            Sends to every supplier listed. {apple ? "Command" : "Control"} plus Enter also sends.
          </span>
        </div>
      </div>

      <SupplierPicker open={picking} onOpenChange={setPicking} selected={targets} max={MAX_TARGETS} onConfirm={(p) => void confirmPicked(p)} />
      <ReviewAll open={reviewing} onOpenChange={setReviewing} targets={targets} onRemove={remove} />
    </>,
  );
}

function UnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Select aria-label="Unit" value={value} onValueChange={onChange} options={UNITS.map((u) => ({ value: u, label: unitWords(u) }))} className="w-[120px] shrink-0 max-sm:h-input-touch max-sm:text-md" />;
}
