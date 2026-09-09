/**
 * EPB Harmonised System codes shown on the Compliance tab.
 * Only 4–6 digit codes and edb.epb.gov.bd HS URLs pass through.
 */

export type ProfileEpbHscode = {
  code: string;
  description: string | null;
  source_url: string | null;
};

const CODE_RE = /^\d{4,6}$/;
const EXPORTER_PREFIX = "https://edb.epb.gov.bd/exporter/";

function hsSourceUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  return /^https:\/\/edb\.epb\.gov\.bd\/hscode-exporters\/\d+$/i.test(url)
    ? url
    : null;
}

/** Same guard as migration 0103 EPB source_url. Never the agency homepage. */
export function epbExporterOpenUrl(
  sourceRef: string | null | undefined,
  detailUrl: string | null | undefined,
): string | null {
  const ref = (sourceRef ?? "").trim();
  const url = (detailUrl ?? "").trim();
  if (!ref || !url) return null;
  const prefix = `${EXPORTER_PREFIX}${ref}/`;
  return url.startsWith(prefix) ? url : null;
}

/** Buyer Open href for an EPB pill. Homepage and non-exporter URLs drop. */
export function epbRegistryVerifyHref(
  sourceUrl: string | null | undefined,
): string | null {
  const url = (sourceUrl ?? "").trim();
  if (!url) return null;
  if (url === "https://epb.gov.bd/" || url === "https://epb.gov.bd") return null;
  return url.startsWith(EXPORTER_PREFIX) ? url : null;
}

export function asEpbHscodes(raw: unknown): ProfileEpbHscode[] {
  if (!Array.isArray(raw)) return [];
  const out: ProfileEpbHscode[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { code?: unknown; description?: unknown; source_url?: unknown };
    const codeRaw = rec.code;
    const code =
      typeof codeRaw === "number" && Number.isInteger(codeRaw)
        ? String(codeRaw)
        : typeof codeRaw === "string"
          ? codeRaw.trim()
          : "";
    if (!CODE_RE.test(code) || seen.has(code)) continue;
    seen.add(code);
    const description =
      typeof rec.description === "string" && rec.description.trim()
        ? rec.description.trim()
        : null;
    out.push({
      code,
      description,
      source_url: hsSourceUrl(rec.source_url),
    });
  }
    return out;
}

/** Distinguish "this company has no HS codes" from "the RPC failed". */
export function hscodesFromRpc(result: {
  data: unknown;
  error: unknown;
}): { hscodes: ProfileEpbHscode[]; loadError: boolean } {
  if (result.error) return { hscodes: [], loadError: true };
  const data = result.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const rec = data as { code?: unknown; message?: unknown };
    const code = String(rec.code ?? "");
    const msg = typeof rec.message === "string" ? rec.message : "";
    if (
      code === "57014" ||
      /statement timeout|canceling statement|timed out/i.test(msg)
    ) {
      return { hscodes: [], loadError: true };
    }
  }
  return { hscodes: asEpbHscodes(data), loadError: false };
}
