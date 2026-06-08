"use client";

// Admin CSV import island (Spec A2). POSTs multipart/form-data to
// /api/v1/admin/suppliers/import and renders the per-row outcome report.

import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table";

type FailedRow = { row: number; slug: string; ok: false; reason: string };
type Result = {
  processed: number;
  updated: number;
  failed_count: number;
  failed: FailedRow[];
};

const FAILED_COLUMNS: Column<FailedRow>[] = [
  {
    key: "row",
    label: "Row",
    render: (f) => <span className="font-mono">L{f.row}</span>,
  },
  {
    key: "slug",
    label: "Slug",
    render: (f) => <span className="font-mono">{f.slug || "—"}</span>,
  },
  {
    key: "reason",
    label: "Reason",
    render: (f) => <span className="text-ink-tertiary">{f.reason}</span>,
  },
];

export function AdminSupplierImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/v1/admin/suppliers/import", {
          method: "POST",
          body: fd,
        });
        const j = (await res.json().catch(() => null)) as
          | (Result & { error?: string })
          | { error?: string; detail?: string }
          | null;
        if (!res.ok) {
          setError(
            (j && "error" in j && j.error) ||
              (j && "detail" in j && j.detail) ||
              `Failed (${res.status})`,
          );
          return;
        }
        setResult(j as Result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="space-y-4">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" size="sm" disabled={pending || !file}>
            {pending ? "Uploading…" : "Upload CSV"}
          </Button>
          {file ? (
            <span className="font-mono text-[11px] text-ink-tertiary">
              {file.name} · {file.size.toLocaleString()} bytes
            </span>
          ) : null}
        </div>
        {error ? <p className="text-[12px] text-sem-red">{error}</p> : null}
      </form>

      {result ? (
        <div className="rounded-input border border-hairline bg-bg-l0 p-3 text-[12px]">
          <p className="font-mono">
            processed{" "}
            <span className="tabular-nums text-ink-primary">{result.processed}</span>
            {" · "}updated{" "}
            <span className="tabular-nums text-sem-green">{result.updated}</span>
            {" · "}failed{" "}
            <span className="tabular-nums text-sem-red">{result.failed_count}</span>
          </p>
          {result.failed.length > 0 ? (
            <div className="mt-2">
              <ResponsiveTable
                mode="swipe"
                columns={FAILED_COLUMNS}
                rows={result.failed}
                rowKey={(f) => `${f.row}-${f.slug}`}
                caption="Failed rows"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
