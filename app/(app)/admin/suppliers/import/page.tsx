// Admin bulk-import page (Spec A2). Server shell + client form island.

import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { AdminSupplierImportForm } from "@/components/admin-supplier-import-form";

export const dynamic = "force-dynamic";

export default function AdminSupplierImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
            Admin · suppliers
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
            Bulk import
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            CSV upload. Each row is dispatched through{" "}
            <code className="font-mono text-[12px]">admin_supplier_update</code>;
            one bad row never aborts the batch.
          </p>
        </div>
        <Link
          href="/admin/suppliers"
          className="rounded-pill border border-hairline px-3 py-1.5 text-[12px] text-ink-tertiary hover:text-ink-primary"
        >
          ← Back to list
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>CSV format</CardTitle>
          <CardMeta>RFC 4180 — header row required</CardMeta>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 text-[13px] text-ink-secondary">
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
          <pre className="overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-3 font-mono text-[11px] text-ink-primary">
{`slug,action,name_display,notes_admin
acme-textiles,update,Acme Textiles Pvt. Ltd.,priority outreach 2026
beta-knit,sanction,,OFAC SDN match 2026-05-12 — confirmed
gamma-woven,publish,,`}
          </pre>
          <p className="text-[12px] text-ink-tertiary">
            Limits: ≤ 2 MB, ≤ 2000 data rows per upload.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardMeta>POST /api/v1/admin/suppliers/import</CardMeta>
        </CardHeader>
        <CardContent className="pt-0">
          <AdminSupplierImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
