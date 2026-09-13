import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { LocationRowMarkup } from "../components/supplier/also-recorded-as";
import { AddressRow } from "../components/supplier/locations-section";
import {
  buildLocationOverview,
  mergeUniqueLocations,
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
  const chunks = html
    .split(/(?=<(?:div|button)\b[^>]*data-location-row)/)
    .filter(Boolean);
  return chunks.find((chunk) => chunk.includes(`data-location-group="${group}"`));
}

function renderAddressRows(rows: AddressRowRaw[]): string {
  return mergeUniqueLocations(rows)
    .map((loc) =>
      renderToStaticMarkup(
        createElement(AddressRow, {
          location: {
            displayAddress: loc.displayAddress,
            floors: loc.floors,
            variants: loc.variants,
            types: loc.types,
            authorities: loc.authorities,
            markerIndex: null,
          },
          groupTitle: "Factories",
          isSelected: false,
          locateState: "idle",
          showSiteNumber: false,
          onClick: () => undefined,
        }),
      ),
    )
    .join("");
}

function locationChunks(html: string): string[] {
  return html
    .split(/(?=<(?:div|button)\b[^>]*data-location-row)/)
    .filter((chunk) => /data-location-row=""/.test(chunk));
}

function displayHtml(chunk: string): string {
  const alsoIdx = chunk.search(/data-also-recorded-as=/);
  return alsoIdx >= 0 ? chunk.slice(0, alsoIdx) : chunk;
}

function assertSplitAddressRowHtml(
  left: AddressRowRaw,
  right: AddressRowRaw,
  keepRe: RegExp,
  otherRe: RegExp,
  otherName: string,
) {
  for (const ordered of [
    [left, right],
    [right, left],
  ]) {
    const locs = mergeUniqueLocations(ordered);
    assert.equal(locs.length, 2, `${otherName} matcher split`);
    const html = renderAddressRows(ordered);
    assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2, `${otherName} row count`);
    const chunks = locationChunks(html);
    assert.equal(chunks.length, 2, `${otherName} chunks`);
    const keep = chunks.find((chunk) => keepRe.test(displayHtml(chunk)));
    const other = chunks.find((chunk) => otherRe.test(displayHtml(chunk)));
    assert.ok(keep, `${otherName} keep row missing`);
    assert.ok(other, `${otherName} other row missing`);
    assert.notEqual(keep, other, `${otherName} fused into one row`);
    const also = keep!.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
    assert.ok(
      !also.some((block) => otherRe.test(block)),
      `${otherName} must not sit in Also recorded as on the keep row`,
    );
  }
}

