"use client";

// SettingsWorkspaceForm — the company behind the account (Settings ·
// Workspace). Reads `settings_get().workspace` (nulls until set) and posts
// `{action:'update_workspace', …}` to /api/v1/settings. The company name and
// website are what `{{company}}` and `{{website}}` fill in an RFQ message.
//
// No logo upload: the avatar's upload goes to its own storage route, and the
// workspace has none yet. The field is read and left alone.

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useContext, useId, useState, useTransition } from "react";

import { Field, SelectInput, TextArea, TextInput } from "@/components/dashboard/fields";
import { PageSection } from "@/components/dashboard/page";
import { COMPANY_TYPES, EMPLOYEE_BANDS, FormActions, FormError, type WorkspaceDoc } from "@/components/dashboard/settings";
import { useFlash } from "@/components/dashboard/use-flash";

type Values = Record<"company_name" | "company_type" | "business_description" | "website" | "customer_base" | "employee_count", string>;

const LIMITS = { company_name: 120, business_description: 1000, website: 200, customer_base: 200 } as const;

/** The body the settings API takes: every field, trimmed, an empty one as null. */
export function workspacePayload(v: Values) {
  const or = (s: string) => s.trim() || null;
  return {
    action: "update_workspace" as const,
    company_name: or(v.company_name),
    company_type: or(v.company_type),
    business_description: or(v.business_description),
    website: or(v.website),
    customer_base: or(v.customer_base),
    employee_count: or(v.employee_count),
  };
}

export function SettingsWorkspaceForm({ initial }: { initial: WorkspaceDoc }) {
  // Not `useRouter()`, which throws outside a mounted app router (the route tests draw this with none).
  const router = useContext(AppRouterContext);
  const id = useId();
  const [v, setV] = useState<Values>({
    company_name: initial.company_name ?? "",
    company_type: initial.company_type ?? "",
    business_description: initial.business_description ?? "",
    website: initial.website ?? "",
    customer_base: initial.customer_base ?? "",
    employee_count: initial.employee_count ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const [pending, startTransition] = useTransition();
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(workspacePayload(v)),
        });
        if (!res.ok) {
          const detail = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(detail?.error ?? `Could not save (${res.status}). Nothing was changed.`);
          return;
        }
        setFlash("Company info saved");
        router?.refresh();
      } catch {
        setError("Could not reach SourceBD. Nothing was changed; try again.");
      }
    });
  }

  // A saved value outside today's lists stays selectable rather than being
  // silently replaced by the first option.
  const types = v.company_type && !(COMPANY_TYPES as readonly string[]).includes(v.company_type) ? [...COMPANY_TYPES, v.company_type] : COMPANY_TYPES;
  const bands = v.employee_count && !(EMPLOYEE_BANDS as readonly string[]).includes(v.employee_count) ? [...EMPLOYEE_BANDS, v.employee_count] : EMPLOYEE_BANDS;

  return (
    <PageSection title="Company info" caption="Your company name and website sign the RFQs you send">
      <form onSubmit={onSubmit} aria-label="Company info">
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Company name" htmlFor={`${id}-name`}>
            <TextInput id={`${id}-name`} value={v.company_name} onChange={set("company_name")} maxLength={LIMITS.company_name} autoComplete="organization" />
          </Field>
          <Field label="Company type" htmlFor={`${id}-type`}>
            <SelectInput id={`${id}-type`} value={v.company_type} onChange={set("company_type")}>
              <option value="">Not set</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Business description" htmlFor={`${id}-desc`} hint="What you make or sell, in a sentence or two" className="sm:col-span-2">
            <TextArea id={`${id}-desc`} value={v.business_description} onChange={set("business_description")} maxLength={LIMITS.business_description} rows={3} />
          </Field>
          <Field label="Website" htmlFor={`${id}-web`}>
            <TextInput id={`${id}-web`} type="url" inputMode="url" placeholder="https://" value={v.website} onChange={set("website")} maxLength={LIMITS.website} autoComplete="url" />
          </Field>
          <Field label="Customer base" htmlFor={`${id}-customers`} hint="Who buys from you, for example UK high-street retail">
            <TextInput id={`${id}-customers`} value={v.customer_base} onChange={set("customer_base")} maxLength={LIMITS.customer_base} />
          </Field>
          <Field label="Employees" htmlFor={`${id}-size`}>
            <SelectInput id={`${id}-size`} value={v.employee_count} onChange={set("employee_count")}>
              <option value="">Not set</option>
              {bands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </SelectInput>
          </Field>
          <div className="sm:col-span-2">
            <FormError>{error}</FormError>
          </div>
        </div>
        <FormActions pending={pending} label="Save company info" flash={flash} />
      </form>
    </PageSection>
  );
}
