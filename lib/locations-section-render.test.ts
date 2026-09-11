import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { LocationRowMarkup } from "../components/supplier/also-recorded-as";
import {
  buildLocationOverview,
  type AddressRowRaw,
} from "./dedup-addresses";

function row(address: string, source_code: string, kind: string): AddressRowRaw {
  return {
    kind,
    address,
    source_code,
    fetched_at: "2026-07-24T00:00:00Z",
  };
}

function renderOverview(rows: AddressRowRaw[]): string {
  const overview = buildLocationOverview(rows);
  return overview.groups
    .flatMap((group) =>
      group.locations.map((loc) =>
        renderToStaticMarkup(
          createElement(LocationRowMarkup, {
            groupTitle: group.title,
            display: loc.displayAddress,
            variants: loc.variants,
            authorities: loc.authorities,
          }),
        ),
      ),
    )
    .join("");
}

const HABITUS: AddressRowRaw[] = [
  row("Gajaria Para, Kauitis\nGazipur\nGazipur", "BGMEA", "factory"),
  row(
    "GAJARIA PARA, BHAWAL MIRZAPUR, GAZIPUR SADAR, GAZIPUR, SADAR, GAZIPUR",
    "BKMEA",
    "factory",
  ),
  row(
    "Gojariapara, Vhawal Mirzapur, Gazipur Sadar PS, Gazipur - 1703, Bangladesh",
    "OEKO_TEX",
    "factory",
  ),
  row("Fakir Khali Road, Boro Beraid, Badda\nDhaka\nDhaka", "BGMEA", "mailing"),
  row("FOKIRKHALI ROAD, BORO BERAID, BADDA, DHAKA, BADDA, DHAKA", "BKMEA", "mailing"),
];

const FAKHRUDDIN: AddressRowRaw[] = [
  row("Kewa, Ghorgaria, Master Bari, Sreepur\nGazipur\nGazipur", "BGMEA", "factory"),
  row("MOUZA KEWA, SREEPUR, GAZIPUR", "BKMEA", "factory"),
  row(
    "Ghargaria Master Bari, Kewa, Sreepur, Gazipur - 1740, Bangladesh",
    "OEKO_TEX",
    "factory",
  ),
  row(
    "235/B, Bir Uttam Mir Sawkat Sarak, Tejgaon I/A\nDhaka\nDhaka",
    "BGMEA",
    "mailing",
  ),
  row("235/B, BIR UTTAM MIR SAWKAT SARAK, TEJGAON I/A, DHAKA", "BKMEA", "mailing"),
];

describe("Locations Also recorded as — rendered HTML boundary", () => {
  it("Habitus Fashion shows one Factories row and one Mailing row with variant spellings and authorities", () => {
    const html = renderOverview(HABITUS);
    const factoryRows = html.match(/data-location-group="Factories"/g) ?? [];
    const mailingRows = html.match(/data-location-group="Mailing addresses"/g) ?? [];
    assert.equal(factoryRows.length, 1);
    assert.equal(mailingRows.length, 1);
    assert.match(html, /Also recorded as/);
    assert.match(html, /data-also-recorded-as=/);
    assert.match(html, /Gojariapara/);
    assert.match(html, /Kauitis|Gajaria Para/);
    assert.match(html, />OEKO-TEX</);
    assert.doesNotMatch(html, /\[object Object\]/);
  });

  it("Fakhruddin Textile Mills shows one Factories row with Kewa / Ghorgaria variants", () => {
    const html = renderOverview(FAKHRUDDIN);
    const factoryRows = html.match(/data-location-group="Factories"/g) ?? [];
    const mailingRows = html.match(/data-location-group="Mailing addresses"/g) ?? [];
    assert.equal(factoryRows.length, 1);
    assert.equal(mailingRows.length, 1);
    assert.match(html, /Also recorded as/);
    assert.match(html, /Mouza Kewa|Ghorgaria|Ghargaria/);
    assert.match(html, />OEKO-TEX</);
    assert.doesNotMatch(html, /\[object Object\]/);
  });
});
