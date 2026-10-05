"use client";

// The three first-run steps and the panels beside them (Paper `20 Onboarding` 3 to 5). Each step is a
// form that posts to a server action in `app/(auth)/onboarding/actions.ts` and works without script;
// what is typed is also written to the draft the panel reads, so the panel can change as they answer.

import { Check, MagnifyingGlass, XCircle } from "@phosphor-icons/react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { saveAbout, saveCompany, saveSource, type StepState } from "@/app/(auth)/onboarding/actions";
import { AuthLink } from "@/components/auth/link";
import { Button, Checkbox, Field, Input, Radio, Select } from "@/components/kit";
import { countSuppliers } from "@/components/search/filter-actions";
import { formatCount } from "@/lib/dashboard/facts";
import { CERT_LABELS, CERT_ORDER, COMPANY_TYPE_CHOICES, COUNTRIES, JOB_ROLES, MARKETS, PEOPLE_BANDS, certWords, companyTypeLabel, countryName, peopleLabel, sourceSearch, stepHref, type JobRole } from "@/lib/onboarding";
import type { CertKind } from "@/lib/discover-v32-state";
import { cn } from "@/lib/utils";
import { useDraft } from "./draft";

const INITIAL: StepState = {};
const box = "h-control-lg max-sm:h-input-touch max-sm:text-md";
const tall = "max-sm:h-input-touch max-sm:text-md";

function Problem({ state, field }: { state: StepState; field?: string }) {
  if (!state.error || (field ? state.field !== field : Boolean(state.field))) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
      <XCircle size={16} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
      <span>{state.error}</span>
    </p>
  );
}

/** Back and Continue, as Paper draws them: Back is quiet, Continue takes the width. */
function Foot({ back, label, loadingLabel, pending }: { back?: string; label: string; loadingLabel: string; pending: boolean }) {
  return (
    <div className="flex gap-2">
      {back ? (
        <AuthLink href={back} className="flex h-control-lg items-center px-4 font-medium text-ink-2 no-underline max-sm:h-input-touch">
          Back
        </AuthLink>
      ) : null}
      <Button type="submit" kind="primary" size="lg" className={cn("grow", tall)} loading={pending} loadingLabel={loadingLabel}>
        {label}
      </Button>
    </div>
  );
}

// --------------------------------------------------------------------------- 3 About you

export function AboutForm({ name, role }: { name: string; role: JobRole | null }) {
  const [state, action, pending] = useActionState(saveAbout, INITIAL);
  return (
    <form action={action} noValidate className="flex flex-col gap-7">
      <Field label="Your name" error={state.field === "name" ? state.error : undefined}>
        {(a) => <Input {...a} name="name" defaultValue={name} autoComplete="name" required maxLength={120} className={box} />}
      </Field>
      <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby="about-work-help">
        <legend className="mb-2 text-sm font-medium text-ink">Your work</legend>
        <div className="flex flex-col overflow-clip rounded-md border border-line">
          {JOB_ROLES.map((r, i) => (
            <Radio
              key={r.value}
              name="role"
              value={r.value}
              defaultChecked={role === r.value}
              className={cn("min-h-12 w-full gap-3 px-3 sm:min-h-10 has-[:checked]:border-l-2 has-[:checked]:border-l-brand has-[:checked]:bg-brand-tint has-[:checked]:pl-2.5 has-[:checked]:font-medium", i > 0 && "border-t border-line")}
            >
              {r.label}
            </Radio>
          ))}
        </div>
        <Problem state={state} field="role" />
        <p id="about-work-help" className="text-xs text-ink-3">
          Compliance people start on Compliance. Everyone else starts on Search.
        </p>
      </fieldset>
      <Problem state={state} />
      <Foot label="Continue" loadingLabel="Saving" pending={pending} />
    </form>
  );
}

