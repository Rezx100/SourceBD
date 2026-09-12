import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

function locationRowHtml(html: string, group: string): string | undefined {
  const chunks = html.split(/(?=<div data-location-row="")/).filter(Boolean);
  return chunks.find((chunk) => chunk.includes(`data-location-group="${group}"`));
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
    assert.match(html, /data-also-recorded-authorities="[^"]*(?:BGMEA|BKMEA)/);
    assert.match(html, /Gojariapara/);
    assert.match(html, /Kauitis|Gajaria Para/);
    const factoryRow = locationRowHtml(html, "Factories");
    assert.ok(factoryRow, "Habitus Factories row missing");
    assert.match(factoryRow, /data-location-display=""/);
    assert.match(factoryRow, /Gojariapara|Gojaria/i);
    assert.match(factoryRow, />OEKO-TEX</);
    assert.match(factoryRow, /data-also-recorded-as=/);
    assert.doesNotMatch(html, /\[object Object\]/);
    const alsoBlocks = factoryRow.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
    assert.ok(alsoBlocks.length >= 1);
    assert.ok(
      alsoBlocks.some((block) => /Gajaria/i.test(block) && /BGMEA/.test(block)),
      "BGMEA must sit on the Gajaria Also recorded as pill on the Factories row",
    );
    for (const block of alsoBlocks) {
      assert.match(block, />BGMEA<|>BKMEA<|>OEKO-TEX</);
    }
  });

  it("Fakhruddin Textile Mills shows one Factories row with Kewa / Ghorgaria variants", () => {
    const html = renderOverview(FAKHRUDDIN);
    const factoryRows = html.match(/data-location-group="Factories"/g) ?? [];
    const mailingRows = html.match(/data-location-group="Mailing addresses"/g) ?? [];
    assert.equal(factoryRows.length, 1);
    assert.equal(mailingRows.length, 1);
    const factoryRow = locationRowHtml(html, "Factories");
    assert.ok(factoryRow, "Fakhruddin Factories row missing");
    assert.match(factoryRow, /Mouza Kewa|Ghorgaria|Ghargaria|Kewa/i);
    assert.match(factoryRow, />OEKO-TEX</);
    assert.match(factoryRow, /data-also-recorded-as=/);
    const alsoBlocks = factoryRow.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
    assert.ok(
      alsoBlocks.some(
        (block) => /Ghorgaria|Ghargaria/i.test(block) && /OEKO-TEX/.test(block),
      ),
      "OEKO-TEX must sit on the Ghargaria/Ghorgaria Also recorded as pill",
    );
    assert.doesNotMatch(html, /\[object Object\]/);
  });

  it("LocationsSection renders AlsoRecordedAs from the shared pill component", () => {
    const src = readFileSync(
      join(process.cwd(), "components/supplier/locations-section.tsx"),
      "utf8",
    );
    assert.match(src, /import \{ AlsoRecordedAs \} from "@\/components\/supplier\/also-recorded-as"/);
    assert.match(src, /<AlsoRecordedAs variants=\{location.variants\} \/>/);
    assert.match(src, /data-location-row=""/);
    assert.match(src, /data-location-group=\{groupTitle\}/);
  });
});
