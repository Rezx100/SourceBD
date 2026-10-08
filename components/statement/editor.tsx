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

import { CaretRight } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, Field, Input } from "@/components/kit";
import { fieldBox, fieldEdge } from "@/components/kit/classes";
import { ConfirmedClaim, OpenClaim, downloadBlockedWords } from "@/components/patterns";
import { buildStatement, type MsaInputs, type MsaScreening } from "@/lib/msa-statement";
import { cn } from "@/lib/utils";
import { DETAIL_LABELS, claimLabel, claimsOf, claimsToConfirm, fileName, finalText, openBySection, openClaims, parseStatement, subsOf, type Block, type DetailKey, type Section, type Segment } from "./words";

const neverChanges = () => () => {};
const isoDay = (d: Date, local: boolean) => (local ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : d.toISOString().slice(0, 10));

/** Today in the buyer's own time zone: the server renders the UTC day and the browser swaps in its own after hydration. */
function useToday(): string {
  return useSyncExternalStore(neverChanges, () => isoDay(new Date(), true), () => isoDay(new Date(), false));
}

export function StatementEditor({ inputs, screening }: { inputs: MsaInputs; screening: MsaScreening | null }) {
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
    <div className="flex min-h-0 flex-1 max-lg:flex-col">
      <SectionNav sections={sections} bySection={bySection} />
      <div className="order-3 flex min-w-0 flex-1 flex-col items-center bg-subtle px-8 py-6 max-lg:px-0 max-lg:py-0 lg:order-none" id="draft">
        <Document sections={sections} focus={editing} onClaim={(key) => setEditing(key)} />
      </div>
      <aside aria-label="Claims to confirm" className="order-2 flex w-80 shrink-0 flex-col gap-5 border-l border-line bg-surface p-4 max-lg:w-auto max-lg:border-l-0 max-lg:px-4 lg:sticky lg:top-0 lg:order-none lg:max-h-[calc(100dvh-3.5rem)] lg:self-start lg:overflow-y-auto">
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
  const openKeys = new Set(open.map((c) => c.key));
  // Answered claims stay listed while one is being edited, so the field does not vanish under the buyer's hands.
  const rows = claims.filter((c) => openKeys.has(c.key) || c.key === editing);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-md font-semibold text-ink">Before you download{open.length > 0 ? ` · ${claimsToConfirm(open.length)}` : ""}</h2>
      <ul>
        {rows.map((c) => (
          <li key={c.key} className="border-t border-line py-2.5 last:border-b">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="text-sm text-ink-3 lg:hidden">{c.section}</span>
                <span className="text-base text-ink max-lg:text-md max-lg:font-medium">{c.label}</span>
              </span>
              <Button kind="secondary" className="max-lg:h-12 max-lg:px-3.5 max-lg:text-md" onClick={() => onFill(c.key, c.detail)} aria-expanded={c.detail ? undefined : editing === c.key}>
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
      <a href="#draft" className="flex min-h-12 items-center justify-between border-b border-line text-md font-medium text-ink lg:hidden">
        Read the whole draft
        <CaretRight size={20} className="text-ink-2" aria-hidden />
      </a>
      {/* Download stays in reach however many claims are listed above it. */}
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-1.5 border-t border-line bg-surface px-4 py-3 max-lg:bottom-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom))]">
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
      <div className="flex flex-col gap-3 border-t border-line pt-3">
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
  return (
    <section aria-label="Your details" className="flex flex-col gap-3 border-t border-line pt-4">
      <h2 className="text-md font-semibold text-ink">Your details</h2>
      {keys.map((k) => (
        <Field key={k} label={DETAIL_LABELS[k]}>
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
    </section>
  );
}