/** "Where you'll start": Search, and Compliance for a compliance role. Follows the radio with no script (`:has`). */
export function StartPanel() {
  const picked = "group-has-[input[value=compliance]:checked]/auth:";
  return (
    <>
      <p className="text-sm font-medium text-ink-3">Where you&rsquo;ll start</p>
      <div className={cn("flex w-full max-w-[440px] flex-col gap-1 rounded-lg border-l-2 border-brand bg-surface py-4 pl-[18px] pr-5", `${picked}border-l-0 ${picked}border ${picked}border-line ${picked}bg-transparent ${picked}pl-5`)}>
        <p className={cn("text-lg font-semibold text-ink", `${picked}text-ink-3`)}>Search</p>
        <p className={cn("text-base text-ink-2", `${picked}text-ink-3`)}>Suppliers that match what you source, with every certificate and its date.</p>
      </div>
      <div className={cn("flex w-full max-w-[440px] flex-col gap-1 rounded-lg border border-line px-5 py-4", `${picked}border-l-2 ${picked}border-brand ${picked}bg-surface ${picked}pl-[18px]`)}>
        <p className={cn("text-lg font-semibold text-ink-3", `${picked}text-ink`)}>Compliance</p>
        <p className={cn("text-base text-ink-3", `${picked}text-ink-2`)}>If you work in compliance: expired certificates and UFLPA Entity List checks on suppliers you save.</p>
      </div>
      <p className="max-w-[440px] text-sm text-ink-3">You can open both from the sidebar at any time.</p>
    </>
  );
}

// --------------------------------------------------------------------------- 4 Your company

export function CompanyForm({ company, type, country, people }: { company: string; type: string; country: string; people: string }) {
  const [state, action, pending] = useActionState(saveCompany, INITIAL);
  const { set } = useDraft();
  const [c, setC] = useState(country);
  const [p, setP] = useState(people);
  const [t, setT] = useState(type);
  const [n, setN] = useState(company);
  useEffect(() => set({ company: n, type: t, country: c, people: p }), [n, t, c, p]); // eslint-disable-line react-hooks/exhaustive-deps -- `set` is rebuilt with the draft; only the answers matter.
  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <Field label="Company name" error={state.field === "company" ? state.error : undefined}>
        {(a) => <Input {...a} name="company" value={n} onChange={(e) => setN(e.target.value)} autoComplete="organization" required maxLength={200} className={box} />}
      </Field>
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-ink">You are a</legend>
        <div className="flex flex-wrap gap-2">
          {COMPANY_TYPE_CHOICES.map((o) => (
            <label
              key={o.value}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-line-strong px-3 text-base text-ink hover:border-ink-3 has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:checked]:font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand max-sm:h-11"
            >
              <input type="radio" name="type" value={o.value} checked={t === o.value} onChange={() => setT(o.value)} className="peer sr-only" />
              <Check size={14} className="hidden shrink-0 text-brand peer-checked:block" aria-hidden />
              {o.label}
            </label>
          ))}
        </div>
        <Problem state={state} field="type" />
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Country" error={state.field === "country" ? state.error : undefined}>
          {(a) => <Select {...a} name="country" value={c || undefined} onValueChange={setC} placeholder="Choose a country" size="md" options={COUNTRIES.map((x) => ({ value: x.code, label: x.name }))} className={box} />}
        </Field>
        <Field label="People at your company" error={state.field === "people" ? state.error : undefined}>
          {(a) => <Select {...a} name="people" value={p || undefined} onValueChange={setP} placeholder="Choose a range" size="md" options={PEOPLE_BANDS.map((x) => ({ value: x.value, label: x.label }))} className={box} />}
        </Field>
      </div>
      <p className="text-xs text-ink-3">This fills your Settings, so we won&rsquo;t ask again.</p>
      <Problem state={state} />
      <Foot back={stepHref("about")} label="Continue" loadingLabel="Saving" pending={pending} />
    </form>
  );
}

