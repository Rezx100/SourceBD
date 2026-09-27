// The filter surface of the search (enterprise pass, 27 Sep 2026): a pane
// beside the results (`/app/discover?filters=1`), one GET form whose fields
// are typed pickers — selects, checkboxes and suggestion lists — rather than
// the comma-and-colon syntax the old inputs asked for. Grouped the way a
// sourcing manager thinks: what it makes, what it holds, who lists it, where
// it is, how big it is. Apply submits the search; the chips in the composer
// bar remove one filter at a time.
//
// Server component: the URL is the state, so the form needs no script.

import { HS_CATALOGUE } from "@/lib/hs-catalogue";
import { hsBuyerLabel } from "@/lib/epb-hscode-labels";
import {
  BRAND_URL,
  CERT_KINDS,
  DISCOVER_PATH,
  FILTER_HIDDEN_OMIT,
  REGISTRIES,
  discoverHiddenParams,
  filterCount,
  type DiscoverState,
} from "@/lib/discover-v32-state";
import { certScheme } from "@/lib/dashboard/facts";
import { Button } from "./controls";
import { Icon } from "./icons";
import { Sheet, SheetBar, SheetScroll } from "./sheet";
import { Caption, Label } from "./type";

const BRAND_LABEL: Record<string, string> = { hm: "H&M", asos: "ASOS", next: "NEXT", ms: "M&S", inditex: "Inditex", primark: "Primark" };
const DISTRICTS = ["Dhaka", "Gazipur", "Narayanganj", "Chattogram", "Savar", "Ashulia", "Tongi", "Mymensingh", "Comilla", "Narsingdi"];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-ink-strong">{title}</legend>
      {children}
    </fieldset>
  );
}

const control = "h-control w-full min-w-0 rounded-sm border border-line-strong bg-surface px-2.5 text-base text-ink-strong";

function Check({ name, value, label, on }: { name: string; value: string; label: string; on: boolean }) {
  return (
    <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm text-ink hover:bg-surface-sunken">
      <input type="checkbox" name={name} value={value} defaultChecked={on} className="size-4 rounded-xs border-line-strong" />
      {label}
    </label>
  );
}

export function DiscoverFilters({ state, closeHref }: { state: DiscoverState; closeHref: string }) {
  const n = filterCount(state);
  const firstCert = state.cert[0] ?? null;
  const brandOn = new Set(state.brand.map((b) => b.replace(/^BRAND_/i, "").toLowerCase()));
  return (
    <Sheet label="Filters">
      <SheetBar>
        <Button variant="ghost" icon size="sm" aria-label="Close" href={closeHref} clientNav scroll={false}>
          <Icon name="x" />
        </Button>
        <Label className="text-ink-strong">Filters</Label>
        <Caption>{n === 0 ? "none set" : `${n} set`}</Caption>
        {n > 0 ? (
          <Button variant="ghost" size="sm" className="ml-auto" href={`${DISCOVER_PATH}${state.q ? `?q=${encodeURIComponent(state.q)}` : ""}`} clientNav scroll={false}>
            Clear all
          </Button>
        ) : null}
      </SheetBar>
      <SheetScroll>
        <form id="filters" action={DISCOVER_PATH} method="get" className="flex flex-col gap-8 p-6">
          {discoverHiddenParams(state, FILTER_HIDDEN_OMIT).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <Group title="What it exports">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">HS heading</span>
              <input name="hs" list="filters-hs" defaultValue={state.hs.join(",")} placeholder="6105" className={control} />
              <datalist id="filters-hs">
                {HS_CATALOGUE.map((r) => (
                  <option key={r.hs} value={r.hs}>
                    {hsBuyerLabel(r.hs, r.heading ?? null)}
                  </option>
                ))}
              </datalist>
              <Caption>Several headings: separate them with commas.</Caption>
            </label>
          </Group>
          <Group title="What it holds">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted">Certificate</span>
                <select name="cert_kind" defaultValue={firstCert?.kind ?? ""} className={control}>
                  <option value="">Any</option>
                  {CERT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {certScheme(k)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted">Its state</span>
                <select name="cert_state" defaultValue={firstCert?.state ?? "any"} className={control}>
                  <option value="any">Any</option>
                  <option value="valid">Valid</option>
                  <option value="expiring">Expiring</option>
                  <option value="expired">Expired</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">RSC safety record</span>
              <select name="rsc" defaultValue={state.rsc ?? ""} className={control}>
                <option value="">Any</option>
                <option value="active">Active</option>
                <option value="lapsed">Lapsed</option>
              </select>
            </label>
          </Group>
          <Group title="Who filed it">
            <div className="grid grid-cols-2 gap-x-2">
              {REGISTRIES.map((r) => (
                <Check key={r} name="reg" value={r} label={r} on={state.reg.includes(r)} />
              ))}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">Registers and certifiers on file, at least</span>
              <select name="min_sources" defaultValue={state.minSources ?? ""} className={control}>
                <option value="">Any</option>
                {[1, 2, 3, 4, 5].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </Group>
          <Group title="Who lists it">
            <div className="grid grid-cols-2 gap-x-2">
              {Object.keys(BRAND_URL).map((b) => (
                <Check key={b} name="brand" value={b} label={BRAND_LABEL[b] ?? b.toUpperCase()} on={brandOn.has(b)} />
              ))}
            </div>
          </Group>
          <Group title="Where it is">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted">District</span>
                <input name="district" list="filters-district" defaultValue={state.district.join(",")} className={control} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted">City</span>
                <input name="city" list="filters-district" defaultValue={state.city.join(",")} className={control} />
              </label>
              <datalist id="filters-district">
                {DISTRICTS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </Group>
          <Group title="What kind of company">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">Type</span>
              <select name="type" defaultValue={state.type[0] ?? ""} className={control}>
                <option value="">Any</option>
                <option value="factory">Factory</option>
                <option value="buying_house">Buying house</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted">Workers, at least</span>
                <input name="workers_min" inputMode="numeric" defaultValue={state.workersMin ?? ""} className={control} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted">Workers, at most</span>
                <input name="workers_max" inputMode="numeric" defaultValue={state.workersMax ?? ""} className={control} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted">Established from</span>
                <input name="est_from" inputMode="numeric" placeholder="1990" defaultValue={state.estFrom ?? ""} className={control} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-ink-muted">Established to</span>
                <input name="est_to" inputMode="numeric" placeholder="2026" defaultValue={state.estTo ?? ""} className={control} />
              </label>
            </div>
          </Group>
          <div className="glass sticky bottom-0 -mx-6 -mb-6 flex items-center gap-2 border-t border-line-subtle px-6 py-3">
            <Caption className="flex-1">Every filter is a URL: the results update when you apply, and each chip removes one.</Caption>
            <Button type="submit" variant="primary">
              Apply filters
            </Button>
          </div>
        </form>
      </SheetScroll>
    </Sheet>
  );
}
