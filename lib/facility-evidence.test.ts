/**
 * REZ-93 — facility compliance-document + cert inheritance (pure merge rules).
 *
 * Mirrors the docs/certs CTEs carried by the live shaper,
 * 20260808_rez73_buyer_supplier_profile_facilities.sql (originally 0095).
 * No database. Covers the acceptance cases on the Linear issue, plus display-only
 * containment so discover/pills/t13 cannot pick up facility certs.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  DISCOVER_CERT_FILTER_MIGRATIONS,
  FACILITY_EVIDENCE_PROFILE_MIGRATION,
  assertFacilityEvidenceContainment,
  projectFacilityCertifications,
  projectFacilityDocuments,
  type FacilityEvidenceSource,
} from "./facility-evidence";

function doc(
  id: string,
  doc_type: "fire" | "structural" | "electrical" | "boiler" | "cap" = "structural",
  fetched_at = "2026-01-01T00:00:00Z",
) {
  return {
    document_id: id,
    doc_type,
    mirror_url: `https://cdn.example/${id}.pdf`,
    original_url: `https://rsc.example/${id}.pdf`,
    fetched_at,
    file_size: 1000,
  };
}

function cert(
  id: string,
  kind: string,
  certificate_no: string,
  expires_on: string | null = "2027-01-01",
) {
  return {
    certification_id: id,
    kind,
    certificate_no,
    issuer: kind.toUpperCase(),
    issued_on: null as string | null,
    expires_on,
    scope: "Gold",
    document_url: `https://cert.example/${id}`,
  };
}

function parent(
  overrides: Partial<FacilityEvidenceSource> = {},
): FacilityEvidenceSource {
  return {
    supplier_id: "parent",
    facility_of: null,
    company_name: "Babylon Garments Limited",
    documents: [doc("p-fire", "fire")],
    certifications: [cert("p-wrap", "wrap", "111")],
    ...overrides,
  };
}

function child(
  id: string,
  company_name: string,
  overrides: Partial<FacilityEvidenceSource> = {},
): FacilityEvidenceSource {
  return {
    supplier_id: id,
    facility_of: "parent",
    company_name,
    documents: [],
    certifications: [],
    ...overrides,
  };
}

describe("projectFacilityDocuments", () => {
  it("labels a facility's RSC documents with the facility name (test #1)", () => {
    const result = projectFacilityDocuments(parent(), [
      child("ext", "Babylon Garments Limited (Extension)", {
        documents: [doc("e-struct", "structural")],
      }),
    ]);
    assert.ok(result);
    const inherited = result.filter((d) => d.building_name != null);
    assert.equal(inherited.length, 1);
    assert.equal(inherited[0]!.document_id, "e-struct");
    assert.equal(
      inherited[0]!.building_name,
      "Babylon Garments Limited (Extension)",
    );
  });

  it("retains the (Extension) / Unit-2 suffix on the label (test #2)", () => {
    const result = projectFacilityDocuments(parent({ documents: [] }), [
      child("u2", "Silken Sewing Ltd Unit-2", {
        documents: [doc("u2-fire", "fire")],
      }),
    ]);
    assert.ok(result);
    assert.equal(result[0]!.building_name, "Silken Sewing Ltd Unit-2");
    assert.match(result[0]!.building_name!, /Unit-2/);
  });

  it("keeps same-type reports across two buildings (test #3)", () => {
    const result = projectFacilityDocuments(parent({ documents: [] }), [
      child("a", "Plant A (Extension)", {
        documents: [doc("a-s", "structural")],
      }),
      child("b", "Plant B (Extension)", {
        documents: [doc("b-s", "structural")],
      }),
    ]);
    assert.ok(result);
    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map((d) => d.document_id).sort(),
      ["a-s", "b-s"],
    );
    assert.ok(result.every((d) => d.doc_type === "structural"));
  });

  it("renders the same compliance_documents id once (test #4)", () => {
    const shared = doc("shared-id", "electrical");
    const result = projectFacilityDocuments(parent({ documents: [shared] }), [
      child("ext", "Babylon Garments Limited (Extension)", {
        documents: [shared],
      }),
    ]);
    assert.ok(result);
    const sharedHits = result.filter((d) => d.document_id === "shared-id");
    assert.equal(sharedHits.length, 1);
    assert.equal(sharedHits[0]!.building_name, null);
  });

  it("with no facilities returns only the parent's own docs (test #5)", () => {
    const own = [doc("p1", "fire"), doc("p2", "boiler")];
    const result = projectFacilityDocuments(parent({ documents: own }), []);
    assert.ok(result);
    assert.equal(result.length, 2);
    assert.ok(result.every((d) => d.building_name == null));
    assert.deepEqual(
      result.map((d) => d.document_id).sort(),
      ["p1", "p2"],
    );
  });

  it("excludes unattached, wrong-parent, and tombstoned children (test #6)", () => {
    const result = projectFacilityDocuments(parent({ documents: [] }), [
      child("orphan", "Orphan (Extension)", {
        facility_of: null,
        documents: [doc("o1")],
      }),
      child("other-mom", "Other Mom Unit-2", {
        facility_of: "someone-else",
        documents: [doc("o2")],
      }),
      child("dead", "Dead (Extension)", {
        tombstoned: true,
        documents: [doc("o3")],
      }),
    ]);
    assert.deepEqual(result, []);
  });

  it("returns null when the subject is itself a facility", () => {
    assert.equal(
      projectFacilityDocuments({
        supplier_id: "ext",
        facility_of: "parent",
        company_name: "Babylon Garments Limited (Extension)",
        documents: [doc("x")],
      }),
      null,
    );
  });

  it("returns null for a tombstoned parent", () => {
    assert.equal(
      projectFacilityDocuments(parent({ tombstoned: true }), [
        child("ext", "Ext", { documents: [doc("e")] }),
      ]),
      null,
    );
  });
});

describe("projectFacilityCertifications", () => {
  it("labels every inherited kind with the building name", () => {
    const result = projectFacilityCertifications(
      parent({ certifications: [] }),
      [
        child("u2", "Debonair Limited Unit-2", {
          certifications: [
            cert("c-wrap", "wrap", "125985"),
            cert("c-gots", "gots", "GOTS-23499"),
            cert("c-oeko", "oeko_tex", "49174-100", null),
          ],
        }),
      ],
    );
    assert.ok(result);
    assert.equal(result.length, 3);
    assert.ok(
      result.every((c) => c.building_name === "Debonair Limited Unit-2"),
    );
    assert.deepEqual(result.map((c) => c.kind).sort(), [
      "gots",
      "oeko_tex",
      "wrap",
    ]);
  });

  it("keeps same-kind certs across two buildings", () => {
    const result = projectFacilityCertifications(
      parent({ certifications: [] }),
      [
        child("a", "Plant A Unit-2", {
          certifications: [cert("a1", "wrap", "111")],
        }),
        child("b", "Plant B Unit-2", {
          certifications: [cert("b1", "wrap", "222")],
        }),
      ],
    );
    assert.ok(result);
    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map((c) => c.certificate_no).sort(),
      ["111", "222"],
    );
  });

  it("renders the same certifications id once", () => {
    const shared = cert("shared-cert", "gots", "GOTS-1");
    const result = projectFacilityCertifications(
      parent({ certifications: [shared] }),
      [
        child("ext", "Babylon Garments Limited (Extension)", {
          certifications: [shared],
        }),
      ],
    );
    assert.ok(result);
    const hits = result.filter((c) => c.certification_id === "shared-cert");
    assert.equal(hits.length, 1);
    assert.equal(hits[0]!.building_name, null);
  });

  it("with no facilities returns only the parent's own certs", () => {
    const result = projectFacilityCertifications(parent(), []);
    assert.ok(result);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.building_name, null);
    assert.equal(result[0]!.certificate_no, "111");
  });
});

describe("facility cert inheritance is display-only", () => {
  it("pins discover/pills/t13 away from facility_of certs", () => {
    // npm test runs from the repo root; compiled __dirname is a cache dir.
    const root = process.cwd();
    const profileMigrationSql = fs.readFileSync(
      path.join(root, FACILITY_EVIDENCE_PROFILE_MIGRATION),
      "utf8",
    );
    const discoverMigrationSqls = DISCOVER_CERT_FILTER_MIGRATIONS.map((rel) =>
      fs.readFileSync(path.join(root, rel), "utf8"),
    );
    assert.doesNotThrow(() =>
      assertFacilityEvidenceContainment({
        profileMigrationSql,
        discoverMigrationSqls,
      }),
    );
  });
});
