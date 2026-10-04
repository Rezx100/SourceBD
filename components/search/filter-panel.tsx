"use client";

// The filter pane's body (Paper `10 · Filters panel open, live count` at 1440, `11 · Filters
// sheet` at 390 and 320): the applied filters as chips, one group per kind of filter, Clear
// all, and a button that says how many suppliers the draft finds. The draft is a plain form
// held here; every change asks the server for the count (a short pause after the last key),
// and "Show N suppliers" opens the search the draft describes. The URL stays the search: the
// chips and the button are links and navigations, the same filters the results bar reads.
//
// From 768 a group is a section that opens in place; on a phone it is a 56-tall row with its
// value under the name. The sub-pickers a phone would open are not drawn in Paper, so a row
// opens its controls in place at touch size.

import { CaretDown, CaretRight, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Checkbox, Field, FilterChip, Input, Segmented, Select, StandingFilter, Switch, buttonClass, linkClass, ring, ringInset } from "@/components/kit";
import { REGISTRIES, discoverHref, serializeDiscoverState, type CertState, type DiscoverState } from "@/lib/discover-v32-state";
import { countSuppliers } from "./filter-actions";
import {
  BRAND_KEYS,
  BRAND_NAME,
  CERT_NAME,
  CERT_ORDER,
  CERT_STATES,
  DISTRICTS,
  TYPE_NAME,
  clearedForm,
  countKey,
  formOf,
  groupsSet,
  searchOf,
  showLabel,
  summaryOf,
  type FilterForm,
  type GroupId,
} from "./filter-model";

const DESKTOP = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True from 768 (the server draws the desktop pane; a phone swaps on the first client render). */
function useDesktop(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => true);
}

const PAUSE_MS = 300;

export type PanelChip = { key: string; label: string; href: string };

