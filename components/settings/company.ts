// Company details, out of React (Paper `10 · Settings · Company details, unsaved changes`): the
// fields, which of them differ from what is saved (the bar names them), and the body the settings API
// takes. The company name and website are what `{{company}}` and `{{website}}` fill in an RFQ.

import { COMPANY_TYPES, EMPLOYEE_BANDS, type WorkspaceDoc } from "./doc";

export type CompanyKey = "company_name" | "website" | "company_type" | "business_description" | "customer_base" | "employee_count";
export type CompanyValues = Record<CompanyKey, string>;

/** Paper's names for the fields, as the unsaved-changes bar prints them. */
export const COMPANY_LABELS: Record<CompanyKey, string> = {
  company_name: "Company name",
  website: "Website",
  company_type: "Company type",
  business_description: "What you sell",
  customer_base: "Who you sell to",
  employee_count: "Employees",
};

const ORDER: readonly CompanyKey[] = ["company_name", "website", "company_type", "business_description", "customer_base", "employee_count"];

export const COMPANY_LIMITS = { company_name: 120, business_description: 1000, website: 200, customer_base: 200 } as const;

export const COMPANY_SAVED = "Company details saved";

export const valuesOf = (w: WorkspaceDoc): CompanyValues => ({
  company_name: w.company_name ?? "",
  website: w.website ?? "",
  company_type: w.company_type ?? "",
  business_description: w.business_description ?? "",
  customer_base: w.customer_base ?? "",
  employee_count: w.employee_count ?? "",
});

/** The fields that differ from what is saved, in the page's order; a trailing space is not a change. */
export function changedFields(saved: CompanyValues, now: CompanyValues): CompanyKey[] {
  return ORDER.filter((k) => saved[k].trim() !== now[k].trim());
}

/** The body the settings API takes: every field, trimmed, an empty one as null. */
export function workspacePayload(v: CompanyValues) {
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

/** "201-1000" is read "201–1,000"; "1000+" is "1,000+". */
export function bandLabel(v: string): string {
  return v.replace(/\d+/g, (n) => new Intl.NumberFormat("en-GB").format(Number(n))).replace("-", "–");
}

/** A saved value outside today's list stays selectable rather than being silently replaced. */
export const typeOptions = (current: string): string[] => (current && !(COMPANY_TYPES as readonly string[]).includes(current) ? [...COMPANY_TYPES, current] : [...COMPANY_TYPES]);
export const bandOptions = (current: string): string[] => (current && !(EMPLOYEE_BANDS as readonly string[]).includes(current) ? [...EMPLOYEE_BANDS, current] : [...EMPLOYEE_BANDS]);
