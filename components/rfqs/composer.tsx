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
import { useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { PaneDivider, usePaneWidth, type PaneLimits } from "@/components/frame/pane-divider";
import { Button, DateInput, Define, Dialog, DialogClose, Field, IconButton, Input, Select, buttonClass, fieldBox, fieldEdge } from "@/components/kit";
import { SanctionBanner } from "@/components/patterns";
import { SAVE_FAILED, browserFetch, postSettings } from "@/components/settings/transport";
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
  fieldNote,
  fillTemplate,
  footerStatus,
  fromWorkspace,
  fromYouSaves,
  leftoverPlaceholders,
  listAnd,
  missingFields,
  needsFromYou,
  refusalWords,
  reviewWords,
  sendDecision,
  sendWords,
  shownNumber,
  targetSummary,
  typeCounts,
  type ComposerPrefill,
  type ComposerTarget,
  type ComposerWorkspace,
} from "./composer-model";
import { SupplierPicker, resolvePicked } from "./picker";
import { money, perUnit, quantityWords, unitWords } from "./words";

/** The page's preview column: Paper's 344, at least 320, the form keeping 480. */
const PREVIEW_PANE: PaneLimits = { key: "sourcebd.rfq-preview-width", initial: 344, min: 320, keep: 480 };

const textarea = cn(fieldBox, fieldEdge, "block min-h-16 px-2.5 py-1.5 text-base");

/** Radix cannot hold an empty value: "Not set" and "another country" are these two. */
const NOT_SET = "none";
const OTHER = "other";
const shipToPickOf = (country: string): string => (!country.trim() ? NOT_SET : (SHIP_TO as readonly string[]).includes(country) ? country : OTHER);

