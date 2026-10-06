/**
 * POST /api/v1/evidence-pack: the CSV behind "Download an evidence pack" on Compliance (gap row 8,
 * migration 0114). Calling the database's `evidence_pack` IS the download: it writes the download
 * record (what Plan and usage counts) and enforces the 50 a day, under the buyer's own session, so
 * no preview may call it. The file is built here from the rows it returns: a fixed list of columns
 * (no contact detail), dates and states in the words the product uses, spreadsheet formulas defused.
 *
 * Only CSV is built. The database records a `pdf` format too, but there is no PDF library in the
 * repo and none is added without the founder (AGENTS rule 4); a request for it is a 400, not a CSV
 * under a PDF's name.
 */

import { PACK_SECTIONS } from "@/components/compliance/pack";
import { csvEscape } from "@/lib/dashboard/build-discover-row";
import { formatDay } from "@/lib/dashboard/facts";
import type { ExportResult, ExportRpcClient } from "@/lib/discover-export";

export const PACK_COLUMNS = [
  ["section", "Section"],
  ["supplier", "Supplier"],
  ["supplier_slug", "Profile"],
  ["item", "Item"],
  ["state", "State"],
  ["date", "Date"],
  ["source", "Source"],
  ["checked_on", "Checked on"],
  ["address", "Address"],
] as const;

const SECTION_WORDS: Record<string, string> = { cert_expiry: "Certificate expiry", uflpa: "UFLPA check", sources: "Source" };
const STATE_WORDS: Record<string, string> = {
  expired: "Expired",
  expiring: "Expires within 90 days",
  valid: "Valid",
  no_expiry_date: "No expiry date",
  on_the_list: "On the UFLPA Entity List",
  possible_xinjiang_link: "Possible Xinjiang link",
  no_link_found: "No link found",
};

/** "tier1_gov" -> "Tier 1"; a state the table does not know passes through as the database wrote it. */
export function stateWords(state: unknown): string {
  if (typeof state !== "string") return "";
  const tier = /^tier(\d)/.exec(state);
  return STATE_WORDS[state] ?? (tier ? `Tier ${tier[1]}` : state);
}

type PackRow = Record<string, unknown>;

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const day = (v: unknown): string => (typeof v === "string" && v ? (formatDay(v) ?? "") : "");

/** One row as the CSV prints it. */
export function packRecord(r: PackRow): string[] {
  const source = text(r.source);
  return [
    SECTION_WORDS[text(r.section)] ?? text(r.section),
    text(r.supplier),
    text(r.supplier_slug),
    text(r.item),
    stateWords(r.state),
    day(r.date),
    source ? `From ${source}` : "",
    day(r.checked_on),
    text(r.address),
  ];
}

export function packCsv(rows: readonly PackRow[]): string {
  return [PACK_COLUMNS.map(([, h]) => h).join(","), ...rows.map((r) => packRecord(r).map(csvEscape).join(","))].join("\r\n") + "\r\n";
}

const json = (status: number, error: string): ExportResult => ({ status, body: JSON.stringify({ error }), headers: { "Content-Type": "application/json; charset=utf-8" } });

export async function runEvidencePack(input: { role: string | null; supabase: ExportRpcClient; raw: unknown; today: Date }): Promise<ExportResult> {
  if (input.role !== "buyer" && input.role !== "admin") {
    return input.role != null ? json(403, "forbidden") : json(401, "unauthorised");
  }
  if (!input.raw || typeof input.raw !== "object" || Array.isArray(input.raw)) return json(400, "body must be an object");
  const { sections, format } = input.raw as { sections?: unknown; format?: unknown };
  const known = new Set<string>(PACK_SECTIONS.map((s) => s.key));
  if (!Array.isArray(sections) || sections.length === 0 || !sections.every((s) => typeof s === "string" && known.has(s))) {
    return json(400, "invalid sections");
  }
  if (format !== "csv") return json(400, "format not available");
  const asked = [...new Set(sections as string[])];

  let res;
  try {
    res = await input.supabase.rpc("evidence_pack", { p_sections: asked, p_format: "csv" });
  } catch {
    return json(503, "evidence pack unavailable");
  }
  if (res.error) {
    const code = (res.error as { code?: string }).code;
    if (code === "54000") return json(429, "daily limit");
    if (code === "42501") return json(401, "unauthorised");
    if (code === "22023") return json(400, "invalid sections");
    return json(503, "evidence pack unavailable");
  }
  const d = res.data as { rows?: unknown } | null;
  if (!d || !Array.isArray(d.rows) || !d.rows.every((r) => r && typeof r === "object")) return json(503, "evidence pack unavailable");
  const rows = d.rows as PackRow[];
  return {
    status: 200,
    body: packCsv(rows),
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sourcebd-evidence-pack-${input.today.toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
      "X-SourceBD-Rows": String(rows.length),
    },
  };
}
