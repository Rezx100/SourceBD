/**
 * GET /api/v1/export?kind=saved|certificates — the CSV behind Download CSV on Saved,
 * Compliance and Certificate expiry (gap row 16). Auth at the handler; this builder is the
 * observable boundary (status, body, Content-Disposition). The same reads the pages make
 * (`buyer_saved_list`, the two compliance reads), so no new RPC, policy or migration, and no
 * contact column: the columns are a fixed list below.
 *
 * `saved` follows the page's `sort`; `certificates` follows the expiry page's `show`, so the
 * file is what is on the screen. A read that failed is a 503, never a short file that looks whole.
 */

import { csvEscape, discoverWorkers } from "@/lib/dashboard/build-discover-row";
import { displayName, entityLabel } from "@/lib/dashboard/facts";
import { enrichDiscoverWorkers } from "@/lib/enrich-discover-workers";
import { expiryGroups, expiryItems, parseShow, type CertList } from "@/components/compliance/words";
import { groupCerts, parseSort, type CertRead, type SavedRow } from "@/components/saved/words";
import type { ExportResult, ExportRpcClient } from "@/lib/discover-export";

const PAGE = 100;
const MAX_ROWS = 1000;

export const SAVED_COLUMNS = ["company", "slug", "type", "city", "district", "workers", "workers_source", "profile_workers", "profile_workers_source", "sources", "certificates_to_check", "saved_on"] as const;
export const CERT_COLUMNS = ["status", "expires_on", "days_to_expiry", "certificate", "certificate_no", "supplier", "slug", "location", "issued_by"] as const;

const json = (status: number, error: string): ExportResult => ({ status, body: JSON.stringify({ error }), headers: { "Content-Type": "application/json; charset=utf-8" } });

const toCsv = (columns: readonly string[], rows: readonly Record<string, string>[]) =>
  [columns.join(","), ...rows.map((r) => columns.map((c) => csvEscape(r[c] ?? "")).join(","))].join("\r\n") + "\r\n";

const day = (d: Date) => d.toISOString().slice(0, 10);

const csvOk = (body: string, filename: string, rows: number, extra: Record<string, string> = {}): ExportResult => ({
  status: 200,
  body,
  headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-SourceBD-Rows": String(rows), ...extra },
});

const certRows = (d: unknown): CertRead[] | null => (d && typeof d === "object" && Array.isArray((d as { rows?: unknown }).rows) ? (d as { rows: CertRead[] }).rows : null);
const certList = (d: unknown): CertList | null => (d && typeof d === "object" && Array.isArray((d as { rows?: unknown }).rows) && typeof (d as { total?: unknown }).total === "number" ? (d as CertList) : null);

async function read(supabase: ExportRpcClient, fn: string, args?: Record<string, unknown>): Promise<unknown> {
  try {
    const r = await supabase.rpc(fn, args);
    return r.error ? null : r.data;
  } catch {
    return null;
  }
}

async function savedCsv(supabase: ExportRpcClient, search: URLSearchParams, today: Date): Promise<ExportResult> {
  const sort = parseSort(search.get("sort") ?? undefined);
  const rows: SavedRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    let r;
    try {
      r = await supabase.rpc("buyer_saved_list", { p_sort: sort, p_limit: PAGE, p_offset: offset });
    } catch {
      return json(503, "export unavailable");
    }
    if (r.error || !Array.isArray(r.data)) return json(503, "export unavailable");
    rows.push(...((await enrichDiscoverWorkers(supabase, r.data as SavedRow[])) as SavedRow[]));
    if (r.data.length < PAGE) break;
  }
  const matched = rows.length > 0 ? Number(rows[0]!.total_count ?? rows.length) : 0;
  const [expired, expiring] = await Promise.all([read(supabase, "compliance_expired_certs"), read(supabase, "compliance_expiring_certs", { p_window_days: 90 })]);
  const certs = groupCerts(certRows(expired), certRows(expiring));
  const records = rows.map((r) => {
    const w = discoverWorkers({ employees_total: r.employees_total, workers_own: r.workers_own, workers_basis: r.workers_basis, workers_source: r.workers_source });
    const own = certs.bySupplier.get(r.id) ?? [];
    return {
      company: displayName(r.company_name),
      slug: r.slug,
      type: entityLabel(r.entity_type),
      city: r.city ?? "",
      district: r.district ?? "",
      workers: w.own == null ? "" : String(w.own),
      workers_source: w.own == null ? "" : (w.ownLabel ?? ""),
      profile_workers: w.second == null ? "" : String(w.second),
      profile_workers_source: w.second == null ? "" : (w.secondLabel ?? ""),
      sources: String(r.t13_source_count ?? 0),
      // An unread list cannot say "nothing to check": the cell says it was not read.
      certificates_to_check: own.length ? own.map((c) => `${c.scheme} ${c.expiresOn.slice(0, 10)}`).join("; ") : certs.complete ? "" : "not read",
      saved_on: r.saved_at ? r.saved_at.slice(0, 10) : "",
    };
  });
  const truncated = matched > rows.length;
  const name = `sourcebd-saved-suppliers-${day(today)}${truncated ? `-first-${rows.length}-of-${matched}` : ""}.csv`;
  return csvOk(toCsv(SAVED_COLUMNS, records), name, rows.length, { "X-SourceBD-Matched": String(matched), ...(truncated ? { "X-SourceBD-Truncated": "1" } : {}) });
}

async function certificatesCsv(supabase: ExportRpcClient, search: URLSearchParams, today: Date): Promise<ExportResult> {
  const show = parseShow(search.get("show") ?? undefined);
  const [expired, expiring] = await Promise.all([read(supabase, "compliance_expired_certs"), read(supabase, "compliance_expiring_certs", { p_window_days: 90 })]);
  const e = certList(expired);
  const w = certList(expiring);
  if (!e || !w) return json(503, "export unavailable");
  const items = expiryItems(expiryGroups(e, w, today), show);
  const records = items.map((i) => ({
    status: i.state === "expired" ? "expired" : "expiring",
    expires_on: i.expiresOn,
    // A lapsed certificate has no days left; the date says how long ago (and "-5" would be defused as a formula).
    days_to_expiry: i.state === "expired" ? "" : String(i.days),
    certificate: i.scheme,
    certificate_no: i.number ?? "",
    supplier: i.supplier,
    slug: i.slug,
    location: i.place ?? "",
    issued_by: i.issuer ?? "",
  }));
  return csvOk(toCsv(CERT_COLUMNS, records), `sourcebd-certificates-${show === "all" ? "to-check" : show === "expired" ? "expired" : `expiring-${show}-days`}-${day(today)}.csv`, records.length);
}

export async function runListExport(input: { role: string | null; supabase: ExportRpcClient; search: string; today: Date }): Promise<ExportResult> {
  if (input.role !== "buyer" && input.role !== "admin") {
    // 401 only for no session; a signed-in supplier is known and refused (403).
    return input.role != null ? json(403, "forbidden") : json(401, "unauthorised");
  }
  const search = new URLSearchParams(input.search.replace(/^\?/, ""));
  const kind = search.get("kind");
  if (kind === "saved") return savedCsv(input.supabase, search, input.today);
  if (kind === "certificates") return certificatesCsv(input.supabase, search, input.today);
  return json(400, "invalid kind");
}