/** "Saved to Settings › Company details": the four answers as they are typed. */
export function CompanyPanel() {
  const { draft } = useDraft();
  const rows: [string, string | null][] = [
    ["Company", typeof draft.company === "string" && draft.company.trim() ? draft.company.trim() : null],
    ["Type", companyTypeLabel(String(draft.type ?? ""))],
    ["Country", countryName(String(draft.country ?? ""))],
    ["People", peopleLabel(String(draft.people ?? ""))],
  ];
  return (
    <>
      <p className="text-sm font-medium text-ink-3">Saved to Settings &rsaquo; Company details</p>
      <dl className="flex w-full max-w-[440px] flex-col rounded-lg border border-line bg-surface">
        {rows.map(([k, v], i) => (
          <div key={k} className={cn("flex min-h-10 items-center px-4", i < rows.length - 1 && "border-b border-line")}>
            <dt className="w-[140px] shrink-0 text-sm text-ink-3">{k}</dt>
            <dd className={cn("min-w-0 text-base", v ? "text-ink" : "text-ink-3")}>{v ?? "Not chosen yet"}</dd>
          </div>
        ))}
      </dl>
      <p className="max-w-[440px] text-sm text-ink-3">Change these any time in Settings.</p>
    </>
  );
}

// --------------------------------------------------------------------------- 5 What you source

export type HsOption = { hs: string; label: string; n: number };

/** The headings shown before anything is typed: the chosen ones first, then the suggestions. */
export function visibleHeadings(all: readonly HsOption[], chosen: readonly string[], suggested: readonly string[], q: string): HsOption[] {
  const by = new Map(all.map((o) => [o.hs, o]));
  const term = q.trim().toLowerCase();
  if (!term) {
    const codes = [...new Set([...chosen, ...suggested])];
    return codes.map((c) => by.get(c)).filter((o): o is HsOption => Boolean(o));
  }
  const hit = (o: HsOption) => o.hs.startsWith(term) || o.label.toLowerCase().includes(term);
  const picked = chosen.map((c) => by.get(c)).filter((o): o is HsOption => o !== undefined && hit(o));
  const rest = all.filter((o) => hit(o) && !chosen.includes(o.hs)).sort((a, b) => b.n - a.n).slice(0, 8);
  return [...picked, ...rest];
}

