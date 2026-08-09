/**
 * Facility group roll-up for the mother profile — REZ-73 (widened 8 Aug 2026:
 * separate labelled figures, never one combined total).
 *
 * Arithmetic LOCKSTEP with `etl/core/facility_rollup.py` (REZ-92): sums,
 * unknown/lower-bound rules, and building counts. The Python module also
 * filters nest/tombstone/parent-is-facility inputs for ETL callers that
 * receive raw rows; this web path is fed by `buyer_supplier_profile`'s
 * facilities[] which already scopes to direct children of a published
 * mother, so those input-hygiene filters are not duplicated here.
 * Presentation differs deliberately: `describeGroupMetric` renders en-US
 * grouped digits ("5,200 across 3 buildings") where Python `describe()`
 * renders raw digits.
 *
 * RULES:
 * - The mother's own figures are returned untouched and never summed into
 *   themselves — `own` mirrors the stored columns byte-for-byte.
 * - Across genuinely distinct buildings the arithmetic sum is real.
 * - `null` is unknown, never coerced to 0. Any unknown building makes the
 *   group total a lower bound: "at least N across M buildings, K unknown".
 * - Only direct children of the viewed mother are summed (RPC scopes by
 *   `f.facility_of = s.id`).
 */

export const ROLLUP_COLUMNS = [
  "employees_total",
  "machines_sewing",
  "production_capacity_pcs_day",
  "production_capacity_dozen_yearly",
] as const;

export type RollupColumn = (typeof ROLLUP_COLUMNS)[number];

/** The mother's own stored figures — rendered as-is everywhere else. */
export type FacilityRollupOwn = Record<RollupColumn, number | null>;

/** One facility row from the RPC payload (numerics nullable = unknown). */
export type FacilityRollupBuilding = FacilityRollupOwn & { name: string };

export type GroupMetric = {
  /** Mother's own stored value — never a sum. */
  own: number | null;
  /** Arithmetic sum of known values across mother + facilities. */
  knownSum: number | null;
  facilityCount: number;
  buildingCount: number;
  knownCount: number;
  unknownCount: number;
  /** True when at least one building's value is unknown. */
  isLowerBound: boolean;
};

export type FacilityGroupProjection = {
  facilityCount: number;
  metrics: Record<RollupColumn, GroupMetric>;
};

function metricForColumn(
  own: FacilityRollupOwn,
  facilities: readonly FacilityRollupBuilding[],
  column: RollupColumn,
): GroupMetric {
  const values = [own[column], ...facilities.map((f) => f[column])];
  const known = values.filter((v): v is number => v != null);
  const unknownCount = values.length - known.length;
  const facilityCount = facilities.length;
  return {
    own: own[column],
    knownSum:
      facilityCount === 0
        ? own[column]
        : known.length > 0
          ? known.reduce((a, b) => a + b, 0)
          : null,
    facilityCount,
    buildingCount: 1 + facilityCount,
    knownCount: known.length,
    unknownCount,
    isLowerBound: unknownCount > 0 && known.length > 0,
  };
}

/**
 * Derive the group view for a mother company. Pure; no mutation of inputs.
 * With zero facilities every metric's knownSum equals the mother's own
 * value — callers omit the section entirely in that case.
 */
export function projectFacilityGroup(
  own: FacilityRollupOwn,
  facilities: readonly FacilityRollupBuilding[],
): FacilityGroupProjection {
  const metrics = Object.fromEntries(
    ROLLUP_COLUMNS.map((column) => [
      column,
      metricForColumn(own, facilities, column),
    ]),
  ) as Record<RollupColumn, GroupMetric>;
  return { facilityCount: facilities.length, metrics };
}

/**
 * Human-readable group figure for the UI. Examples:
 * - no facilities, known own        → "2,000"
 * - all known across buildings      → "5,200 across 3 buildings"
 * - partial                         → "at least 3,500 across 3 buildings, 1 unknown"
 * - all unknown                     → "unknown across 3 buildings, 3 unknown"
 */
