// Company details as a page (Paper `10 · Settings · Company details`): shared by `/app/settings`
// (the desktop's first page) and `/app/settings/workspace` (the phone's, and the RFQ composer's link).
// A failed read draws no form: a save from blank fields would blank the company.

import { CompanyForm } from "./company-form";
import { workspaceOf, type SettingsDoc } from "./doc";
import { SettingsError, SettingsShell } from "./shell";

export const COMPANY_CAPTION = "Suppliers see your company name and website on every RFQ.";

export function CompanyPage({ doc, retryHref }: { doc: SettingsDoc | null; retryHref: string }) {
  return (
    <SettingsShell current="company" doc={doc} title="Company details" caption={COMPANY_CAPTION}>
      {doc ? <CompanyForm initial={workspaceOf(doc)} /> : <SettingsError retryHref={retryHref} />}
    </SettingsShell>
  );
}
