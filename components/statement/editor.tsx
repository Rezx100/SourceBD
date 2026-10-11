"use client";

// The modern slavery statement editor (B6c-2, Paper `10 · Modern slavery statement editor, 3 claims
// open`, `11 · Alerts · modern slavery statement`). The draft is composed in the browser from the
// buyer's saved suppliers (`lib/msa-statement.ts`) and nothing is uploaded or stored. Whatever only
// the buyer can know is a claim: dashed amber until they answer it, underlined once they have. A
// rail lists the open claims with a Fill in each; Download stays disabled, with its reason in words,
// until none is open. Sections on the left (a desktop), the document in the middle, the rail on the
// right; on a phone the claims come first and the draft is under "Read the whole draft".
// Paper's PDF/Word download and saved versions are not here: no document library is installed and
// nothing is stored, so the file is Markdown and the draft lives in the page.
// Below 768 the page is Paper page 36's: a pill with the claims left, the section claims in a card
// (three, then the rest folded), the details with the signatory side by side, what we wrote for you
// (`written`, drawn by the page), and Copy and Download in a bar fixed to the foot.

import { CaretDown, CaretRight, Clock, Copy, FileText, PencilSimple } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ActionBar, Button, Field, IconButton, Input } from "@/components/kit";
import { fieldBox, fieldEdge } from "@/components/kit/classes";
import { ConfirmedClaim, OpenClaim, downloadBlockedWords } from "@/components/patterns";
import { buildStatement, type MsaInputs, type MsaScreening } from "@/lib/msa-statement";
import { cn } from "@/lib/utils";
import { DETAIL_LABELS, claimLabel, claimsOf, claimsToConfirm, fileName, finalText, foldWords, openBySection, openClaims, parseStatement, phoneBlocked, subsOf, type Block, type DetailKey, type Section, type Segment } from "./words";

const neverChanges = () => () => {};
/** Section claims a phone shows before the fold. */
const PHONE_SHOWN = 3;
const isoDay = (d: Date, local: boolean) => (local ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : d.toISOString().slice(0, 10));

/** Today in the buyer's own time zone: the server renders the UTC day and the browser swaps in its own after hydration. */
function useToday(): string {
  return useSyncExternalStore(neverChanges, () => isoDay(new Date(), true), () => isoDay(new Date(), false));
}

export function StatementEditor({ inputs, screening, written }: { inputs: MsaInputs; screening: MsaScreening | null; /** A phone's "Written for you", drawn on the server. */ written?: ReactNode }) {
  const today = useToday();
  const [details, setDetails] = useState<Record<DetailKey, string>>({ org: "", year: String(new Date().getFullYear() - 1), signerName: "", signerRole: "Director" });
  const [fills, setFills] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const detailRefs = useRef<Partial<Record<DetailKey, HTMLInputElement | null>>>({});

  const draft = useMemo(() => buildStatement({ ...details, asOf: today, inputs, screening }), [details, today, inputs, screening]);
  // A fill is kept under the claim with the typed organisation and year as tokens, so correcting either does not lose an answer.
  const subs = useMemo(() => subsOf(details), [details]);
  const sections = useMemo(() => parseStatement(draft, fills, subs), [draft, fills, subs]);
  const claims = useMemo(() => claimsOf(sections), [sections]);
  const open = useMemo(() => openClaims(sections), [sections]);
  const bySection = useMemo(() => openBySection(sections), [sections]);
  const text = useMemo(() => finalText(draft, fills, subs), [draft, fills, subs]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(""), 4000);
    return () => clearTimeout(t);
  }, [note]);

  const fill = (key: string, detail: DetailKey | null) => {
    if (detail) detailRefs.current[detail]?.focus();
    else setEditing((cur) => (cur === key ? null : key));
  };

  function download() {
    if (open.length > 0) return;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName(details.org, details.year);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNote("Statement downloaded.");
  }

  function copy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return setNote("Copying is not available in this browser.");
    navigator.clipboard.writeText(text).then(
      () => setNote(open.length > 0 ? `Draft copied. ${claimsToConfirm(open.length)}.` : "Draft copied."),
      () => setNote("Could not copy. Select the draft and copy it instead."),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 max-lg:flex-col max-md:pb-[120px]">
      <SectionNav sections={sections} bySection={bySection} />
      <div className="order-3 flex min-w-0 flex-1 flex-col items-center bg-subtle px-8 py-6 max-lg:px-0 max-lg:py-0 lg:order-none" id="draft">
        <Document sections={sections} focus={editing} onClaim={(key) => setEditing(key)} />
      </div>
      <aside aria-label="Claims to confirm" className="order-2 flex w-80 shrink-0 flex-col gap-5 border-l border-line bg-surface p-4 max-lg:w-auto max-lg:border-l-0 max-lg:px-4 max-md:gap-0 max-md:px-5 max-md:pt-2 lg:sticky lg:top-0 lg:order-none lg:max-h-[calc(100dvh-3.5rem)] lg:self-start lg:overflow-y-auto">
        <div className="flex flex-col gap-3 md:hidden">
          {open.some((c) => !c.detail) ? (
            <p className="flex h-7 shrink-0 items-center gap-1.5 self-start rounded-full bg-caution-tint pl-2 pr-2.5 text-sm font-medium text-caution">
              <PencilSimple size={16} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />
              Draft · {claimsToConfirm(open.filter((c) => !c.detail).length)}
            </p>
          ) : null}
          <p className="text-[15px]/[22px] text-ink-2">
            We wrote the supply chain part from your {inputs.total_published === 1 ? "1 saved supplier" : `${inputs.total_published} saved suppliers`}. Only you can answer the rest.
          </p>
        </div>
        <Rail
          open={open}
          claims={claims}
          fills={fills}
          editing={editing}
          setFill={(key, v) => setFills((f) => ({ ...f, [key]: v }))}
          onFill={fill}
          onDone={() => setEditing(null)}
          onDownload={download}
          onCopy={copy}
          note={note}
        />
        <Details details={details} setDetails={setDetails} refs={detailRefs} />
        {written ? <div className="flex flex-col md:hidden">{written}</div> : null}
        <a href="#draft" className="mt-4 flex h-11 items-center justify-center gap-1.5 rounded-full bg-sunken px-3.5 text-base font-medium text-ink outline-none active:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:hidden">
          <FileText size={16} weight="thin" className="shrink-0" aria-hidden />
          Read the whole draft
        </a>
        <p className="pt-4 text-xs text-ink-3 md:hidden">Your board approves it and a director signs it. Have counsel review it before you publish. Nothing leaves your phone.</p>
      </aside>
    </div>
  );
}

