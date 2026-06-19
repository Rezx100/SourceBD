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
      <div className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-brand-forest">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
            Admin · suppliers
          </p>
          <h1 className="font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-primary sm:text-[32px]">
            Bulk import
          </h1>
          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
            CSV upload. Each row is dispatched through{" "}
            <code className="font-mono text-[12px]">admin_supplier_update</code>;
            one bad row never aborts the batch.
          </p>
        </div>
        <Link
          href="/admin/suppliers"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-hairline px-3 py-1.5 text-[12px] font-medium text-ink-tertiary transition-colors hover:border-brand-forest/30 hover:text-ink-primary"
        >
          ← Back to list
        </Link>
      </div>

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
