"use client";

// Smart Match wizard \u2014 Spec B4 client island.
//
// Three-step form (Product \u2192 Requirements \u2192 Review) that posts to
// POST /api/v1/match and renders the ranked result list inline using F1
// primitives. State lives in this component only \u2014 no URL params, no global
// store. Reload === clean wizard, which matches the design spec's intent
// that Smart Match is a session-local brief.

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import {
  DiscoverResultCard,
  type DiscoverRow,
} from "@/components/discover/result-card";
import { cn } from "@/lib/utils";

// ----- form schema (mirrors /api/v1/match allow-lists) -----

const MATCH_PAGE_SIZE = 24;

const ENTITY_TYPES = [
  { value: "factory", label: "Factory" },
  { value: "buying_house", label: "Buying house" },
] as const;

const REGISTRY_OPTIONS = [
  { value: "BGMEA",   label: "BGMEA" },
  { value: "BKMEA",   label: "BKMEA" },
  { value: "BTMA",    label: "BTMA" },
  { value: "BGAPMEA", label: "BGAPMEA" },
  { value: "EPB",     label: "EPB (gov)" },
  { value: "RSC",     label: "RSC remediation" },
] as const;

const CERT_OPTIONS = [
  { value: "wrap",     label: "WRAP" },
  { value: "oeko_tex", label: "OEKO-TEX" },
  { value: "gots",     label: "GOTS" },
  { value: "sa8000",   label: "SA8000" },
] as const;

type EntityType = (typeof ENTITY_TYPES)[number]["value"];
type Registry   = (typeof REGISTRY_OPTIONS)[number]["value"];
type Cert       = (typeof CERT_OPTIONS)[number]["value"];

type FormState = {
  product: string;
  entityTypes: EntityType[];
  registries: Registry[];
  certs: Cert[];
  rscMin: string;     // raw string from input
  minMachines: string;
  city: string;
  district: string;
};

const INITIAL_STATE: FormState = {
  product: "",
  entityTypes: [],
  registries: [],
  certs: [],
  rscMin: "",
  minMachines: "",
  city: "",
  district: "",
};

type MatchResult = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  completeness_pct: number;
  employees_total: number | null;
  established_date: string | null;
  principal_products: string[];
  factory_types: string[];
  rsc_progress_pct: number | null;
  parent_group_name: string | null;
  t13_source_count: number;
  source_tags: string[];
  match_score: number;
  match_reasons: string[];
};

type MatchResponse = {
  criteria_count: number;
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  results: MatchResult[];
};

// ----- main component -----

export function SmartMatchWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [response, setResponse] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setForm(INITIAL_STATE);
    setResponse(null);
    setError(null);
    setStep(1);
  }

  function requestMatches(offset: number, append: boolean) {
    setError(null);
    if (summarise(form).length === 0) {
      setError("Add a product or at least one requirement before finding matches.");
      return;
    }
    const payload = {
      ...buildPayload(form),
      limit: MATCH_PAGE_SIZE,
      offset,
    };
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/match", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          setError(detail?.error ?? `Request failed (${res.status})`);
          return;
        }
        const data = (await res.json()) as MatchResponse;
        setResponse((prev) =>
          append && prev
            ? { ...data, results: [...prev.results, ...data.results] }
            : data,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      }
    });
  }

  function submit() {
    requestMatches(0, false);
  }

  return (
    <div className="space-y-4">
      <StepBar step={step} />

      {step === 1 ? (
        <Step1Product form={form} update={update} onNext={() => setStep(2)} />
      ) : null}

      {step === 2 ? (
        <Step2Requirements
          form={form}
          update={update}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      ) : null}

      {step === 3 ? (
        <Step3Review
          form={form}
          pending={pending}
          onBack={() => setStep(2)}
          onSubmit={submit}
        />
      ) : null}

      {error ? (
        <div className="proto-card border-sem-red text-sm text-sem-red">{error}</div>
      ) : null}

      {response ? (
        <ResultsPanel
          data={response}
          pending={pending}
          onLoadMore={() => requestMatches(response.results.length, true)}
          onReset={reset}
        />
      ) : null}
    </div>
  );
}

