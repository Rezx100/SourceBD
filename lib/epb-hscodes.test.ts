import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { asEpbHscodes, epbExporterOpenUrl, epbRegistryVerifyHref, hscodesFromRpc } from "./epb-hscodes";

describe("asEpbHscodes", () => {
  it("returns empty for missing or non-array payloads", () => {
    assert.deepEqual(asEpbHscodes(null), []);
    assert.deepEqual(asEpbHscodes(undefined), []);
    assert.deepEqual(asEpbHscodes({ code: "6103" }), []);
  });

  it("keeps live list-id HS URLs, numeric codes, and drops foreign hosts", () => {
    const rows = asEpbHscodes([
      {
        code: "6103",
        description: "Men's or boys' suits",
        source_url: "https://edb.epb.gov.bd/hscode-exporters/813",
      },
      { code: 6104, description: "Women's or girls' suits" },
      { code: "6103", description: "duplicate" },
      { code: "61", description: "too short" },
      { code: "ABC", description: "not digits" },
      {
        code: "6112",
        description: "Track suits",
        source_url: "https://evil.example/hscode-exporters/776",
      },
    ]);
    assert.equal(rows.length, 3);
    assert.equal(rows[0]!.code, "6103");
    assert.equal(
      rows[0]!.source_url,
      "https://edb.epb.gov.bd/hscode-exporters/813",
    );
    assert.equal(rows[1]!.code, "6104");
    assert.equal(rows[2]!.code, "6112");
    assert.equal(rows[2]!.source_url, null);
  });
});

describe("epbExporterOpenUrl", () => {
  it("accepts the stored exporter page and rejects the agency homepage", () => {
    assert.equal(
      epbExporterOpenUrl(
        "2043",
        "https://edb.epb.gov.bd/exporter/2043/interstoff-apparels-ltd",
      ),
      "https://edb.epb.gov.bd/exporter/2043/interstoff-apparels-ltd",
    );
    assert.equal(epbExporterOpenUrl("2043", "https://epb.gov.bd/"), null);
    assert.equal(
      epbExporterOpenUrl(
        "2043",
        "https://edb.epb.gov.bd/exporter/4821/za-apparels-ltd",
      ),
      null,
    );
    assert.equal(epbExporterOpenUrl("2043", null), null);
  });
});

describe("epbRegistryVerifyHref", () => {
  it("keeps exporter pages and drops the agency homepage", () => {
    assert.equal(
      epbRegistryVerifyHref(
        "https://edb.epb.gov.bd/exporter/2043/interstoff-apparels-ltd",
      ),
      "https://edb.epb.gov.bd/exporter/2043/interstoff-apparels-ltd",
    );
    assert.equal(epbRegistryVerifyHref("https://epb.gov.bd/"), null);
    assert.equal(epbRegistryVerifyHref("https://epb.gov.bd"), null);
    assert.equal(epbRegistryVerifyHref("https://evil.example/exporter/1"), null);
  });
});

describe("hscodesFromRpc", () => {
  it("does not treat an RPC error as an empty HS list", () => {
    assert.deepEqual(hscodesFromRpc({ data: [{ code: "6103" }], error: null }), {
      hscodes: [{ code: "6103", description: null, source_url: null }],
      loadError: false,
    });
    assert.deepEqual(
      hscodesFromRpc({ data: [{ code: "6103" }], error: { message: "function missing" } }),
      { hscodes: [], loadError: true },
    );
    assert.deepEqual(
      hscodesFromRpc({
        data: { code: "57014", message: "canceling statement due to statement timeout" },
        error: null,
      }),
      { hscodes: [], loadError: true },
    );
  });
});

describe("EPB HS wiring (observable call sites)", () => {
  it("both profile routes fetch supplier_epb_hscodes and do not swallow RPC errors", () => {
    const helper = readFileSync(
      join(process.cwd(), "lib/public-supplier-profile.ts"),
      "utf8",
    );
    assert.match(helper, /supplier_epb_hscodes/);
    assert.match(helper, /hscodesFromRpc/);
    assert.doesNotMatch(helper, /hsResult\.error \? \[\]/);

    const pub = readFileSync(
      join(process.cwd(), "app/(public)/suppliers/[slug]/page.tsx"),
      "utf8",
    );
    assert.match(pub, /getPublicSupplierProfile/);
    assert.match(pub, /hscodesLoadError/);
    assert.match(pub, /forceMount/);
    assert.match(pub, /hscodes=\{epbHs\.hscodes\}/);
    assert.match(pub, /facilitiesLoadError=\{facilityLoadError\}/);

    const app = readFileSync(
      join(process.cwd(), "app/(app)/app/suppliers/[slug]/page.tsx"),
      "utf8",
    );
    assert.match(app, /supplier_epb_hscodes/);
    assert.match(app, /hscodesFromRpc/);
    assert.match(app, /hscodesLoadError/);
    assert.doesNotMatch(app, /hsResult\.error \? \[\]/);
    assert.match(app, /forceMount/);
    assert.match(app, /hscodes=\{epbHs\.hscodes\}/);
    assert.match(app, /facilitiesLoadError=\{panelPack\.facilityLoadError\}/);
    assert.match(app, /facilityPanelFromRpc/);
    assert.match(app, /isProfileRpcTimeout/);
  });

  it("Overview shows HS codes; Compliance does not; empty list is omitted", () => {
    const overview = readFileSync(
      join(process.cwd(), "components/supplier/profile-overview-tab.tsx"),
      "utf8",
    );
    const tab = readFileSync(
      join(process.cwd(), "components/supplier/profile-compliance-tab.tsx"),
      "utf8",
    );
    const card = readFileSync(
      join(process.cwd(), "components/supplier/epb-hscodes-card.tsx"),
      "utf8",
    );
    assert.match(overview, /<ProfileEpbHscodesCard/);
    assert.match(overview, /hscodesLoadError/);
    assert.match(overview, /facilitiesLoadError/);
    assert.match(overview, /FacilitiesUnavailable/);
    assert.doesNotMatch(tab, /ProfileEpbHscodesCard/);
    assert.match(tab, /EpbRegistryOpenMarkup sourceUrl=\{pill\.source_url\}/);
    assert.match(card, /export function ProfileEpbHscodesCard/);
    assert.match(card, /if \(loadError\)/);
    assert.match(card, /<EpbHscodesUnavailable \/>/);
    assert.match(card, /if \(hscodes\.length === 0\) return null/);
    assert.doesNotMatch(card, /View list entry/);
    assert.doesNotMatch(card, /source_url/);
    assert.match(card, /hsOverviewLede/);
  });
});
