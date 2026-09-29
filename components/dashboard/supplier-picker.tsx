"use client";

// "Select suppliers" (27 Sep 2026, the founder's walkthrough: from a product,
// Send inquiry → add a supplier, add a favourite): pick the suppliers an RFQ
// goes to from three places — the buyer's saved suppliers, a search, and the
// suppliers of their recent RFQs — tick any number across the three, confirm.
// The composer wires it in and receives `ComposerTarget`s.
//
// Reads, all under the buyer's own session:
// - Saved: `GET /api/v1/saved` → `{ rows: SupplierRow[] }`.
// - Search: `GET /api/discover/suggest?q=` → company suggestions. They carry a
//   slug and no id, so those targets leave `id: ""` for the caller to resolve.
// - Recent RFQs: `GET /api/v1/rfqs`, then `?id=` for the newest few, whose
//   `targets` carry id and slug.
// A failed read says so; it is never the empty list. A supplier known to be
// sanctioned cannot be ticked (the server refuses it an RFQ anyway).

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { targetFromRow, type SupplierRow } from "@/lib/dashboard/composer-target";
import { displayName, entityLabel, formatCount, initials, nameSecondLine, splitQualifier } from "@/lib/dashboard/facts";
import { topTier } from "@/lib/dashboard/source-tiers";
import { cn } from "@/lib/utils";
import { Button, Checkbox } from "./controls";
import { TextInput } from "./fields";
import { Icon } from "./icons";
import { LogoTile, SourceMarks } from "./marks";
import { ErrorNote } from "./page";
import type { ComposerTarget } from "./rfq-composer";
import { SheetBar } from "./sheet";
import { OneLine } from "./type";

// The composer and the tests import these from here.
export { targetFromRow, type SupplierRow };

export const PICKER_TABS = [
  { key: "saved", label: "Saved suppliers" },
  { key: "search", label: "Search" },
  { key: "recent", label: "Recent RFQs" },
] as const;
type Tab = (typeof PICKER_TABS)[number]["key"];

/** A typeahead company: a slug and a place, no id and no source tags — so no marks are drawn for it. */
export function targetFromSuggestion(s: { label: string; sublabel: string | null; slug: string }): ComposerTarget {
  const name = displayName(s.label);
  return { id: "", slug: s.slug, name, initials: initials(name), tier: topTier([]), marks: [], place: s.sublabel, type: entityLabel(null), sanctioned: false };
}

type Load = { status: "loading" } | { status: "failed" } | { status: "ok"; rows: ComposerTarget[] };

