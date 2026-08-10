/**
 * Facility evidence inheritance — REZ-93 / Extensions B0b.
 *
 * Read-path merge rules for compliance documents and certifications on a
 * mother profile. The live wire is `buyer_supplier_profile` (SQL); this
 * module mirrors those rules so unit tests can pin them without a database.
 *
 * WHY NOT RE-POINT ROWS
 * ---------------------
 * Re-pointing `compliance_documents.supplier_id` or `certifications.supplier_id`
 * to the mother destroys building attribution. Inheritance is a projection
 * only.
 *
 * DEDUPE: ROW IDENTITY VS KIND / DOC TYPE
 * --------------------------------------
 * Three RSC structural reports (or three WRAP certs) for three buildings are
 * three facts — they share kind/doc_type but have distinct row ids, so all
 * three survive. The same table row reachable via two paths (same id)
 * renders once.
 *
 * DISPLAY-ONLY CERTS (founder 6 Aug 2026)
 * ---------------------------------------
 * Inherited certifications appear on the mother profile labelled by building.
 * They must never feed discover's cert filter, registry pills, or the Tier
 * 1–3 receipts count — those paths read `certifications` /
 * `v_supplier_registry_ids` / `source_records` by the mother's own id.
 * See `assertFacilityEvidenceContainment` and its tests.
 *
 * Buyer profiles surface `compliance_documents` (mirrored RSC PDFs), not the
 * admin `evidence_documents` provenance table.
 */

export type FacilityEvidenceDoc = {
  document_id: string;
  doc_type: "fire" | "structural" | "electrical" | "boiler" | "cap";
  mirror_url: string | null;
  original_url: string;
  fetched_at: string;
  file_size: number | null;
  /** Full facility `company_name`, suffix intact. Null = parent's own doc. */
  building_name: string | null;
};

export type FacilityEvidenceCert = {
  certification_id: string;
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  scope: string | null;
  document_url: string | null;
  /** Full facility `company_name`, suffix intact. Null = parent's own cert. */
  building_name: string | null;
};

export type FacilityEvidenceSource = {
  supplier_id: string;
  /** Null for the mother; set to the parent's id for an attached facility. */
  facility_of: string | null;
  /** Full display name — do not strip Extension / Unit-2. */
  company_name: string;
  /** Soft-delete / merge-loser marker for tests; deleted rows have no DB row. */
  tombstoned?: boolean;
  documents: readonly Omit<FacilityEvidenceDoc, "building_name">[];
  certifications?: readonly Omit<FacilityEvidenceCert, "building_name">[];
};

function docSortKey(d: FacilityEvidenceDoc): string {
  const building = d.building_name ?? "";
  return `${d.building_name == null ? "0" : "1"}|${building}|${d.doc_type}|${d.fetched_at}`;
}

function certSortKey(c: FacilityEvidenceCert): string {
  const building = c.building_name ?? "";
  return `${c.building_name == null ? "0" : "1"}|${building}|${c.kind}|${c.expires_on ?? ""}`;
}

function liveChildren(
  parent: FacilityEvidenceSource,
  children: readonly FacilityEvidenceSource[],
): FacilityEvidenceSource[] {
  const seen = new Set<string>();
  const out: FacilityEvidenceSource[] = [];
  for (const child of children) {
    if (child.tombstoned) continue;
    if (child.supplier_id === parent.supplier_id) continue;
    if (child.facility_of !== parent.supplier_id) continue;
    if (seen.has(child.supplier_id)) continue;
    seen.add(child.supplier_id);
    out.push(child);
  }
  return out;
}

/**
 * Project the documents a mother profile should show.
 *
 * Returns null when `parent` is itself a facility — buildings do not inherit
 * from their siblings. Tombstoned parents yield null. Children without
 * `facility_of === parent.supplier_id`, or tombstoned children, contribute
 * nothing (issue test #6).
 */
