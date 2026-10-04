"use client";

// "Add suppliers" (Paper has the button, not the box, so this is the kit's form dialog with its
// own tabs): choose the suppliers an RFQ goes to from three places, tick any number across them
// and confirm. Saved suppliers (`/api/v1/saved`), a search (`/api/discover/suggest`) and the
// suppliers of the buyer's recent RFQs (`/api/v1/rfqs`). A failed read says so; it is never the
// empty list. A supplier known to be sanctioned cannot be ticked (the server refuses it anyway).
// The composer asks the server to resolve what was picked, because only the server knows today's
// sanction flag and whether the supplier is still published.

import { WarningOctagon } from "@phosphor-icons/react";
import { useEffect, useId, useState } from "react";
import type { ComposerTarget } from "@/components/dashboard/rfq-composer";
import { Button, Checkbox, DialogClose, Dialog, Input, InlineError, Tab, Tabs, TabsContent, TabsList } from "@/components/kit";
import { nameSecondLine, splitQualifier } from "@/lib/dashboard/facts";
import { targetFromRow, type SupplierRow } from "@/lib/dashboard/composer-target";

export const PICKER_TABS = [
  { key: "saved", label: "Saved suppliers" },
  { key: "search", label: "Search" },
  { key: "recent", label: "Recent RFQs" },
] as const;
type TabKey = (typeof PICKER_TABS)[number]["key"];

