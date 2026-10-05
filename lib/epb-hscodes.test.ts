import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SupplierSheet } from "@/components/dashboard/supplier-sheet";
import { buildSheet } from "@/lib/dashboard/build-models";
import { aboniInput } from "@/lib/dashboard/fixtures";

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
    // B9g: the public page hands the pack's lines and its load error to the record builder, which says
    // "The export lines could not be read." for an unread list and never "no lines".
    assert.match(pub, /hscodes: epbHs\.hscodes/);
    assert.match(pub, /hscodesError: epbHs\.loadError/);
    assert.match(pub, /facilities:\s*\{\s*panel:\s*facilitiesPanel\s*\}/);

    // REZ-C moved the buyer route onto the dashboard kit, so the RPC call and
    // the error handling now live one step away, in the loader the route uses.
    // The rule is unchanged: a failed HS read must be carried as "unknown",
    // never rendered as "no lines".
    const app = readFileSync(
      join(process.cwd(), "app/(app)/app/suppliers/[slug]/page.tsx"),
      "utf8",
    );
    assert.match(app, /loadRecordSheet/);
    const loader = readFileSync(join(process.cwd(), "lib/dashboard/load-record.ts"), "utf8");
    assert.match(loader, /supplier_epb_hscodes/);
    assert.match(loader, /hscodesFromRpc/);
    assert.match(loader, /hscodesError: loadError/);
    assert.doesNotMatch(loader, /hsResult\.error \? \[\]/);
    // `forceMount` was how the old page kept the Compliance tab's registry
    // links in the INITIAL HTML (the REZ-115 / REZ-72 lesson: a tab panel that
    // mounts on click ships none of its links to a caller who never clicks).
    // The kit sheet has no tab panels — every section is in the one document —
    // so the requirement is met more strongly, and this asserts the outcome
    // rather than the mechanism.
    assert.match(app, /ProfileReadTimeout/, "a slow read must not answer 404");
  });

  it("the record sheet ships every section's HS lines and register links in the first response", () => {
    // The outcome `forceMount` existed to protect, asserted on the HTML.
    const html = renderToStaticMarkup(
      createElement(SupplierSheet, { model: buildSheet(aboniInput()) }),
    );
    for (const id of ["overview", "products", "certificates", "safety", "sources", "locations", "facilities", "rfqs"]) {
      assert.ok(html.includes(`id="${id}"`), `#${id} is not in the initial HTML`);
    }
    assert.match(html, /edb\.epb\.gov\.bd\/exporter\//, "the EPB exporter link is not in the initial HTML");
    assert.match(html, /bgmea\.com\.bd\/member\//, "the BGMEA register link is not in the initial HTML");
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
