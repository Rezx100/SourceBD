// The words and the download of "Download an evidence pack" (gap row 8), out of React so the
// refusals can be tested: which sections there are, what the dialog says when the route refuses, and
// the POST that saves the file under the server's own name. A refusal saves nothing.

export const PACK_SECTIONS = [
  { key: "cert_expiry", label: "Certificate expiry dates", hint: "Every certificate on your saved suppliers, with its expiry date and where we read it." },
  { key: "uflpa", label: "UFLPA Entity List checks", hint: "Whether each saved supplier matches the US forced labour list, and when it was checked." },
  { key: "sources", label: "Sources and when they were read", hint: "The records behind each supplier, with the factory address each one holds." },
] as const;
export type PackSection = (typeof PACK_SECTIONS)[number]["key"];

/** What the dialog says once the route has answered. */
export function packMessage(status: number | "network", rows?: number): string {
  if (status === 200) return rows === undefined ? "Evidence pack downloaded." : `Evidence pack downloaded · ${rows} ${rows === 1 ? "row" : "rows"}.`;
  if (status === "network") return "Could not download the pack. There is no connection. Try again.";
  if (status === 429) return "You have downloaded 50 evidence packs today. You can download more tomorrow.";
  if (status === 401) return "Sign in again to download a pack.";
  if (status === 400) return "Choose at least one section to include.";
  return "Could not build the pack just now. Nothing was downloaded. Try again.";
}

type PackResponse = { ok: boolean; status: number; headers: { get(name: string): string | null }; blob(): Promise<unknown> };

/** POST the chosen sections; save the CSV on success. Resolves to `{ ok, message }` for the dialog. */
export async function runPackDownload(
  sections: readonly PackSection[],
  deps: { fetch: (init: { sections: readonly PackSection[]; format: "csv" }) => Promise<PackResponse>; save: (blob: unknown, filename: string) => void },
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await deps.fetch({ sections, format: "csv" });
    if (!res.ok) return { ok: false, message: packMessage(res.status) };
    const filename = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "sourcebd-evidence-pack.csv";
    deps.save(await res.blob(), filename);
    const rows = Number(res.headers.get("X-SourceBD-Rows"));
    return { ok: true, message: packMessage(200, Number.isFinite(rows) && res.headers.get("X-SourceBD-Rows") !== null ? rows : undefined) };
  } catch {
    return { ok: false, message: packMessage("network") };
  }
}
