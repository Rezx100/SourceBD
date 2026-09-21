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

/**
 * The span a set of reads covers: `18 May – 18 Sep 2026`, or one date when
 * they all fall on the same day. Shared by the topbar and the sheet header so
 * the two cannot drift; both used to print a maximum, which said nothing
 * about the oldest read behind the figure beside it.
 */
export function formatDayRange(oldestIso: string | null | undefined, newestIso: string | null | undefined): string | null {
  const a = formatDay(oldestIso);
  const b = formatDay(newestIso);
  if (a === null || b === null) return a ?? b;
  if (a === b) return a;
  const year = a.slice(a.lastIndexOf(" ") + 1);
  return `${year === b.slice(b.lastIndexOf(" ") + 1) ? a.slice(0, a.lastIndexOf(" ")) : a} – ${b}`;
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
      // Four published certificates expire today; "expires in 0 days" is not
      // how anyone says that.
      if (c.daysLeft === 0) return `${c.scheme} expires today`;
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

/**
 * Every value of the `cert_kind` enum, so no scheme can reach a buyer as the
 * database's own token. Production holds four of the fourteen today (GOTS,
 * OEKO_TEX, WRAP, SA8000); the other ten were rendering as "SEDEX_SMETA",
 * "ISO9001", "OTHER" and so on the moment a scraper filed one.
 */
const SCHEME_LABEL: Record<string, string> = {
  GOTS: "GOTS",
  WRAP: "WRAP",
  OEKO_TEX: "OEKO-TEX",
  "OEKO-TEX": "OEKO-TEX",
  SA8000: "SA8000",
  GRS: "GRS",
  RCS: "RCS",
  OCS: "OCS",
  BSCI: "BSCI",
  SEDEX_SMETA: "Sedex SMETA",
  BCI: "Better Cotton",
  FAIRTRADE: "Fairtrade",
  ISO9001: "ISO 9001",
  ISO14001: "ISO 14001",
  ISO45001: "ISO 45001",
  // The enum's own catch-all. "OTHER" on a certificate card says nothing; this
  // says what the row actually is — a certificate whose scheme was not named.
  OTHER: "Certificate",
};

/** `OEKO_TEX` → `OEKO-TEX`; unknown kinds render as stored. */
/**
 * The OEKO-TEX schemes production's `certifications.scope` holds, longest
 * first so "STANDARD 100" is not matched by a shorter prefix.
 * `select scope, count(*) … where kind = 'oeko_tex' group by 1` on 20 Sep 2026:
 * STANDARD 100 2,588 · STeP 190 · MADE IN GREEN 71 · ORGANIC COTTON 60 ·
 * ECO PASSPORT 13 · DETOX TO ZERO 1.
 */
const OEKO_SCHEMES = ["standard 100", "made in green", "organic cotton", "eco passport", "detox to zero", "step"] as const;

export function certScheme(kind: string, scope: string | null = null): string {
  const base = SCHEME_LABEL[kind] ?? SCHEME_LABEL[kind.toUpperCase()] ?? kind.toUpperCase();
  // WRAP stores its level in the scope ("Gold | Industries: …"); the artifact reads "WRAP Gold".
  if (base === "WRAP" && scope) {
    const level = /^(gold|platinum|silver)\b/i.exec(scope.trim());
    if (level && level[1]) return `WRAP ${level[1][0]!.toUpperCase()}${level[1].slice(1).toLowerCase()}`;
  }
  // OEKO-TEX runs six schemes and production holds five of them. Only
  // Standard 100 was named, so a STeP facility certificate and a MADE IN GREEN
  // product certificate both read as a bare "OEKO-TEX" on the card and the
  // table — 242 published records hold one that is not Standard 100.
  if (base === "OEKO-TEX" && scope) {
    const named = OEKO_SCHEMES.find((n) => new RegExp(`^\\s*(?:oeko-?tex\\s*)?${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(scope.trim()));
    if (named) return `OEKO-TEX ${named.replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/Step/, "STeP")}`;
  }
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
 * The tile's sub-line: every state that needs a look, soonest expiry first —
 * "1 expiring in 11 days · 1 expired · 4 no expiry" — and "all valid" when
 * none does. It used to return early on the expiring branch, so a record with
 * both an expiring and an expired certificate showed only the expiring one and
 * the expired certificate vanished from the card and the table.
 */
export function certTileSubline(certs: readonly CertModel[]): string | null {
  if (certs.length === 0) return null;
  const parts: string[] = [];
  const expiring = certs.filter((c) => c.state === "expiring");
  if (expiring.length) {
    const soonest = expiring.reduce((a, b) => ((a.daysLeft ?? 0) <= (b.daysLeft ?? 0) ? a : b));
    // `certChipLabel` says "expires today" at 0 days; this said "expiring in
    // 0 days" beside it. Four published certificates expire on the read date.
    parts.push(
      soonest.daysLeft === 0
        ? `${expiring.length} expiring today`
        : `${expiring.length} expiring in ${soonest.daysLeft} ${soonest.daysLeft === 1 ? "day" : "days"}`,
    );
  }
  const expired = certs.filter((c) => c.state === "expired").length;
  const undated = certs.filter((c) => c.state === "no-expiry").length;
  if (expired) parts.push(`${expired} expired`);
  if (undated) parts.push(`${undated} no expiry`);
  return parts.length ? parts.join(" · ") : "all valid";
}

/**
 * RSC remediation status words for the five real states (spec §3).
 *
 * The register stores each state under several spellings, and the ones with
 * the rows are unspaced. Counted on production 19 Sep 2026 (active rows):
 * `behindschedule` 907 · `initialcompleted` 638 · `ontrack` 38 ·
 * `notfinalized` 36 · `notimplemented` 280 (all inactive today) · `` 97 ·
 * plus the spaced `Behind schedule` 10, `On track` 1, `Initial CAP Completed`
 * 2, `CAP not finalised/ N/A` 1. Matching only the spaced forms left
 * `ontrack` and `notfinalized` — 30 published records — rendering the raw
 * database token to a buyer, and the tone checks below reading them as fine.
 */
export function rscStatusWords(status: string | null | undefined): string | null {
  if (!status) return null;
  // Compare without spaces so "On track", "on track" and "ontrack" are one state.
  const s = status.toLowerCase().replace(/[^a-z]/g, "");
  if (s.includes("behind")) return "behind schedule";
  if (s.includes("ontrack")) return "on track";
  if (s.includes("notimplemented")) return "not implemented";
  if (s.includes("notfinal")) return "not finalised";
  if (s.includes("initial")) return "initial plan completed";
  return status;
}

/**
 * The five states, exactly as `rscStatusWords` returns them. A status the
 * register starts storing under a tenth spelling falls through to the raw
 * token, and `rscStatusUnmapped` is what a guard asserts against.
 */
export const RSC_STATUS_WORDS = ["behind schedule", "on track", "not implemented", "not finalised", "initial plan completed"] as const;

/** True when the stored status did not map to one of the five states. */
export function rscStatusUnmapped(status: string | null | undefined): boolean {
  const words = rscStatusWords(status);
  return words !== null && !(RSC_STATUS_WORDS as readonly string[]).includes(words);
}

/**
 * A remediation state a buyer should look at. "Not implemented" and "not
 * finalised" are as much a caution as "behind schedule"; the two tone checks
 * used to test `/behind|not implemented/i`, so `notfinalized` rendered in the
 * positive treatment.
 */
export function rscStatusNeedsLook(status: string | null | undefined): boolean {
  const words = rscStatusWords(status);
  return words === "behind schedule" || words === "not implemented" || words === "not finalised";
}

/**
 * Training status words. Production stores `completed` 923 · `yet to start`
 * 461 · `ongoing` 235 · `unknown` 1 (active rows, 19 Sep 2026).
 */
export function rscTrainingWords(status: string | null | undefined): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("complete")) return "training completed";
  if (s.includes("yet") || s.includes("not start")) return "training yet to start";
  if (s.includes("ongoing") || s.includes("progress")) return "training ongoing";
  if (s.includes("unknown")) return "training status not on file";
  return `training ${status.toLowerCase()}`;
}

/** Tokens that stay in capitals when a name is re-cased. */
// "CO" is not an initialism — 35 published all-caps names carry a standalone
// "CO." token and rendered as "Textile CO. Ltd".
const KEEP_UPPER = new Set(["BD", "UK", "USA", "EU", "LLC", "PLC", "INC", "JV", "EPZ", "RMG", "ETP", "ERP", "SA", "AG", "BV", "NV"]);

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
  // 256 published records reduce to one non-stopword token ("ANABHIL & CO.
  // LTD."); the tile takes the word's second letter rather than showing one.
  const second = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return (first + second).toUpperCase();
}

/** Every value of the `entity_type` enum; production holds three of the four. */
const ENTITY_LABEL: Record<string, string> = {
  factory: "Factory",
  buying_house: "Buying house",
  agent: "Agent",
  unknown: "Unknown type",
};

/** Plain company-type word. */
export function entityLabel(type: string | null | undefined): string {
  if (!type) return "Unknown type";
  // An unmapped type still reads as a type, not as a column value.
  const words = type.replace(/_/g, " ").trim();
  return ENTITY_LABEL[type] ?? (words ? words[0]!.toUpperCase() + words.slice(1) : "Unknown type");
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
