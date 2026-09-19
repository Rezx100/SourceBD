// Fact formatting for the dashboard kit (REZ-A): certificate states, dates,
// counts, names. Pure functions — every rendered value on a card, table row or
// sheet passes through here, so the boundary tests can pin the words.

export type CertState = "valid" | "expiring" | "expired" | "no-expiry";

export type CertModel = {
  kind: string;
  /** Scheme as a buyer reads it: `GOTS`, `WRAP Gold`, `OEKO-TEX Standard 100`. */
  scheme: string;
  number: string | null;
  issuer: string | null;
  scope: string | null;
  expiresOn: string | null;
  state: CertState;
  /** Whole days until expiry (negative when past); null without a date. */
  daysLeft: number | null;
  documentUrl: string | null;
  /** The mark code for the issuer's rank square. */
  markCode: string;
};

const DAY = 86_400_000;
const EXPIRING_WITHIN_DAYS = 90;

/** UTC midnight of an ISO date or timestamp; null when unparsable. */
export function dayOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor(t / DAY) * DAY;
}

/** Whole days from `today` to `iso` (negative when `iso` is in the past). */
export function daysUntil(iso: string | null | undefined, today: Date): number | null {
  const d = dayOf(iso);
  const t = dayOf(today.toISOString());
  if (d === null || t === null) return null;
  return Math.round((d - t) / DAY);
}