export function describeGroupMetric(m: GroupMetric): string {
  const fmt = (n: number) => n.toLocaleString("en-US");
  if (m.facilityCount === 0) {
    return m.own == null ? "unknown" : fmt(m.own);
  }
  if (m.knownSum == null) {
    return `unknown across ${m.buildingCount} buildings, ${m.unknownCount} unknown`;
  }
  if (m.isLowerBound) {
    return `at least ${fmt(m.knownSum)} across ${m.buildingCount} buildings, ${m.unknownCount} unknown`;
  }
  return `${fmt(m.knownSum)} across ${m.buildingCount} buildings`;
}

/** Paths pinned by containment tests — relative to repo root. */
export const FACILITIES_PROFILE_MIGRATION =
  "supabase/migrations/20260808_rez73_buyer_supplier_profile_facilities.sql";

/** PG dollar-quote opener `$tag$` — tag may include digits (`$e1$`). */
const DOLLAR_TAG = /^\$([A-Za-z0-9_]*)\$/;

type JsonbPair = { key: string; value: string };

/**
 * Quote/dollar-aware extract of a `jsonb_build_object(...)` body's
 * key/value pairs starting at `openIdx`. A `)` inside a string value must
 * not close the object — that truncation let `'rsc', 'x)', 'display_name',
 * f.slug` pass a key-only whitelist while emitting identity. Every KEY
 * must be a lowercase snake literal; VALUES are returned trimmed for the
 * caller to pin exactly.
 */
export function extractLiteralJsonbPairs(
  sql: string,
  openIdx: number,
): JsonbPair[] {
  const marker = "jsonb_build_object";
  const parenStart = sql.indexOf("(", openIdx);
  if (parenStart < 0 || !sql.slice(openIdx, parenStart).includes(marker)) {
    throw new Error("extractLiteralJsonbPairs: not at a jsonb_build_object");
  }
  const close = findMatchingParen(sql, parenStart);
  const body = sql.slice(parenStart + 1, close);
  const args = splitTopLevelArgs(body);
  if (args.length % 2 !== 0) {
    throw new Error(
      `jsonb_build_object has an odd argument count (${args.length}) — key/value pairs required`,
    );
  }
  const pairs: JsonbPair[] = [];
  for (let i = 0; i < args.length; i += 2) {
    const keyArg = args[i]!.trim();
    const lit = /^'([a-z][a-z0-9_]*)'$/.exec(keyArg);
    if (!lit) {
      throw new Error(
        `facilities jsonb key must be a lowercase snake literal; got ${keyArg}`,
      );
    }
    pairs.push({ key: lit[1]!, value: args[i + 1]!.trim() });
  }
  return pairs;
}

/** Sorted keys only — prefer extractLiteralJsonbPairs when values matter. */
export function extractLiteralJsonbKeys(
  sql: string,
  openIdx: number,
): string[] {
  return extractLiteralJsonbPairs(sql, openIdx)
    .map((p) => p.key)
    .sort();
}