export function FilterPanel({
  state,
  count,
  chips,
  showThemHref,
  hsOptions,
  closeHref,
  defaultOpen,
}: {
  /** The groups that start open, when the page says (the gallery and the proof shots do); otherwise the width decides. */
  defaultOpen?: readonly GroupId[];
  /** The search in the address: the draft starts as this and the chips remove from it. */
  state: DiscoverState;
  /** How many suppliers that search finds; null when it could not be read. */
  count: number | null;
  chips: PanelChip[];
  /** The search with sanctioned suppliers shown, or null when they are already. */
  showThemHref: string | null;
  hsOptions: { hs: string; label: string }[];
  closeHref: string;
}) {
  const router = useRouter();
  const desktop = useDesktop();
  const size = desktop ? "md" : "touch";
  const [form, setForm] = useState<FilterForm>(() => formOf(state));
  const set = (over: Partial<FilterForm>) => setForm((f) => ({ ...f, ...over }));
  const [opened, setOpened] = useState<Partial<Record<GroupId, boolean>>>({});
  // The groups the address sets open first on a desktop; a phone starts with every row closed.
  const startsOpen = defaultOpen ?? (desktop ? groupsSet(state) : []);
  const isOpen = (id: GroupId) => opened[id] ?? startsOpen.includes(id);
  const toggle = (id: GroupId) => setOpened((o) => ({ ...o, [id]: !isOpen(id) }));

  // The count of the draft. The draft that is the address needs no request; any other waits a
  // moment after the last change, and an answer for a draft that has since changed is dropped.
  const draft = searchOf(state, form);
  const key = countKey(draft);
  const [fetched, setFetched] = useState<{ key: string; count: number | null } | null>(null);
  const shownCount = key === countKey(state) ? count : fetched ? fetched.count : count;
  const pending = key !== countKey(state) && fetched?.key !== key;
  const latest = useRef(key);
  latest.current = key;
  useEffect(() => {
    if (key === countKey(state)) return;
    const t = setTimeout(async () => {
      const n = await countSuppliers(serializeDiscoverState(draft).toString()).catch(() => null);
      if (latest.current === key) setFetched({ key, count: n });
    }, PAUSE_MS);
    return () => clearTimeout(t);
    // The draft is `key`'s own content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const summaries = Object.fromEntries((["cert", "place", "type", "hs", "reg", "brand", "size", "sources"] as const).map((id) => [id, summaryOf(form, id)])) as Record<GroupId, string | null>;
  const pick = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const districts = [...DISTRICTS, ...form.district.filter((d) => !DISTRICTS.includes(d))];

  return (
    <form
      aria-label="Filters"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(discoverHref(draft), { scroll: false });
      }}
      // Under 1280 the pane is the drawer's body, which does not stretch it: fill the drawer
      // under its 64-tall title so Clear all and the count sit at the foot, as Paper draws them.
      className="flex min-h-0 flex-1 flex-col max-xl:min-h-[calc(100dvh-4rem)]"
    >
      {/* Docked at 1280 and over the pane has no title of its own; under it the drawer draws one. */}
      <div className="hidden items-center justify-between px-5 pb-3 pt-4 xl:flex">
        <h2 className="text-lg font-semibold text-ink">Filters</h2>
        <Link href={closeHref} scroll={false} aria-label="Close" className={`${buttonClass({ kind: "quiet", size: "icon-32" })}`}>
          <X size={20} aria-hidden />
        </Link>
      </div>
      {chips.length > 0 || showThemHref ? (
        <div className="flex flex-wrap gap-2 border-b border-line px-5 pb-3 pt-1 max-md:hidden">
          {chips.map((c) => (
            <FilterChip key={c.key} removeHref={c.href} removeLabel={`Remove ${c.label}`}>
              {c.label}
            </FilterChip>
          ))}
          {showThemHref ? (
            <StandingFilter
              action={
                <Link href={showThemHref} scroll={false} className={`${linkClass} text-sm`}>
                  Show them
                </Link>
              }
            >
              Hiding sanctioned suppliers
            </StandingFilter>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 md:px-0">
        <Group id="cert" title="Certificates" summary={summaries.cert} open={isOpen("cert")} onToggle={() => toggle("cert")}>
          {CERT_ORDER.map((k) => (
            <Box desktop={desktop} key={k} name="cert" value={k} checked={form.cert.includes(k)} onChange={() => set({ cert: pick(form.cert, k) })}>
              {CERT_NAME[k]}
            </Box>
          ))}
          <p className="pt-1 text-xs font-semibold text-ink-3">Certificate status</p>
          <Segmented
            name="cert_state"
            label="Certificate status"
            value={form.certState}
            options={CERT_STATES}
            disabled={form.cert.length === 0}
            onValueChange={(v) => set({ certState: v as CertState })}
            className="max-w-full max-md:[&_span]:h-11"
          />
          {form.cert.length === 0 ? <p className="text-xs text-ink-3">Tick a certificate to choose its status.</p> : null}
        </Group>

        <Group id="place" title="Location" summary={summaries.place} open={isOpen("place")} onToggle={() => toggle("place")}>
          <Select
            name="district"
            size={size}
            aria-label="District"
            placeholder="Any district"
            value={form.district[0] ?? "any"}
            options={[{ value: "any", label: "Any district" }, ...districts.map((d) => ({ value: d, label: d }))]}
            onValueChange={(v) => set({ district: v === "any" ? [] : [v] })}
          />
          {form.district.length > 1 ? <p className="text-xs text-ink-3">Also filtering on {form.district.slice(1).join(", ")}. Clear all removes them.</p> : null}
          <Input size={size} name="city" aria-label="City" placeholder="City" value={form.city} onChange={(e) => set({ city: e.target.value })} />
        </Group>

        <Group id="type" title="Company type" summary={summaries.type} open={isOpen("type")} onToggle={() => toggle("type")}>
          {(Object.keys(TYPE_NAME) as (keyof typeof TYPE_NAME)[]).map((t) => (
            <Box desktop={desktop} key={t} name="type" value={t} checked={form.type.includes(t)} onChange={() => set({ type: pick(form.type, t) })}>
              {TYPE_NAME[t]}
            </Box>
          ))}
        </Group>

        <Group id="hs" title="Products exported (HS code)" summary={summaries.hs} open={isOpen("hs")} onToggle={() => toggle("hs")}>
          <Field label="HS heading" help="Several headings: separate them with commas.">
            {(a) => <Input {...a} size={size} name="hs" list="filters-hs" placeholder="6105" value={form.hs} onChange={(e) => set({ hs: e.target.value })} />}
          </Field>
          <datalist id="filters-hs">
            {hsOptions.map((o) => (
              <option key={o.hs} value={o.hs}>
                {o.label}
              </option>
            ))}
          </datalist>
        </Group>

        <Group id="reg" title="Member of" summary={summaries.reg} open={isOpen("reg")} onToggle={() => toggle("reg")}>
          <div className="grid grid-cols-2 gap-x-2">
            {REGISTRIES.map((r) => (
              <Box desktop={desktop} key={r} name="reg" value={r} checked={form.reg.includes(r)} onChange={() => set({ reg: pick(form.reg, r) })}>
                {r}
              </Box>
            ))}
          </div>
        </Group>

        <Group id="brand" title="Brand supplier lists" summary={summaries.brand} open={isOpen("brand")} onToggle={() => toggle("brand")}>
          <div className="grid grid-cols-2 gap-x-2">
            {BRAND_KEYS.map((b) => (
              <Box desktop={desktop} key={b} name="brand" value={b} checked={form.brand.includes(b)} onChange={() => set({ brand: pick(form.brand, b) })}>
                {BRAND_NAME[b] ?? b.toUpperCase()}
              </Box>
            ))}
          </div>
        </Group>

        <Group id="size" title="Workers and founding year" summary={summaries.size} open={isOpen("size")} onToggle={() => toggle("size")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Workers, at least">{(a) => <Input {...a} size={size} name="workers_min" inputMode="numeric" value={form.workersMin} onChange={(e) => set({ workersMin: e.target.value })} />}</Field>
            <Field label="Workers, at most">{(a) => <Input {...a} size={size} name="workers_max" inputMode="numeric" value={form.workersMax} onChange={(e) => set({ workersMax: e.target.value })} />}</Field>
            <Field label="Founded from">{(a) => <Input {...a} size={size} name="est_from" inputMode="numeric" placeholder="1990" value={form.estFrom} onChange={(e) => set({ estFrom: e.target.value })} />}</Field>
            <Field label="Founded to">{(a) => <Input {...a} size={size} name="est_to" inputMode="numeric" placeholder="2026" value={form.estTo} onChange={(e) => set({ estTo: e.target.value })} />}</Field>
          </div>
        </Group>

        <Group id="sources" title="At least this many sources" summary={summaries.sources} open={isOpen("sources")} onToggle={() => toggle("sources")}>
          <Field label="Registers and certifiers on file" help="Counts registers and certifiers, not brand lists.">
            {(a) => (
              <Select
                id={a.id}
                aria-describedby={a["aria-describedby"]}
                name="min_sources"
                size={size}
                value={form.minSources || "any"}
                options={[{ value: "any", label: "Any" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))]}
                onValueChange={(v) => set({ minSources: v === "any" ? "" : v })}
              />
            )}
          </Field>
        </Group>

        <SwitchRow title="In the RSC safety programme" name="rsc" checked={form.rsc} desktop={desktop} onChange={(on) => set({ rsc: on, rscLapsed: false })} />
        <SwitchRow
          title={desktop ? "Hide sanctioned suppliers" : "Hiding sanctioned suppliers"}
          hint={desktop ? undefined : "Suppliers on the UFLPA Entity List stay out of the results."}
          name="hide_sanctioned"
          checked={form.hideSanctioned}
          desktop={desktop}
          last
          onChange={(on) => set({ hideSanctioned: on })}
        />
      </div>

      <div className="sticky bottom-0 flex shrink-0 items-center justify-between gap-3 border-t border-line bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:h-16 md:px-5 md:py-0">
        {desktop ? (
          <button type="button" onClick={() => setForm(clearedForm())} className={`inline-flex min-h-6 items-center rounded-sm text-base font-medium text-ink-2 underline decoration-1 [text-underline-position:from-font] hover:text-ink ${ring}`}>
            Clear all
          </button>
        ) : (
          <button type="button" onClick={() => setForm(clearedForm())} className={buttonClass({ kind: "secondary", size: "touch" })}>
            Clear all
          </button>
        )}
        <button type="submit" aria-busy={pending || undefined} className={buttonClass({ kind: "primary", size: desktop ? "lg" : "touch", className: desktop ? undefined : "flex-1" })}>
          {showLabel(shownCount)}
        </button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {pending ? "Counting suppliers" : shownCount === null ? "" : `${showLabel(shownCount).replace("Show ", "")} match`}
      </p>
    </form>
  );
}

/** A tick: 16 with a 28 row on a desktop pane, the kit's 48 row on a phone. Module level, so a click does not remount it. */
function Box({ desktop, name, value, checked, onChange, children }: { desktop: boolean; name: string; value: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <Checkbox size={desktop ? "md" : "touch"} name={name} value={value} checked={checked} onChange={onChange} className={desktop ? "min-h-7 gap-2.5" : undefined}>
      {children}
    </Checkbox>
  );
}

/**
 * One group: from 768 a header that opens its controls in place (the open ones semibold, a
 * caret that turns); on a phone a 56-tall row with the name, the value beneath it in brand
 * (or "Any"), and a caret. No colour and size share a `cn()` here: the merge reads `text-md` as a colour.
 */
function Group({ id, title, summary, open, onToggle, children }: { id: string; title: string; summary: string | null; open: boolean; onToggle: () => void; children: ReactNode }) {
  const panel = `filters-group-${id}`;
  return (
    <section className="border-b border-line">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={onToggle}
          className={`flex min-h-14 w-full items-center justify-between gap-3 text-left outline-none md:min-h-11 md:px-5 ${ringInset}`}
        >
          <span className="flex min-w-0 flex-col">
            <span className={`text-md text-ink md:text-base ${open ? "md:font-semibold" : "md:font-medium"}`}>{title}</span>
            <span className={`text-sm md:hidden ${summary ? "font-medium text-brand" : "text-ink-3"}`}>{summary ?? "Any"}</span>
          </span>
          <CaretRight size={20} className={`shrink-0 text-ink-3 md:hidden ${open ? "rotate-90" : ""}`} aria-hidden />
          <CaretDown size={16} className={`hidden shrink-0 text-ink-2 md:block ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </h3>
      {open ? (
        <div id={panel} className="flex flex-col gap-2 pb-3.5 md:px-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** A yes/no filter as a row: the name, and the switch with On or Off beside it (the phone's 52 wide switch has no word). */
function SwitchRow({ title, hint, name, checked, desktop, last, onChange }: { title: string; hint?: string; name: string; checked: boolean; desktop: boolean; last?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className={`flex min-h-11 items-center justify-between gap-4 py-2 md:px-5 ${last ? "border-y border-cert-valid-edge md:border-0" : "border-b border-line"}`}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-md font-medium text-ink md:text-base">{title}</span>
        {hint ? <span className="text-sm text-ink-3">{hint}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Switch name={name} aria-label={title} size={desktop ? "md" : "touch"} checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="hidden w-6 text-base text-ink md:inline">{checked ? "On" : "Off"}</span>
      </span>
    </label>
  );
}
