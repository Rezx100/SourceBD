/**
 * Facility group roll-up for the mother profile — REZ-73 (widened 8 Aug 2026:
 * separate labelled figures, never one combined total).
 *
 * LOCKSTEP: this mirrors the semantics of `etl/core/facility_rollup.py`
 * (REZ-92). The Python module is the ETL-side reference; this module is the
 * live computation for the web read path, fed by the raw per-building
 * numerics in the `facilities` key of `buyer_supplier_profile` (migration
 * 0097). If one changes, change both. Presentation differs deliberately:
 * `describeGroupMetric` renders en-US grouped digits ("5,200 across 3
 * buildings") where the Python `describe()` renders raw digits — the sums,
 * thresholds and lower-bound rules are the lockstep contract.
 *
 * RULES (from the Python module's docstring):
 * - The mother's own figures are returned untouched and never summed into
 *   themselves — `own` mirrors the stored columns byte-for-byte.
 * - Across genuinely distinct buildings the arithmetic sum is real.
 * - `null` is unknown, never coerced to 0. Any unknown building makes the
 *   group total a lower bound: "at least N across M buildings, K unknown".
 * - Only direct children of the viewed mother are summed. REZ-71 refuses
 *   facility→facility chains; the SQL scopes children by
 *   `f.facility_of = s.id`, so nesting cannot arrive here — the input
 *   hygiene dedupe from the Python module (same supplier_id twice) is
 *   unnecessary because the payload carries no ids at all.
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
  "supabase/migrations/0097_buyer_supplier_profile_facilities.sql";

/**
 * Pure checks on the migration text: the facilities CTE must exist, must
 * join children through the partial-index predicate, must read addresses
 * and pills from the DIRECT views, must emit no identifying or PII keys,
 * and the payload must expose the facilities key. The REZ-93 inheritance
 * (certs/docs union) and the t13/pills isolation are re-pinned here against
 * this migration because 0097 is now the live shaper of the function.
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

  // The facilities CTE joins suppliers to itself ONLY via the partial-index
  // predicate for the single viewed mother (0055/0056 lesson: no scans).
  const facilitiesBlock = sliceBetween("facilities as (", "partner_factories as (");
  if (!/join public\.suppliers f on f\.facility_of = s\.id/.test(facilitiesBlock)) {
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
  // Hard requirement (REZ-73): nothing that identifies the unpublished row
  // beyond its name and address, and no contact PII. Quoted-key match only —
  // f.id appears in join predicates and must stay legal there.
  const forbiddenKey =
    /'(slug|id|completeness_pct|is_sanctioned|entity_type|source_tags|email_primary|phones|contact_name|contact_role|website|created_at|updated_at|phone|email)'\s*,/;
  const badKey = forbiddenKey.exec(facilitiesBlock);
  if (badKey) {
    throw new Error(`facilities CTE emits forbidden key ${badKey[0]}`);
  }

  // Whitelist, not just blacklist: the facilities object's key set must be
  // exactly this. A renamed-key leak ('display_name', f.slug) passes a
  // blacklist; it fails here. Extract the facilities jsonb_build_object and
  // compare its top-level quoted keys.
  const objMatch = /jsonb_build_object\(([\s\S]*?)\) as obj/.exec(
    facilitiesBlock,
  );
  if (!objMatch) {
    throw new Error("facilities CTE must build its object as `as obj`");
  }
  const emittedKeys = [...objMatch[1]!.matchAll(/'([a-z_]+)'\s*,/g)]
    .map((m) => m[1])
    .sort();
  const allowedKeys = [
    "addresses",
    "employees_total",
    "machines_sewing",
    "name",
    "pills",
    "production_capacity_dozen_yearly",
    "production_capacity_pcs_day",
    "rsc",
  ].sort();
  if (JSON.stringify(emittedKeys) !== JSON.stringify(allowedKeys)) {
    throw new Error(
      `facilities object keys must be exactly ${allowedKeys.join(",")}; got ${emittedKeys.join(",")}`,
    );
  }

  // Payload exposes the new key.
  if (!/'facilities',\s*\(select items from facilities\)/.test(migrationSql)) {
    throw new Error("payload must include 'facilities', (select items from facilities)");
  }

  // The address-view relaxation that keeps facility addresses visible after
  // the A2 trigger unpublishes them.
  if (
    !/sup\.is_published = true\s+or\s+sup\.facility_of is not null/.test(
      migrationSql,
    )
  ) {
    throw new Error(
      "v_supplier_addresses_direct must relax the REZ-18 predicate for attached facilities",
    );
  }

  // The registry-view relaxation that keeps facility pills visible — every
  // one of the seven branches (BGMEA, BKMEA, RSC, EPB, BGAPMEA, BTMA, certs)
  // must carry it, and REZ-98's backed-only BGMEA rule must survive intact.
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

  // The address-inheriting view must be recreated here with the donor-side
  // gate — without it, the relaxed direct view lets an unpublished facility
  // donate `_inherited` addresses (and its slug via #inherited:<slug>) onto
  // a name-matched stranger's profile.
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

  // The relaxation is only safe because both registry views are revoked
  // from anon/authenticated here (0082 precedent) — without the revokes an
  // anonymous PostgREST caller could enumerate unpublished facilities'
  // pills. Verified anonymously readable in production on 8 Aug 2026.
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

  // REZ-93 invariants re-pinned against this (now the live) shaper.
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
  // Require the actual join text, not the bare word — a comment containing
  // "facility_of" must not satisfy these pins.
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
}