function assertMergedAddressRowHtml(
  left: AddressRowRaw,
  right: AddressRowRaw,
  keepRe: RegExp,
  alsoRe: RegExp,
  otherName: string,
) {
  for (const ordered of [
    [left, right],
    [right, left],
  ]) {
    const locs = mergeUniqueLocations(ordered);
    assert.equal(locs.length, 1, `${otherName} matcher merge`);
    const html = renderAddressRows(ordered);
    assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1, `${otherName} row count`);
    const chunks = locationChunks(html);
    assert.equal(chunks.length, 1, `${otherName} chunks`);
    const chunk = chunks[0]!;
    const disp = displayHtml(chunk);
    assert.match(disp, keepRe, `${otherName} keep display`);
    const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
    assert.ok(also.length > 0, `${otherName} Also recorded as pill`);
    assert.ok(
      also.some((block) => alsoRe.test(block)),
      `${otherName} Also recorded as spelling must sit in an Also <li>`,
    );
  }
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
  row("235/B, TEJGAON I/A-1208, TEJGAON, DHAKA", "BKMEA", "mailing"),
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
    const mailingRow = locationRowHtml(html, "Mailing addresses");
    assert.ok(mailingRow, "Habitus Mailing row missing");
    const mailingAlso = mailingRow.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
    assert.ok(
      mailingAlso.some((block) => /Fakir Khali|FOKIRKHALI/i.test(block) && /BGMEA|BKMEA/.test(block)),
      "Habitus mailing Also recorded as must pair Fakir Khali/FOKIRKHALI with BGMEA or BKMEA",
    );
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
    const mailingRow = locationRowHtml(html, "Mailing addresses");
    assert.ok(mailingRow, "Fakhruddin Mailing row missing");
    assert.match(mailingRow, /235\/B/);
    const mailingAlso = mailingRow.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
    assert.ok(
      mailingAlso.some((block) => /TEJGAON I\/A-1208/i.test(block) && /BKMEA/.test(block)),
      "Fakhruddin mailing Also recorded as must pair TEJGAON I/A-1208 with BKMEA",
    );
  });

  it("matcher-split extras render as two Locations rows, not Also recorded as", () => {
    const cases: Array<{
      left: AddressRowRaw;
      right: AddressRowRaw;
      keepRe: RegExp;
      otherRe: RegExp;
      otherName: string;
    }> = [
      {
        left: row("House # 50, Road # 3, No.7 Gulshan, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /No\.7 Gulshan|7 Gulshan/i,
        otherRe: /Banani Road/i,
        otherName: "No.7 Gulshan vs Banani Road",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 Baro Banani, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /Baro Banani/i,
        otherName: "House 50 vs 7 Baro Banani",
      },
      {
        left: row("House # 50, Road # 3, 7 Baro Gulshan, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Baro Gulshan/i,
        otherRe: /Banani Road/i,
        otherName: "7 Baro Gulshan vs Banani Road",
      },
      {
        left: row("Plot # 10, 10 Choto Gulshan, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Banani Road, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Choto Gulshan/i,
        otherRe: /Banani Road/i,
        otherName: "Plot 10 Choto Gulshan vs Banani Road",
      },
      {
        left: row("Plot # 10, 10 Gulshan, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Banani Road, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /10 Gulshan/i,
        otherRe: /Banani Road/i,
        otherName: "Plot 10 Gulshan vs Banani Road",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 South Banani, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /South Banani/i,
        otherName: "House 50 vs 7 South Banani",
      },
      {
        left: row("House # 50, Road # 3, 7 South Gulshan, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /South Gulshan/i,
        otherRe: /Banani Road/i,
        otherName: "7 South Gulshan vs Banani Road",
      },
      {
        left: row("House # 50, Road # 3, SAT7 South Gulshan, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /SAT7 South Gulshan|Sat7 South Gulshan/i,
        otherRe: /Banani Road/i,
        otherName: "SAT7 South Gulshan vs Banani Road",
      },
      {
        left: row(
          "House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka",
          "BGMEA",
          "factory",
        ),
        right: row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 187/,
        otherRe: /House # 13/,
        otherName: "House 187 vs House 13",
      },
      {
        left: row(
          "House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka",
          "BGMEA",
          "factory",
        ),
        right: row("House # 62, Plot # 10, Holding # 1, H/O-13, Tejgaon, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 187/,
        otherRe: /H\/O-13/,
        otherName: "House 187 vs H/O-13",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row(
          "House # 50, Road # 3, 7 South-East Banani, Gulshan-1, Dhaka",
          "BKMEA",
          "factory",
        ),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /South-East Banani/i,
        otherName: "House 50 vs 7 South-East Banani",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row(
          "House # 50, Road # 3, 7 Southern Banani, Gulshan-1, Dhaka",
          "BKMEA",
          "factory",
        ),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /Southern Banani/i,
        otherName: "House 50 vs 7 Southern Banani",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row(
          "House # 50, Road # 3, 7 Paschim Banani, Gulshan-1, Dhaka",
          "BKMEA",
          "factory",
        ),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /Paschim Banani/i,
        otherName: "House 50 vs 7 Paschim Banani",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row(
          "House # 50, Road # 3, 7 Street Banani, Gulshan-1, Dhaka",
          "BKMEA",
          "factory",
        ),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /Street Banani/i,
        otherName: "House 50 vs 7 Street Banani",
      },
      {
        left: row(
          "House # 50, Road # 3, 7 South-East Gulshan, Gulshan-1, Dhaka",
          "BGMEA",
          "factory",
        ),
        right: row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /South-East Gulshan/i,
        otherRe: /Banani Road/i,
        otherName: "7 South-East Gulshan vs Banani Road",
      },
      {
        left: row(
          "House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka",
          "BGMEA",
          "factory",
        ),
        right: row("House # 50, Road # 3, 7 Airport Road, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Gulshan Avenue/i,
        otherRe: /Airport Road/i,
        otherName: "7 Gulshan Avenue vs 7 Airport Road",
      },
      {
        left: row("Plot # 10, 10 Airport Road, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Green Road, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /Green Road/i,
        otherName: "Plot 10 Airport Road vs Plot 10 Green Road",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row(
          "House # 50, Road # 3, 7 S-E Banani, Gulshan-1, Dhaka",
          "BKMEA",
          "factory",
        ),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /S-E Banani/i,
        otherName: "House 50 vs 7 S-E Banani",
      },
      {
        left: row(
          "House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka",
          "BGMEA",
          "factory",
        ),
        right: row(
          "House # 62, Plot # 10, Holding # 1, Head-Office 13, Tejgaon, Dhaka",
          "BKMEA",
          "factory",
        ),
        keepRe: /House # 187/,
        otherRe: /Head-Office 13/,
        otherName: "House 187 vs Head-Office 13",
      },
      {
        left: row(
          "House # 62, Plot # 10, Holding # 1, Building # 187, Tejgaon, Dhaka",
          "BGMEA",
          "factory",
        ),
        right: row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka", "BKMEA", "factory"),
        keepRe: /Building # 187/,
        otherRe: /House # 13/,
        otherName: "Building 187 vs House 13",
      },
      {
        left: row(
          "House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka",
          "BGMEA",
          "factory",
        ),
        right: row("House # 62, Plot # 10, Holding # 1, H-O-13, Tejgaon, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 187/,
        otherRe: /H-O-13/,
        otherName: "House 187 vs H-O-13",
      },
      {
        left: row(
          "House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka",
          "BGMEA",
          "factory",
        ),
        right: row(
          "House # 62, Plot # 10, Holding # 1, House # 13 (Old Zone 2), Tejgaon, Dhaka",
          "BKMEA",
          "factory",
        ),
        keepRe: /House # 187/,
        otherRe: /House # 13 \(Old Zone 2\)/,
        otherName: "House 187 vs House 13 (Old Zone 2)",
      },
      {
        left: row(
          "House # 62, Plot # 10, Holding # 1, Apt # 2/C, Tejgaon, Dhaka",
          "BGMEA",
          "factory",
        ),
        right: row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka", "BKMEA", "factory"),
        keepRe: /Apt # 2\/C/,
        otherRe: /House # 13/,
        otherName: "Apt # 2/C vs House 13",
      },
      {
        left: row("Plot # 10, 10 Airport, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Green, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport/i,
        otherRe: /Green/i,
        otherName: "Plot 10 Airport vs Plot 10 Green",
      },
      {
        left: row("Plot # 10, 10 Airport Road, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Green, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /Green/i,
        otherName: "Plot 10 Airport Road vs Plot 10 Green unsuffixed",
      },
      {
        left: row("Plot # 10, 10 Airport, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Green Road, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport/i,
        otherRe: /Green Road/i,
        otherName: "Plot 10 Airport vs Plot 10 Green Road",
      },
      {
        left: row("Plot # 10, Airport, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Green, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport/i,
        otherRe: /Green/i,
        otherName: "Plot 10 Airport vs Plot 10 Green no restated digit",
      },
      {
        left: row("7 Airport, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("7 Green, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /7 Airport/,
        otherRe: /7 Green/,
        otherName: "7 Airport vs 7 Green without Plot",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 Airport, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /7 Airport/i,
        otherName: "House 50 vs 7 Airport unsuffixed",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 Green, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /7 Green/i,
        otherName: "House 50 vs 7 Green unsuffixed",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 Outer Banani, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /Outer Banani/i,
        otherName: "House 50 vs 7 Outer Banani",
      },
      {
        left: row("House # 50, Road # 3, 7 Kazi Nazrul Islam Avenue, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 Panthapath, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Kazi Nazrul/i,
        otherRe: /Panthapath/i,
        otherName: "7 Kazi Nazrul Islam Avenue vs 7 Panthapath",
      },
      {
        left: row(
          "House # 62, Plot # 10, Holding # 1, Apt # 2/C, Tejgaon, Dhaka",
          "BGMEA",
          "factory",
        ),
        right: row(
          "House # 62, Plot # 10, Holding # 1, Building # 13, Tejgaon, Dhaka",
          "BKMEA",
          "factory",
        ),
        keepRe: /Apt # 2\/C/,
        otherRe: /Building # 13/,
        otherName: "Apt # 2/C vs Building 13",
      },
      {
        left: row("Plot # 10, 10 Airport Road, Green, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Green Road, Airport, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /Green Road/i,
        otherName: "Plot 10 Airport Road, Green vs Green Road, Airport",
      },
      {
        left: row("Plot # 10, 10 Airport Road, Green, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Green, Airport, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /10 Green, Airport/i,
        otherName: "Plot 10 Airport Road, Green vs Green, Airport leftover",
      },
      {
        left: row("Plot # 10, Airport, Green, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Green, Airport, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport, Green/i,
        otherRe: /Green, Airport/i,
        otherName: "Plot 10 Airport, Green vs Green, Airport leftover",
      },
      {
        left: row("Plot # 10, 10 Airport Road, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Greenpur, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /Greenpur/i,
        otherName: "Plot 10 Airport Road vs Greenpur",
      },
      {
        left: row("Plot # 10, 10 Green, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Greenpara, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /\bGreen\b/i,
        otherRe: /Greenpara/i,
        otherName: "Plot 10 Green vs Greenpara",
      },
      {
        left: row("Plot # 10, 10 Green, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Greennagar, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /\bGreen\b/i,
        otherRe: /Greennagar/i,
        otherName: "Plot 10 Green vs Greennagar",
      },
      {
        left: row("Plot # 10, 1st Ln, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 2nd Ln, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /1st Ln/i,
        otherRe: /2nd Ln/i,
        otherName: "Plot 10 1st Ln vs 2nd Ln",
      },
      {
        left: row("Plot # 10, 1stLane, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 2ndLane, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /1stLane/i,
        otherRe: /2ndLane/i,
        otherName: "Plot 10 1stLane vs 2ndLane glued",
      },
      {
        left: row("Plot # 10, Lane, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 2nd Lane, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Plot # 10, Lane/,
        otherRe: /2nd Lane/i,
        otherName: "Plot 10 un-ordinal Lane vs 2nd Lane",
      },
      {
        left: row("Plot # 10, Street, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 2nd Street, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Plot # 10, Street/,
        otherRe: /2nd Street/i,
        otherName: "Plot 10 un-ordinal Street vs 2nd Street",
      },
      {
        left: row("Plot # 10, Gali, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 2nd Gali, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Plot # 10, Gali/,
        otherRe: /2nd Gali/i,
        otherName: "Plot 10 un-ordinal Gali vs 2nd Gali",
      },
      {
        left: row("Plot # 10, Gulshan, Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Gulshan, Green, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /\bGreen\b/i,
        otherName: "Plot 10 Gulshan Airport Road vs Gulshan Green",
      },
      {
        left: row("Plot # 10, 10 Kazi Nazrul Islam Avenue, Green, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Green, Nazrul, Dhaka", "BKMEA", "factory"),
        keepRe: /Kazi Nazrul Islam Avenue, Green/,
        otherRe: /Green, Nazrul/,
        otherName: "Kazi Nazrul Islam Avenue leftover vs Green Nazrul",
      },
      {
        left: row("10, C DA Road, Chittagong", "BGMEA", "factory"),
        right: row("10, DA Road, Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Road/i,
        otherRe: /10, DA Road/i,
        otherName: "C DA Road vs DA Road",
      },
      {
        left: row("Plot # 10, 1st Gali, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 2nd Gali, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /1st Gali/i,
        otherRe: /2nd Gali/i,
        otherName: "Plot 10 1st Gali vs 2nd Gali",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 S\uFF0DE Banani, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /Banani/i,
        otherName: "House 50 vs 7 S-E Banani U+FF0D",
      },
      {
        left: row("12/1, Hossain Uddin Khan 1st Lane, Lalbag, Dhaka", "BGMEA", "factory"),
        right: row("12/1, Hossain Uddin Khan 2nd Lane, Lalbag, Dhaka", "BKMEA", "factory"),
        keepRe: /1st Lane/i,
        otherRe: /2nd Lane/i,
        otherName: "12/1 1st Lane vs 2nd Lane",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 S‐E Banani, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /S‐E Banani|S-E Banani/i,
        otherName: "House 50 vs 7 S-E Banani U+2010",
      },
      {
        left: row("Plot # 10, 10 Banani, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Barani, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /\bBanani\b/i,
        otherRe: /Barani/i,
        otherName: "Plot 10 Banani vs Plot 10 Barani",
      },
      {
        left: row("Plot # 10, 10 Banani, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Bananipur, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /\bBanani\b/i,
        otherRe: /Bananipur/i,
        otherName: "Plot 10 Banani vs Plot 10 Bananipur",
      },
      {
        left: row("Plot # 10, 10 Rampura, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Rampur, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Rampura/i,
        otherRe: /\bRampur\b/i,
        otherName: "Plot 10 Rampura vs Plot 10 Rampur",
      },
      {
        left: row("Plot # 10, 1st Avenue, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 2nd Avenue, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /1st Avenue/i,
        otherRe: /2nd Avenue/i,
        otherName: "Plot 10 1st Avenue vs 2nd Avenue",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 S‒E Banani, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /S‒E Banani|S-E Banani/i,
        otherName: "House 50 vs 7 S-E Banani U+2012",
      },
      {
        left: row("Plot # 10, Valuka, Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Valuka, Green, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /\bGreen\b/i,
        otherName: "Plot 10 Valuka Airport Road vs Green",
      },
      {
        left: row("Plot # 10, Satarkul, Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Satarkul, Green, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /\bGreen\b/i,
        otherName: "Plot 10 Satarkul Airport Road vs Green",
      },
      {
        left: row("Plot # 10, Fatullah, Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Fatullah, Green, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /\bGreen\b/i,
        otherName: "Plot 10 Fatullah Airport Road vs Green",
      },
      {
        left: row("Plot # 10, Hemayetpur, Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Hemayetpur, Greenpur, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /Greenpur/i,
        otherName: "Plot 10 Hemayetpur Airport Road vs Greenpur",
      },
      {
        left: row("Plot # 10, Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Green, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /Plot # 10, Green/,
        otherName: "Plot # 10 Airport Road vs unsuffixed Green",
      },
      {
        left: row("Plot # 10, C DA Road, Chittagong", "BGMEA", "factory"),
        right: row("Plot # 10, DA Road, Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Road/i,
        otherRe: /Plot # 10, DA Road/i,
        otherName: "Plot # 10 C DA Road vs DA Road",
      },
      {
        left: row("Plot # 10, Airport Path, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Green Path, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Path/i,
        otherRe: /Green Path/i,
        otherName: "Airport Path vs Green Path",
      },
      {
        left: row("10, C DA Gali, Chittagong", "BGMEA", "factory"),
        right: row("10, DA Gali, Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Gali/i,
        otherRe: /10, DA Gali/i,
        otherName: "C DA Gali vs DA Gali",
      },
      {
        left: row("Plot # 10, 1st Gully, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 2nd Gully, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /1st Gully/i,
        otherRe: /2nd Gully/i,
        otherName: "Plot 10 1st Gully vs 2nd Gully",
      },
      {
        left: row("Plot # 10, Street, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 2nd Lane, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /Plot # 10, Street/,
        otherRe: /2nd Lane/i,
        otherName: "Plot 10 un-ordinal Street vs 2nd Lane",
      },
      {
        left: row("Plot # 10, 10 Green, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Greenpark, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /\bGreen\b/i,
        otherRe: /Greenpark/i,
        otherName: "Plot 10 Green vs Greenpark",
      },
      {
        left: row("Plot # 10, 10 Green, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Greenfield, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /\bGreen\b/i,
        otherRe: /Greenfield/i,
        otherName: "Plot 10 Green vs Greenfield",
      },
      {
        left: row("Plot # 10, 10 Green, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Greenwood, Dhaka", "BKMEA", "factory"),
        keepRe: /\bGreen\b/i,
        otherRe: /Greenwood/i,
        otherName: "Plot 10 Green vs Greenwood",
      },
      {
        left: row("Plot # 10, 10 Green, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 10 Greenbelt, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /\bGreen\b/i,
        otherRe: /Greenbelt/i,
        otherName: "Plot 10 Green vs Greenbelt",
      },
      {
        left: row("10, C DA Gully, Chittagong", "BGMEA", "factory"),
        right: row("10, DA Gully, Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Gully/i,
        otherRe: /10,\s*DA Gully/i,
        otherName: "C DA Gully vs DA Gully",
      },
      {
        left: row("10, C DA Gulley, Chittagong", "BGMEA", "factory"),
        right: row("10, DA Gulley, Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Gulley/i,
        otherRe: /10,\s*DA Gulley/i,
        otherName: "C DA Gulley vs DA Gulley",
      },
      {
        left: row("10, C DA Galli, Chittagong", "BGMEA", "factory"),
        right: row("10, DA Galli, Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Galli/i,
        otherRe: /10,\s*DA Galli/i,
        otherName: "C DA Galli vs DA Galli",
      },
      {
        left: row("10, I A Gully, Dhaka", "BGMEA", "factory"),
        right: row("10, A Gully, Dhaka", "BKMEA", "factory"),
        keepRe: /I A Gully/i,
        otherRe: /10,\s*A Gully/i,
        otherName: "I A Gully vs A Gully",
      },
      {
        left: row("Plot # 10, 1st Alley, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, 2nd Alley, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /1st Alley/i,
        otherRe: /2nd Alley/i,
        otherName: "Plot 10 1st Alley vs 2nd Alley",
      },
      {
        left: row("Plot # 10, 1st Lane, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Twelfth Lane, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /1st Lane/i,
        otherRe: /Twelfth Lane/i,
        otherName: "Plot 10 1st Lane vs Twelfth Lane",
      },
      {
        left: row("Plot # 10, Joydebpur Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Tejgaon Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Joydebpur Road/i,
        otherRe: /Tejgaon Road/i,
        otherName: "Plot 10 Joydebpur Road vs Tejgaon Road",
      },
      {
        left: row("Plot # 10, Singair Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Joydebpur Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Singair Road/i,
        otherRe: /Joydebpur Road/i,
        otherName: "Plot 10 Singair Road vs Joydebpur Road",
      },
      {
        left: row("Plot # 10, Valuka, Joydebpur Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Valuka, Tejgaon Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Joydebpur Road/i,
        otherRe: /Tejgaon Road/i,
        otherName: "Plot 10 Valuka Joydebpur vs Tejgaon",
      },
      {
        left: row("Plot # 10, C DA Road, Chittagong", "BGMEA", "factory"),
        right: row("Plot # 10, DA, Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Road/i,
        otherRe: /Plot # 10,\s*DA,/i,
        otherName: "Plot # 10 C DA Road vs Plot # unsuffixed DA",
      },
      {
        left: row("10, I A Road, Dhaka", "BGMEA", "factory"),
        right: row("10, A, Dhaka", "BKMEA", "factory"),
        keepRe: /I A Road/i,
        otherRe: /10,\s*A,/i,
        otherName: "I A Road vs unsuffixed A",
      },
      {
        left: row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Union, Dogri, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Telulzora/i,
        otherRe: /Dogri/i,
        otherName: "Union Telulzora vs Union Dogri",
      },
      {
        left: row("House # 50, Road # 3, Gulshan-1, Dhaka", "BGMEA", "factory"),
        right: row("House # 50, Road # 3, 7 Kakhin Banani, Gulshan-1, Dhaka", "BKMEA", "factory"),
        keepRe: /House # 50, Road # 3, Gulshan-1/,
        otherRe: /Kakhin Banani/i,
        otherName: "House 50 vs 7 Kakhin Banani",
      },
      {
        left: row("10, C DA Road, Chittagong", "BGMEA", "factory"),
        right: row("10, DA, Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Road/i,
        otherRe: /10,\s*DA,/i,
        otherName: "C DA Road vs unsuffixed DA",
      },
      {
        left: row("Plot # 10, Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Joydebpur Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /Joydebpur Road/i,
        otherName: "Plot 10 Airport Road vs Joydebpur Road",
      },
    ];
    for (const c of cases) {
      assertSplitAddressRowHtml(c.left, c.right, c.keepRe, c.otherRe, c.otherName);
    }
  });

  it("shows HOUSE #14 as Also recorded as of House 14, Apt # 2 (one Locations row)", () => {
    assertMergedAddressRowHtml(
      row("House # 14, Apt # 2, Road # 20, Sector # 04, Uttara Model Town, Dhaka", "BGMEA", "factory"),
      row("HOUSE #14, ROAD #20, SECTOR #04, UTTARA, DHAKA", "BKMEA", "factory"),
      /House # 14, Apt # 2/,
      /HOUSE #14|House #14/,
      "House 14 Apt # 2 vs HOUSE #14",
    );
  });

  it("shows Building # 13 as Also recorded as of House 13 at the same Plot+Holding", () => {
    const house13 = row(
      "House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka",
      "BGMEA",
      "factory",
    );
    const building13 = row(
      "House # 62, Plot # 10, Holding # 1, Building # 13, Tejgaon, Dhaka",
      "BKMEA",
      "factory",
    );
    for (const ordered of [
      [house13, building13],
      [building13, house13],
    ]) {
      assert.equal(
        mergeUniqueLocations(ordered).length,
        1,
        "House 13 vs Building # 13 matcher merge",
      );
      const html = renderAddressRows(ordered);
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1);
      const chunk = locationChunks(html)[0]!;
      const disp = displayHtml(chunk);
      const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
      const houseDisp = /House # 13/.test(disp);
      const bldgDisp = /Building # 13/.test(disp);
      const houseAlso = also.some((block) => /House # 13/.test(block));
      const bldgAlso = also.some((block) => /Building # 13/.test(block));
      assert.ok(
        (houseDisp && bldgAlso) || (bldgDisp && houseAlso),
        "House 13 vs Building # 13 Also <li> isolation",
      );
    }
    assertMergedAddressRowHtml(
      row("67, City Heart Building, Suite # 4/3, Naya Paltan, Dhaka", "BGMEA", "mailing"),
      row("SUIT-4/3, CITY HEART, 67 NAYAPALTAN, PALTAN, DHAKA", "BKMEA", "mailing"),
      /City Heart|NAYAPALTAN/i,
      /City Heart|NAYAPALTAN|Naya Paltan/i,
      "City Heart Building 67 inverted",
    );
    assertMergedAddressRowHtml(
      row("Plot # 702, Jhajar, National University, Board bazar, Gazipur", "BGMEA", "factory"),
      row("Plot-702, Jajhar, National University, Gazipur", "BKMEA", "factory"),
      /Jhajar|Jajhar/i,
      /Jhajar|Jajhar/i,
      "Plot 702 Jhajar vs Jajhar",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row("Plot # 23-24, Union, Telulzora, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
      /Union,\s*Telulzora|Union\s*-\s*Telulzora/i,
      /Union\s*-\s*Telulzora|Union,\s*Telulzora/i,
      "Plot 23-24 Union hyphen vs Union comma",
    );
    assertMergedAddressRowHtml(
      row("Plot # 10, 6th Lane, Gulshan-1, Dhaka", "BGMEA", "factory"),
      row("Plot # 10, Sixth Lane, Gulshan-1, Dhaka", "BKMEA", "factory"),
      /Sixth Lane|6th Lane/i,
      /6th Lane/i,
      "Plot 10 6th Lane vs Sixth Lane",
    );
    assertMergedAddressRowHtml(
      row("Plot # 10, 12th Lane, Gulshan-1, Dhaka", "BGMEA", "factory"),
      row("Plot # 10, Twelfth Lane, Gulshan-1, Dhaka", "BKMEA", "factory"),
      /12th Lane|Twelfth Lane/i,
      /12th Lane|Twelfth Lane/i,
      "Plot 10 12th Lane vs Twelfth Lane",
    );
    assertMergedAddressRowHtml(
      row("Plot # 636, Shahriar Road, Sonda", "BGMEA", "factory"),
      row("636, Sharifpur Road, Sonda", "BKMEA", "factory"),
      /Shahriar|Sharifpur/i,
      /Sharifpur Road|Shahriar Road/i,
      "Plot 636 Shahriar vs Sharifpur at Sonda",
    );
    assertMergedAddressRowHtml(
      row("Plot # 10, Satarkul, Badda, Dhaka", "BGMEA", "factory"),
      row("Plot # 10, Satarkul, Jiban, Dhaka", "BKMEA", "factory"),
      /Satarkul/i,
      /Badda|Jiban/i,
      "Plot 10 Satarkul Badda vs Jiban",
    );
    assertMergedAddressRowHtml(
      row(
        "Holding # 106, Ward # 5, East Faridabad, Baitur Rahmat Jame Mosque Road\nDhaka\nDakshinkhan",
        "BGMEA",
        "factory",
      ),
      row(
        "Holding No. 106, Ward No. 5, Baitur Rahmat Jame Mosque Road, East Faidabad (Atipara), Dakshinkhan, Dhaka - 1230, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Faridabad|Faidabad/i,
      /Faridabad|Faidabad/i,
      "Holding 106 Faridabad vs Faidabad Ward 5",
    );
    assertMergedAddressRowHtml(
      row(
        "Union Plaza, Plot # 140, Baron, D EPZ Road, Ashulia\nDhaka\nDhaka",
        "BGMEA",
        "factory",
      ),
      row(
        "Union Plaza, 140 Baron, DEPZ Road, Ashulia, Savar, Dhaka - 1349, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Union Plaza/i,
      /DEPZ|D EPZ/i,
      "Union Plaza 140 Baron D EPZ vs DEPZ Road",
    );
    assertMergedAddressRowHtml(
      row("Plot # 397, Chandona, Chowrasta, Joydevpur\nGazipur\nGazipur", "BGMEA", "factory"),
      row(
        "Plot # 397 joydebpur road,chandona Chowrast, Gazipur Sadar, Gazipur 1702, Bangladesh, Gazipur, Bangladesh",
        "BKMEA",
        "factory",
      ),
      /Joydebpur Road/i,
      /Plot # 397, Chandona, Chowrasta, Joydevpur/i,
      "Plot 397 Chandona vs Joydebpur Road Chandona",
    );
    assertMergedAddressRowHtml(
      row("186, Maddya Gazirchat, Ashulia-EPZ Road\nDhaka\nSavar", "BGMEA", "factory"),
      row("186, Maddhya Gazir Chat, Ashulia EPZ Road, , DHAKA", "BKMEA", "factory"),
      /Gazirchat/i,
      /Gazir Chat/i,
      "186 Maddya Gazirchat vs Maddhya Gazir Chat",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur\nDhaka\nSavar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /23-24|Holding No\. 87/i,
      /Telulzora|Tetuljhora|Hemayetpur/i,
      "Plot 23-24 Telulzora vs Holding 87 Hemayetpur",
    );
    assertMergedAddressRowHtml(
      row("South Nayapara, 6, Dogri Mouja, Bhawal\nGazipur\nMirjapur", "BGMEA", "factory"),
      row(
        "South Noyapara, 6 No Dogri, P.O : Bhawal, Mirzapur, Gazipur Sadar PS, Gazipur - 1703, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Nayapara|Noyapara/i,
      /Nayapara|Noyapara|Dogri/i,
      "6 Dogri Mouja vs 6 No Dogri",
    );
    assertMergedAddressRowHtml(
      row(
        "Plot # 16 - 18, Dakhin Panishail, EPZ-Kaliakoir Road, Kashimpur, Gazipur - 1349, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      row("PLOT # 16-18, KAKHIN PANISHALI, EPZ-KALIAKOIR, KASHIMPUR, GAZIPUR", "BKMEA", "factory"),
      /Panishail|PANISHALI/i,
      /Panishail|PANISHALI|Kakhin|Dakhin/i,
      "Dakhin Panishail vs Kakhin Panishali",
    );
  });

  it("LocationsSection AddressRow HTML contains Also recorded as pills", () => {
    const html = renderToStaticMarkup(
      createElement(AddressRow, {
        location: {
          displayAddress: "House # 50, Road # 3, Gulshan-1, Dhaka",
          floors: [],
          variants: [
            {
              address: "House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka",
              authorities: ["BGMEA"],
            },
          ],
          types: ["factory"],
          authorities: ["BGMEA"],
          markerIndex: null,
        },
        groupTitle: "Factories",
        isSelected: false,
        locateState: "idle",
        showSiteNumber: false,
        onClick: () => undefined,
      }),
    );
    assert.match(html, /Also recorded as/);
    assert.match(html, /data-also-recorded-as=/);
    assert.match(html, /7 Gulshan Avenue/);
    assert.match(html, /data-location-row=""/);
    assert.match(html, /data-location-group="Factories"/);
  });

  it("does not count a Mailing Also-recorded-as pill as the Factories row", () => {
    const html = [
      `<button data-location-row="" data-location-group="Factories"><p data-location-display="">Kewa</p></button>`,
      `<button data-location-row="" data-location-group="Mailing addresses"><p data-location-display="">Badda</p><li data-also-recorded-as="">Gajaria · BGMEA</li></button>`,
    ].join("");
    const factoryRow = locationRowHtml(html, "Factories");
    assert.ok(factoryRow, "Factories button missing");
    assert.doesNotMatch(factoryRow, /Gajaria/);
    assert.doesNotMatch(factoryRow, /BGMEA/);
    const mailingRow = locationRowHtml(html, "Mailing addresses");
    assert.match(mailingRow ?? "", /Gajaria/);
  });
});