async function getJson(url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`read failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

async function loadSaved(): Promise<ComposerTarget[]> {
  const json = await getJson("/api/v1/saved");
  if (!Array.isArray(json.rows)) throw new Error("no rows");
  return (json.rows as SupplierRow[]).map(targetFromRow);
}

const RECENT_RFQS = 5;
async function loadRecent(): Promise<ComposerTarget[]> {
  const json = await getJson("/api/v1/rfqs");
  const rfqs = (Array.isArray(json.rfqs) ? json.rfqs : []) as { id: string; viewer_role?: string }[];
  // ponytail: one read per RFQ, the newest 5; a single RPC of recent targets when this list needs to reach further back.
  const docs = await Promise.all(
    rfqs
      .filter((r) => r.viewer_role !== "supplier")
      .slice(0, RECENT_RFQS)
      .map((r) => getJson(`/api/v1/rfqs?id=${encodeURIComponent(r.id)}`)),
  );
  const seen = new Set<string>();
  const out: ComposerTarget[] = [];
  for (const d of docs) {
    for (const t of ((d.rfq as { targets?: SupplierRow[] } | undefined)?.targets ?? [])) {
      if (seen.has(t.slug)) continue;
      seen.add(t.slug);
      out.push(targetFromRow(t));
    }
  }
  return out;
}

async function loadSearch(q: string, signal: AbortSignal): Promise<ComposerTarget[]> {
  const json = await getJson(`/api/discover/suggest?q=${encodeURIComponent(q)}`, signal);
  const list = (Array.isArray(json.suggestions) ? json.suggestions : []) as { type?: string; label: string; sublabel: string | null; slug: string }[];
  return list.filter((s) => s.type === "company" && s.slug).map(targetFromSuggestion);
}

/** One key per supplier across the three lists: a search result has no id, but every source has the slug. */
const keyOf = (t: ComposerTarget) => t.slug;

export function SupplierPicker({
  onConfirm,
  onClose,
  selected = [],
}: {
  onConfirm(targets: ComposerTarget[]): void;
  onClose(): void;
  /** Already chosen (the composer's current targets), shown ticked. */
  selected?: ComposerTarget[];
}) {
  const id = useId();
  const [tab, setTab] = useState<Tab>("saved");
  const [picked, setPicked] = useState(() => new Map(selected.map((t) => [keyOf(t), t])));
  const [saved, setSaved] = useState<Load>({ status: "loading" });
  const [recent, setRecent] = useState<Load | null>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Load | null>(null);

  useEffect(() => {
    let live = true;
    loadSaved().then(
      (rows) => live && setSaved({ status: "ok", rows }),
      () => live && setSaved({ status: "failed" }),
    );
    return () => {
      live = false;
    };
  }, []);

  // Read on first visit to the tab, not before: it is several requests.
  useEffect(() => {
    if (tab !== "recent" || recent) return;
    setRecent({ status: "loading" });
    loadRecent().then(
      (rows) => setRecent({ status: "ok", rows }),
      () => setRecent({ status: "failed" }),
    );
  }, [tab, recent]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setFound(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setFound({ status: "loading" });
      loadSearch(term, ctrl.signal).then(
        (rows) => setFound({ status: "ok", rows }),
        () => !ctrl.signal.aborted && setFound({ status: "failed" }),
      );
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const toggle = (t: ComposerTarget) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(keyOf(t))) next.delete(keyOf(t));
      else next.set(keyOf(t), t);
      return next;
    });

  // The tablist's keys (ARIA tabs pattern): ←/→ move between tabs and select, Home/End jump.
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = PICKER_TABS.findIndex((t) => t.key === tab);
    const n = PICKER_TABS.length;
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    setTab(PICKER_TABS[to]!.key);
    document.getElementById(`${id}-tab-${PICKER_TABS[to]!.key}`)?.focus();
  };

  const count = picked.size;

  return (
    <section
      aria-label="Select suppliers"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="flex h-full min-h-0 flex-col bg-surface"
    >
      <SheetBar>
        <h2 className="m-0 min-w-0 flex-1 text-title font-semibold text-ink-strong">Select suppliers</h2>
        <Button icon variant="ghost" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </Button>
      </SheetBar>
      <div role="tablist" aria-label="Where to pick suppliers from" className="flex shrink-0 gap-5 overflow-x-auto border-b border-line-subtle px-5">
        {PICKER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${id}-tab-${t.key}`}
            aria-selected={t.key === tab}
            aria-controls={`${id}-panel`}
            tabIndex={t.key === tab ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={onTabKey}
            className={cn(
              "-mb-px inline-flex h-10 items-center whitespace-nowrap border-b-2 border-transparent text-base font-medium text-ink-muted transition-colors duration-fast hover:text-ink-strong",
              t.key === tab && "border-accent text-ink-strong",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-4">
        {tab === "saved" ? (
          <Rows
            load={saved}
            picked={picked}
            onToggle={toggle}
            failed="Your saved suppliers could not be read just now. Try again in a moment, or search instead."
            empty="No saved suppliers yet. Save one from the search and it appears here."
          />
        ) : tab === "search" ? (
          <>
            <TextInput
              type="search"
              aria-label="Search suppliers"
              placeholder="Company name, city or product"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            {found === null ? (
              <p className="m-0 text-sm text-ink-muted">Type a company name to find a supplier.</p>
            ) : (
              <Rows load={found} picked={picked} onToggle={toggle} failed="The search could not run just now. Try again in a moment." empty="No supplier by that name." />
            )}
          </>
        ) : (
          <Rows
            load={recent ?? { status: "loading" }}
            picked={picked}
            onToggle={toggle}
            failed="Your recent RFQs could not be read just now. Try again in a moment."
            empty="No RFQs sent yet. The suppliers of your next RFQs appear here."
          />
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line-subtle px-5 py-3">
        <span role="status" aria-live="polite" className="min-w-0 flex-1 text-sm text-ink-muted">
          {formatCount(count)} selected
        </span>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={count === 0} onClick={() => onConfirm([...picked.values()])}>
          <Icon name="check" /> Confirm
        </Button>
      </div>
    </section>
  );
}

function Rows({
  load,
  picked,
  onToggle,
  failed,
  empty,
}: {
  load: Load;
  picked: Map<string, ComposerTarget>;
  onToggle: (t: ComposerTarget) => void;
  failed: string;
  empty: string;
}) {
  if (load.status === "loading") {
    return (
      <p role="status" className="m-0 inline-flex items-center gap-2 text-sm text-ink-muted">
        <Icon name="spinner" className="animate-spin motion-reduce:animate-none" /> Loading
      </p>
    );
  }
  if (load.status === "failed") return <ErrorNote>{failed}</ErrorNote>;
  if (load.rows.length === 0) return <p className="m-0 text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {load.rows.map((t) => {
        const on = picked.has(keyOf(t));
        return (
          <li
            key={keyOf(t)}
            // The whole row ticks for a pointer; the checkbox is the keyboard's control and handles its own click.
            onClick={(e) => {
              if (t.sanctioned || (e.target as HTMLElement).closest('[role="checkbox"], a')) return;
              onToggle(t);
            }}
            className={cn(
              "flex items-center gap-3 rounded-sm px-2 py-2 transition-colors duration-fast",
              t.sanctioned ? "cursor-not-allowed" : "cursor-pointer hover:bg-surface-sunken",
              on && "bg-brand-tint hover:bg-brand-tint",
            )}
          >
            {t.sanctioned ? <span aria-hidden className="size-4 shrink-0" /> : <Checkbox on={on} label={`Select ${t.name}`} onToggle={() => onToggle(t)} />}
            <LogoTile initials={t.initials} tier={t.tier} size="row" />
            <span className="flex min-w-0 flex-1 flex-col">
              {/* Two lines, each cut to one (the One-Line Name Rule). */}
              <OneLine text={splitQualifier(t.name).base} title={t.name} className="text-sm font-medium text-ink-strong" />
              {t.sanctioned ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-sanction-ink">
                  <Icon name="warn" small /> Sanctioned · cannot receive an RFQ
                </span>
              ) : nameSecondLine(t.name, t.place) ? (
                <OneLine text={nameSecondLine(t.name, t.place)} className="text-xs text-ink-subtle" />
              ) : null}
            </span>
            {t.marks.length > 0 ? <SourceMarks marks={t.marks.slice(0, 4)} caption="none" sm className="shrink-0 flex-nowrap" /> : null}
          </li>
        );
      })}
    </ul>
  );
}
