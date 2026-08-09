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
  /buyer_supplier_profile|v_supplier_addresses(?:_direct)?|v_supplier_registry_ids(?:_direct)?/i;

/**
 * True when SQL contains a dynamic EXECUTE (format / dollar / E' / ' / var)
 * whose argument text mentions a pinned object. Also catches PERFORM format(...),
 * opaque `EXECUTE stmt` after := / SELECT…INTO assignment, and obfuscated
 * convert_from/decode/chr payloads (fail-closed). Ignores GRANT EXECUTE and
 * trigger EXECUTE FUNCTION.
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
    // Obfuscated EXECUTE — migrations must not hide DDL this way.
    if (/\b(convert_from|decode|encode|chr)\s*\(/i.test(payload)) return true;
    if (PINNED_OBJECT_NAME.test(payload)) return true;
    const opaque =
      /^([A-Za-z_][A-Za-z0-9_]*)\s*;/.exec(trimmed) ??
      /^\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*;/.exec(trimmed);
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

/** Prior assignments to `varName` before `beforeIdx` that mention a pinned object
 * or obfuscate via convert_from/decode/encode/chr (fail-closed). */
function assignedVarMentionsPinned(
  code: string,
  varName: string,
  beforeIdx: number,
): boolean {
  const window = code.slice(0, beforeIdx);
  const obfuscated = /\b(convert_from|decode|encode|chr)\s*\(/i;
  const assignRe = new RegExp(
    `\\b${varName}\\s*(?::=|=)\\s*([^;]+);`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = assignRe.exec(window)) !== null) {
    if (PINNED_OBJECT_NAME.test(m[1]!) || obfuscated.test(m[1]!)) return true;
  }
  const intoRe = new RegExp(
    `\\bselect\\b([\\s\\S]*?)\\binto\\s+${varName}\\b`,
    "gi",
  );
  while ((m = intoRe.exec(window)) !== null) {
    if (PINNED_OBJECT_NAME.test(m[1]!) || obfuscated.test(m[1]!)) return true;
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

/** Constant-false / tautology-false predicates used to dead-host refusal code. */
const CONST_FALSE_PRED =
  String.raw`(?:\(\s*)?(?:false\b|null\b|not\s*\(\s*true\s*\)|not\s+true\b|true\s+is\s+false\b|true\s*=\s*false\b|false\s*=\s*true\b|false\s*::\s*boolean\b|\(\s*1\s*=\s*0\s*\)|1\s*=\s*0|0\s*=\s*1|2\s*=\s*3|1\s*=\s*2)(?:\s*\))?`;

/**
 * Fail closed on wrappers that can host PERFORM / EXISTS / RAISE without
 * executing them. Ban LOOP entirely (empty FOR / WHILE). Do not delete
 * IF/ELSE branches — that previously left post-IF PERFORM looking reachable.
 */
function assertNoDeadPathGaming(triggerCode: string): void {
  if (/\bloop\b/i.test(triggerCode)) {
    throw new Error(
      "enforce_facility_parent_is_company must not use LOOP (FOR/WHILE can host dead PERFORM)",
    );
  }
  if (new RegExp(String.raw`\bif\s+${CONST_FALSE_PRED}`, "i").test(triggerCode)) {
    throw new Error(
      "enforce_facility_parent_is_company must not wrap body in constant-false IF",
    );
  }
  if (
    new RegExp(String.raw`\belsif\s+${CONST_FALSE_PRED}`, "i").test(triggerCode)
  ) {
    throw new Error(
      "enforce_facility_parent_is_company must not use constant-false ELSIF",
    );
  }
  if (
    new RegExp(String.raw`\bcase\s+when\s+${CONST_FALSE_PRED}`, "i").test(
      triggerCode,
    )
  ) {
    throw new Error(
      "enforce_facility_parent_is_company must not wrap body in CASE WHEN FALSE",
    );
  }
  if (/\bwhile\b/i.test(triggerCode)) {
    throw new Error(
      "enforce_facility_parent_is_company must not use WHILE",
    );
  }
  if (/\bexception\s+when\b/i.test(triggerCode)) {
    throw new Error(
      "enforce_facility_parent_is_company must not catch exceptions (RAISE must abort)",
    );
  }
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

  if (hasDynamicExecuteOfPinnedObject(migrationSql)) {
    throw new Error(
      "migration must not dynamically EXECUTE a pinned object (buyer_supplier_profile / address or registry views)",
    );
  }

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

  // Exact key AND value pins for EVERY jsonb_build_object in the facilities
  // CTE. First key must be one of the allowed shapes — a decoy name-object
  // beside a live display_name / reordered object must not pass.
  const allowedOuter: Record<string, string> = {
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
  const shapeByFirstKey: Record<string, Record<string, string>> = {
    name: allowedOuter,
    kind: {
      kind: "va.address_kind",
      address: "va.address",
      source_code: "va.source_code",
      fetched_at: "va.fetched_at",
    },
    source_code: {
      source_code: "p.source_code",
      label: "p.label",
      value: "p.value",
      verified: "p.verified",
      source_url: "p.source_url",
    },
    progress_pct: {
      progress_pct: "rr.progress_pct",
      workers_count: "rr.workers_count",
      remediation_status: "rr.remediation_status",
      training_status: "rr.training_status",
    },
  };
  const foundShapes = new Set<string>();
  let searchFrom = 0;
  while (searchFrom < facilitiesCode.length) {
    const idx = facilitiesCode.indexOf("jsonb_build_object", searchFrom);
    if (idx === -1) break;
    const pairs = extractLiteralJsonbPairs(facilitiesCode, idx);
    const first = pairs[0]?.key;
    if (!first || !(first in shapeByFirstKey)) {
      throw new Error(
        `facilities CTE jsonb_build_object first key must be name|kind|source_code|progress_pct; got ${first ?? "(empty)"}`,
      );
    }
    assertExactPairs(
      `facilities shape (${first})`,
      pairs,
      shapeByFirstKey[first]!,
    );
    foundShapes.add(first);
    searchFrom = idx + 1;
  }
  for (const need of Object.keys(shapeByFirstKey)) {
    if (!foundShapes.has(need)) {
      throw new Error(
        `facilities CTE missing jsonb_build_object starting with '${need}'`,
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

  const addressesInheritingBlock = stripSqlComments(
    sliceBetween(
      "create or replace view public.v_supplier_addresses as",
      "v_supplier_registry_ids_direct as",
    ),
  );
  const addressesNorm = addressesInheritingBlock.replace(/\s+/g, " ");
  // Donor gate must be an exact JOIN conjunct followed by the next JOIN —
  // `= true or true` still contains the substring but widens the ON clause.
  if (
    !/\band parent\.is_published = true join public\.v_supplier_addresses_direct\b/i.test(
      addressesNorm,
    )
  ) {
    throw new Error(
      "v_supplier_addresses inheritance branch must gate donors on parent.is_published = true",
    );
  }
  if (/\bparent\.is_published\s*=\s*true\s+or\b/i.test(addressesNorm)) {
    throw new Error(
      "v_supplier_addresses donor gate must not be widened with OR",
    );
  }
  if (!/\band child\.is_published = true\b/i.test(addressesNorm)) {
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
      ).test(stripSqlComments(migrationSql))
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

  // buyer_supplier_profile must stay SECURITY DEFINER with a fixed search_path
  // so unpublished facility_of children are visible to the roll-up.
  const profileFn =
    /create or replace function public\.buyer_supplier_profile\s*\([\s\S]*?\$\$\s*;/i.exec(
      migrationSql,
    );
  if (!profileFn) {
    throw new Error("migration must define public.buyer_supplier_profile");
  }
  const profileAs = /as\s*\$\$/i.exec(profileFn[0]!);
  if (!profileAs || profileAs.index === undefined) {
    throw new Error("buyer_supplier_profile must use an as $$ body");
  }
  const profileHeader = stripSqlComments(
    profileFn[0]!.slice(0, profileAs.index),
  );
  if (!/security\s+definer/i.test(profileHeader)) {
    throw new Error("buyer_supplier_profile must be SECURITY DEFINER");
  }
  if (!/set\s+search_path\s*=\s*public\b/i.test(profileHeader)) {
    throw new Error("buyer_supplier_profile must set search_path = public");
  }

  // Reverse comment block only — stop before the first CREATE so DDL cannot
  // host a decoy restore name.
  const reverseStart = migrationSql.search(/--\s*REVERSE/i);
  if (reverseStart < 0) {
    throw new Error("migration must include a REVERSE section");
  }
  const reverseEnd = migrationSql.search(
    /\ncreate\s+or\s+replace\b/i,
  );
  const reverseBlock = migrationSql.slice(
    reverseStart,
    reverseEnd > reverseStart ? reverseEnd : reverseStart + 800,
  );
  if (
    !/Re-apply the[\s\S]*?20260725_rez_security_hardening_2 function body/i.test(
      reverseBlock,
    )
  ) {
    throw new Error(
      "REVERSE must name 20260725_rez_security_hardening_2 as the restore body",
    );
  }
  if (!/NOT 0095|not 0095|NOT\s+0095/.test(reverseBlock)) {
    throw new Error(
      "REVERSE must warn that 0095 is not the production pre-state",
    );
  }

  // Chain-refusal trigger: blank strings (no errcode preserve — that
  // resurrected raise exception 'check_violation'), reject constant-false /
  // EXCEPTION wrappers, require PERFORM before any RETURN, and RAISE with
  // USING ERRCODE after blanking.
  const triggerFn =
    /create or replace function public\.enforce_facility_parent_is_company\(\)([\s\S]*?)\$\$\s*;/i.exec(
      migrationSql,
    );
  if (!triggerFn) {
    throw new Error(
      "migration must define enforce_facility_parent_is_company()",
    );
  }
  const triggerAs = /as\s*\$\$/i.exec(triggerFn[0]!);
  if (!triggerAs || triggerAs.index === undefined) {
    throw new Error(
      "enforce_facility_parent_is_company must use an as $$ ... $$ body",
    );
  }
  const triggerHeader = stripSqlComments(
    triggerFn[0]!.slice(0, triggerAs.index),
  );
  if (!/set\s+search_path\s*=\s*public\b/i.test(triggerHeader)) {
    throw new Error(
      "enforce_facility_parent_is_company must set search_path = public",
    );
  }
  const bodyMatch = /as\s*\$\$([\s\S]*?)\$\$/i.exec(triggerFn[0]!);
  if (!bodyMatch) {
    throw new Error(
      "enforce_facility_parent_is_company must use an as $$ ... $$ body",
    );
  }
  const triggerCode = blankSqlStrings(stripSqlComments(bodyMatch[1]!));
  assertNoDeadPathGaming(triggerCode);
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
  const firstReturn = triggerCode.search(/\breturn\b/i);
  if (firstReturn >= 0 && firstReturn < Math.min(parentLockAt, childLockAt)) {
    throw new Error(
      "enforce_facility_parent_is_company must PERFORM FOR UPDATE before any RETURN",
    );
  }
  // After blanking, require USING ERRCODE = (literal value is blanked).
  if (
    !/if\s+exists\s*\(\s*select\s+1\s+from\s+public\.suppliers\s+p\s+where\s+p\.id\s*=\s*new\.facility_of\s+and\s+p\.facility_of\s+is\s+not\s+null\s*\)\s*then\s*raise\s+exception[\s\S]*?using\s+errcode\s*=/i.test(
      triggerCode,
    )
  ) {
    throw new Error(
      "enforce_facility_parent_is_company must EXISTS-check parent.facility_of IS NOT NULL and RAISE USING ERRCODE",
    );
  }
  if (
    !/if\s+exists\s*\(\s*select\s+1\s+from\s+public\.suppliers\s+c\s+where\s+c\.facility_of\s*=\s*new\.id\s*\)\s*then\s*raise\s+exception[\s\S]*?using\s+errcode\s*=/i.test(
      triggerCode,
    )
  ) {
    throw new Error(
      "enforce_facility_parent_is_company must EXISTS-check children pointing here and RAISE USING ERRCODE",
    );
  }
  // Errcode value must be check_violation on the comment-stripped (unblanked) body.
  const triggerRaw = stripSqlComments(bodyMatch[1]!);
  if (
    (
      triggerRaw.match(
        /using\s+errcode\s*=\s*'check_violation'/gi,
      ) ?? []
    ).length < 2
  ) {
    throw new Error(
      "enforce_facility_parent_is_company must RAISE USING ERRCODE = 'check_violation' on both refusal paths",
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