export function projectFacilityDocuments(
  parent: FacilityEvidenceSource,
  children: readonly FacilityEvidenceSource[] = [],
): FacilityEvidenceDoc[] | null {
  if (parent.tombstoned) return null;
  if (parent.facility_of != null) return null;

  const out: FacilityEvidenceDoc[] = [];
  const seenIds = new Set<string>();

  const push = (
    raw: Omit<FacilityEvidenceDoc, "building_name">,
    building_name: string | null,
  ) => {
    if (seenIds.has(raw.document_id)) return;
    seenIds.add(raw.document_id);
    out.push({ ...raw, building_name });
  };

  for (const d of parent.documents) {
    push(d, null);
  }
  for (const child of liveChildren(parent, children)) {
    for (const d of child.documents) {
      push(d, child.company_name);
    }
  }

  out.sort((a, b) => {
    const ka = docSortKey(a);
    const kb = docSortKey(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });
  return out;
}

/**
 * Project the certifications a mother profile should show (display-only).
 *
 * Same attachment / tombstone / dedupe rules as documents. Must not be wired
 * into discover, pills, or t13 — see containment asserts.
 */
export function projectFacilityCertifications(
  parent: FacilityEvidenceSource,
  children: readonly FacilityEvidenceSource[] = [],
): FacilityEvidenceCert[] | null {
  if (parent.tombstoned) return null;
  if (parent.facility_of != null) return null;

  const out: FacilityEvidenceCert[] = [];
  const seenIds = new Set<string>();

  const push = (
    raw: Omit<FacilityEvidenceCert, "building_name">,
    building_name: string | null,
  ) => {
    if (seenIds.has(raw.certification_id)) return;
    seenIds.add(raw.certification_id);
    out.push({ ...raw, building_name });
  };

  for (const c of parent.certifications ?? []) {
    push(c, null);
  }
  for (const child of liveChildren(parent, children)) {
    for (const c of child.certifications ?? []) {
      push(c, child.company_name);
    }
  }

  out.sort((a, b) => {
    const ka = certSortKey(a);
    const kb = certSortKey(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });
  return out;
}

/** Paths pinned by containment tests — relative to repo root. */
export const FACILITY_EVIDENCE_PROFILE_MIGRATION =
  "supabase/migrations/0099_buyer_supplier_profile_facility_registries_rsc.sql";

export const DISCOVER_CERT_FILTER_MIGRATIONS = [
  "supabase/migrations/0075_discover_text_postgrest_budget.sql",
  "supabase/migrations/0076_discover_browse_postgrest_budget.sql",
] as const;

/**
 * Pure checks that inherited facility certs stay profile-display-only.
 * Pass migration SQL bodies (already read from disk by the test).
 */
export function assertFacilityEvidenceContainment(args: {
  profileMigrationSql: string;
  discoverMigrationSqls: readonly string[];
}): void {
  const { profileMigrationSql, discoverMigrationSqls } = args;

  const sliceBetween = (startMarker: string, endMarker: string): string => {
    const start = profileMigrationSql.indexOf(startMarker);
    const end = profileMigrationSql.indexOf(endMarker);
    if (start < 0 || end < 0 || end <= start) {
      throw new Error(
        `could not slice profile migration between ${startMarker} and ${endMarker}`,
      );
    }
    return profileMigrationSql.slice(start, end);
  };

  const ringBlock = sliceBetween("ring as (", "pills as (");
  if (/facility_of/.test(ringBlock) || /certifications/.test(ringBlock)) {
    throw new Error(
      "t13 ring must stay on source_records for the mother only — no facility certs",
    );
  }

  const pillsBlock = sliceBetween("pills as (", "certs as (");
  // REZ-110: pills may union facility_of for DISPLAY with building_name.
  // Discover/t13 must still ignore these (ring + discover asserts below).
  if (!/facility_of/.test(pillsBlock)) {
    throw new Error(
      "pills CTE must union facility_of children labelled by building_name (REZ-110)",
    );
  }
  if (!/building_name/.test(pillsBlock)) {
    throw new Error("facility pills must carry building_name");
  }
  if (!/DISPLAY-ONLY/.test(pillsBlock)) {
    throw new Error("pills CTE must mark facility union as DISPLAY-ONLY");
  }

  const certsBlock = sliceBetween("certs as (", "rsc as (");
  if (!/facility_of/.test(certsBlock)) {
    throw new Error(
      "certs CTE must union facility_of children (labelled inheritance)",
    );
  }
  if (!/DISPLAY-ONLY/.test(profileMigrationSql)) {
    throw new Error("profile migration must document display-only inheritance");
  }

  const rscBlock = sliceBetween("rsc as (", "brands as (");
  if (!/facility_of/.test(rscBlock)) {
    throw new Error(
      "rsc CTE must union facility_of children for per-building remediation",
    );
  }
  if (!/building_name/.test(rscBlock)) {
    throw new Error("facility RSC sites must carry building_name");
  }

  const brandsBlock = sliceBetween("brands as (", "sanc as (");
  if (!/facility_of/.test(brandsBlock)) {
    throw new Error(
      "brands CTE must union facility_of children labelled by building_name",
    );
  }
  if (!/building_name/.test(brandsBlock)) {
    throw new Error("facility brands must carry building_name");
  }
  if (!/DISPLAY-ONLY/.test(brandsBlock)) {
    throw new Error("brands CTE must mark facility union as DISPLAY-ONLY");
  }

  for (const sql of discoverMigrationSqls) {
    const blocks = [
      ...sql.matchAll(/from public\.certifications c[\s\S]{0,240}/g),
    ];
    if (blocks.length === 0) {
      throw new Error("discover migration has no certifications filter block");
    }
    for (const m of blocks) {
      const block = m[0];
      if (!/c\.supplier_id\s*=\s*s\.id/.test(block)) {
        throw new Error(
          "discover cert filter must use c.supplier_id = s.id (own rows only)",
        );
      }
      if (/facility_of/.test(block)) {
        throw new Error(
          "discover cert filter must never join facility_of — would make a mother searchable on a building's cert",
        );
      }
    }
    // REZ-110: registry / brand discover filters must stay on mother id.
    if (/facility_of/.test(sql) && /p_registries|p_brand_codes/.test(sql)) {
      // Allow facility_of only outside those filter windows — fail if a
      // registries/brand join block also mentions facility_of.
      const regBlocks = [
        ...sql.matchAll(/p_registries[\s\S]{0,800}/g),
        ...sql.matchAll(/p_brand_codes[\s\S]{0,800}/g),
      ];
      for (const m of regBlocks) {
        if (/facility_of/.test(m[0])) {
          throw new Error(
            "discover registry/brand filters must never join facility_of",
          );
        }
      }
    }
  }
}