/** valid · expiring (≤ 90 days) · expired · no expiry on file. */
export function certState(expiresOn: string | null | undefined, today: Date): CertState {
  const days = daysUntil(expiresOn, today);
  if (days === null) return "no-expiry";
  if (days < 0) return "expired";
  if (days <= EXPIRING_WITHIN_DAYS) return "expiring";
  return "valid";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2027-05-12` → `12 May 2027`. Null in, null out. */
export function formatDay(iso: string | null | undefined): string | null {
  const d = dayOf(iso);
  if (d === null) return null;
  const date = new Date(d);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `2027-05-12` → `May 2027`. */
export function formatMonth(iso: string | null | undefined): string | null {
  const d = dayOf(iso);
  if (d === null) return null;
  const date = new Date(d);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Tabular figure with thousands separators: 3314 → `3,314`. */
export function formatCount(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-GB").format(Math.round(n));
}

/** The words on a certificate's state badge. */
export function certStateLabel(c: Pick<CertModel, "state" | "daysLeft" | "expiresOn">): string {
  const day = formatDay(c.expiresOn);
  switch (c.state) {
    case "valid":
      return day ? `Valid to ${day}` : "Valid";
    case "expiring":
      return day
        ? `Expires ${day} · ${c.daysLeft} ${c.daysLeft === 1 ? "day" : "days"}`
        : `Expires in ${c.daysLeft} days`;
    case "expired":
      return day ? `Expired ${day}` : "Expired";
    default:
      return "No expiry on file";
  }
}

/** The short form on a card chip: `GOTS valid to 12 May 2027`, `WRAP expires in 11 days`, `WRAP expired 21 Jul 2026`. */
export function certChipLabel(c: Pick<CertModel, "scheme" | "state" | "daysLeft" | "expiresOn">): string {
  const day = formatDay(c.expiresOn);
  switch (c.state) {
    case "valid":
      return day ? `${c.scheme} valid to ${day}` : `${c.scheme} valid`;
    case "expiring":
      return `${c.scheme} expires in ${c.daysLeft} ${c.daysLeft === 1 ? "day" : "days"}`;
    case "expired":
      return day ? `${c.scheme} expired ${day}` : `${c.scheme} expired`;
    default:
      return `${c.scheme} · no expiry on file`;
  }
}

/** The shortest form, for a 22px table chip: `GOTS valid`, `WRAP 11 d`, `WRAP expired`. */
export function certTableLabel(c: Pick<CertModel, "scheme" | "state" | "daysLeft">): string {
  switch (c.state) {
    case "valid":
      return `${c.scheme} valid`;
    case "expiring":
      return `${c.scheme} ${c.daysLeft} d`;
    case "expired":
      return `${c.scheme} expired`;
    default:
      return `${c.scheme} on file`;
  }
}

const SCHEME_LABEL: Record<string, string> = {
  GOTS: "GOTS",
  WRAP: "WRAP",
  OEKO_TEX: "OEKO-TEX",
  "OEKO-TEX": "OEKO-TEX",
  SA8000: "SA8000",
  GRS: "GRS",
  RCS: "RCS",
  OCS: "OCS",
};

/** `OEKO_TEX` → `OEKO-TEX`; unknown kinds render as stored. */
export function certScheme(kind: string, scope: string | null = null): string {
  const base = SCHEME_LABEL[kind] ?? SCHEME_LABEL[kind.toUpperCase()] ?? kind.toUpperCase();
  // WRAP stores its level in the scope ("Gold | Industries: …"); the artifact reads "WRAP Gold".
  if (base === "WRAP" && scope) {
    const level = /^(gold|platinum|silver)\b/i.exec(scope.trim());
    if (level && level[1]) return `WRAP ${level[1][0]!.toUpperCase()}${level[1].slice(1).toLowerCase()}`;
  }
  if (base === "OEKO-TEX" && scope && /standard\s*100/i.test(scope)) return "OEKO-TEX Standard 100";
  return base;
}

export function certModel(
  raw: {
    kind: string;
    certificate_no: string | null;
    issuer: string | null;
    expires_on: string | null;
    scope: string | null;
    document_url: string | null;
  },
  today: Date,
): CertModel {
  return {
    kind: raw.kind,
    scheme: certScheme(raw.kind, raw.scope),
    number: raw.certificate_no,
    issuer: raw.issuer,
    scope: raw.scope,
    expiresOn: raw.expires_on,
    state: certState(raw.expires_on, today),
    daysLeft: daysUntil(raw.expires_on, today),
    documentUrl: raw.document_url,
    markCode: raw.kind,
  };
}

/** Certificates in the order a buyer needs them: expiring soonest, then valid, then expired, then undated. */
export function sortCerts(certs: readonly CertModel[]): CertModel[] {
  const rank: Record<CertState, number> = { expiring: 0, valid: 1, expired: 2, "no-expiry": 3 };
  return [...certs].sort(
    (a, b) => rank[a.state] - rank[b.state] || (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || a.scheme.localeCompare(b.scheme),
  );
}

/** "4 on file" / "1 on file". */
export function onFileLabel(n: number): string {
  return `${n} on file`;
}

/**
 * The tile's sub-line, one line that fits 172px: the soonest expiry when one
 * is inside 90 days ("1 expiring in 11 days"), otherwise the counts that need
 * a look ("1 expired · 4 no expiry"), otherwise "all valid".
 */
export function certTileSubline(certs: readonly CertModel[]): string | null {
  if (certs.length === 0) return null;
  const expiring = certs.filter((c) => c.state === "expiring");
  if (expiring.length) {
    const soonest = expiring.reduce((a, b) => ((a.daysLeft ?? 0) <= (b.daysLeft ?? 0) ? a : b));
    return `${expiring.length} expiring in ${soonest.daysLeft} ${soonest.daysLeft === 1 ? "day" : "days"}`;
  }
  const expired = certs.filter((c) => c.state === "expired").length;
  const undated = certs.filter((c) => c.state === "no-expiry").length;
  const parts: string[] = [];
  if (expired) parts.push(`${expired} expired`);
  if (undated) parts.push(`${undated} no expiry`);
  return parts.length ? parts.join(" · ") : "all valid";
}

/** RSC remediation status words for the five real states (nine stored spellings, plus blank). */
export function rscStatusWords(status: string | null | undefined): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("behind")) return "behind schedule";
  if (s.includes("on track")) return "on track";
  if (s.includes("not implemented")) return "not implemented";
  if (s.includes("not final")) return "not finalised";
  if (s.includes("initial")) return "initial plan completed";
  return status;
}

/** Training status words. */
export function rscTrainingWords(status: string | null | undefined): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("complete")) return "training completed";
  if (s.includes("yet") || s.includes("not start")) return "training yet to start";
  if (s.includes("ongoing") || s.includes("progress")) return "training ongoing";
  return `training ${status.toLowerCase()}`;
}

/** Tokens that stay in capitals when a name is re-cased. */
const KEEP_UPPER = new Set(["BD", "UK", "USA", "EU", "LLC", "PLC", "INC", "CO", "JV", "EPZ", "RMG", "ETP", "ERP", "SA", "AG", "BV", "NV"]);

function caseWord(word: string): string {
  const upper = word.toUpperCase();
  if (KEEP_UPPER.has(upper)) return upper;
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

/**
 * The name as the dashboard shows it. A name stored in mixed case is shown
 * verbatim. A name stored in capitals (most register rows: "ABONI KNITWEAR
 * LTD.") is re-cased letter-run by letter-run, so brackets, hyphens, digits and
 * "(PVT)LTD." keep their shape ("(Unit-3, Textile)", "Al-Falah", "(Pvt)Ltd"),
 * dotted initials stay as filed ("G.A.B.", "D.H."), and the trailing period
 * after the legal suffix is dropped. Nothing is ever cut (spec §3).
 */
export function displayName(stored: string): string {
  const name = stored.trim().replace(/\s+/g, " ");
  if (/[a-z]/.test(name)) return name;
  const cased = name
    .split(" ")
    .map((token) => {
      // Dotted initials ("G.A.B.", "A.K.M.", "D.H") are filed that way; keep them.
      if (/^[A-Z](?:\.[A-Z])+\.?$/.test(token)) return token;
      return token.replace(/[A-Z][A-Z0-9]*/g, (run) => (/^\d/.test(run) ? run : caseWord(run)));
    })
    .join(" ");
  return cased.replace(/\b(Ltd|Limited|Inc|Plc|Co)\.$/, "$1");
}

/** Two-letter initials for the logo slot: `Aboni Knitwear Ltd` → `AK`. */
export function initials(name: string): string {
  const words = name
    .replace(/[()&,.-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(ltd|limited|co|inc|plc|pvt|private|the|and|of)$/i.test(w));
  const first = words[0]?.[0] ?? name[0] ?? "?";
  const second = words[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

const ENTITY_LABEL: Record<string, string> = {
  factory: "Factory",
  buying_house: "Buying house",
  unknown: "Unknown type",
};

/** Plain company-type word. */
export function entityLabel(type: string | null | undefined): string {
  if (!type) return "Unknown type";
  return ENTITY_LABEL[type] ?? type.replace(/_/g, " ");
}

/** "Savar, Dhaka" · "Gazipur" · null. City and district collapse when equal. */
export function placeLabel(city: string | null | undefined, district: string | null | undefined): string | null {
  const c = city?.trim() || null;
  const d = district?.trim() || null;
  if (c && d && c.toLowerCase() !== d.toLowerCase()) return `${c}, ${d}`;
  return c ?? d;
}

/** The year from an established date; null when the date is missing. */
export function establishedYearOf(iso: string | null | undefined): string | null {
  const d = dayOf(iso);
  if (d === null) return null;
  return String(new Date(d).getUTCFullYear());
}