export function SourceForm({ options, suggested, hs, certs, markets }: { options: HsOption[]; suggested: string[]; hs: string[]; certs: CertKind[]; markets: string[] }) {
  const [state, action, pending] = useActionState(saveSource, INITIAL);
  const { draft, set } = useDraft();
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<string[]>(hs);
  const [cert, setCert] = useState<string[]>(certs);
  const [mk, setMk] = useState<string[]>(markets);
  useEffect(() => set({ hs: chosen, certs: cert, markets: mk }), [chosen, cert, mk]); // eslint-disable-line react-hooks/exhaustive-deps -- as above.
  const shown = useMemo(() => visibleHeadings(options, chosen, suggested, q), [options, chosen, suggested, q]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const count = typeof draft.count === "number" ? draft.count : null;
  return (
    <form action={action} noValidate className="flex flex-col gap-7">
      {chosen.map((h) => (
        <input key={h} type="hidden" name="hs" value={h} />
      ))}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Products</legend>
        <div className="relative">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search products or HS codes"
            placeholder="Search products or HS codes"
            className={cn("w-full rounded-sm border border-line-strong bg-surface pl-[34px] pr-3 text-base text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:[box-shadow:inset_0_0_0_1px_theme(colors.brand)]", box)}
          />
        </div>
        <ul className="flex flex-col overflow-clip rounded-md border border-line">
          {shown.length === 0 ? <li className="px-3 py-3 text-base text-ink-3">No product matches &ldquo;{q.trim()}&rdquo;.</li> : null}
          {shown.map((o, i) => (
            <li key={o.hs} className={i > 0 ? "border-t border-line" : undefined}>
              <Checkbox checked={chosen.includes(o.hs)} onChange={() => setChosen((c) => toggle(c, o.hs))} size="md" className="min-h-12 w-full gap-3 px-3 sm:min-h-10 has-[:checked]:bg-brand-tint">
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="min-w-0 truncate text-base text-ink">{o.label}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-3">{o.hs}</span>
                </span>
                <span className="shrink-0 text-sm text-ink-3">{formatCount(o.n)} suppliers</span>
              </Checkbox>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-3">Supplier counts from EPB export records.</p>
        <Problem state={state} field="hs" />
      </fieldset>
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Certificates you require</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {CERT_ORDER.map((k) => (
            <Checkbox key={k} name="cert" value={k} checked={cert.includes(k)} onChange={() => setCert((c) => toggle(c, k))} className="max-sm:min-h-11">
              {CERT_LABELS[k]}
            </Checkbox>
          ))}
        </div>
        <p className="text-xs text-ink-3">We show suppliers whose certificate hasn&rsquo;t expired.</p>
        <Problem state={state} field="certs" />
      </fieldset>
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Markets you sell into</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {MARKETS.map((m) => (
            <Checkbox key={m.value} name="market" value={m.value} checked={mk.includes(m.value)} onChange={() => setMk((c) => toggle(c, m.value))} className="max-sm:min-h-11">
              {m.label}
            </Checkbox>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 text-xs text-ink-3">
          {MARKETS.filter((m) => m.note).map((m) => (
            <p key={m.value}>
              {m.label === "UK" ? "UK" : m.label}: {m.note}
            </p>
          ))}
        </div>
        <Problem state={state} field="markets" />
      </fieldset>
      <Problem state={state} />
      <Foot back={stepHref("company")} label={count !== null ? `Show ${formatCount(count)} suppliers` : "Show suppliers"} loadingLabel="Saving" pending={pending} />
    </form>
  );
}

/** "Your search so far": how many suppliers match the products, and how many of those hold the certificates, counted as the answers change. */
export function SourcePanel() {
  const { draft, set } = useDraft();
  const hs = useMemo(() => (Array.isArray(draft.hs) ? (draft.hs as string[]) : []), [draft.hs]);
  const certs = useMemo(() => (Array.isArray(draft.certs) ? (draft.certs as CertKind[]) : []), [draft.certs]);
  const markets = Array.isArray(draft.markets) ? (draft.markets as string[]) : [];
  const [all, setAll] = useState<number | null>(null);
  const [withCerts, setWithCerts] = useState<number | null>(null);
  const [reading, setReading] = useState(hs.length > 0);
  const key = `${hs.join(",")}|${certs.join(",")}`;
  useEffect(() => {
    if (hs.length === 0) {
      setAll(null);
      setWithCerts(null);
      set({ count: null });
      return;
    }
    let live = true;
    setReading(true);
    const t = setTimeout(async () => {
      const [a, b] = await Promise.all([countSuppliers(sourceSearch(hs, []).toString()).catch(() => null), certs.length ? countSuppliers(sourceSearch(hs, certs).toString()).catch(() => null) : Promise.resolve(null)]);
      if (!live) return;
      setAll(a);
      setWithCerts(b);
      setReading(false);
      set({ count: certs.length ? b : a });
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- the answers, as one key; `set` is rebuilt with the draft.
  const shownCount = certs.length ? withCerts : all;
  const headline = hs.length === 0 ? "Choose a product to see how many suppliers match." : shownCount !== null ? `${formatCount(shownCount)} suppliers match` : reading ? "Counting…" : "We could not count just now.";
  return (
    <>
      <p className="text-sm font-medium text-ink-3">Your search so far</p>
      <p className="text-2xl font-semibold tracking-tighter text-ink" aria-live="polite">
        {headline}
      </p>
      {hs.length > 0 && all !== null ? (
        <div className="flex w-full max-w-[440px] flex-col gap-4">
          <div className="flex flex-col gap-0.5 border-l-2 border-line pl-4">
            <p className="text-md font-medium text-ink">{formatCount(all)} export the products you chose</p>
            <p className="text-sm text-ink-3">From EPB export records</p>
          </div>
          {certs.length > 0 && withCerts !== null ? (
            <div className="flex flex-col gap-0.5 border-l-2 border-line pl-4">
              <p className="text-md font-medium text-ink">{formatCount(withCerts)} of them hold a {certWords(certs)} certificate that hasn&rsquo;t expired</p>
              <p className="text-sm text-ink-3">From the certification bodies&rsquo; registers</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {markets.some((m) => m === "UK" || m === "US") ? (
        <div className="flex w-full max-w-[440px] flex-col gap-1.5">
          <p className="text-sm font-medium text-ink-3">For your markets</p>
          {markets.includes("UK") ? <p className="text-base text-ink">Modern slavery statement draft &middot; UK</p> : null}
          {markets.includes("US") ? <p className="text-base text-ink">UFLPA Entity List checks &middot; US</p> : null}
        </div>
      ) : null}
    </>
  );
}