function SectionNav({ sections, bySection }: { sections: readonly Section[]; bySection: Record<string, number> }) {
  return (
    <nav aria-label="Sections" className="flex w-[232px] shrink-0 flex-col gap-0.5 border-r border-line bg-surface px-3 py-4 max-lg:hidden">
      <p className="px-2 pb-2 text-xs font-semibold text-ink-3">Sections</p>
      {sections.map((s) => {
        const n = bySection[s.id] ?? 0;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex flex-col gap-0.5 rounded-sm px-3 py-2 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
          >
            <span className="text-base font-medium text-ink">{s.number ? `${s.number}. ${s.title}` : s.title}</span>
            <span className={cn("text-xs", n > 0 ? "font-semibold text-caution" : "text-ink-3")}>{n > 0 ? claimsToConfirm(n) : "Nothing to confirm"}</span>
          </a>
        );
      })}
    </nav>
  );
}

function Seg({ s, focus, onClaim }: { s: Segment; focus: string | null; onClaim: (key: string) => void }) {
  if (s.kind === "text") return <>{s.text}</>;
  if (s.kind === "bold") return <strong className="font-semibold">{s.text}</strong>;
  if (s.fill !== null) return <ConfirmedClaim>{s.fill}</ConfirmedClaim>;
  return (
    <button type="button" onClick={() => onClaim(s.claim)} className="rounded-sm align-baseline outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      <OpenClaim focused={focus === s.claim}>{claimLabel(s.text)}</OpenClaim>
    </button>
  );
}

function BlockView({ b, focus, onClaim }: { b: Block; focus: string | null; onClaim: (key: string) => void }) {
  if (b.kind === "ul")
    return (
      <ul className="flex list-disc flex-col gap-1 pl-5 text-md leading-[26px] text-ink">
        {b.items.map((it, i) => (
          <li key={i}>
            {it.map((s, j) => (
              <Seg key={j} s={s} focus={focus} onClaim={onClaim} />
            ))}
          </li>
        ))}
      </ul>
    );
  return (
    <p className="whitespace-pre-line text-md leading-[26px] text-ink">
      {b.segments.map((s, j) => (
        <Seg key={j} s={s} focus={focus} onClaim={onClaim} />
      ))}
    </p>
  );
}