/** A typeahead company: a slug and a place, no id and no source tags. */
export function targetFromSuggestion(s: { label: string; sublabel: string | null; slug: string }): ComposerTarget {
  return { ...targetFromRow({ id: "", slug: s.slug, company_name: s.label }), place: s.sublabel };
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
  const docs = await Promise.all(
    rfqs
      .filter((r) => r.viewer_role !== "supplier")
      .slice(0, RECENT_RFQS)
      .map((r) => getJson(`/api/v1/rfqs?id=${encodeURIComponent(r.id)}`)),
  );
  const seen = new Set<string>();
  const out: ComposerTarget[] = [];
  for (const d of docs) {
    for (const t of (d.rfq as { targets?: SupplierRow[] } | undefined)?.targets ?? []) {
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

function Rows({ load, picked, onToggle, failed, empty }: { load: Load; picked: Map<string, ComposerTarget>; onToggle: (t: ComposerTarget) => void; failed: string; empty: string }) {
  if (load.status === "loading") return <p role="status" className="py-3 text-base text-ink-3">Loading</p>;
  if (load.status === "failed") return <InlineError>{failed}</InlineError>;
  if (load.rows.length === 0) return <p className="py-3 text-base text-ink-3">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {load.rows.map((t) => {
        const on = picked.has(keyOf(t));
        return (
          <li key={keyOf(t)} className="border-b border-line last:border-b-0">
            {t.sanctioned ? (
              <div className="flex min-h-12 items-center gap-3 py-2">
                <span aria-hidden className="size-4 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base font-medium text-ink">{splitQualifier(t.name).base}</span>
                  <span className="flex items-center gap-1 text-xs font-medium text-sanction">
                    <WarningOctagon size={12} weight="fill" aria-hidden /> Sanctioned: cannot receive an RFQ
                  </span>
                </span>
              </div>
            ) : (
              <Checkbox checked={on} onChange={() => onToggle(t)} className="min-h-12 w-full gap-3 py-2 max-sm:min-h-14">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base font-medium text-ink">{splitQualifier(t.name).base}</span>
                  {nameSecondLine(t.name, t.type, t.place) ? <span className="text-xs text-ink-3">{nameSecondLine(t.name, t.type, t.place)}</span> : null}
                </span>
              </Checkbox>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SupplierPicker({ open, onOpenChange, selected, max, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; selected: readonly ComposerTarget[]; max: number; onConfirm: (picked: ComposerTarget[]) => void }) {
  const id = useId();
  const [tab, setTab] = useState<TabKey>("saved");
  const [picked, setPicked] = useState(() => new Map(selected.map((t) => [keyOf(t), t])));
  const [saved, setSaved] = useState<Load>({ status: "loading" });
  const [recent, setRecent] = useState<Load | null>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Load | null>(null);

  // Opening again starts from the composer's current suppliers.
  useEffect(() => {
    if (open) setPicked(new Map(selected.map((t) => [keyOf(t), t])));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a fresh open resets the choice
  }, [open]);

  useEffect(() => {
    if (!open || saved.status === "ok") return;
    let live = true;
    loadSaved().then(
      (rows) => live && setSaved({ status: "ok", rows }),
      () => live && setSaved({ status: "failed" }),
    );
    return () => {
      live = false;
    };
  }, [open, saved.status]);

  useEffect(() => {
    if (!open || tab !== "recent" || recent) return;
    setRecent({ status: "loading" });
    loadRecent().then(
      (rows) => setRecent({ status: "ok", rows }),
      () => setRecent({ status: "failed" }),
    );
  }, [open, tab, recent]);

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
      else if (next.size < max) next.set(keyOf(t), t);
      return next;
    });
  const count = picked.size;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      kind="form"
      title="Add suppliers"
      footer={
        <>
          <span role="status" aria-live="polite" className="mr-auto self-center text-sm text-ink-3">
            {count} of {max} chosen
          </span>
          <DialogClose asChild>
            <Button kind="secondary">Cancel</Button>
          </DialogClose>
          <Button kind="primary" disabled={count === 0} onClick={() => onConfirm([...picked.values()])}>
            Use these {count > 0 ? count : ""}
          </Button>
        </>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex min-h-0 flex-col gap-3">
        <TabsList aria-label="Where to pick suppliers from">
          {PICKER_TABS.map((t) => (
            <Tab key={t.key} value={t.key} id={`${id}-tab-${t.key}`}>
              {t.label}
            </Tab>
          ))}
        </TabsList>
        <TabsContent value="saved" className="max-h-80 overflow-y-auto outline-none">
          <Rows load={saved} picked={picked} onToggle={toggle} failed="Your saved suppliers could not be read just now. Try again in a moment, or search instead." empty="No saved suppliers yet. Save one from the search and it appears here." />
        </TabsContent>
        <TabsContent value="search" className="flex max-h-80 flex-col gap-3 overflow-y-auto outline-none">
          <Input type="search" aria-label="Search suppliers" placeholder="Company name, city or product" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          {found === null ? <p className="text-base text-ink-3">Type a company name to find a supplier.</p> : <Rows load={found} picked={picked} onToggle={toggle} failed="The search could not run just now. Try again in a moment." empty="No supplier by that name." />}
        </TabsContent>
        <TabsContent value="recent" className="max-h-80 overflow-y-auto outline-none">
          <Rows load={recent ?? { status: "loading" }} picked={picked} onToggle={toggle} failed="Your recent RFQs could not be read just now. Try again in a moment." empty="No RFQs sent yet. The suppliers of your next RFQs appear here." />
        </TabsContent>
      </Tabs>
    </Dialog>
  );
}

/** Resolve what was picked on the server: it knows today's sanction flag and whether each supplier is still published. `targets: null` means it could not be checked: keep what the composer had. */
export async function resolvePicked(picked: ComposerTarget[], max: number): Promise<{ targets: ComposerTarget[] | null; note: string | null }> {
  const ids = picked.map((t) => t.id).filter(Boolean);
  const slugs = picked.filter((t) => !t.id).map((t) => t.slug);
  const qs = new URLSearchParams();
  if (ids.length) qs.set("ids", ids.join(","));
  if (slugs.length) qs.set("slugs", slugs.join(","));
  try {
    const res = await fetch(`/api/v1/suppliers?${qs.toString()}`, { headers: { accept: "application/json" } });
    const json = (await res.json().catch(() => null)) as { rows?: SupplierRow[]; error?: string } | null;
    if (!res.ok || !Array.isArray(json?.rows)) return { targets: null, note: json?.error ?? "The suppliers could not be checked just now. Nothing was added; try again." };
    const byId = new Map(json.rows.map((r) => [r.id, r]));
    const bySlug = new Map(json.rows.map((r) => [r.slug, r]));
    const resolved = picked
      .map((t) => (t.id ? byId.get(t.id) : bySlug.get(t.slug)))
      .filter((r): r is SupplierRow => Boolean(r))
      .map(targetFromRow);
    const dropped = picked.length - resolved.length;
    return {
      targets: resolved.slice(0, max),
      note: dropped > 0 ? `${dropped} ${dropped === 1 ? "supplier is" : "suppliers are"} no longer listed and ${dropped === 1 ? "was" : "were"} left out.` : null,
    };
  } catch {
    return { targets: null, note: "The suppliers could not be checked: no connection. Nothing was added; try again." };
  }
}
