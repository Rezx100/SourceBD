// Admin bulk-import page (Spec A2). Server shell + client form island.

import {
  AdminActionLink,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
} from "@/components/admin/admin-ui";
import { AdminSupplierImportForm } from "@/components/admin-supplier-import-form";

export const dynamic = "force-dynamic";

export default function AdminSupplierImportPage() {
  return (
    <AdminPage maxWidth="4xl">
      <AdminPageHeader
        kicker="Admin · Suppliers"
        title="Bulk import"
        description={
          <>
            CSV upload. Each row is dispatched through{" "}
            <code className="font-mono text-[13px]">admin_supplier_update</code>;
            one bad row never aborts the batch.
          </>
        }
        actions={<AdminActionLink href="/admin/suppliers">Back to list</AdminActionLink>}
      />

      <AdminPanel
        title="CSV format"
        meta="RFC 4180 · header row required"
        contentClassName="space-y-3 text-[14px] text-ink-secondary"
      >
          <p>
            Required column: <code className="font-mono">slug</code> (looks up
            the supplier).
          </p>
          <p>
            Optional column: <code className="font-mono">action</code> — one of{" "}
            <code className="font-mono">update</code> (default),{" "}
            <code className="font-mono">publish</code>,{" "}
            <code className="font-mono">unpublish</code>,{" "}
            <code className="font-mono">sanction</code>,{" "}
            <code className="font-mono">unsanction</code>.
          </p>
          <p>
            Editable columns:{" "}
            <code className="font-mono">
              name_display, description, entity_type, sanctioned_reason,
              notes_admin
            </code>
            . Any other column is ignored. Blank values are skipped (use the
            single-supplier editor to clear a field).
          </p>
          <pre className="overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-3 font-mono text-[12px] text-ink-primary">
{`slug,action,name_display,notes_admin
acme-textiles,update,Acme Textiles Pvt. Ltd.,priority outreach 2026
beta-knit,sanction,,OFAC SDN match 2026-05-12 — confirmed
gamma-woven,publish,,`}
          </pre>
          <p className="text-[13px] text-ink-tertiary">
            Limits: ≤ 2 MB, ≤ 2000 data rows per upload.
          </p>
      </AdminPanel>

      <AdminPanel
        title="Upload"
        description="Upload a CSV to update, publish, unpublish, sanction, or clear supplier rows in bulk."
      >
          <AdminSupplierImportForm />
      </AdminPanel>
    </AdminPage>
  );
}
