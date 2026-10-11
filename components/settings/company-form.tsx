"use client";

// Company details (Paper `10 · Settings · Company details`): the name and website that sign every
// RFQ, the kind of company, what it sells, who it sells to and how many people it employs. Changing
// any of them raises the bar at the foot (what changed, Discard, Save changes). Posts
// `{action:'update_workspace', …}`; a failed save keeps what was typed and says why. No logo upload:
// the workspace has no storage route for one, so the saved logo is read and left alone.

import { Check } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, Input, Segmented, Select } from "@/components/kit";
import { COMPANY_LABELS, COMPANY_LIMITS, COMPANY_SAVED, bandLabel, bandOptions, changedFields, typeOptions, valuesOf, workspacePayload, type CompanyKey, type CompanyValues } from "./company";
import { companyTypeWord, type WorkspaceDoc } from "./doc";
import { Flash, FormNote, SaveBar, textareaClass, useFlash } from "./form";
import { PHONE_INPUT } from "./phone";
import { SAVE_FAILED, browserFetch, postSettings } from "./transport";

/** Radix cannot hold an empty value, so "Not set" is this one. */
const NOT_SET = "none";

export function CompanyForm({ initial }: { initial: WorkspaceDoc }) {
  const router = useRouter();
  const [saved, setSaved] = useState<CompanyValues>(() => valuesOf(initial));
  const [v, setV] = useState<CompanyValues>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const set = (k: CompanyKey) => (value: string) => setV((s) => ({ ...s, [k]: value }));
  const changed = changedFields(saved, v);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || changed.length === 0) return;
    setSaving(true);
    setError(null);
    setFlash(null);
    const r = await postSettings(workspacePayload(v), SAVE_FAILED.workspace, { fetch: browserFetch });
    setSaving(false);
    if (!r.ok) return setError(r.message);
    setSaved(v);
    setFlash(COMPANY_SAVED);
    router.refresh();
  }

  const typeValues = typeOptions(v.company_type);
  return (
    <form onSubmit={onSubmit} aria-label="Company details" className="flex flex-col gap-4 border-t border-line pt-5 max-md:border-t-0 max-md:pt-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name">{(a) => <Input {...a} value={v.company_name} onChange={(e) => set("company_name")(e.target.value)} maxLength={COMPANY_LIMITS.company_name} autoComplete="organization" className={PHONE_INPUT} />}</Field>
        <Field label="Website">
          {(a) => <Input {...a} type="url" inputMode="url" placeholder="https://" value={v.website} onChange={(e) => set("website")(e.target.value)} maxLength={COMPANY_LIMITS.website} autoComplete="url" className={PHONE_INPUT} />}
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">{COMPANY_LABELS.company_type}</span>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented name="company_type" label={COMPANY_LABELS.company_type} value={v.company_type} onValueChange={set("company_type")} options={typeValues.map((t) => ({ value: t, label: companyTypeWord(t) }))} className="max-w-full flex-wrap max-md:hidden" />
          {/* Paper `11 · Company details`: the same choice as 36-tall pills, the chosen one filled with a tick. */}
          <div role="radiogroup" aria-label={COMPANY_LABELS.company_type} className="flex flex-wrap gap-2 md:hidden">
            {typeValues.map((t) => {
              const on = v.company_type === t;
              return (
                <label key={t} className="relative">
                  <input type="radio" name="company_type_phone" value={t} checked={on} onChange={() => set("company_type")(t)} className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-full outline-none" />
                  <span
                    className={
                      on
                        ? "flex h-9 items-center gap-1.5 rounded-full bg-ink pl-2.5 pr-3.5 text-base font-medium text-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
                        : "flex h-9 items-center rounded-full border border-line px-3.5 text-base font-medium text-ink peer-active:bg-sunken peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
                    }
                  >
                    {on ? <Check size={16} aria-hidden /> : null}
                    {companyTypeWord(t)}
                  </span>
                </label>
              );
            })}
          </div>
          {v.company_type ? (
            <button type="button" onClick={() => set("company_type")("")} className="flex h-8 items-center rounded-sm px-1 text-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-md:h-11">
              Clear
            </button>
          ) : null}
        </div>
      </div>
      <Field label={COMPANY_LABELS.business_description} help="What you make or sell, in a sentence or two">
        {(a) => <textarea {...a} className={textareaClass} value={v.business_description} onChange={(e) => set("business_description")(e.target.value)} maxLength={COMPANY_LIMITS.business_description} rows={3} placeholder="e.g. Menswear and womenswear basics" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={COMPANY_LABELS.customer_base} help="For example UK high-street retail">
          {(a) => <Input {...a} value={v.customer_base} onChange={(e) => set("customer_base")(e.target.value)} maxLength={COMPANY_LIMITS.customer_base} placeholder="e.g. UK high-street retail" className={PHONE_INPUT} />}
        </Field>
        <Field label={COMPANY_LABELS.employee_count}>
          {(a) => <Select id={a.id} aria-describedby={a["aria-describedby"]} value={v.employee_count || NOT_SET} onValueChange={(b) => set("employee_count")(b === NOT_SET ? "" : b)} options={[{ value: NOT_SET, label: "Not set" }, ...bandOptions(v.employee_count).map((b) => ({ value: b, label: bandLabel(b) }))]} className="max-md:h-input-touch max-md:rounded-lg max-md:pl-3.5 max-md:pr-3.5 max-md:text-md" />}
        </Field>
      </div>
      <FormNote>{error}</FormNote>
      <SaveBar changed={changed.map((k) => COMPANY_LABELS[k])} saving={saving} onDiscard={() => (setV(saved), setError(null))} />
      <Flash text={flash} />
    </form>
  );
}
