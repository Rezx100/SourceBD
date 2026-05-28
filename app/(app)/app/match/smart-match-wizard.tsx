"use client";

// Smart Match wizard \u2014 Spec B4 client island.
//
// Three-step form (Product \u2192 Requirements \u2192 Review) that posts to
// POST /api/v1/match and renders the ranked result list inline using F1
// primitives. State lives in this component only \u2014 no URL params, no global
// store. Reload === clean wizard, which matches the design spec's intent
// that Smart Match is a session-local brief.

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { ReceiptsRing } from "@/components/receipts-ring";
import { cn } from "@/lib/utils";

// ----- form schema (mirrors /api/v1/match allow-lists) -----

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
  t13_source_count: number;
  source_tags: string[];
  match_score: number;
  match_reasons: string[];
};

type MatchResponse = {
  criteria_count: number;
  total: number;
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

  function submit() {
    setError(null);
    const payload = buildPayload(form);
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
        setResponse(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      }
    });
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
        <Card className="border-sem-red">
          <CardContent className="text-sm text-sem-red">{error}</CardContent>
        </Card>
      ) : null}

      {response ? <ResultsPanel data={response} onReset={reset} /> : null}
    </div>
  );
}

// ----- step bar -----

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Product", "Requirements", "Review & match"] as const;
  return (
    <ol
      aria-label="Wizard progress"
      className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.04em]"
    >
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = step > n;
        const active = step === n;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-6 min-w-[24px] items-center justify-center rounded-pill border px-2 text-[11px]",
                done
                  ? "border-sem-green bg-sem-green-soft text-sem-green"
                  : active
                    ? "border-accent-indigo bg-accent-indigo/10 text-ink-primary"
                    : "border-hairline text-ink-tertiary",
              )}
            >
              {done ? <CheckCircle weight="fill" size={12} /> : n}
            </span>
            <span
              className={cn(
                "text-[11px]",
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
    <Card>
      <CardHeader>
        <CardTitle>Step 1 \u2014 Product</CardTitle>
        <CardMeta>What are you sourcing?</CardMeta>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field
          label="Product or category"
          hint="Free-text. Matched against the supplier's declared principal products (e.g. knitwear, polo shirts, denim, accessories)."
        >
          <input
            type="text"
            value={form.product}
            onChange={(e) => update("product", e.target.value)}
            maxLength={80}
            placeholder="e.g. knitwear"
            className={inputClass}
          />
        </Field>

        <Field
          label="Supplier type"
          hint="Leave both unchecked to include any type."
        >
          <CheckboxGroup
            options={ENTITY_TYPES}
            values={form.entityTypes}
            onChange={(v) => update("entityTypes", v as EntityType[])}
          />
        </Field>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={onNext}>
            Next: requirements
            <ArrowRight size={14} weight="bold" />
          </Button>
        </div>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Step 2 \u2014 Requirements</CardTitle>
        <CardMeta>Verified signals that matter for your order</CardMeta>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field
          label="Certifications"
          hint="Only valid (non-expired) certificates count."
        >
          <CheckboxGroup
            options={CERT_OPTIONS}
            values={form.certs}
            onChange={(v) => update("certs", v as Cert[])}
          />
        </Field>

        <Field
          label="Registries / membership"
          hint="Direct or RSC-inherited registry IDs."
        >
          <CheckboxGroup
            options={REGISTRY_OPTIONS}
            values={form.registries}
            onChange={(v) => update("registries", v as Registry[])}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Minimum RSC remediation %"
            hint="0\u2013100. Leave blank to skip."
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
            hint="Soft capacity floor."
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

          <Field label="City" hint="Exact match (case-insensitive).">
            <input
              type="text"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              maxLength={80}
              placeholder="e.g. Gazipur"
              className={inputClass}
            />
          </Field>

          <Field label="District" hint="Exact match (case-insensitive).">
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

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={14} weight="bold" />
            Back
          </Button>
          <Button variant="primary" onClick={onNext}>
            Next: review
            <ArrowRight size={14} weight="bold" />
          </Button>
        </div>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Step 3 \u2014 Review &amp; match</CardTitle>
        <CardMeta>{summary.length} criteria</CardMeta>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            No criteria added. SourceBD will return the highest-quality verified
            suppliers by receipt count.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {summary.map((s) => (
              <li key={s}>
                <Tag tone="neutral">{s}</Tag>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={onBack} disabled={pending}>
            <ArrowLeft size={14} weight="bold" />
            Back
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={pending}>
            <Sparkle size={14} weight="fill" />
            {pending ? "Matching\u2026" : "Find matches"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ----- Results -----

function ResultsPanel({
  data,
  onReset,
}: {
  data: MatchResponse;
  onReset: () => void;
}) {
  return (
    <section aria-label="Match results" className="space-y-3">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-ink-primary">
          {data.total} {data.total === 1 ? "match" : "matches"}
          {data.criteria_count > 0 ? (
            <span className="ml-2 text-[12px] font-normal text-ink-tertiary">
              against {data.criteria_count}{" "}
              {data.criteria_count === 1 ? "criterion" : "criteria"}
            </span>
          ) : null}
        </h2>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Start over
        </Button>
      </header>

      {data.results.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-ink-secondary">
            No verified suppliers satisfied your brief. Loosen one or two
            criteria \u2014 try removing a specific city or lowering the RSC %
            threshold.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4">
          {data.results.map((row) => (
            <li key={row.id}>
              <ResultRow row={row} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultRow({ row }: { row: MatchResult }) {
  const location = [row.city, row.district].filter(Boolean).join(", ");
  const entityLabel =
    row.entity_type === "buying_house" ? "Buying house" : "Factory";
  const visibleTags = row.source_tags.slice(0, 4);
  const extraTags = Math.max(0, row.source_tags.length - visibleTags.length);

  return (
    <Link
      href={`/app/suppliers/${row.slug}`}
      className="block rounded-card transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo"
    >
      <Card className="transition hover:shadow-l2">
        <CardContent className="flex items-start gap-4 py-4">
          <ReceiptsRing sources={row.t13_source_count} size={48} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="font-display text-base font-semibold text-ink-primary">
                {row.company_name}
              </h3>
              <span className="text-[12px] uppercase tracking-[0.04em] text-ink-tertiary">
                {entityLabel}
              </span>
              {location ? (
                <span className="text-[12px] text-ink-tertiary">\u00b7 {location}</span>
              ) : null}
              {row.completeness_pct > 0 ? (
                <Badge tone="neutral" className="ml-1">
                  {row.completeness_pct}% complete
                </Badge>
              ) : null}
              {row.match_score > 0 ? (
                <Badge tone="active" className="ml-1">
                  {row.match_score} match{row.match_score === 1 ? "" : "es"}
                </Badge>
              ) : null}
            </div>

            {visibleTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {visibleTags.map((tag) => (
                  <Tag key={tag} tone="neutral">
                    {tag}
                  </Tag>
                ))}
                {extraTags > 0 ? <Tag tone="muted">+ {extraTags} more</Tag> : null}
              </div>
            ) : null}

            {row.match_reasons.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-ink-tertiary">
                  Matched on:
                </span>
                {row.match_reasons.map((reason) => (
                  <Tag key={reason} tone="green">
                    {reason}
                  </Tag>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ----- helpers -----

const inputClass =
  "block w-full rounded-input border border-hairline-strong bg-surface-l1 px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-accent-indigo focus:outline-none focus:ring-2 focus:ring-accent-indigo/30";

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
      <span className="block font-mono text-[11px] uppercase tracking-[0.04em] text-ink-tertiary">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[12px] text-ink-tertiary">{hint}</span> : null}
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
              "rounded-pill border px-3 py-1 text-[12px] font-medium transition",
              active
                ? "border-accent-indigo bg-accent-indigo/10 text-ink-primary"
                : "border-hairline-strong bg-surface-l1 text-ink-secondary hover:border-accent-indigo",
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
