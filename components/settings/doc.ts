// What `settings_get()` returns and the pure reads of it, shared by every Settings page. The old
// kit's `components/dashboard/settings.tsx` re-exports these until the last page that uses it is
// rebuilt, so there is one definition.

/** The company behind the account (`settings_get().workspace`); every field is null until set. */
export type WorkspaceDoc = {
  company_name: string | null;
  company_type: string | null;
  business_description: string | null;
  website: string | null;
  customer_base: string | null;
  employee_count: string | null;
  company_logo_url: string | null;
};

/** The RFQ defaults (`settings_get().inquiry`). */
export type InquiryDoc = { questions: string[]; email_template: string | null };

export type SettingsDoc = {
  email: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  role: string | null;
  plan_tier: string | null;
  created_at: string | null;
  notifications: {
    digest: boolean;
    rfq_replies: boolean;
    saved_alerts: boolean;
  };
  /** Absent from a reply that predates the workspace RPC: read as empty, never as an error. */
  workspace?: Partial<WorkspaceDoc> | null;
  inquiry?: Partial<InquiryDoc> | null;
};

/** What the database holds and the settings API accepts (0106's check): lower case. */
export const COMPANY_TYPES = ["brand", "retailer", "importer", "agent", "other"] as const;
/** The word for a type: "Retailer". A value outside the list is shown as stored. */
export const companyTypeWord = (v: string): string => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
export const EMPLOYEE_BANDS = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The workspace fields out of a settings reply, nulls where the reply has none. */
export function workspaceOf(doc: SettingsDoc | null): WorkspaceDoc {
  const w = (doc?.workspace ?? {}) as Record<string, unknown>;
  return {
    company_name: text(w.company_name),
    company_type: text(w.company_type)?.toLowerCase() ?? null,
    business_description: text(w.business_description),
    website: text(w.website),
    customer_base: text(w.customer_base),
    employee_count: text(w.employee_count),
    company_logo_url: text(w.company_logo_url),
  };
}

/** The inquiry defaults out of a settings reply, or null when the reply carries none (the form then shows the composer's own). */
export function inquiryOf(doc: SettingsDoc | null): InquiryDoc | null {
  const i = doc?.inquiry;
  if (!i || typeof i !== "object") return null;
  return {
    questions: Array.isArray(i.questions) ? i.questions.filter((q): q is string => typeof q === "string" && q.trim().length > 0) : [],
    email_template: text(i.email_template),
  };
}

/**
 * The plan's name, one string for the rail and Settings. Every buyer is on the
 * free tier during the public beta, and the rail calls it "Free": Settings
 * said "Starter" about the same account.
 */
export function planLabel(tier: string | null | undefined): string {
  if (tier === "growth") return "Growth";
  if (tier === "enterprise") return "Enterprise";
  return "Free";
}

/** What the rail prints beside the plan's name. */
export const PLAN_NOTE = "public beta";
