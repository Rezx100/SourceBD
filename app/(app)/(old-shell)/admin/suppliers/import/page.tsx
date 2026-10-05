// Admin bulk-import page (Spec A2). Server shell + client form island.

import { AdminColumn, AdminHead, AdminSection } from "@/components/admin/data-ui";
import { ButtonLink } from "@/components/kit";
import { AdminSupplierImportForm } from "@/components/admin-supplier-import-form";

export const dynamic = "force-dynamic";

const SAMPLE = `slug,action,name_display,notes_admin
acme-textiles,update,Acme Textiles Pvt. Ltd.,priority outreach 2026
beta-knit,sanction,,OFAC SDN match 2026-05-12 — confirmed
gamma-woven,publish,,`;

export default function AdminSupplierImportPage() {
  return (
    <AdminColumn narrow>
      <AdminHead
        title="Bulk import"
        lede={
          <>
            CSV upload. Each row is dispatched through <code className="font-mono text-sm">admin_supplier_update</code>; one bad row never aborts the
            batch.
          </>
        }
        actions={<ButtonLink href="/admin/suppliers">Back to list</ButtonLink>}
      />

      <AdminSection title="CSV format" meta="RFC 4180 · header row required">
        <div className="flex flex-col gap-3 text-base text-ink-2">
          <p>
            Required column: <code className="font-mono text-sm">slug</code> (looks up the supplier).
          </p>
          <p>
            Optional column: <code className="font-mono text-sm">action</code> — one of <code className="font-mono text-sm">update</code> (default),{" "}
            <code className="font-mono text-sm">publish</code>, <code className="font-mono text-sm">unpublish</code>,{" "}
            <code className="font-mono text-sm">sanction</code>, <code className="font-mono text-sm">unsanction</code>.
          </p>
          <p>
            Editable columns:{" "}
            <code className="font-mono text-sm">name_display, description, entity_type, sanctioned_reason, notes_admin</code>. Any other column is
            ignored. Blank values are skipped (use the single-supplier editor to clear a field).
          </p>
          <JsonBlockText text={SAMPLE} />
          <p className="text-sm text-ink-3">Limits: ≤ 2 MB, ≤ 2000 data rows per upload.</p>
        </div>
      </AdminSection>

      <AdminSection title="Upload" description="Upload a CSV to update, publish, unpublish, sanction, or clear supplier rows in bulk.">
        <AdminSupplierImportForm />
      </AdminSection>
    </AdminColumn>
  );
}

function JsonBlockText({ text }: { text: string }) {
  return <pre className="overflow-x-auto rounded-sm border border-line bg-subtle p-3 font-mono text-xs text-ink">{text}</pre>;
}