/** Find the `)` that closes the `(` at parenStart, ignoring parens inside quotes. */
function findMatchingParen(sql: string, parenStart: number): number {
  let depth = 0;
  let inSingle = false;
  let inDollar: string | null = null;
  for (let i = parenStart; i < sql.length; i++) {
    const ch = sql[i]!;
    if (inDollar !== null) {
      if (sql.startsWith(inDollar, i)) {
        i += inDollar.length - 1;
        inDollar = null;
      }
      continue;
    }
    if (inSingle) {
      if (ch === "'" && sql[i + 1] === "'") {
        i += 1;
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === "$") {
      const m = DOLLAR_TAG.exec(sql.slice(i));
      if (m) {
        inDollar = `$${m[1]}$`;
        i += m[0].length - 1;
        continue;
      }
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error("findMatchingParen: never closes");
}

/** Split on commas that sit at paren/bracket depth 0 outside quotes. */
function splitTopLevelArgs(body: string): string[] {
  const args: string[] = [];
  let start = 0;
  let depth = 0;
  let inSingle = false;
  let inDollar: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (inDollar !== null) {
      if (body.startsWith(inDollar, i)) {
        i += inDollar.length - 1;
        inDollar = null;
      }
      continue;
    }
    if (inSingle) {
      if (ch === "'" && body[i + 1] === "'") {
        i += 1;
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === "$") {
      const m = DOLLAR_TAG.exec(body.slice(i));
      if (m) {
        inDollar = `$${m[1]}$`;
        i += m[0].length - 1;
        continue;
      }
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    else if (ch === "," && depth === 0) {
      args.push(body.slice(start, i));
      start = i + 1;
    }
  }
  args.push(body.slice(start));
  return args.filter((a) => a.trim().length > 0);
}

/** Strip SQL comments without eating quoted / dollar-quoted content. */
function stripSqlComments(sql: string): string {
  let out = "";
  let i = 0;
  let inSingle = false;
  let inDollar: string | null = null;
  while (i < sql.length) {
    const ch = sql[i]!;
    if (inDollar !== null) {
      if (sql.startsWith(inDollar, i)) {
        out += inDollar;
        i += inDollar.length;
        inDollar = null;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (inSingle) {
      out += ch;
      if (ch === "'" && sql[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "$") {
      const m = DOLLAR_TAG.exec(sql.slice(i));
      if (m) {
        inDollar = `$${m[1]}$`;
        out += m[0];
        i += m[0].length;
        continue;
      }
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length - 1 && !(sql[i] === "*" && sql[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Replace string and dollar-quoted literals with spaces (keeps length-ish).
 * Exact literals in `preserve` survive so errcodes like check_violation remain
 * visible after blanking.
 */
function blankSqlStrings(
  sql: string,
  preserve: ReadonlySet<string> = new Set(),
): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i]!;
    if (ch === "'") {
      i += 1;
      let content = "";
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          content += "'";
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i += 1;
          break;
        }
        content += sql[i];
        i += 1;
      }
      out += preserve.has(content) ? ` '${content}' ` : " ";
      continue;
    }
    if (ch === "$") {
      const m = DOLLAR_TAG.exec(sql.slice(i));
      if (m) {
        const closer = `$${m[1]}$`;
        i += m[0].length;
        const end = sql.indexOf(closer, i);
        if (end === -1) break;
        const content = sql.slice(i, end);
        out += preserve.has(content) ? ` ${closer}${content}${closer} ` : " ";
        i = end + closer.length;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

const PINNED_OBJECT_NAME =
  /buyer_supplier_profile|v_supplier_addresses(?:_direct)?/i;

/**
 * True when SQL contains a dynamic EXECUTE (format / dollar / E' / ' / var)
 * whose argument text mentions a pinned object. Also catches PERFORM format(...)
 * and opaque `EXECUTE stmt` when an earlier assignment to stmt embeds a pin.
 * Ignores GRANT EXECUTE and trigger EXECUTE FUNCTION.
 */
export function hasDynamicExecuteOfPinnedObject(sql: string): boolean {
  const code = stripSqlComments(sql);
  if (hasPerformFormatOfPinnedObject(code)) return true;
  let i = 0;
  while (i < code.length) {
    const m = /\bexecute\b/i.exec(code.slice(i));
    if (!m || m.index === undefined) break;
    const at = i + m.index;
    const afterMatch = code.slice(at + m[0].length);
    const ws = afterMatch.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = afterMatch.slice(ws);
    if (/^(on|function|procedure)\b/i.test(trimmed)) {
      i = at + m[0].length;
      continue;
    }
    const payload = extractExecuteArgPayload(code, at + m[0].length + ws);
    if (PINNED_OBJECT_NAME.test(payload)) return true;
    const opaque = /^([A-Za-z_][A-Za-z0-9_]*)\s*;/.exec(trimmed);
    if (opaque) {
      const varName = opaque[1]!;
      if (assignedVarMentionsPinned(code, varName, at)) return true;
    }
    i = at + m[0].length;
  }
  return false;
}

function hasPerformFormatOfPinnedObject(code: string): boolean {
  let i = 0;
  while (i < code.length) {
    const m = /\bperform\s+format\s*\(/i.exec(code.slice(i));
    if (!m || m.index === undefined) break;
    const paren = i + m.index + m[0].length - 1;
    try {
      const close = findMatchingParen(code, paren);
      if (PINNED_OBJECT_NAME.test(code.slice(paren, close + 1))) return true;
      i = close + 1;
    } catch {
      i += m[0].length;
    }
  }
  return false;
}

/** Prior assignments to `varName` before `beforeIdx` that mention a pinned object. */
function assignedVarMentionsPinned(
  code: string,
  varName: string,
  beforeIdx: number,
): boolean {
  const re = new RegExp(
    `\\b${varName}\\s*(?::=|=)\\s*([^;]+);`,
    "gi",
  );
  const window = code.slice(0, beforeIdx);
  let m: RegExpExecArray | null;
  while ((m = re.exec(window)) !== null) {
    if (PINNED_OBJECT_NAME.test(m[1]!)) return true;
  }
  return false;
}

/** Argument text of an EXECUTE — full format(...) or expression until `;`. */
function extractExecuteArgPayload(sql: string, start: number): string {
  const s = sql.slice(start);
  const formatOpen = /^format\s*\(/i.exec(s);
  if (formatOpen) {
    const paren = formatOpen[0].length - 1;
    try {
      const close = findMatchingParen(s, paren);
      return s.slice(0, close + 1);
    } catch {
      return s;
    }
  }
  const semi = s.search(/;/);
  return s.slice(0, semi === -1 ? s.length : semi);
}

/**
 * Drop `IF FALSE THEN … END IF` wrappers so dead-branch decoys cannot
 * host the required PERFORM / EXISTS tokens.
 */
function stripFalsePlpgsqlBranches(sql: string): string {
  let out = sql;
  const re = /\bif\s+false\s+then\b/gi;
  for (let n = 0; n < 32; n++) {
    re.lastIndex = 0;
    const m = re.exec(out);
    if (!m || m.index === undefined) break;
    const start = m.index;
    const afterThen = start + m[0].length;
    const endIf = findMatchingEndIf(out, afterThen);
    if (endIf < 0) break;
    out = out.slice(0, start) + " " + out.slice(endIf);
  }
  return out;
}

/** Index just past the `END IF` that closes the IF whose body starts at bodyStart. */
function findMatchingEndIf(sql: string, bodyStart: number): number {
  let depth = 1;
  let i = bodyStart;
  while (i < sql.length) {
    const slice = sql.slice(i);
    const ifM = /^(?:elsif\b|elseif\b|else\b|end\s+if\b|if\b)/i.exec(slice);
    if (!ifM) {
      i += 1;
      continue;
    }
    const tok = ifM[0]!.toLowerCase().replace(/\s+/g, " ");
    if (tok === "if") depth += 1;
    else if (tok === "end if") {
      depth -= 1;
      if (depth === 0) return i + ifM[0].length;
    }
    i += ifM[0].length;
  }
  return -1;
}

function assertExactPairs(
  label: string,
  pairs: { key: string; value: string }[],
  allowed: Record<string, string>,
): void {
  const byKey = Object.fromEntries(pairs.map((p) => [p.key, p.value]));
  const wantKeys = Object.keys(allowed).sort();
  const gotKeys = Object.keys(byKey).sort();
  if (JSON.stringify(gotKeys) !== JSON.stringify(wantKeys)) {
    throw new Error(
      `${label} keys must be exactly ${wantKeys.join(",")}; got ${gotKeys.join(",")}`,
    );
  }
  for (const [key, want] of Object.entries(allowed)) {
    const got = byKey[key]!.replace(/\s+/g, " ");
    if (got !== want.replace(/\s+/g, " ")) {
      throw new Error(
        `${label} value for '${key}' must be exactly ${want}; got ${byKey[key]}`,
      );
    }
  }
}

/**
 * Pure checks on the migration text: the facilities CTE must exist, must
 * join children through the partial-index predicate, must read addresses
 * and pills from the DIRECT views, must emit no identifying or PII keys,
 * and the payload must expose the facilities key. The REZ-93 inheritance
 * (certs/docs union) and the t13/pills isolation are re-pinned here against
 * this migration because 20260808_rez73 is now the live shaper of the function.
 */
export function assertFacilitiesContainment(args: {
  migrationSql: string;
}): void {
  const { migrationSql } = args;

  const sliceBetween = (startMarker: string, endMarker: string): string => {
    const start = migrationSql.indexOf(startMarker);
    const end = migrationSql.indexOf(endMarker);
    if (start < 0 || end < 0 || end <= start) {
      throw new Error(
        `could not slice migration between ${startMarker} and ${endMarker}`,
      );
    }
    return migrationSql.slice(start, end);
  };

  const facilitiesBlock = sliceBetween(
    "facilities as (",
    "partner_factories as (",
  );
  if (
    !/join public\.suppliers f on f\.facility_of = s\.id/.test(facilitiesBlock)
  ) {
    throw new Error(
      "facilities CTE must join children via f.facility_of = s.id (partial index)",
    );
  }
  if (!/from public\.v_supplier_addresses_direct va/.test(facilitiesBlock)) {
    throw new Error(
      "facility addresses must come from v_supplier_addresses_direct — never the inheriting view",
    );
  }
  if (!/from public\.v_supplier_registry_ids_direct p/.test(facilitiesBlock)) {
    throw new Error(
      "facility pills must come from v_supplier_registry_ids_direct — never the inheriting view",
    );
  }

  const facilitiesCode = stripSqlComments(facilitiesBlock);

  const forbiddenKey =
    /'(slug|id|completeness_pct|entity_type|source_tags|source_ref|sbi_total|sbi_score|email_primary|phones|contact_name|contact_role|website|created_at|updated_at|phone|email)'\s*,/i;
  const badKey = forbiddenKey.exec(facilitiesCode);
  if (badKey) {
    throw new Error(`facilities CTE emits forbidden key ${badKey[0]}`);
  }
  if (/'sbi_[a-z_]*'\s*,/i.test(facilitiesCode)) {
    throw new Error("facilities CTE emits a forbidden sbi_* key");
  }

  // Exact key AND value pins — key-only whitelists green identity under an
  // allowed key (`f.company_name || f.slug`, `'employees_total', f.id`).
  const allowedValues: Record<string, string> = {
    name: "f.company_name",
    employees_total: "f.employees_total",
    machines_sewing: "f.machines_sewing",
    production_capacity_pcs_day: "f.production_capacity_pcs_day",
    production_capacity_dozen_yearly: "f.production_capacity_dozen_yearly",
    is_sanctioned: "f.is_sanctioned",
    addresses: "coalesce(fa.items, '[]'::jsonb)",
    pills: "coalesce(fp.items, '[]'::jsonb)",
    rsc: "fr.obj",
  };
  const allowedKeys = Object.keys(allowedValues).sort();

  let foundFacilityObject = false;
  let searchFrom = 0;
  while (searchFrom < facilitiesCode.length) {
    const idx = facilitiesCode.indexOf("jsonb_build_object", searchFrom);
    if (idx === -1) break;
    const pairs = extractLiteralJsonbPairs(facilitiesCode, idx);
    if (pairs[0]?.key === "name") {
      foundFacilityObject = true;
      const byKey = Object.fromEntries(pairs.map((p) => [p.key, p.value]));
      const emittedKeys = Object.keys(byKey).sort();
      if (JSON.stringify(emittedKeys) !== JSON.stringify(allowedKeys)) {
        throw new Error(
          `facilities object keys must be exactly ${allowedKeys.join(",")}; got ${emittedKeys.join(",")}`,
        );
      }
      for (const [key, want] of Object.entries(allowedValues)) {
        const got = byKey[key]!.replace(/\s+/g, " ");
        const wantNorm = want.replace(/\s+/g, " ");
        if (got !== wantNorm) {
          throw new Error(
            `facilities object value for '${key}' must be exactly ${want}; got ${byKey[key]}`,
          );
        }
      }
      // Do not break — a correct decoy before a poisoned live object must fail.
    }
    searchFrom = idx + 1;
  }
  if (!foundFacilityObject) {
    throw new Error(
      "facilities CTE must build a jsonb_build_object whose first key is 'name'",
    );
  }

  const innerSpecs: { firstKey: string; allowed: Record<string, string> }[] = [
    {
      firstKey: "kind",
      allowed: {
        kind: "va.address_kind",
        address: "va.address",
        source_code: "va.source_code",
        fetched_at: "va.fetched_at",
      },
    },
    {
      firstKey: "source_code",
      allowed: {
        source_code: "p.source_code",
        label: "p.label",
        value: "p.value",
        verified: "p.verified",
        source_url: "p.source_url",
      },
    },
    {
      firstKey: "progress_pct",
      allowed: {
        progress_pct: "rr.progress_pct",
        workers_count: "rr.workers_count",
        remediation_status: "rr.remediation_status",
        training_status: "rr.training_status",
      },
    },
  ];
  const foundInner = new Set<string>();
  searchFrom = 0;
  while (searchFrom < facilitiesCode.length) {
    const idx = facilitiesCode.indexOf("jsonb_build_object", searchFrom);
    if (idx === -1) break;
    const pairs = extractLiteralJsonbPairs(facilitiesCode, idx);
    const first = pairs[0]?.key;
    const spec = innerSpecs.find((s) => s.firstKey === first);
    if (spec) {
      // Pin every matching shape — not the first hit only.
      assertExactPairs(`facilities inner (${spec.firstKey})`, pairs, spec.allowed);
      foundInner.add(spec.firstKey);
    }
    searchFrom = idx + 1;
  }
  for (const spec of innerSpecs) {
    if (!foundInner.has(spec.firstKey)) {
      throw new Error(
        `facilities CTE missing inner jsonb_build_object starting with '${spec.firstKey}'`,
      );
    }
  }

  // Pin every live facilities jsonb_agg(fac.obj …) ORDER BY — blank strings
  // first so a decoy inside a literal cannot satisfy the regex.
  const facilitiesForAgg = blankSqlStrings(facilitiesCode);
  const aggRe =
    /jsonb_agg\s*\(\s*fac\.obj\s+order\s+by\s+([^)]+)\)/gi;
  const aggMatches = [...facilitiesForAgg.matchAll(aggRe)];
  if (aggMatches.length === 0) {
    throw new Error(
      "facilities jsonb_agg(fac.obj order by ...) clause missing",
    );
  }
  for (const aggMatch of aggMatches) {
    const orderArgs = aggMatch[1]!.replace(/\s+/g, " ").trim().toLowerCase();
    if (orderArgs !== "fac.facility_name, fac.facility_id") {
      throw new Error(
        `facilities jsonb_agg must order by fac.facility_name, fac.facility_id; got ${aggMatch[1]}`,
      );
    }
  }

  if (!/'facilities',\s*\(select items from facilities\)/.test(migrationSql)) {
    throw new Error(
      "payload must include 'facilities', (select items from facilities)",
    );
  }

  if (
    !/sup\.is_published = true\s+or\s+sup\.facility_of is not null/.test(
      migrationSql,
    )
  ) {
    throw new Error(
      "v_supplier_addresses_direct must relax the REZ-18 predicate for attached facilities",
    );
  }

  const relaxedBranches = migrationSql.match(
    /s\.is_published = true or s\.facility_of is not null/g,
  );
  if (!relaxedBranches || relaxedBranches.length < 7) {
    throw new Error(
      "v_supplier_registry_ids_direct must relax all seven branches for attached facilities",
    );
  }
  if (
    !/sr\.source_ref = 'general:' \|\| n\.value/.test(migrationSql) ||
    !/sr\.fields->>'bgmea_reg_number' = n\.value/.test(migrationSql) ||
    !/src\.code = 'BGMEA'/.test(migrationSql)
  ) {
    throw new Error(
      "REZ-98 backed-only BGMEA rule must be carried forward unchanged",
    );
  }

  const addressesInheritingBlock = sliceBetween(
    "create or replace view public.v_supplier_addresses as",
    "v_supplier_registry_ids_direct as",
  );
  if (!/and parent\.is_published = true/.test(addressesInheritingBlock)) {
    throw new Error(
      "v_supplier_addresses inheritance branch must gate donors on parent.is_published = true",
    );
  }
  if (!/and child\.is_published = true/.test(addressesInheritingBlock)) {
    throw new Error(
      "v_supplier_addresses inheritance branch must keep the REZ-18 recipient gate",
    );
  }

  for (const view of [
    "v_supplier_registry_ids_direct",
    "v_supplier_registry_ids",
  ]) {
    if (
      !new RegExp(
        `revoke select on public\\.${view}\\s+from anon, authenticated`,
      ).test(migrationSql)
    ) {
      throw new Error(`migration must revoke anon/authenticated on ${view}`);
    }
  }

  const ringBlock = sliceBetween("ring as (", "pills as (");
  if (/facility_of/.test(ringBlock) || /certifications/.test(ringBlock)) {
    throw new Error(
      "t13 ring must stay on source_records for the mother only — no facility certs",
    );
  }
  const pillsBlock = sliceBetween("pills as (", "certs as (");
  if (/facility_of/.test(pillsBlock)) {
    throw new Error(
      "pills CTE must not join facility_of — inherited certs are display-only",
    );
  }
  const certsBlock = sliceBetween("certs as (", "rsc as (");
  if (!/f\.facility_of = s\.id/.test(certsBlock)) {
    throw new Error(
      "certs CTE must union facility_of children via the f.facility_of = s.id join (REZ-93 labelled inheritance)",
    );
  }
  const docsBlock = sliceBetween("docs as (", "facilities as (");
  if (!/f\.facility_of = s\.id/.test(docsBlock)) {
    throw new Error(
      "docs CTE must union facility_of children via the f.facility_of = s.id join (REZ-93 labelled inheritance)",
    );
  }
  if (!/DISPLAY-ONLY/.test(migrationSql)) {
    throw new Error("migration must keep the REZ-93 DISPLAY-ONLY marker");
  }

  // Chain-refusal trigger: blank strings, strip `IF FALSE` wrappers, then
  // require reachable PERFORM … FOR UPDATE before any RETURN NEW, and RAISE
  // check_violation on both EXISTS refusal paths.
  const triggerFn =
    /create or replace function public\.enforce_facility_parent_is_company\(\)([\s\S]*?)\$\$\s*;/i.exec(
      migrationSql,
    );
  if (!triggerFn) {
    throw new Error(
      "migration must define enforce_facility_parent_is_company()",
    );
  }
  // Extract only the plpgsql body between as $$ ... $$ — blanking the
  // whole match would treat the body as one dollar-quoted string.
  const bodyMatch = /as\s*\$\$([\s\S]*?)\$\$/i.exec(triggerFn[0]!);
  if (!bodyMatch) {
    throw new Error(
      "enforce_facility_parent_is_company must use an as $$ ... $$ body",
    );
  }
  const triggerCode = stripFalsePlpgsqlBranches(
    blankSqlStrings(stripSqlComments(bodyMatch[1]!), new Set(["check_violation"])),
  );
  const parentLock =
    /perform\s+1\s+from\s+public\.suppliers\s+p\s+where\s+p\.id\s*=\s*new\.facility_of\s+for\s+update/i;
  const childLock =
    /perform\s+1\s+from\s+public\.suppliers\s+c\s+where\s+c\.facility_of\s*=\s*new\.id\s+for\s+update/i;
  const parentLockAt = triggerCode.search(parentLock);
  const childLockAt = triggerCode.search(childLock);
  if (parentLockAt < 0) {
    throw new Error(
      "enforce_facility_parent_is_company must PERFORM ... parent FOR UPDATE",
    );
  }
  if (childLockAt < 0) {
    throw new Error(
      "enforce_facility_parent_is_company must PERFORM ... children FOR UPDATE",
    );
  }
  const firstReturn = triggerCode.search(/\breturn\s+new\b/i);
  if (firstReturn >= 0 && firstReturn < Math.min(parentLockAt, childLockAt)) {
    throw new Error(
      "enforce_facility_parent_is_company must PERFORM FOR UPDATE before RETURN NEW",
    );
  }
  if (
    !/if\s+exists\s*\(\s*select\s+1\s+from\s+public\.suppliers\s+p\s+where\s+p\.id\s*=\s*new\.facility_of\s+and\s+p\.facility_of\s+is\s+not\s+null\s*\)\s*then\s*raise\s+exception[\s\S]*?check_violation/i.test(
      triggerCode,
    )
  ) {
    throw new Error(
      "enforce_facility_parent_is_company must EXISTS-check parent.facility_of IS NOT NULL and RAISE check_violation",
    );
  }
  if (
    !/if\s+exists\s*\(\s*select\s+1\s+from\s+public\.suppliers\s+c\s+where\s+c\.facility_of\s*=\s*new\.id\s*\)\s*then\s*raise\s+exception[\s\S]*?check_violation/i.test(
      triggerCode,
    )
  ) {
    throw new Error(
      "enforce_facility_parent_is_company must EXISTS-check children pointing here and RAISE check_violation",
    );
  }
  if (
    !/trg_suppliers_facility_parent_is_company/.test(migrationSql) ||
    !/before insert or update of facility_of/.test(migrationSql)
  ) {
    throw new Error(
      "migration must attach trg_suppliers_facility_parent_is_company on facility_of",
    );
  }
}