// ----- step bar -----

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Product", "Requirements", "Review & match"] as const;
  return (
    <ol
      aria-label="Wizard progress"
      className="flex items-center gap-2 text-[13px]"
    >
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = step > n;
        const active = step === n;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-6 min-w-[26px] items-center justify-center rounded-pill border px-2 text-[12px]",
                done
                  ? "border-sem-green bg-sem-green-soft text-sem-green"
                  : active
                    ? "border-brand-forest bg-brand-forest-soft text-brand-forest"
                    : "border-hairline text-ink-tertiary",
              )}
            >
              {done ? <CheckCircle weight="fill" size={16} /> : n}
            </span>
            <span
              className={cn(
                "text-[12px]",
                active ? "text-ink-primary" : "text-ink-tertiary",
              )}
            >
              {label}
            </span>
            {n < 3 ? (
              <span aria-hidden className="mx-1 h-px w-6 bg-hairline" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ----- Step 1: Product -----

function Step1Product({
  form,
  update,
  onNext,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onNext: () => void;
}) {
  return (
    <section className="proto-card space-y-5">
      <div className="proto-card-head">
        <h2 className="proto-card-title">Step 1 — Product</h2>
        <span className="proto-card-meta">What are you sourcing?</span>
      </div>
      <Field
        label="What are you making?"
        hint="Use buyer-style intent, such as kids shirt, ladies trousers, denim jacket, or uniforms."
      >
        <input
          type="text"
          value={form.product}
          onChange={(e) => update("product", e.target.value)}
          maxLength={80}
          placeholder="e.g. Shirts"
          className={inputClass}
        />
      </Field>

      <Field
        label="Who do you want to work with?"
        hint="Choose one if it matters. Leave both off to see all verified suppliers."
      >
        <CheckboxGroup
          options={ENTITY_TYPES}
          values={form.entityTypes}
          onChange={(v) => update("entityTypes", v as EntityType[])}
        />
      </Field>

      <StickyActionBar>
        <Button variant="primary" onClick={onNext}>
          Next: requirements
          <ArrowRight size={16} weight="bold" />
        </Button>
      </StickyActionBar>
    </section>
  );
}

// ----- Step 2: Requirements -----

function Step2Requirements({
  form,
  update,
  onBack,
  onNext,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <section className="proto-card space-y-5">
      <div className="proto-card-head">
        <h2 className="proto-card-title">Step 2 — Must-haves</h2>
        <span className="proto-card-meta">Choose the proof your buyer needs</span>
      </div>
      <Field
        label="Required certifications"
        hint="Pick the certificates your order or retailer requires."
      >
        <CheckboxGroup
          options={CERT_OPTIONS}
          values={form.certs}
          onChange={(v) => update("certs", v as Cert[])}
        />
      </Field>

      <Field
        label="Preferred memberships"
        hint="Use these if you need association, exporter, or RSC evidence."
      >
        <CheckboxGroup
          options={REGISTRY_OPTIONS}
          values={form.registries}
          onChange={(v) => update("registries", v as Registry[])}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Preferred city" hint="Optional. Use this only if location matters.">
          <input
            type="text"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            maxLength={80}
            placeholder="e.g. Gazipur"
            className={inputClass}
          />
        </Field>

        <Field label="Preferred district" hint="Optional. Example: Dhaka, Gazipur, Chattogram.">
          <input
            type="text"
            value={form.district}
            onChange={(e) => update("district", e.target.value)}
            maxLength={80}
            placeholder="e.g. Dhaka"
            className={inputClass}
          />
        </Field>
      </div>

      <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink-primary">
          Advanced requirements
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Minimum RSC progress"
            hint="Optional. Use when you need a remediation progress floor."
          >
            <input
              type="number"
              min={0}
              max={100}
              value={form.rscMin}
              onChange={(e) => update("rscMin", e.target.value)}
              placeholder="e.g. 80"
              className={inputClass}
            />
          </Field>

          <Field
            label="Minimum sewing machines"
            hint="Optional capacity filter for larger orders."
          >
            <input
              type="number"
              min={0}
              value={form.minMachines}
              onChange={(e) => update("minMachines", e.target.value)}
              placeholder="e.g. 200"
              className={inputClass}
            />
          </Field>
        </div>
      </details>

      <StickyActionBar>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} weight="bold" />
          Back
        </Button>
        <Button variant="primary" onClick={onNext}>
          Next: review
          <ArrowRight size={16} weight="bold" />
        </Button>
      </StickyActionBar>
    </section>
  );
}

// ----- Step 3: Review -----

function Step3Review({
  form,
  pending,
  onBack,
  onSubmit,
}: {
  form: FormState;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const summary = summarise(form);
  return (
    <section className="proto-card space-y-4">
      <div className="proto-card-head">
        <h2 className="proto-card-title">Step 3 — Review &amp; match</h2>
        <span className="proto-card-meta">{summary.length} criteria</span>
      </div>
      {summary.length === 0 ? (
        <p className="affiliation-disclaimer">
          No criteria added. SourceBD will return the highest-quality verified
          suppliers by evidence count.
        </p>
      ) : (
        <ul className="pill-row m-0 list-none p-0">
          {summary.map((s) => (
            <li key={s}>
              <span className="proto-pill">{s}</span>
            </li>
          ))}
        </ul>
      )}
      <StickyActionBar>
        <Button variant="ghost" onClick={onBack} disabled={pending}>
          <ArrowLeft size={16} weight="bold" />
          Back
        </Button>
        <Button variant="primary" onClick={onSubmit} disabled={pending}>
          <Sparkle size={16} weight="fill" />
          {pending ? "Matching\u2026" : "Find matches"}
        </Button>
      </StickyActionBar>
    </section>
  );
}

// ----- Results -----

function ResultsPanel({
  data,
  pending,
  onLoadMore,
  onReset,
}: {
  data: MatchResponse;
  pending: boolean;
  onLoadMore: () => void;
  onReset: () => void;
}) {
  const shown = data.results.length;
  return (
    <section aria-label="Match results" className="space-y-3">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-light tracking-tight text-ink-primary">
            {data.total} {data.total === 1 ? "match" : "matches"}
            {data.criteria_count > 0 ? (
              <span className="ml-2 text-[12px] text-ink-tertiary">
                against {data.criteria_count}{" "}
                {data.criteria_count === 1 ? "criterion" : "criteria"}
              </span>
            ) : null}
          </h2>
          {data.total > 0 ? (
            <p className="mt-1 text-[13px] text-ink-tertiary">
              Showing {shown} of {data.total}. Search intent uses the same
              synonym and compound-product brain as Discover.
            </p>
          ) : null}
        </div>
        <button type="button" onClick={onReset} className="btn-proto">
          Start over
        </button>
      </header>

      {data.results.length === 0 ? (
        <div className="proto-card text-sm text-ink-secondary">
          No verified suppliers satisfied your brief. Loosen one or two
          criteria \u2014 try removing a specific city or lowering the RSC %
          threshold.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4">
          {data.results.map((row) => (
            <li key={row.id}>
              <DiscoverResultCard
                row={matchToDiscoverRow(row)}
                hrefBase="/app/suppliers"
                footerSlot={
                  row.match_reasons.length > 0 ? (
                    <div className="pill-row">
                      <span className="text-[12px] font-semibold text-ink-tertiary">
                        Matched on:
                      </span>
                      {row.match_reasons.map((reason) => (
                        <span key={reason} className="proto-pill">
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      )}

      {data.has_more ? (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={onLoadMore} disabled={pending}>
            {pending ? "Loading…" : `Load more matches (${shown}/${data.total})`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function matchToDiscoverRow(r: MatchResult): DiscoverRow {
  return {
    id: r.id,
    slug: r.slug,
    company_name: r.company_name,
    entity_type: r.entity_type,
    city: r.city,
    district: r.district,
    source_tags: r.source_tags,
    t13_source_count: r.t13_source_count,
    completeness_pct: r.completeness_pct,
    employees_total: r.employees_total,
    established_date: r.established_date,
    principal_products: r.principal_products,
    factory_types: r.factory_types,
    rsc_progress_pct: r.rsc_progress_pct,
    parent_group_name: r.parent_group_name,
    total_count: 0,
  };
}

// ----- helpers -----

const inputClass =
  "block w-full rounded-input border border-hairline-strong bg-surface-l1 px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-brand-forest focus:outline-none focus:ring-2 focus:ring-brand-forest/30";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[12px] text-ink-tertiary">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[13px] text-ink-tertiary">{hint}</span> : null}
    </label>
  );
}

function CheckboxGroup<T extends string>({
  options,
  values,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  values: T[];
  onChange: (next: T[]) => void;
}) {
  function toggle(v: T) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            aria-pressed={active}
            className={cn(
              "rounded-pill border px-3 py-1 text-[13px] font-medium transition",
              active
                ? "border-brand-forest bg-brand-forest-soft text-brand-forest"
                : "border-hairline-strong bg-surface-l1 text-ink-secondary hover:border-brand-forest",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function summarise(form: FormState): string[] {
  const out: string[] = [];
  if (form.product) out.push(`Product: ${form.product}`);
  if (form.entityTypes.length > 0) {
    out.push(
      `Type: ${form.entityTypes
        .map((t) => (t === "buying_house" ? "Buying house" : "Factory"))
        .join(" / ")}`,
    );
  }
  for (const c of form.certs) {
    out.push(`Cert: ${c.replace("_", "-").toUpperCase()}`);
  }
  for (const r of form.registries) out.push(`Registry: ${r}`);
  if (form.rscMin) out.push(`RSC \u2265 ${form.rscMin}%`);
  if (form.minMachines) out.push(`Machines \u2265 ${form.minMachines}`);
  if (form.city) out.push(`City: ${form.city}`);
  if (form.district) out.push(`District: ${form.district}`);
  return out;
}

function buildPayload(form: FormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (form.product.trim()) payload.product = form.product.trim();
  if (form.entityTypes.length > 0) payload.entity_types = form.entityTypes;
  if (form.registries.length > 0) payload.registries = form.registries;
  if (form.certs.length > 0) payload.certs = form.certs;
  if (form.rscMin.trim() !== "") {
    const n = Number(form.rscMin);
    if (Number.isFinite(n)) payload.rsc_min = Math.trunc(n);
  }
  if (form.minMachines.trim() !== "") {
    const n = Number(form.minMachines);
    if (Number.isFinite(n)) payload.min_machines = Math.trunc(n);
  }
  if (form.city.trim()) payload.city = form.city.trim();
  if (form.district.trim()) payload.district = form.district.trim();
  return payload;
}