const TONE = { ink: "text-ink", caution: "text-caution", danger: "text-danger", sanction: "text-sanction" } as const;

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
          <Button kind="secondary" icon={Plus} onClick={onAdd} data-add-suppliers="" className="max-sm:h-input-touch max-sm:text-md">
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
export function ReviewBody({
  targets,
  onRemove,
  q = "",
  onQuery,
  byName = false,
  onSort,
}: {
  targets: ComposerTarget[];
  onRemove: (t: ComposerTarget) => void;
  q?: string;
  onQuery?: (q: string) => void;
  /** A to Z by name instead of the order they were added, so fifty can be checked against a list. */
  byName?: boolean;
  onSort?: (byName: boolean) => void;
}) {
  const found = targets.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const shown = byName ? [...found].sort((a, b) => a.name.localeCompare(b.name, "en")) : found;
  return (
    <>
      <div className="flex items-center gap-2">
        <Input type="search" aria-label={`Find in these ${targets.length}`} placeholder={`Find in these ${targets.length}`} value={q} onChange={(e) => onQuery?.(e.target.value)} className="min-w-0 flex-1" />
        {onSort ? (
          <Button kind="secondary" aria-pressed={byName} onClick={() => onSort(!byName)}>
            {byName ? "Sorted A to Z" : "Sort by name"}
          </Button>
        ) : null}
      </div>
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

/** `912-0`: every supplier by name in a dialog; with `onConfirm`, the confirmation a send above five opens. */
function ReviewAll({
  open,
  onOpenChange,
  targets,
  onRemove,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: ComposerTarget[];
  onRemove: (t: ComposerTarget) => void;
  onConfirm?: () => void;
}) {
  const [q, setQ] = useState("");
  const [byName, setByName] = useState(false);
  const words = reviewWords(targets.length, Boolean(onConfirm));
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      kind="form"
      title={words.title}
      footer={
        onConfirm ? (
          <>
            <DialogClose asChild>
              <Button kind="secondary">Back to the RFQ</Button>
            </DialogClose>
            <Button
              kind="primary"
              onClick={() => {
                onOpenChange(false);
                onConfirm();
              }}
            >
              {words.primary}
            </Button>
          </>
        ) : (
          <DialogClose asChild>
            <Button kind="primary">{words.primary}</Button>
          </DialogClose>
        )
      }
    >
      <ReviewBody targets={targets} onRemove={onRemove} q={q} onQuery={setQ} byName={byName} onSort={setByName} />
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
  const side = usePaneWidth(PREVIEW_PANE);
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
  const [shipToPick, setShipToPick] = useState(() => shipToPickOf(prefill.shipTo ?? ""));
  const [shipBy, setShipBy] = useState(prefill.shipBy ?? "");
  // The facts the message signs with, typed here when the workspace lacks one and saved there on send.
  const [fromYou, setFromYou] = useState(() => fromWorkspace(workspace));
  const askFromYou = needsFromYou(workspace);
  // Nothing is named as missing until a send is tried; each try moves focus to the first gap.
  const [attempt, setAttempt] = useState(0);
  const attempted = attempt > 0;
  const [focused, setFocused] = useState<"quantity" | "price" | null>(null);
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
  // "review": Review all, opened by the buyer; "confirm": the same list, opened by a send above five.
  const [reviewing, setReviewing] = useState<false | "review" | "confirm">(false);
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
        user: fromYou.name || null,
        company: fromYou.company || null,
        website: fromYou.website || null,
      }),
    [workspace, targets, productLine, fromYou],
  );
  const message = messageEdited ?? filled.text;
  const missing = [...missingFields({ title, quantity, unit, targets: targets.length, targetPrice }), ...leftoverPlaceholders(message).map((label) => `${label} in the message`)];
  // Send is withheld only for a sanctioned target: an empty field is a sentence the click produces, and
  // while a send or a draft is in flight it is `aria-busy` and ignores clicks, never disabled, so focus
  // stays on it (the kit's rule in `save-button.tsx`).
  const blocked = sanctioned.length > 0;
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

  async function send(confirmed = false) {
    if (busy) return;
    const decision = sendDecision({ blocked, missing, targets: targets.length, confirmed });
    // Above five the review dialog is the confirmation; nothing is marked missing, so focus stays put.
    if (decision === "review") return setReviewing("confirm");
    setAttempt((n) => n + 1);
    if (decision !== "post") return;
    setBusy("send");
    setError(null);
    // What was typed under From you is the workspace's from now on. A save that fails does not stop
    // the RFQ: the message already carries the typed facts.
    await Promise.all(fromYouSaves(fromYou, workspace).map((body) => postSettings(body, body.action === "update_profile" ? SAVE_FAILED.profile : SAVE_FAILED.workspace, { fetch: browserFetch })));
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
    if (busy) return;
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

  // A send tried with a field empty: the first field marked missing takes focus.
  useEffect(() => {
    if (attempt > 0) (formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? formRef.current?.querySelector<HTMLElement>("[data-add-suppliers]"))?.focus();
  }, [attempt]);

  function addQuestion() {
    const q = newQuestion.trim();
    if (!q || questions.length >= MAX_QUESTIONS) return;
    setQuestions((qs) => [...qs, q]);
    setNewQuestion("");
  }

  const remove = (t: ComposerTarget) => setTargets((xs) => xs.filter((x) => x.slug !== t.slug));
  const status = footerStatus({ error, sanctioned: sanctioned.length, missing, attempted, draftSavedAt, words });
  const note = (field: string, text: string) => fieldNote(attempted, missing, field, text);
  const fromYouField = (key: keyof typeof fromYou) => (e: React.ChangeEvent<HTMLInputElement>) => setFromYou((f) => ({ ...f, [key]: e.target.value }));
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
          <Link href={closeHref} prefetch={false} className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-base font-medium text-ink-2 outline-none hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:min-h-6">
            <ArrowLeft size={16} className="shrink-0" aria-hidden />
            {backLabel ?? "Back"}
          </Link>
          <Heading className="text-xl font-semibold tracking-tight text-ink">New RFQ</Heading>
        </header>
      ) : (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            {backHref ? (
              <Link href={backHref} scroll={false} prefetch={false} className="inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
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

      <div ref={page ? side.rowRef : undefined} className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", page && "xl:flex-row xl:overflow-visible")}>
        <form
          id={`${id}-form`}
          ref={formRef}
          // The composer names what is missing itself: the browser's own bubble would stop the click before `send()`.
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className={cn("flex min-w-0 flex-col gap-6 px-4 py-5 sm:px-6", page ? "xl:flex-1 xl:overflow-y-auto" : "")}
        >
          <div className="flex w-full max-w-pane flex-col gap-6">
            <Targets targets={targets} onRemove={remove} onAdd={() => setPicking(true)} onReview={() => setReviewing("review")} note={pickNote ?? note("a supplier", "Add at least one supplier.")} />

            <section aria-label="What you're asking for" className="flex flex-col gap-3">
              <h2 className="text-md font-semibold text-ink">What you&apos;re asking for</h2>
              <Field label="Product · required" error={note("product title", "Add a product")}>
                {(a) => <Input {...a} required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Men's knitted piqué polo, 220 gsm" />}
              </Field>
              <Field label="Details">
                {(a) => <textarea {...a} className={textarea} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={3} />}
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                <Field label="Quantity · required" error={note("quantity", "Add a quantity")}>
                  {(a) => (
                    <div className="flex gap-2">
                      <Input {...a} required inputMode="decimal" value={shownNumber(quantity, focused === "quantity", "count")} onChange={(e) => setQuantity(e.target.value.replace(/,/g, ""))} onFocus={() => setFocused("quantity")} onBlur={() => setFocused(null)} placeholder="e.g. 24,000" className="min-w-0 flex-1 text-right max-sm:h-input-touch max-sm:text-md" />
                      <UnitSelect value={unit} onChange={setUnit} />
                    </div>
                  )}
                </Field>
                <Field label={`Target price per ${per}`} help="Suppliers see your target price." error={note("target price", "Enter a number, like 8.90")}>
                  {(a) => (
                    <div className="flex gap-2">
                      <Select aria-label="Currency" value={currency} onValueChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c === "USD" ? "US$" : c }))} className="w-24 shrink-0 max-sm:h-input-touch max-sm:text-md" />
                      <Input {...a} inputMode="decimal" value={shownNumber(targetPrice, focused === "price", "money")} onChange={(e) => setTargetPrice(e.target.value)} onFocus={() => setFocused("price")} onBlur={() => setFocused(null)} className="min-w-0 flex-1 text-right max-sm:h-input-touch max-sm:text-md" />
                    </div>
                  )}
                </Field>
                <Field label="Ship by" help="For example 15 Nov 2026">
                  {(a) => <DateInput {...a} value={shipBy} onChange={setShipBy} className="max-sm:h-input-touch max-sm:text-md" />}
                </Field>
                {/* A list where the answer is a list (DESIGN.md, Inputs); another country is typed. */}
                <Field label="Ship to">
                  {(a) => (
                    <div className="flex flex-col gap-2">
                      <Select
                        id={a.id}
                        aria-describedby={a["aria-describedby"]}
                        value={shipToPick}
                        onValueChange={(v) => {
                          setShipToPick(v);
                          setShipTo(v === NOT_SET || v === OTHER ? "" : v);
                        }}
                        options={[{ value: NOT_SET, label: "Not set" }, ...SHIP_TO.map((c) => ({ value: c, label: c })), { value: OTHER, label: "Another country…" }]}
                        className="max-sm:h-input-touch max-sm:text-md"
                      />
                      {shipToPick === OTHER ? <Input aria-label="Country" value={shipTo} onChange={(e) => setShipTo(e.target.value)} maxLength={64} placeholder="Country" className="max-sm:h-input-touch max-sm:text-md" /> : null}
                    </div>
                  )}
                </Field>
              </div>
            </section>

            {/* The message signs with the buyer's name, company and website. A workspace that lacks one
                asks here, in place, and keeps the answer (the critique of 7 Oct 2026: a missing fact was
                "[your name]" in the message and a link to another page). */}
            {askFromYou ? (
              <section aria-label="From you" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h2 className="text-md font-semibold text-ink">From you</h2>
                  <p className="text-sm text-ink-3">Signs the message · kept in your workspace when you send</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                  <Field label="Your name" error={note("your name in the message", "Add your name")}>
                    {(a) => <Input {...a} value={fromYou.name} onChange={fromYouField("name")} maxLength={80} autoComplete="name" className="max-sm:h-input-touch max-sm:text-md" />}
                  </Field>
                  <Field label="Company" error={note("company name in the message", "Add your company")}>
                    {(a) => <Input {...a} value={fromYou.company} onChange={fromYouField("company")} maxLength={200} autoComplete="organization" className="max-sm:h-input-touch max-sm:text-md" />}
                  </Field>
                  <Field label="Website" error={note("website in the message", "Add your website")}>
                    {(a) => <Input {...a} type="url" inputMode="url" value={fromYou.website} onChange={fromYouField("website")} maxLength={300} placeholder="https://" autoComplete="url" className="max-sm:h-input-touch max-sm:text-md" />}
                  </Field>
                </div>
                <p className="text-xs text-ink-3">
                  Also under{" "}
                  <Link href="/app/settings/workspace" prefetch={false} className="font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2">
                    Settings
                  </Link>
                  .
                </p>
              </section>
            ) : null}

            <section aria-label="Questions" className="flex flex-col gap-2">
              <h2 className="text-md font-semibold text-ink">Questions · {questions.length}</h2>
              <ul className="flex flex-col gap-2">
                {questions.map((q, i) => (
                  <li key={`${i}-${q}`} className="flex min-h-10 items-center rounded-sm border border-line pl-3">
                    <span className="min-w-0 flex-1 py-2 text-base text-ink [overflow-wrap:anywhere]">
                      <Defined text={q} />
                    </span>
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

        {/* On the page from 1280 the preview sits beside the form, and its edge drags: the message is read and edited there. */}
        {page ? <PaneDivider width={side.width} min={PREVIEW_PANE.min} max={side.max} paneId={`${id}-preview`} label="Resize the preview" onWidth={side.set} onReset={side.reset} /> : null}
        <aside
          id={`${id}-preview`}
          aria-label="Preview"
          style={page ? ({ "--pane-w": `${side.width}px` } as CSSProperties) : undefined}
          className={cn("flex flex-col gap-3 border-t border-line bg-subtle px-4 py-5 sm:px-6", page ? "xl:w-[var(--pane-w)] xl:min-w-[320px] xl:max-w-[calc(100%-480px)] xl:shrink-0 xl:overflow-y-auto xl:border-t-0" : "")}
        >
          <h2 className="text-md font-semibold text-ink">{single ? `What ${single} gets` : "What each supplier gets"}</h2>
          <div className="flex flex-col gap-3 rounded-lg bg-surface p-4">
            <p className="text-xs text-ink-3">RFQ from {workspace?.userName ?? "you"}, on SourceBD</p>
            <p className="text-base font-semibold text-ink [overflow-wrap:anywhere]">{title.trim() || "[product]"}</p>
            <dl className="flex flex-col gap-1 text-sm">
              {([
                ["Quantity", Number(quantity) >= 1 ? quantityWords(Number(quantity), unit) : "Not set"],
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
                  <button type="button" onClick={() => setEditing(false)} className="min-h-6 rounded-sm text-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2 max-sm:min-h-11">
                    Done
                  </button>
                ) : (
                  <button type="button" onClick={() => setEditing(true)} className="min-h-6 rounded-sm text-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2 max-sm:min-h-11">
                    Edit
                  </button>
                )}
              </div>
              {editing ? (
                <>
                  <textarea aria-label="Message" value={message} onChange={(e) => setMessageEdited(e.target.value)} rows={8} maxLength={8000} className={textarea} />
                  {messageEdited !== null ? (
                    <button type="button" onClick={() => setMessageEdited(null)} className="min-h-6 w-fit rounded-sm text-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2 max-sm:min-h-11">
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
          {/* Only when the facts cannot be typed here (the message was edited to hold a bracket): otherwise From you's own fields say it, and only after a send is tried. */}
          {!askFromYou && leftoverPlaceholders(message).length > 0 ? (
            <div role="note" className="flex flex-col gap-1 rounded-md bg-caution-tint p-3 text-sm text-caution">
              <p className="font-medium">
                {listAnd(leftoverPlaceholders(message).map((l) => l.replace(/^your /, "")))} {leftoverPlaceholders(message).length === 1 ? "is" : "are"} missing, so it shows in [brackets].
              </p>
              <Link href="/app/settings/workspace" prefetch={false} className="inline-flex min-h-6 w-fit items-center text-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] max-sm:min-h-11">
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
        {/* The live region is on the page from the first paint but empty: a screen reader hears it only
            after an action (a send tried, a draft saved, a refusal), never an instruction on arrival. */}
        {/* Who this goes to, in ink at 14 (critique of 8 Oct 2026, round 3, item 3): it is the sentence that matters. */}
        <div className="min-w-0 text-base">
          {!status.live ? <p className={TONE[status.tone]}>{status.text}</p> : null}
          <p role="status" aria-live="polite" className={cn(TONE[status.tone], !status.live && "sr-only")}>
            {status.live ? status.text : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button kind="secondary" size="lg" onClick={() => void saveDraft()} loading={busy === "draft"} loadingLabel="Saving" aria-busy={busy !== null || undefined} className="max-sm:h-12">
            Save draft
          </Button>
          <Button type="submit" form={`${id}-form`} kind="primary" size="lg" disabled={blocked} loading={busy === "send"} loadingLabel="Sending" aria-busy={busy !== null || undefined} aria-describedby={`${id}-send-hint`} className="max-sm:h-12 max-sm:flex-1">
            {words.send}
            <span className="text-xs font-medium opacity-85 max-sm:hidden">{apple ? "⌘↵" : "Ctrl ↵"}</span>
          </Button>
          <span id={`${id}-send-hint`} className="sr-only">
            {sanctioned.length > 0 ? "Remove the sanctioned supplier to send." : "Sends to every supplier listed."} {apple ? "Command" : "Control"} plus Enter also sends.
          </span>
        </div>
      </div>

      <SupplierPicker open={picking} onOpenChange={setPicking} selected={targets} max={MAX_TARGETS} onConfirm={(p) => void confirmPicked(p)} />
      <ReviewAll
        open={reviewing !== false}
        onOpenChange={(open) => setReviewing(open ? (reviewing || "review") : false)}
        targets={targets}
        onRemove={remove}
        onConfirm={reviewing === "confirm" ? () => void send(true) : undefined}
      />
    </>,
  );
}

/** A question with its trade terms defined ("FOB"), the rest as typed. */
function Defined({ text }: { text: string }) {
  const parts = text.split(/\b(FOB)\b/);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <Define key={i} term={p} /> : p))}</>;
}

function UnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Select aria-label="Unit" value={value} onValueChange={onChange} options={UNITS.map((u) => ({ value: u, label: unitWords(u) }))} className="w-[120px] shrink-0 max-sm:h-input-touch max-sm:text-md" />;
}
