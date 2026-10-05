"use client";

// Admin CSV import island (Spec A2). POSTs multipart/form-data to
// /api/v1/admin/suppliers/import and renders the per-row outcome report.

import { useRef, useState, useTransition } from "react";

import { Button, Table, TableFrame, TableScroll, Td, Th, Tr } from "@/components/kit";

type FailedRow = { row: number; slug: string; ok: false; reason: string };
type Result = {
  processed: number;
  updated: number;
  failed_count: number;
  failed: FailedRow[];
};

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
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-base text-ink"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" kind="primary" disabled={pending || !file}>
            {pending ? "Uploading…" : "Upload CSV"}
          </Button>
          {file ? (
            <span className="font-mono text-xs text-ink-3">
              {file.name} · {file.size.toLocaleString()} bytes
            </span>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>

      {result ? (
        <div role="status" className="flex flex-col gap-3 rounded-md border border-line bg-subtle p-3 text-base">
          <p className="font-mono text-sm text-ink-2">
            processed <span className="tabular-nums text-ink">{result.processed}</span>
            {" · "}updated <span className="tabular-nums text-ink">{result.updated}</span>
            {" · "}failed <span className="tabular-nums text-ink">{result.failed_count}</span>
          </p>
          {result.failed.length > 0 ? (
            <TableFrame className="bg-surface">
              <TableScroll>
                <Table aria-label="Failed rows">
                  <thead>
                    <tr>
                      <Th>Row</Th>
                      <Th>Slug</Th>
                      <Th>Reason</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.failed.map((f) => (
                      <Tr key={`${f.row}-${f.slug}`}>
                        <Td className="font-mono">L{f.row}</Td>
                        <Td className="font-mono">{f.slug || "—"}</Td>
                        <Td>{f.reason}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
            </TableFrame>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
