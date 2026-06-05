// I-012 — pure-function dedup for the "Addresses on file" panel.
// `v_supplier_addresses` correctly emits one row per (source_code, address_kind)
// as provenance. When two or more sources verify the same physical address we
// want to render it once, keep the longest original string (more detail), and
// expose all corroborating source codes via `verified_by[]`.
//
// Match key (case-insensitive, punctuation-folded):
//   1. lowercase
//   2. fold Chittagong/Chattogram (and Dacca/Dhaka) variants
//   3. fold "plot no" / "plot #" / "plot:" → "plot"
//   4. fold "block-b" / "block: b" → "block b"
//   5. strip `# . , : ; / ()` and collapse whitespace
//   6. drop trailing locality repetition ("dhaka dhaka" → "dhaka")
//
// Two rows merge only when they share `address_kind`. We do not merge a
// `factory` row with a `mailing` row even if the strings match — that's a
// real signal (same building used for both functions).

export type AddressRowRaw = {
  kind: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  source_code: string;
  fetched_at: string;
};

export type DedupedAddress<T extends AddressRowRaw = AddressRowRaw> = {
  kind: string;
  address: string;
  phones: string[];
  emails: string[];
  verified_by: string[];
  fetched_at: string;
  source_rows: T[];
};

function normaliseKey(input: string): string {
  let s = input.toLowerCase();
  s = s.replace(/\bchittagong\b/g, "chattogram");
  s = s.replace(/\bdacca\b/g, "dhaka");
  s = s.replace(/\bplot\s*(no\.?|number|#|:)\s*/g, "plot ");
  s = s.replace(/\bblock\s*[-:]\s*/g, "block ");
  s = s.replace(/\broad\s*(no\.?|#|:)\s*/g, "road ");
  s = s.replace(/\bsector\s*#\s*/g, "sector ");
  s = s.replace(/\bbangladesh\b/g, "");
  s = s.replace(/[#().,:;/\-]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Drop trailing repeated locality token (e.g. "gazipur gazipur" → "gazipur").
  const parts = s.split(" ");
  if (parts.length >= 2 && parts[parts.length - 1] === parts[parts.length - 2]) {
    parts.pop();
    s = parts.join(" ");
  }
  return s;
}

export function dedupAddresses<T extends AddressRowRaw>(
  rows: readonly T[],
): DedupedAddress<T>[] {
  const groups = new Map<string, DedupedAddress<T>>();
  for (const row of rows) {
    if (!row.address || row.address.trim() === "") continue;
    const key = `${row.kind}::${normaliseKey(row.address)}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        kind: row.kind,
        address: row.address,
        phones: row.phone ? [row.phone] : [],
        emails: row.email ? [row.email] : [],
        verified_by: [row.source_code],
        fetched_at: row.fetched_at,
        source_rows: [row],
      });
      continue;
    }
    // Keep the longest original string (more detail wins).
    if (row.address.length > existing.address.length) {
      existing.address = row.address;
    }
    if (row.phone && !existing.phones.includes(row.phone)) {
      existing.phones.push(row.phone);
    }
    if (row.email && !existing.emails.includes(row.email)) {
      existing.emails.push(row.email);
    }
    if (!existing.verified_by.includes(row.source_code)) {
      existing.verified_by.push(row.source_code);
    }
    if (row.fetched_at > existing.fetched_at) {
      existing.fetched_at = row.fetched_at;
    }
    existing.source_rows.push(row);
  }
  return Array.from(groups.values());
}