/** The draft as a document: each section a heading and its paragraphs, claims in place. */
function Document({ sections, focus, onClaim }: { sections: readonly Section[]; focus: string | null; onClaim: (key: string) => void }) {
  return (
    <article className="flex w-full max-w-[608px] flex-col gap-4 rounded-lg border border-line bg-surface p-8 max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:p-4">
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="flex scroll-mt-4 flex-col gap-4">
          {s.number ? (
            <>
              <p className="pt-2 text-xs font-semibold text-ink-3">Section {s.number}</p>
              <h2 className="text-lg font-semibold text-ink">{s.title}</h2>
            </>
          ) : null}
          {s.blocks.map((b, i) => (
            <BlockView key={i} b={b} focus={focus} onClaim={onClaim} />
          ))}
        </section>
      ))}
      <p className="pt-1 text-xs text-ink-3">Dashed amber: only you can confirm it. Underlined: you confirmed it.</p>
    </article>
  );
}

function Rail({
  open,
  claims,
  fills,
  editing,
  setFill,
  onFill,
  onDone,
  onDownload,
  onCopy,
  note,
}: {
  open: ReturnType<typeof openClaims>;
  claims: ReturnType<typeof claimsOf>;
  fills: Record<string, string>;
  editing: string | null;
  setFill: (key: string, value: string) => void;
  onFill: (key: string, detail: DetailKey | null) => void;
  onDone: () => void;
  onDownload: () => void;
  onCopy: () => void;
  note: string;
}) {
  const reason = useId();
  const phoneReason = useId();
  const [unfolded, setUnfolded] = useState(false);
  const openKeys = new Set(open.map((c) => c.key));
  // Answered claims stay listed while one is being edited, so the field does not vanish under the buyer's hands.
  const rows = claims.filter((c) => openKeys.has(c.key) || c.key === editing);
  // A phone lists the section claims only (the details card answers the rest): three, then the others folded.
  const phoneRows = rows.filter((c) => !c.detail);
  const folded = unfolded ? [] : phoneRows.slice(PHONE_SHOWN);
  const foldedKeys = new Set(folded.map((c) => c.key));
  const firstShown = phoneRows[0]?.key;
  const phoneOpen = open.filter((c) => !c.detail).length;
  return (
    <section className="flex flex-col gap-3 max-md:gap-0">
      <div className="flex items-baseline justify-between max-md:pb-3.5 max-md:pt-6">
        <h2 className="text-md font-semibold text-ink max-md:flex max-md:items-baseline max-md:gap-2 max-md:text-lg max-md:font-medium max-md:tracking-tight">
          Before you download<span className="max-md:hidden">{open.length > 0 ? ` · ${claimsToConfirm(open.length)}` : ""}</span>
          {phoneOpen > 0 ? <span className="font-normal text-ink-3 md:hidden">{phoneOpen}</span> : null}
        </h2>
        <span className="text-sm text-ink-3 md:hidden">In draft order</span>
      </div>
      <ul className={cn("max-md:overflow-clip max-md:rounded-[10px] max-md:border max-md:border-line", folded.length > 0 && "max-md:rounded-b-none max-md:border-b-0", phoneRows.length === 0 && "max-md:hidden")}>
        {rows.map((c) => (
          <li key={c.key} className={cn("border-t border-line py-2.5 last:border-b max-md:border-b-0 max-md:p-4", c.key === firstShown && "max-md:border-t-0", (c.detail || foldedKeys.has(c.key)) && "max-md:hidden")}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col max-md:gap-1">
                <span className="text-sm text-ink-3 lg:hidden max-md:text-xs max-md:font-medium max-md:text-caution">{c.section}</span>
                <span className="text-base text-ink max-lg:text-md max-lg:font-medium max-md:leading-[22px]">{c.label}</span>
              </span>
              <Button
                kind="secondary"
                className="max-lg:h-12 max-lg:px-3.5 max-lg:text-md max-md:h-11 max-md:rounded-full max-md:border-0 max-md:bg-sunken max-md:text-base max-md:hover:bg-sunken max-md:active:bg-line"
                onClick={() => onFill(c.key, c.detail)}
                aria-expanded={c.detail ? undefined : editing === c.key}
              >
                Fill in
              </Button>
            </div>
            {editing === c.key && !c.detail ? (
              <div className="flex flex-col gap-2 pt-2">
                <label htmlFor={`fill-${c.key}`} className="sr-only">
                  {c.label}
                </label>
                <textarea
                  id={`fill-${c.key}`}
                  autoFocus
                  rows={3}
                  value={fills[c.key] ?? ""}
                  onChange={(e) => setFill(c.key, e.target.value)}
                  placeholder="Write it as you want it to read in the statement"
                  className={cn(fieldBox, fieldEdge, "min-h-20 px-2.5 py-1.5 text-base max-lg:text-md")}
                />
                <p className="text-xs text-ink-3">This is the claim as it reads in the draft: {c.text}</p>
                <Button kind="primary" size="md" className="self-start" onClick={onDone}>
                  Done
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {folded.length > 0 ? (
        <div className="overflow-clip rounded-b-[10px] border border-line md:hidden">
          <button type="button" onClick={() => setUnfolded(true)} className="flex min-h-12 w-full items-center justify-between bg-subtle px-4 py-3 text-left text-sm text-ink-2 outline-none active:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
            {foldWords(folded)}
            <CaretDown size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
          </button>
        </div>
      ) : null}
      <a href="#draft" className="flex min-h-12 items-center justify-between border-b border-line text-md font-medium text-ink lg:hidden max-md:hidden">
        Read the whole draft
        <CaretRight size={20} className="text-ink-2" aria-hidden />
      </a>
      {/* Download stays in reach however many claims are listed above it. */}
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-1.5 border-t border-line bg-surface px-4 py-3 max-lg:bottom-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom))] max-md:hidden">
        <Button kind="primary" size="lg" full disabled={open.length > 0} aria-describedby={open.length > 0 ? reason : undefined} onClick={onDownload} className="max-lg:h-input-touch">
          Download statement
        </Button>
        {open.length > 0 ? (
          <p id={reason} className="text-sm text-ink-2">
            {downloadBlockedWords(open.length)}
          </p>
        ) : null}
        <Button kind="secondary" full onClick={onCopy} className="max-lg:h-input-touch">
          Copy draft
        </Button>
        <p role="status" aria-live="polite" className="min-h-4 text-sm text-ink-2">
          {note}
        </p>
      </div>
      {/* A phone's bar, fixed to the foot (the frame's tabs step aside on this page): Copy beside Download, the reason over them. */}
      <div className="fixed inset-x-0 bottom-0 z-raised flex flex-col border-t border-line bg-surface md:hidden">
        {note || open.length > 0 ? (
          <p id={phoneReason} className={cn("flex items-center gap-1.5 px-4 pt-2.5 text-xs font-medium", note ? "text-ink-2" : "text-caution")}>
            {note ? null : <Clock size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />}
            {note || phoneBlocked(open)}
          </p>
        ) : null}
        <ActionBar className="border-t-0">
          <IconButton icon={Copy} label="Copy draft" size={48} onClick={onCopy} className="rounded-lg border-line" />
          <Button kind="primary" size="touch" full disabled={open.length > 0} aria-describedby={open.length > 0 ? phoneReason : undefined} onClick={onDownload} className="h-12 rounded-lg">
            Download statement
          </Button>
        </ActionBar>
      </div>
      <div className="flex flex-col gap-3 border-t border-line pt-3 max-md:hidden">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-ink">Format</p>
          <p className="text-sm text-ink-2">Markdown (.md). Open it in Word or Google Docs to make a PDF or a Word file.</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-ink">Approval</p>
          <p className="text-sm text-ink-2">Your board approves it and a director signs it. Have counsel review it before you publish. Nothing leaves your browser.</p>
        </div>
      </div>
    </section>
  );
}

function Details({ details, setDetails, refs }: { details: Record<DetailKey, string>; setDetails: (d: Record<DetailKey, string>) => void; refs: React.MutableRefObject<Partial<Record<DetailKey, HTMLInputElement | null>>> }) {
  const keys: DetailKey[] = ["org", "year", "signerName", "signerRole"];
  const filled = keys.filter((k) => details[k].trim()).length;
  return (
    <section aria-label="Your details" className="flex flex-col gap-3 border-t border-line pt-4 max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-4 max-md:border-t-0 max-md:pt-0">
      <div className="flex items-baseline justify-between max-md:col-span-2 max-md:-mb-4 max-md:pb-3.5 max-md:pt-6">
        <h2 className="text-md font-semibold text-ink max-md:text-lg max-md:font-medium max-md:tracking-tight">Your details</h2>
        <span className="text-sm text-ink-3 md:hidden">
          {filled} of {keys.length} filled
        </span>
      </div>
      {keys.map((k) => (
        <Field key={k} label={DETAIL_LABELS[k]} className={k === "org" || k === "year" ? "max-md:col-span-2" : undefined}>
          {(a) => (
            <Input
              {...a}
              ref={(el) => {
                refs.current[k] = el;
              }}
              value={details[k]}
              onChange={(e) => setDetails({ ...details, [k]: e.target.value })}
              size="md"
              className="max-lg:h-input-touch max-lg:text-md"
            />
          )}
        </Field>
      ))}
      {/* Under the year on a phone (the grid's fourth row); nothing from 768. */}
      <p className="col-span-2 row-start-4 -mt-3 text-xs text-ink-3 md:hidden">The year before this one, unless you change it</p>
    </section>
  );
}
