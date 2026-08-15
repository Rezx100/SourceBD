import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { ProfileEpbHscodesCard } from "../components/supplier/epb-hscodes-card";
import {
  EpbHscodesMarkup,
  EpbHscodesUnavailable,
  EpbRegistryOpenMarkup,
} from "../components/supplier/epb-buyer-links";

describe("EPB buyer Open/HS hrefs (rendered)", () => {
  it("HS Open uses the list-id path, not the code and not the agency homepage", () => {
    const html = renderToStaticMarkup(
      createElement(EpbHscodesMarkup, {
        hscodes: [
          {
            code: "6103",
            description: "Men's or boys' suits",
            source_url: "https://edb.epb.gov.bd/hscode-exporters/813",
          },
        ],
      }),
    );
    assert.match(html, />6103</);
    assert.match(
      html,
      /href="https:\/\/edb\.epb\.gov\.bd\/hscode-exporters\/813"/,
    );
    assert.doesNotMatch(html, /hscode-exporters\/6103/);
    assert.doesNotMatch(html, /https:\/\/epb\.gov\.bd/);
  });

  it("omits the HS card markup when there are no codes", () => {
    const html = renderToStaticMarkup(
      createElement(EpbHscodesMarkup, { hscodes: [] }),
    );
    assert.equal(html, "");
  });

  it("EPB registry Open is the exporter page, never the agency homepage", () => {
    const open = renderToStaticMarkup(
      createElement(EpbRegistryOpenMarkup, {
        sourceUrl:
          "https://edb.epb.gov.bd/exporter/2043/interstoff-apparels-ltd",
      }),
    );
    assert.match(
      open,
      /href="https:\/\/edb\.epb\.gov\.bd\/exporter\/2043\/interstoff-apparels-ltd"/,
    );

    const homepage = renderToStaticMarkup(
      createElement(EpbRegistryOpenMarkup, {
        sourceUrl: "https://epb.gov.bd/",
      }),
    );
    assert.equal(homepage, "");
    assert.doesNotMatch(homepage, /epb\.gov\.bd/);
  });

  it("renders Interstoff and SARADA HS Open hrefs with list ids, not codes", () => {
    const html = renderToStaticMarkup(
      createElement(EpbHscodesMarkup, {
        hscodes: [
          {
            code: "6103",
            description: "Interstoff Apparels",
            source_url: "https://edb.epb.gov.bd/hscode-exporters/813",
          },
          {
            code: "6105",
            description: "SARADA FASHIONS",
            source_url: "https://edb.epb.gov.bd/hscode-exporters/694",
          },
        ],
      }),
    );
    assert.match(html, />6103</);
    assert.match(html, />6105</);
    assert.match(html, /hscode-exporters\/813/);
    assert.match(html, /hscode-exporters\/694/);
    assert.doesNotMatch(html, /hscode-exporters\/6103/);
    assert.doesNotMatch(html, /hscode-exporters\/6105/);
    assert.doesNotMatch(html, /https:\/\/epb\.gov\.bd/);
  });

  it("RPC failure markup is visible and is not an omitted card", () => {
    const html = renderToStaticMarkup(createElement(EpbHscodesUnavailable));
    assert.match(html, /data-epb-hscodes-error/);
    assert.match(html, /could not load/);
  });
});

describe("EPB HS Overview card (buyer-visible)", () => {
  it("omits the card when there are no codes", () => {
    const html = renderToStaticMarkup(
      createElement(ProfileEpbHscodesCard, { hscodes: [] }),
    );
    assert.equal(html, "");
  });

  it("shows an error card on RPC failure, not an omitted card", () => {
    const html = renderToStaticMarkup(
      createElement(ProfileEpbHscodesCard, { hscodes: [], loadError: true }),
    );
    assert.match(html, /Export products/);
    assert.match(html, /data-epb-hscodes-error/);
    assert.match(html, /could not load/);
    assert.doesNotMatch(html, /data-epb-hscodes=""/);
  });

  it("groups codes for a buyer and does not render a source link", () => {
    const html = renderToStaticMarkup(
      createElement(ProfileEpbHscodesCard, {
        hscodes: [
          {
            code: "6103",
            description: "Men's or boys' suits",
            source_url: "https://edb.epb.gov.bd/hscode-exporters/813",
          },
          {
            code: "6109",
            description: "T-shirts, singlets and other vests",
            source_url: "https://edb.epb.gov.bd/hscode-exporters/698",
          },
          {
            code: "6205",
            description: "Men's or boys' shirts",
            source_url: "https://edb.epb.gov.bd/hscode-exporters/786",
          },
        ],
      }),
    );
    assert.match(html, /Export products/);
    assert.match(html, /knit and woven apparel exporter/);
    assert.match(html, /Knit apparel/);
    assert.match(html, /Woven apparel/);
    assert.match(html, /data-epb-hscode="6103"/);
    assert.match(html, />6103</);
    assert.match(html, /Men&#x27;s knit suits/);
    assert.match(html, /T-shirts/);
    assert.match(html, /Men&#x27;s woven shirts/);
    assert.doesNotMatch(html, /View list entry/);
    assert.doesNotMatch(html, /hscode-exporters/);
    assert.doesNotMatch(html, /https:\/\/epb\.gov\.bd/);
  });
});
