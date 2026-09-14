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
      {
        left: row("Plot # 10, C DA Road, Chittagong", "BGMEA", "factory"),
        right: row("Plot # 10, DA Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Road/i,
        otherRe: /Da Chittagong/i,
        otherName: "Plot # 10 C DA Road vs DA Chittagong no comma",
      },
      {
        left: row("10, C DA Road, Chittagong", "BGMEA", "factory"),
        right: row("10, DA Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Road/i,
        otherRe: /10,\s*DA Chittagong|10,\s*Da Chittagong/i,
        otherName: "10 C DA Road vs 10 DA Chittagong no comma",
      },
      {
        left: row("Plot # 10, I A Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, A Dhaka", "BKMEA", "factory"),
        keepRe: /I A Road/i,
        otherRe: /Plot # 10,\s*A Dhaka/i,
        otherName: "Plot # 10 I A Road vs A Dhaka no comma",
      },
      {
        left: row("Plot # 10, Joydebpur Road, Valuka", "BGMEA", "factory"),
        right: row("Plot # 10, Tejgaon Road, Valuka", "BKMEA", "factory"),
        keepRe: /Joydebpur Road/i,
        otherRe: /Tejgaon Road/i,
        otherName: "Plot 10 Joydebpur vs Tejgaon Valuka after",
      },
      {
        left: row("Plot # 10, Singair Road, Hemayetpur", "BGMEA", "factory"),
        right: row("Plot # 10, Joydebpur Road, Hemayetpur", "BKMEA", "factory"),
        keepRe: /Singair Road/i,
        otherRe: /Joydebpur Road/i,
        otherName: "Plot 10 Singair vs Joydebpur Hemayetpur after",
      },
      {
        left: row("Plot # 10, Shahriar Road, Valuka", "BGMEA", "factory"),
        right: row("Plot # 10, Sharifpur Road, Valuka", "BKMEA", "factory"),
        keepRe: /Shahriar Road/i,
        otherRe: /Sharifpur Road/i,
        otherName: "Plot 10 Shahriar vs Sharifpur Valuka after",
      },
      {
        left: row("Plot # 23-24, Union, Dogri, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
        keepRe: /Holding No\. 87/i,
        otherRe: /Dogri/i,
        otherName: "Union Dogri vs Holding 87 Tetuljhora",
      },
      {
        left: row("Plot # 10, Faridabad Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Faridpur Road, Sonda", "BKMEA", "factory"),
        keepRe: /Faridabad Road/i,
        otherRe: /Faridpur Road/i,
        otherName: "Plot 10 Faridabad vs Faridpur at Sonda",
      },
      {
        left: row("Plot # 10, Faridabad Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Faridpur Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Faridabad Road/i,
        otherRe: /Faridpur Road/i,
        otherName: "Plot 10 Faridabad vs Faridpur no Sonda",
      },
      {
        left: row("Plot # 10, Sharifpur Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Faridpur Road, Sonda", "BKMEA", "factory"),
        keepRe: /Sharifpur Road/i,
        otherRe: /Faridpur Road/i,
        otherName: "Plot 10 Sharifpur vs Faridpur at Sonda",
      },
      {
        left: row("Plot # 10, Sharifpur Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Faridpur Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Sharifpur Road/i,
        otherRe: /Faridpur Road/i,
        otherName: "Plot 10 Sharifpur vs Faridpur no Sonda",
      },
      {
        left: row("Plot # 10, Mohammadpur Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Shahjadpur Road, Sonda", "BKMEA", "factory"),
        keepRe: /Mohammadpur Road/i,
        otherRe: /Shahjadpur Road/i,
        otherName: "Plot 10 Mohammadpur vs Shahjadpur at Sonda",
      },
      {
        left: row("Plot # 10, Joydebpur Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Tejgaon Road, Sonda", "BKMEA", "factory"),
        keepRe: /Joydebpur Road/i,
        otherRe: /Tejgaon Road/i,
        otherName: "Plot 10 Joydebpur vs Tejgaon at Sonda",
      },
      {
        left: row("Plot # 10, Joydebpur Road, Valuka, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Tejgaon Road, Valuka, Dhaka", "BKMEA", "factory"),
        keepRe: /Joydebpur Road/i,
        otherRe: /Tejgaon Road/i,
        otherName: "Plot 10 Joydebpur vs Tejgaon Valuka after with Dhaka",
      },
      {
        left: row("10, C DA Road, Chittagong", "BGMEA", "factory"),
        right: row("10 DA Chittagong", "BKMEA", "factory"),
        keepRe: /C DA Road/i,
        otherRe: /10\s+Da Chittagong|10\s+DA Chittagong/i,
        otherName: "10 C DA Road vs 10 DA Chittagong no comma after digit",
      },
      {
        left: row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
        keepRe: /Holding No\. 87/i,
        otherRe: /Dogri/i,
        otherName: "Village Dogri vs Holding 87 Tetuljhora",
      },
      {
        left: row("Plot # 23-24, Vill, Dogri, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
        keepRe: /Holding No\. 87/i,
        otherRe: /Dogri/i,
        otherName: "Vill Dogri vs Holding 87 Tetuljhora",
      },
      {
        left: row("Plot # 10, Rampura Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Rampur Road, Sonda", "BKMEA", "factory"),
        keepRe: /Rampura Road/i,
        otherRe: /Rampur Road/i,
        otherName: "Plot 10 Rampura vs Rampur at Sonda",
      },
      {
        left: row("Plot # 10, Rampura Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Rampur Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Rampura Road/i,
        otherRe: /Rampur Road/i,
        otherName: "Plot 10 Rampura vs Rampur no Sonda",
      },
      {
        left: row("Plot # 10, Keraniganj Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Narayanganj Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Keraniganj Road/i,
        otherRe: /Narayanganj Road/i,
        otherName: "Plot 10 Keraniganj vs Narayanganj",
      },
      {
        left: row("Plot # 10, Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road/i,
        otherRe: /Airpark Road/i,
        otherName: "Plot 10 Airport vs Airpark",
      },
      {
        left: row("Plot # 10, Hariken Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Horizon Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Hariken Road/i,
        otherRe: /Horizon Road/i,
        otherName: "Plot 10 Hariken vs Horizon",
      },
      {
        left: row("Plot # 10, Station Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Staten Road, Sonda", "BKMEA", "factory"),
        keepRe: /Station Road/i,
        otherRe: /Staten Road/i,
        otherName: "Plot 10 Station vs Staten at Sonda",
      },
      {
        left: row("Plot # 10, Station Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Stationary Road, Sonda", "BKMEA", "factory"),
        keepRe: /Station Road/i,
        otherRe: /Stationary Road/i,
        otherName: "Plot 10 Station vs Stationary at Sonda",
      },
      {
        left: row("Plot # 10, Chandora Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Bashundhara Road, Sonda", "BKMEA", "factory"),
        keepRe: /Chandora Road/i,
        otherRe: /Bashundhara Road/i,
        otherName: "Plot 10 Chandora vs Bashundhara at Sonda",
      },
      {
        left: row("Plot # 23-24, Union Plaza, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
        keepRe: /Holding No\. 87/i,
        otherRe: /Union Plaza/i,
        otherName: "Union Plaza vs Holding 87 Tetuljhora",
      },
      {
        left: row("Plot # 23-24, Village of Dogri, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
        keepRe: /Holding No\. 87/i,
        otherRe: /Dogri/i,
        otherName: "Village of Dogri vs Holding 87 Tetuljhora",
      },
      {
        left: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Village,\s*Hemayetpur/i,
        otherRe: /Dogri/i,
        otherName: "Village Hemayetpur vs Village Dogri",
      },
      {
        left: row("Plot # 23-24, Village, Hemayetpur, Dogri, Dhaka, Savar", "BGMEA", "factory"),
        right: row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
        keepRe: /Holding No\. 87/i,
        otherRe: /Dogri/i,
        otherName: "Village Hemayetpur Dogri vs Holding 87 Tetuljhora",
      },
      {
        left: row("Plot # 23-24, Union House, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
        keepRe: /Holding No\. 87/i,
        otherRe: /Union House/i,
        otherName: "Union House vs Holding 87 Tetuljhora",
      },
      {
        left: row("Plot # 23-24, Union of Plaza, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
        keepRe: /Holding No\. 87/i,
        otherRe: /Union of Plaza|Union Of Plaza/i,
        otherName: "Union of Plaza vs Holding 87 Tetuljhora",
      },
      {
        left: row("Plot # 10, East Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, West Airport Road, Dhaka", "BKMEA", "factory"),
        keepRe: /East Airport Road/i,
        otherRe: /West Airport Road/i,
        otherName: "Plot 10 East Airport vs West Airport",
      },
      {
        left: row("Plot # 10, Baba Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Babu Airpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Baba Airport Road/i,
        otherRe: /Babu Airpark Road/i,
        otherName: "Plot 10 Baba Airport vs Babu Airpark",
      },
      {
        left: row("Plot # 10, East Rampura Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, West Rampura Road, Dhaka", "BKMEA", "factory"),
        keepRe: /East Rampura Road/i,
        otherRe: /West Rampura Road/i,
        otherName: "Plot 10 East Rampura vs West Rampura",
      },
      {
        left: row("Plot # 10, New Eskaton Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Old Eskaton Road, Dhaka", "BKMEA", "factory"),
        keepRe: /New Eskaton Road/i,
        otherRe: /Old Eskaton Road/i,
        otherName: "Plot 10 New Eskaton vs Old Eskaton",
      },
      {
        left: row("Plot # 10, Inner Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Outer Airport Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Inner Airport Road/i,
        otherRe: /Outer Airport Road/i,
        otherName: "Plot 10 Inner Airport vs Outer Airport",
      },
      {
        left: row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Telulzora/i,
        otherRe: /Village,\s*Dogri/i,
        otherName: "Union hyphen Telulzora vs Village Dogri",
      },
      {
        left: row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Village,\s*Dogri/i,
        otherRe: /Telulzora/i,
        otherName: "Village Dogri vs Union hyphen Telulzora",
      },
      {
        left: row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village of Dogri, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Telulzora/i,
        otherRe: /Village of Dogri/i,
        otherName: "Union hyphen Telulzora vs Village of Dogri",
      },
      {
        left: row("Plot # 23-24, Union - Dogri, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Union\s*-\s*Dogri/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Union hyphen Dogri vs Village Hemayetpur",
      },
      {
        left: row("Plot # 10, East Mirpur Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, West Mirpur Road, Sonda", "BKMEA", "factory"),
        keepRe: /East Mirpur Road/i,
        otherRe: /West Mirpur Road/i,
        otherName: "Plot 10 East Mirpur vs West Mirpur at Sonda",
      },
      {
        left: row("Plot # 10, East Mirpur Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, West Mirpur Road, Dhaka", "BKMEA", "factory"),
        keepRe: /East Mirpur Road/i,
        otherRe: /West Mirpur Road/i,
        otherName: "Plot 10 East Mirpur vs West Mirpur at Dhaka",
      },
      {
        left: row("Plot # 10, East Mirpur Road", "BGMEA", "factory"),
        right: row("Plot # 10, West Mirpur Road", "BKMEA", "factory"),
        keepRe: /East Mirpur Road/i,
        otherRe: /West Mirpur Road/i,
        otherName: "Plot 10 East Mirpur vs West Mirpur no village",
      },
      {
        left: row("Plot # 10, East Tejgaon Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, West Tejgaon Road, Sonda", "BKMEA", "factory"),
        keepRe: /East Tejgaon Road/i,
        otherRe: /West Tejgaon Road/i,
        otherName: "Plot 10 East Tejgaon vs West Tejgaon at Sonda",
      },
      {
        left: row("Plot # 10, East Tejgaon Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, West Tejgaon Road, Dhaka", "BKMEA", "factory"),
        keepRe: /East Tejgaon Road/i,
        otherRe: /West Tejgaon Road/i,
        otherName: "Plot 10 East Tejgaon vs West Tejgaon at Dhaka",
      },
      {
        left: row("Plot # 10, East Joydebpur Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, West Joydebpur Road, Sonda", "BKMEA", "factory"),
        keepRe: /East Joydebpur Road/i,
        otherRe: /West Joydebpur Road/i,
        otherName: "Plot 10 East Joydebpur vs West Joydebpur same remainder",
      },
      {
        left: row("Plot # 10, EastAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, WestAirport Road, Dhaka", "BKMEA", "factory"),
        keepRe: /EastAirport|Eastairport/i,
        otherRe: /WestAirport|Westairport/i,
        otherName: "Plot 10 EastAirport vs WestAirport concatenated",
      },
      {
        left: row("Plot # 10, East Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, WestAirport Road, Dhaka", "BKMEA", "factory"),
        keepRe: /East Airport Road/i,
        otherRe: /WestAirport|Westairport/i,
        otherName: "Plot 10 East Airport spaced vs WestAirport glued",
      },
      {
        left: row("Plot # 10, North East Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, South West Airport Road, Dhaka", "BKMEA", "factory"),
        keepRe: /North East Airport Road/i,
        otherRe: /South West Airport Road/i,
        otherName: "Plot 10 North East Airport vs South West Airport",
      },
      {
        left: row("Plot # 10, East Airport Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, West Airport Road, Sonda", "BKMEA", "factory"),
        keepRe: /East Airport Road/i,
        otherRe: /West Airport Road/i,
        otherName: "Plot 10 East Airport vs West Airport at Sonda",
      },
      {
        left: row("Plot # 23-24, Union - Faridabad, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Faridabad/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Union hyphen Faridabad vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Union - Faridabad, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Village,\s*Hemayetpur/i,
        otherRe: /Faridabad/i,
        otherName: "Village Hemayetpur vs Union hyphen Faridabad",
      },
      {
        left: row("Plot # 23-24, Union - Chandona, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Chandona/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Union hyphen Chandona vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Union - Chandora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Chandora/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Union hyphen Chandora vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Union - Kaliakoir, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Kaliakoir/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Union hyphen Kaliakoir vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Union - Chandra, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Chandra/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Union hyphen Chandra vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Union, Faridabad, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Union,\s*Faridabad/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Union comma Faridabad vs Village Hemayetpur",
      },
      {
        left: row("Plot # 10, BabaAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, BabuAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /BabaAirport|Babaairport/i,
        otherRe: /BabuAirpark|Babuairpark/i,
        otherName: "Plot 10 BabaAirport vs BabuAirpark concatenated",
      },
      {
        left: row("Plot # 10, BabaAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, BabuAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /BabuAirpark|Babuairpark/i,
        otherRe: /BabaAirport|Babaairport/i,
        otherName: "Plot 10 BabuAirpark vs BabaAirport concatenated",
      },
      {
        left: row("Plot # 10, BabaAirport Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, BabuAirpark Road, Sonda", "BKMEA", "factory"),
        keepRe: /BabaAirport|Babaairport/i,
        otherRe: /BabuAirpark|Babuairpark/i,
        otherName: "Plot 10 BabaAirport vs BabuAirpark concatenated at Sonda",
      },
      {
        left: row("Plot # 10, BabaAirport Road", "BGMEA", "factory"),
        right: row("Plot # 10, BabuAirpark Road", "BKMEA", "factory"),
        keepRe: /BabaAirport|Babaairport/i,
        otherRe: /BabuAirpark|Babuairpark/i,
        otherName: "Plot 10 BabaAirport vs BabuAirpark concatenated no village",
      },
      {
        left: row("Plot # 10, Northeast Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Southwest Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Northeast Road/i,
        otherRe: /Southwest Road/i,
        otherName: "Plot 10 Northeast vs Southwest one-token",
      },
      {
        left: row("Plot # 10, Northeast Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Northwest Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Northeast Road/i,
        otherRe: /Northwest Road/i,
        otherName: "Plot 10 Northeast vs Northwest one-token",
      },
      {
        left: row("Plot # 10, Southeast Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Southwest Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Southeast Road/i,
        otherRe: /Southwest Road/i,
        otherName: "Plot 10 Southeast vs Southwest one-token",
      },
      {
        left: row("Plot # 10, North East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, South West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /North East Road/i,
        otherRe: /South West Road/i,
        otherName: "Plot 10 North East vs South West no Airport",
      },
      {
        left: row("Plot # 10, BabaAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Babu Airpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Babu Airpark Road/i,
        otherRe: /BabaAirport|Babaairport/i,
        otherName: "Plot 10 BabaAirport glued vs Babu Airpark spaced",
      },
      {
        left: row("Plot # 10, BabaAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Babu Airpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /BabaAirport|Babaairport/i,
        otherRe: /Babu Airpark Road/i,
        otherName: "Plot 10 Babu Airpark vs BabaAirport glued reverse",
      },
      {
        left: row("Plot # 10, Baba Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, BabuAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Baba Airport Road/i,
        otherRe: /BabuAirpark|Babuairpark/i,
        otherName: "Plot 10 Baba Airport spaced vs BabuAirpark glued",
      },
      {
        left: row("Plot # 10, BabaAirport Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Babu Airpark Road, Sonda", "BKMEA", "factory"),
        keepRe: /Babu Airpark Road/i,
        otherRe: /BabaAirport|Babaairport/i,
        otherName: "Plot 10 BabaAirport glued vs Babu Airpark spaced at Sonda",
      },
      {
        left: row("Plot # 10, BabaAirport Road", "BGMEA", "factory"),
        right: row("Plot # 10, Babu Airpark Road", "BKMEA", "factory"),
        keepRe: /Babu Airpark Road/i,
        otherRe: /BabaAirport|Babaairport/i,
        otherName: "Plot 10 BabaAirport glued vs Babu Airpark spaced no village",
      },
      {
        left: row("Plot # 10, BabaAirport Road, Valuka", "BGMEA", "factory"),
        right: row("Plot # 10, Babu Airpark Road, Valuka", "BKMEA", "factory"),
        keepRe: /Babu Airpark Road/i,
        otherRe: /BabaAirport|Babaairport/i,
        otherName: "Plot 10 BabaAirport glued vs Babu Airpark spaced at Valuka",
      },
      {
        left: row("Plot # 10, ShahidAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, ShahedAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /ShahidAirport|Shahidairport/i,
        otherRe: /ShahedAirpark|Shahedairpark/i,
        otherName: "Plot 10 ShahidAirport vs ShahedAirpark",
      },
      {
        left: row("Plot # 10, MasterAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, MastarAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /MasterAirport|Masterairport/i,
        otherRe: /MastarAirpark|Mastarairpark/i,
        otherName: "Plot 10 MasterAirport vs MastarAirpark",
      },
      {
        left: row("Plot # 10, SheikhAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, ShaikhAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /SheikhAirport|Sheikhairport/i,
        otherRe: /ShaikhAirpark|Shaikhairpark/i,
        otherName: "Plot 10 SheikhAirport vs ShaikhAirpark",
      },
      {
        left: row("Plot # 10, Sheikh Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh Airpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh Airport Road/i,
        otherRe: /Shaikh Airpark Road/i,
        otherName: "Plot 10 Sheikh Airport vs Shaikh Airpark spaced",
      },
      {
        left: row("Plot # 10, AlAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, AlAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /AlAirport|Alairport/i,
        otherRe: /AlAirpark|Alairpark/i,
        otherName: "Plot 10 AlAirport vs AlAirpark",
      },
      {
        left: row("Plot # 10, MdAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, MdAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /MdAirport|Mdairport/i,
        otherRe: /MdAirpark|Mdairpark/i,
        otherName: "Plot 10 MdAirport vs MdAirpark",
      },
      {
        left: row("Plot # 10, NewBabaAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, OldBabuAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /NewBabaAirport|Newbabaairport/i,
        otherRe: /OldBabuAirpark|Oldbabuairpark/i,
        otherName: "Plot 10 NewBabaAirport vs OldBabuAirpark",
      },
      {
        left: row("Plot # 10, EastBabaAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, WestBabuAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /EastBabaAirport|Eastbabaairport/i,
        otherRe: /WestBabuAirpark|Westbabuairpark/i,
        otherName: "Plot 10 EastBabaAirport vs WestBabuAirpark",
      },
      {
        left: row("Plot # 10, InnerBabaAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, OuterBabuAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /InnerBabaAirport|Innerbabaairport/i,
        otherRe: /OuterBabuAirpark|Outerbabuairpark/i,
        otherName: "Plot 10 InnerBabaAirport vs OuterBabuAirpark",
      },
      {
        left: row("Plot # 10, PaschimBabaAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, PurboBabuAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /PaschimBabaAirport|Paschimbabaairport/i,
        otherRe: /PurboBabuAirpark|Purbobabuairpark/i,
        otherName: "Plot 10 PaschimBabaAirport vs PurboBabuAirpark",
      },
      {
        left: row("Plot # 23-24, Dogri Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Dogri Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Dogri Union title-after vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Faridabad Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Faridabad Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Faridabad Union title-after vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Chandona Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Chandona Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Chandona Union title-after vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Union - Tetultola, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Tetultola/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Union hyphen Tetultola vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Union - Tetultola, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
        keepRe: /Holding No\. 87/i,
        otherRe: /Tetultola/i,
        otherName: "Union hyphen Tetultola vs Holding 87",
      },
      {
        left: row("Plot # 23-24, Union - Telultola, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Telultola/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Union hyphen Telultola vs Village Hemayetpur",
      },
      {
        left: row("Plot # 10, Airport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport East Road/i,
        otherRe: /Airpark West Road/i,
        otherName: "Plot 10 Airport East vs Airpark West",
      },
      {
        left: row("Plot # 10, Airport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark East Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport East Road/i,
        otherRe: /Airpark East Road/i,
        otherName: "Plot 10 Airport East vs Airpark East",
      },
      {
        left: row("Plot # 10, Airport North Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark North Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport North Road/i,
        otherRe: /Airpark North Road/i,
        otherName: "Plot 10 Airport North vs Airpark North",
      },
      {
        left: row("Plot # 10, Airport South Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark South Road, Sonda", "BKMEA", "factory"),
        keepRe: /Airport South Road/i,
        otherRe: /Airpark South Road/i,
        otherName: "Plot 10 Airport South vs Airpark South at Sonda",
      },
      {
        left: row("Plot # 10, Airport West Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark East Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport West Road/i,
        otherRe: /Airpark East Road/i,
        otherName: "Plot 10 Airport West vs Airpark East",
      },
      {
        left: row("Plot # 10, Airport East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport East/i,
        otherRe: /Airpark West/i,
        otherName: "Plot 10 Airport East vs Airpark West no-Road",
      },
      {
        left: row("Plot # 10, AirportEast Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, AirparkWest Road, Dhaka", "BKMEA", "factory"),
        keepRe: /AirportEast|Airporteast/i,
        otherRe: /AirparkWest|Airparkwest/i,
        otherName: "Plot 10 AirportEast vs AirparkWest glued",
      },
      {
        left: row("Plot # 10, Airport-East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark-West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport-East/i,
        otherRe: /Airpark-West/i,
        otherName: "Plot 10 Airport-East vs Airpark-West hyphen",
      },
      {
        left: row("Plot # 10, Baba Airport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Babu Airpark West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Baba Airport East/i,
        otherRe: /Babu Airpark West/i,
        otherName: "Plot 10 Baba Airport East vs Babu Airpark West",
      },
      {
        left: row("Plot # 10, BabaAirport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Babu Airpark West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /BabaAirport East|Babaairport East/i,
        otherRe: /Babu Airpark West/i,
        otherName: "Plot 10 BabaAirport East vs Babu Airpark West",
      },
      {
        left: row("Plot # 10, Inner Airport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Outer Airpark West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Inner Airport East/i,
        otherRe: /Outer Airpark West/i,
        otherName: "Plot 10 Inner Airport East vs Outer Airpark West",
      },
      {
        left: row("Plot # 10, New Airport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Old Airpark West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /New Airport East/i,
        otherRe: /Old Airpark West/i,
        otherName: "Plot 10 New Airport East vs Old Airpark West",
      },
      {
        left: row("Plot # 10, Sheikh Airport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh Airpark West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh Airport East/i,
        otherRe: /Shaikh Airpark West/i,
        otherName: "Plot 10 Sheikh Airport East vs Shaikh Airpark West",
      },
      {
        left: row("Plot # 10, Airport East Road, Green, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West Road, Green, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport East Road/i,
        otherRe: /Airpark West Road/i,
        otherName: "Plot 10 leftover Airport East vs Airpark West Green",
      },
      {
        left: row("Plot # 10, Airport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport East Road/i,
        otherRe: /Airport West Road/i,
        otherName: "Plot 10 Airport East vs Airport West",
      },
      {
        left: row("Plot # 10, East Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark East Road, Dhaka", "BKMEA", "factory"),
        keepRe: /East Airport Road/i,
        otherRe: /Airpark East Road/i,
        otherName: "Plot 10 East Airport vs Airpark East",
      },
      {
        left: row("Plot # 10, Airport East Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West Road, Sonda", "BKMEA", "factory"),
        keepRe: /Airport East Road/i,
        otherRe: /Airpark West Road/i,
        otherName: "Plot 10 Airport East vs Airpark West at Sonda",
      },
      {
        left: row("Plot # 10, Airport East Road", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West Road", "BKMEA", "factory"),
        keepRe: /Airport East Road/i,
        otherRe: /Airpark West Road/i,
        otherName: "Plot 10 Airport East vs Airpark West no village",
      },
      {
        left: row("Plot # 10, Airport East Road, Valuka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West Road, Valuka", "BKMEA", "factory"),
        keepRe: /Airport East Road/i,
        otherRe: /Airpark West Road/i,
        otherName: "Plot 10 Airport East vs Airpark West at Valuka",
      },
      {
        left: row("Plot # 10, Airport East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport East/i,
        otherRe: /Airpark West Road/i,
        otherName: "Plot 10 Airport East no-Road vs Airpark West Road",
      },
      {
        left: row("Plot # 10, Airport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport East Road/i,
        otherRe: /Airpark West/i,
        otherName: "Plot 10 Airport East Road vs Airpark West no-Road",
      },
      {
        left: row("Plot # 10, AirportEastRoad, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, AirparkWestRoad, Dhaka", "BKMEA", "factory"),
        keepRe: /AirportEastRoad|Airporteastroad/i,
        otherRe: /AirparkWestRoad|Airparkwestroad/i,
        otherName: "Plot 10 AirportEastRoad vs AirparkWestRoad",
      },
      {
        left: row("Plot # 10, Airport Road East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road West, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road East/i,
        otherRe: /Airport Road West/i,
        otherName: "Plot 10 Airport Road East vs Airport Road West",
      },
      {
        left: row("Plot # 10, East Mirpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, West Mirpur, Sonda", "BKMEA", "factory"),
        keepRe: /East Mirpur/i,
        otherRe: /West Mirpur/i,
        otherName: "Plot 10 East Mirpur vs West Mirpur no-Road at Sonda",
      },
      {
        left: row("Plot # 10, East Tejgaon, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, West Tejgaon, Sonda", "BKMEA", "factory"),
        keepRe: /East Tejgaon/i,
        otherRe: /West Tejgaon/i,
        otherName: "Plot 10 East Tejgaon vs West Tejgaon no-Road at Sonda",
      },
      {
        left: row("Plot # 10, East Circular, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, West Circular, Dhaka", "BKMEA", "factory"),
        keepRe: /East Circular/i,
        otherRe: /West Circular/i,
        otherName: "Plot 10 East Circular vs West Circular no-Road",
      },
      {
        left: row("Plot # 10, East Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, West Airport, Dhaka", "BKMEA", "factory"),
        keepRe: /East Airport/i,
        otherRe: /West Airport/i,
        otherName: "Plot 10 East Airport vs West Airport no-Road",
      },
      {
        left: row("Plot # 23-24, Dogri, Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Dogri,\s*Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Dogri, Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Faridabad, Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Faridabad,\s*Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Faridabad, Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Tetultola, Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Tetultola,\s*Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Tetultola, Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Chandona, Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Chandona,\s*Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Chandona, Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 10, East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, West Joydebpur Road, Sonda", "BKMEA", "factory"),
        keepRe: /East Joydebpur/i,
        otherRe: /West Joydebpur Road/i,
        otherName: "Plot 10 East Joydebpur vs West Joydebpur Road mixed at Sonda",
      },
      {
        left: row("Plot # 10, East Joydebpur, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, West Joydebpur Road, Dhaka", "BKMEA", "factory"),
        keepRe: /East Joydebpur/i,
        otherRe: /West Joydebpur Road/i,
        otherName: "Plot 10 East Joydebpur vs West Joydebpur Road mixed at Dhaka",
      },
      {
        left: row("Plot # 10, East Joydebpur, Valuka", "BGMEA", "factory"),
        right: row("Plot # 10, West Joydebpur Road, Valuka", "BKMEA", "factory"),
        keepRe: /East Joydebpur/i,
        otherRe: /West Joydebpur Road/i,
        otherName: "Plot 10 East Joydebpur vs West Joydebpur Road mixed at Valuka",
      },
      {
        left: row("Plot # 10, East Joydebpur", "BGMEA", "factory"),
        right: row("Plot # 10, West Joydebpur Road", "BKMEA", "factory"),
        keepRe: /East Joydebpur/i,
        otherRe: /West Joydebpur Road/i,
        otherName: "Plot 10 East Joydebpur vs West Joydebpur Road mixed no village",
      },
      {
        left: row("Plot # 10, Joydebpur East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Joydebpur West Road, Sonda", "BKMEA", "factory"),
        keepRe: /Joydebpur East/i,
        otherRe: /Joydebpur West Road/i,
        otherName: "Plot 10 Joydebpur East vs Joydebpur West Road mixed at Sonda",
      },
      {
        left: row("Plot # 10, East Joydebpur, Green, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, West Joydebpur Road, Green, Sonda", "BKMEA", "factory"),
        keepRe: /East Joydebpur/i,
        otherRe: /West Joydebpur Road/i,
        otherName: "Plot 10 leftover East Joydebpur vs West Joydebpur Road Green mixed",
      },
      {
        left: row("Plot # 10, Airport Road, East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road,\s*East/i,
        otherRe: /Airport Road,\s*West/i,
        otherName: "Plot 10 Airport Road, East vs West",
      },
      {
        left: row("Plot # 10, Airport Road, East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road,\s*East/i,
        otherRe: /Airport Road,\s*West/i,
        otherName: "Plot 10 Airport Road, East vs West at Sonda",
      },
      {
        left: row("Plot # 10, Airport Rd, East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Rd, West, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Rd,\s*East/i,
        otherRe: /Airport Rd,\s*West/i,
        otherName: "Plot 10 Airport Rd, East vs West",
      },
      {
        left: row("Plot # 10, Airport Road,East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road,West, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road,\s*East/i,
        otherRe: /Airport Road,\s*West/i,
        otherName: "Plot 10 Airport Road,East vs West no-space",
      },
      {
        left: row("Plot # 10, Mirpur Road, East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Mirpur Road, West, Sonda", "BKMEA", "factory"),
        keepRe: /Mirpur Road,\s*East/i,
        otherRe: /Mirpur Road,\s*West/i,
        otherName: "Plot 10 Mirpur Road, East vs West at Sonda",
      },
      {
        left: row("Plot # 10, Tejgaon Road, East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Tejgaon Road, West, Sonda", "BKMEA", "factory"),
        keepRe: /Tejgaon Road,\s*East/i,
        otherRe: /Tejgaon Road,\s*West/i,
        otherName: "Plot 10 Tejgaon Road, East vs West at Sonda",
      },
      {
        left: row("Plot # 10, Circular Road, East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Circular Road, West, Sonda", "BKMEA", "factory"),
        keepRe: /Circular Road,\s*East/i,
        otherRe: /Circular Road,\s*West/i,
        otherName: "Plot 10 Circular Road, East vs West at Sonda",
      },
      {
        left: row("Plot # 10, Joydebpur Road, East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Joydebpur Road, West, Sonda", "BKMEA", "factory"),
        keepRe: /Joydebpur Road,\s*East/i,
        otherRe: /Joydebpur Road,\s*West/i,
        otherName: "Plot 10 Joydebpur Road, East vs West at Sonda",
      },
      {
        left: row("Plot # 10, Green Road, East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Green Road, West, Sonda", "BKMEA", "factory"),
        keepRe: /Green Road,\s*East/i,
        otherRe: /Green Road,\s*West/i,
        otherName: "Plot 10 Green Road, East vs West at Sonda",
      },
      {
        left: row("Plot # 10, Airport Road, North, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, South, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road,\s*North/i,
        otherRe: /Airport Road,\s*South/i,
        otherName: "Plot 10 Airport Road, North vs South",
      },
      {
        left: row("Plot # 10, East, Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, West, Airport Road, Dhaka", "BKMEA", "factory"),
        keepRe: /East,\s*Airport Road/i,
        otherRe: /West,\s*Airport Road/i,
        otherName: "Plot 10 East, Airport Road vs West, Airport Road",
      },
      {
        left: row("Plot # 10, East, Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, West, Airport, Dhaka", "BKMEA", "factory"),
        keepRe: /East,\s*Airport/i,
        otherRe: /West,\s*Airport/i,
        otherName: "Plot 10 East, Airport vs West, Airport no-Road",
      },
      {
        left: row("Plot # 10, Sheikh Airport East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh Airpark West, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh Airport East/i,
        otherRe: /Shaikh Airpark West/i,
        otherName: "Plot 10 Sheikh Airport East vs Shaikh Airpark West no-Road",
      },
      {
        left: row("Plot # 10, Sheikh Airport East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh Airpark West, Sonda", "BKMEA", "factory"),
        keepRe: /Sheikh Airport East/i,
        otherRe: /Shaikh Airpark West/i,
        otherName: "Plot 10 Sheikh Airport East vs Shaikh Airpark West no-Road at Sonda",
      },
      {
        left: row("Plot # 10, Sheikh Airport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh Airpark West, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh Airport East Road/i,
        otherRe: /Shaikh Airpark West/i,
        otherName: "Plot 10 Sheikh Airport East Road vs Shaikh Airpark West no-Road mixed",
      },
      {
        left: row("Plot # 10, Sheikh Airport East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh Airpark West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh Airport East/i,
        otherRe: /Shaikh Airpark West Road/i,
        otherName: "Plot 10 Sheikh Airport East no-Road vs Shaikh Airpark West Road mixed",
      },
      {
        left: row("Plot # 10, North East Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, South East Airport, Dhaka", "BKMEA", "factory"),
        keepRe: /North East Airport/i,
        otherRe: /South East Airport/i,
        otherName: "Plot 10 North East Airport vs South East Airport no-Road",
      },
      {
        left: row("Plot # 10, North East Airport, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, South East Airport, Sonda", "BKMEA", "factory"),
        keepRe: /North East Airport/i,
        otherRe: /South East Airport/i,
        otherName: "Plot 10 North East Airport vs South East Airport no-Road at Sonda",
      },
      {
        left: row("Plot # 10, North East Airport", "BGMEA", "factory"),
        right: row("Plot # 10, South East Airport", "BKMEA", "factory"),
        keepRe: /North East Airport/i,
        otherRe: /South East Airport/i,
        otherName: "Plot 10 North East Airport vs South East Airport no-Road no village",
      },
      {
        left: row("Plot # 10, North-East Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, South-East Airport, Dhaka", "BKMEA", "factory"),
        keepRe: /North-East Airport/i,
        otherRe: /South-East Airport/i,
        otherName: "Plot 10 North-East vs South-East Airport hyphen",
      },
      {
        left: row("Plot # 10, North West Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, South West Airport, Dhaka", "BKMEA", "factory"),
        keepRe: /North West Airport/i,
        otherRe: /South West Airport/i,
        otherName: "Plot 10 North West Airport vs South West Airport no-Road",
      },
      {
        left: row("Plot # 10, North East Mirpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, South East Mirpur, Sonda", "BKMEA", "factory"),
        keepRe: /North East Mirpur/i,
        otherRe: /South East Mirpur/i,
        otherName: "Plot 10 North East Mirpur vs South East Mirpur",
      },
      {
        left: row("Plot # 10, Northeast Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Southeast Airport, Dhaka", "BKMEA", "factory"),
        keepRe: /Northeast Airport/i,
        otherRe: /Southeast Airport/i,
        otherName: "Plot 10 Northeast vs Southeast Airport oneword",
      },
      {
        left: row("Plot # 10, Airport Road, East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road,\s*East Joydebpur/i,
        otherRe: /Airport Road,\s*West Joydebpur/i,
        otherName: "Plot 10 Airport Road, East Joydebpur vs West Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, East Mirpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Mirpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road,\s*East Mirpur/i,
        otherRe: /Airport Road,\s*West Mirpur/i,
        otherName: "Plot 10 Airport Road, East Mirpur vs West Mirpur",
      },
      {
        left: row("Plot # 10, Airport Road, East Tejgaon, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Tejgaon, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road,\s*East Tejgaon/i,
        otherRe: /Airport Road,\s*West Tejgaon/i,
        otherName: "Plot 10 Airport Road, East Tejgaon vs West Tejgaon",
      },
      {
        left: row("Plot # 10, Sheikh Airport East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh Airport West, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh Airport East/i,
        otherRe: /Shaikh Airport West/i,
        otherName: "Plot 10 Sheikh Airport East vs Shaikh Airport West same stem",
      },
      {
        left: row("Plot # 10, Sheikh Airport East Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh Airport West Road, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh Airport East Road/i,
        otherRe: /Shaikh Airport West Road/i,
        otherName: "Plot 10 Sheikh Airport East Road vs Shaikh Airport West Road same stem",
      },
      {
        left: row("Plot # 10, Sheikh Airpark East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh Airpark West, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh Airpark East/i,
        otherRe: /Shaikh Airpark West/i,
        otherName: "Plot 10 Sheikh Airpark East vs Shaikh Airpark West",
      },
      {
        left: row("Plot # 10, Sheikh East Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh West Airpark, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh East Airport/i,
        otherRe: /Shaikh West Airpark/i,
        otherName: "Plot 10 Sheikh East Airport vs Shaikh West Airpark mid-compass",
      },
      {
        left: row("Plot # 10, East Sheikh Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, West Shaikh Airpark, Dhaka", "BKMEA", "factory"),
        keepRe: /East Sheikh Airport/i,
        otherRe: /West Shaikh Airpark/i,
        otherName: "Plot 10 East Sheikh Airport vs West Shaikh Airpark prefix",
      },
      {
        left: row("Plot # 10, Md Sheikh Airport East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Md Shaikh Airpark West, Dhaka", "BKMEA", "factory"),
        keepRe: /Md Sheikh Airport East/i,
        otherRe: /Md Shaikh Airpark West/i,
        otherName: "Plot 10 Md Sheikh Airport East vs Md Shaikh Airpark West",
      },
      {
        left: row("Plot # 10, Sheikh East Airport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh West Airpark, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh East Airport Road/i,
        otherRe: /Shaikh West Airpark/i,
        otherName: "Plot 10 Sheikh East Airport Road vs Shaikh West Airpark mixed",
      },
      {
        left: row("Plot # 10, Md. Airport East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West, Dhaka", "BKMEA", "factory"),
        keepRe: /Md\.\s*Airport East/i,
        otherRe: /Airpark West/i,
        otherName: "Plot 10 Md. Airport East vs Airpark West",
      },
      {
        left: row("Plot # 10, Md Airport East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West, Dhaka", "BKMEA", "factory"),
        keepRe: /Md Airport East/i,
        otherRe: /Airpark West/i,
        otherName: "Plot 10 Md Airport East vs Airpark West",
      },
      {
        left: row("Plot # 10, Dr. Airport East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airpark West, Dhaka", "BKMEA", "factory"),
        keepRe: /Dr\.\s*Airport East/i,
        otherRe: /Airpark West/i,
        otherName: "Plot 10 Dr. Airport East vs Airpark West",
      },
      {
        left: row("Plot # 10, Airport Road_East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road_West, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road_East/i,
        otherRe: /Airport Road_West/i,
        otherName: "Plot 10 Airport Road_East vs Road_West",
      },
      {
        left: row("Plot # 10, Airport Road_East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road_West, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road_East/i,
        otherRe: /Airport Road_West/i,
        otherName: "Plot 10 Airport Road_East vs Road_West at Sonda",
      },
      {
        left: row("Plot # 10, Airport Road_East", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road_West", "BKMEA", "factory"),
        keepRe: /Airport Road_East/i,
        otherRe: /Airport Road_West/i,
        otherName: "Plot 10 Airport Road_East vs Road_West no village",
      },
      {
        left: row("Plot # 10, Airport Rd_East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Rd_West, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Rd_East/i,
        otherRe: /Airport Rd_West/i,
        otherName: "Plot 10 Airport Rd_East vs Rd_West",
      },
      {
        left: row("Plot # 10, Mirpur Road_East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Mirpur Road_West, Sonda", "BKMEA", "factory"),
        keepRe: /Mirpur Road_East/i,
        otherRe: /Mirpur Road_West/i,
        otherName: "Plot 10 Mirpur Road_East vs Road_West",
      },
      {
        left: row("Plot # 10, Joydebpur Road_East, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Joydebpur Road_West, Sonda", "BKMEA", "factory"),
        keepRe: /Joydebpur Road_East/i,
        otherRe: /Joydebpur Road_West/i,
        otherName: "Plot 10 Joydebpur Road_East vs Road_West",
      },
      {
        left: row("Plot # 10, Airport Road East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road West Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road East Joydebpur/i,
        otherRe: /Airport Road West Joydebpur/i,
        otherName: "Plot 10 Airport Road East Joydebpur vs West same-field",
      },
      {
        left: row("Plot # 10, Airport Road East Joydebpur, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road West Joydebpur, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road East Joydebpur/i,
        otherRe: /Airport Road West Joydebpur/i,
        otherName: "Plot 10 Airport Road East Joydebpur vs West at Dhaka",
      },
      {
        left: row("Plot # 10, Airport Road East Joydebpur", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road West Joydebpur", "BKMEA", "factory"),
        keepRe: /Airport Road East Joydebpur/i,
        otherRe: /Airport Road West Joydebpur/i,
        otherName: "Plot 10 Airport Road East Joydebpur vs West no village",
      },
      {
        left: row("Plot # 10, Airport Road East Mirpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road West Mirpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road East Mirpur/i,
        otherRe: /Airport Road West Mirpur/i,
        otherName: "Plot 10 Airport Road East Mirpur vs West same-field",
      },
      {
        left: row("Plot # 10, Airport Road_East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road_West Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road_East Joydebpur/i,
        otherRe: /Airport Road_West Joydebpur/i,
        otherName: "Plot 10 Airport Road_East Joydebpur vs Road_West leftover",
      },
      {
        left: row("Plot # 10, Airport Road_East Joydebpur, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road_West Joydebpur, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Road_East Joydebpur/i,
        otherRe: /Airport Road_West Joydebpur/i,
        otherName: "Plot 10 Airport Road_East Joydebpur vs Road_West at Dhaka",
      },
      {
        left: row("Plot # 10, Airport Road_East Mirpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road_West Mirpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road_East Mirpur/i,
        otherRe: /Airport Road_West Mirpur/i,
        otherName: "Plot 10 Airport Road_East Mirpur leftover",
      },
      {
        left: row("Plot # 10, Airport Rd East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Rd West Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Rd East Joydebpur/i,
        otherRe: /Airport Rd West Joydebpur/i,
        otherName: "Plot 10 Airport Rd East Joydebpur vs West same-field",
      },
      {
        left: row("Plot # 10, Mirpur Road East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Mirpur Road West Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Mirpur Road East Joydebpur/i,
        otherRe: /Mirpur Road West Joydebpur/i,
        otherName: "Plot 10 Mirpur Road East Joydebpur vs West same-field",
      },
      {
        left: row("Plot # 10, Airport Road, Sheikh East Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Shaikh West Airpark, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh East Airport/i,
        otherRe: /Shaikh West Airpark/i,
        otherName: "Plot 10 leftover Sheikh East Airport vs Shaikh West Airpark",
      },
      {
        left: row("Plot # 10, Airport Road, Sheikh East Airport, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Shaikh West Airpark, Sonda", "BKMEA", "factory"),
        keepRe: /Sheikh East Airport/i,
        otherRe: /Shaikh West Airpark/i,
        otherName: "Plot 10 leftover Sheikh East Airport vs Shaikh West Airpark at Sonda",
      },
      {
        left: row("Plot # 10, Airport Road, East Sheikh Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Shaikh Airpark, Dhaka", "BKMEA", "factory"),
        keepRe: /East Sheikh Airport/i,
        otherRe: /West Shaikh Airpark/i,
        otherName: "Plot 10 leftover East Sheikh Airport vs West Shaikh Airpark",
      },
      {
        left: row("Plot # 10, Airport Road, Sheikh East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Shaikh West Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Sheikh East Joydebpur/i,
        otherRe: /Shaikh West Joydebpur/i,
        otherName: "Plot 10 leftover Sheikh East Joydebpur vs Shaikh West Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, Md East Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Dr West Airpark, Dhaka", "BKMEA", "factory"),
        keepRe: /Md East Airport/i,
        otherRe: /Dr West Airpark/i,
        otherName: "Plot 10 leftover Md East Airport vs Dr West Airpark",
      },
      {
        left: row("Plot # 10, Airport Road, Doctor East Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Docter West Airpark, Dhaka", "BKMEA", "factory"),
        keepRe: /Doctor East Airport/i,
        otherRe: /Docter West Airpark/i,
        otherName: "Plot 10 leftover Doctor East Airport vs Docter West Airpark",
      },
      {
        left: row("Plot # 10, Airport Road, EastJoydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /EastJoydebpur|Eastjoydebpur/i,
        otherRe: /West Joydebpur/i,
        otherName: "Plot 10 leftover EastJoydebpur glued vs West Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, EastAirport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, WestAirport, Dhaka", "BKMEA", "factory"),
        keepRe: /EastAirport|Eastairport/i,
        otherRe: /WestAirport|Westairport/i,
        otherName: "Plot 10 leftover EastAirport vs WestAirport both-glued",
      },
      {
        left: row("Plot # 10, Airport Road, EastMirpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Mirpur, Sonda", "BKMEA", "factory"),
        keepRe: /EastMirpur|Eastmirpur/i,
        otherRe: /West Mirpur/i,
        otherName: "Plot 10 leftover EastMirpur glued vs West Mirpur",
      },
      {
        left: row("Plot # 10, Airport Road, East Mirpur Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Mirpur Road, Sonda", "BKMEA", "factory"),
        keepRe: /East Mirpur Road/i,
        otherRe: /West Mirpur Road/i,
        otherName: "Plot 10 leftover East Mirpur Road vs West Mirpur Road restated",
      },
      {
        left: row("Plot # 10, Airport Road, East Joydebpur Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Joydebpur Road, Sonda", "BKMEA", "factory"),
        keepRe: /East Joydebpur Road/i,
        otherRe: /West Joydebpur Road/i,
        otherName: "Plot 10 leftover East Joydebpur Road vs West Joydebpur Road restated",
      },
      {
        left: row("Plot # 10, Airport Road, East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Joydebpur Road, Sonda", "BKMEA", "factory"),
        keepRe: /East Joydebpur/i,
        otherRe: /West Joydebpur Road/i,
        otherName: "Plot 10 leftover East Joydebpur vs West Joydebpur Road mixed restated",
      },
      {
        left: row("Plot # 10, Airport Road Sheikh East Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road Shaikh West Airpark, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh East Airport/i,
        otherRe: /Shaikh West Airpark/i,
        otherName: "Plot 10 same-field leftover Sheikh East Airport no comma",
      },
      {
        left: row("Plot # 10, Airport Road, Airport Sheikh East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Airpark Shaikh West Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Sheikh East Joydebpur/i,
        otherRe: /Airpark Shaikh West Joydebpur/i,
        otherName: "Plot 10 leftover honorific-after-stem Airport Sheikh East Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, Airport Sheikh East Joydebpur, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Airpark Shaikh West Joydebpur, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Sheikh East Joydebpur/i,
        otherRe: /Airpark Shaikh West Joydebpur/i,
        otherName: "Plot 10 leftover honorific-after-stem Joydebpur at Dhaka",
      },
      {
        left: row("Plot # 10, Airport Road, Airport Sheikh East Circular, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Airpark Shaikh West Circular, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Sheikh East Circular/i,
        otherRe: /Airpark Shaikh West Circular/i,
        otherName: "Plot 10 leftover honorific-after-stem Airport Sheikh East Circular",
      },
      {
        left: row("Plot # 10, Airport Road, Airport Sheikh East Circular, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Airpark Shaikh West Circular, Dhaka", "BKMEA", "factory"),
        keepRe: /Airport Sheikh East Circular/i,
        otherRe: /Airpark Shaikh West Circular/i,
        otherName: "Plot 10 leftover honorific-after-stem Circular at Dhaka",
      },
      {
        left: row("Plot # 10, Airport Road, East Airport Circular, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Airpark Circular, Sonda", "BKMEA", "factory"),
        keepRe: /East Airport Circular/i,
        otherRe: /West Airpark Circular/i,
        otherName: "Plot 10 leftover East Airport Circular vs West Airpark Circular",
      },
      {
        left: row("Plot # 10, Airport Road, Airport East Circular, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Airpark West Circular, Sonda", "BKMEA", "factory"),
        keepRe: /Airport East Circular/i,
        otherRe: /Airpark West Circular/i,
        otherName: "Plot 10 leftover Airport East Circular vs Airpark West Circular",
      },
      {
        left: row("Plot # 10, Airport Road, Airport Circular, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Airpark Circular, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Circular/i,
        otherRe: /Airpark Circular/i,
        otherName: "Plot 10 leftover Airport Circular vs Airpark Circular no compass",
      },
      {
        left: row("Plot # 10, Airport Road, Northeast Airport Circular, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Southeast Airpark Circular, Sonda", "BKMEA", "factory"),
        keepRe: /Northeast Airport Circular/i,
        otherRe: /Southeast Airpark Circular/i,
        otherName: "Plot 10 leftover Northeast Airport Circular vs Southeast Airpark Circular",
      },
      {
        left: row("Plot # 10, Airport Road, East Airport Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Airport Joydevpur, Sonda", "BKMEA", "factory"),
        keepRe: /East Airport Joydebpur/i,
        otherRe: /West Airport Joydevpur/i,
        otherName: "Plot 10 leftover East Airport Joydebpur vs West Airport Joydevpur",
      },
      {
        left: row("Plot # 10, Airport Road, East Mirpur Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Mirpur Joydevpur, Sonda", "BKMEA", "factory"),
        keepRe: /East Mirpur Joydebpur/i,
        otherRe: /West Mirpur Joydevpur/i,
        otherName: "Plot 10 leftover East Mirpur Joydebpur vs West Mirpur Joydevpur",
      },
      {
        left: row("Plot # 10, Airport Road, Airport Sheikh East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Airport Shaikh West Joydevpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Sheikh East Joydebpur/i,
        otherRe: /Airport Shaikh West Joydevpur/i,
        otherName: "Plot 10 leftover Airport Sheikh East Joydebpur vs Airport Shaikh West Joydevpur",
      },
      {
        left: row("Plot # 10, Airport Road, AirportCircular, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, AirparkCircular, Sonda", "BKMEA", "factory"),
        keepRe: /Airportcircular/i,
        otherRe: /Airparkcircular/i,
        otherName: "Plot 10 leftover one-token AirportCircular vs AirparkCircular",
      },
      {
        left: row("Plot # 10, Airport Court, Airport Sheikh East Circular, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Court, Airpark Shaikh West Circular, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Sheikh East Circular/i,
        otherRe: /Airpark Shaikh West Circular/i,
        otherName: "Plot 10 leftover honorific-after-stem Circular after Airport Court",
      },
      {
        left: row("Plot # 10, Airport Road, Airport Hajee East Circular, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Airpark Hajee West Circular, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Hajee East Circular/i,
        otherRe: /Airpark Hajee West Circular/i,
        otherName: "Plot 10 leftover Hajee East Circular vs Hajee West Circular",
      },
      {
        left: row("Airport Road, Airport Sheikh East Circular, Sonda", "BGMEA", "factory"),
        right: row("Airport Road, Airpark Shaikh West Circular, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Sheikh East Circular/i,
        otherRe: /Airpark Shaikh West Circular/i,
        otherName: "leftover honorific-after-stem Circular with Plot omitted",
      },
      {
        left: row("House 10, East Airport Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("House 10, West Airport Joydevpur, Sonda", "BKMEA", "factory"),
        keepRe: /East Airport Joydebpur/i,
        otherRe: /West Airport Joydevpur/i,
        otherName: "House 10 leftover East Airport Joydebpur vs West Airport Joydevpur",
      },
      {
        left: row("Airport Road, East Airport Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Airport Road, West Airport Joydevpur, Sonda", "BKMEA", "factory"),
        keepRe: /East Airport Joydebpur/i,
        otherRe: /West Airport Joydevpur/i,
        otherName: "leftover East Airport Joydebpur vs West Airport Joydevpur Plot omitted",
      },
      {
        left: row("Plot # 10, Airport Road, East Station Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Station Joydevpur, Sonda", "BKMEA", "factory"),
        keepRe: /East Station Joydebpur/i,
        otherRe: /West Station Joydevpur/i,
        otherName: "Plot 10 leftover East Station Joydebpur vs West Station Joydevpur",
      },
      {
        left: row("Plot # 10, Circular Road, Airport, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Circular Road, Airpark, Sonda", "BKMEA", "factory"),
        keepRe: /Circular Road, Airport/i,
        otherRe: /Circular Road, Airpark/i,
        otherName: "Plot 10 leftover Circular Road Airport vs Airpark",
      },
      {
        left: row("Circular Road, Airport, Sonda", "BGMEA", "factory"),
        right: row("Circular Road, Airpark, Sonda", "BKMEA", "factory"),
        keepRe: /Circular Road, Airport/i,
        otherRe: /Circular Road, Airpark/i,
        otherName: "leftover Circular Road Airport vs Airpark Plot omitted",
      },
      {
        left: row("Plot # 10, Airport Road, East Airport Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Airport Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /East Airport Joydebpur/i,
        otherRe: /West Airport Joydebpur/i,
        otherName: "Plot 10 leftover East Airport Joydebpur vs West Airport Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, Joydebpur East Airport, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Joydebpur West Airpark, Sonda", "BKMEA", "factory"),
        keepRe: /Joydebpur East Airport/i,
        otherRe: /Joydebpur West Airpark/i,
        otherName: "Plot 10 leftover Joydebpur East Airport vs Joydebpur West Airpark",
      },
      {
        left: row("Plot # 10, Airport Road, Sheikh East Joydebpur Airport, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Shaikh West Joydebpur Airpark, Sonda", "BKMEA", "factory"),
        keepRe: /Sheikh East Joydebpur Airport/i,
        otherRe: /Shaikh West Joydebpur Airpark/i,
        otherName: "Plot 10 leftover Sheikh East Joydebpur Airport vs Shaikh West Joydebpur Airpark",
      },
      {
        left: row("Plot # 10, Airport Road, East Mirpur Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Mirpur Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /East Mirpur Joydebpur/i,
        otherRe: /West Mirpur Joydebpur/i,
        otherName: "Plot 10 leftover East Mirpur Joydebpur vs West Mirpur Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, East Green Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Green Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /East Green Joydebpur/i,
        otherRe: /West Green Joydebpur/i,
        otherName: "Plot 10 leftover East Green Joydebpur vs West Green Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, North East Airport Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, South East Airport Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /North East Airport Joydebpur/i,
        otherRe: /South East Airport Joydebpur/i,
        otherName: "Plot 10 leftover spaced North East Airport Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, Northeast Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Southeast Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Northeast Joydebpur/i,
        otherRe: /Southeast Joydebpur/i,
        otherName: "Plot 10 leftover Northeast Joydebpur vs Southeast Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, Northeast Joydebpur, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Southeast Joydebpur, Dhaka", "BKMEA", "factory"),
        keepRe: /Northeast Joydebpur/i,
        otherRe: /Southeast Joydebpur/i,
        otherName: "Plot 10 leftover Northeast Joydebpur vs Southeast at Dhaka",
      },
      {
        left: row("Plot # 10, Airport Road, Northeast Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Southeast Airport, Dhaka", "BKMEA", "factory"),
        keepRe: /Northeast Airport/i,
        otherRe: /Southeast Airport/i,
        otherName: "Plot 10 leftover Northeast Airport vs Southeast Airport",
      },
      {
        left: row("Plot # 10, Airport Road, Northeast Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Southeast Airpark, Dhaka", "BKMEA", "factory"),
        keepRe: /Northeast Airport/i,
        otherRe: /Southeast Airpark/i,
        otherName: "Plot 10 leftover Northeast Airport vs Southeast Airpark",
      },
      {
        left: row("Plot # 10, Airport Road, Northeast Mirpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Southeast Mirpur, Sonda", "BKMEA", "factory"),
        keepRe: /Northeast Mirpur/i,
        otherRe: /Southeast Mirpur/i,
        otherName: "Plot 10 leftover Northeast Mirpur vs Southeast Mirpur",
      },
      {
        left: row("Plot # 10, Airport Road, Northwest Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Southwest Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Northwest Joydebpur/i,
        otherRe: /Southwest Joydebpur/i,
        otherName: "Plot 10 leftover Northwest Joydebpur vs Southwest Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road Northeast Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road Southeast Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road Northeast Joydebpur/i,
        otherRe: /Airport Road Southeast Joydebpur/i,
        otherName: "Plot 10 same-field Airport Road Northeast Joydebpur vs Southeast",
      },
      {
        left: row("Plot # 10, Airport Road_Northeast Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road_Southeast Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Airport Road_Northeast Joydebpur/i,
        otherRe: /Airport Road_Southeast Joydebpur/i,
        otherName: "Plot 10 Airport Road_Northeast Joydebpur vs Road_Southeast leftover",
      },
      {
        left: row("Plot # 10, Airport Road, Northeast Mirpur Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Southeast Mirpur Road, Sonda", "BKMEA", "factory"),
        keepRe: /Northeast Mirpur Road/i,
        otherRe: /Southeast Mirpur Road/i,
        otherName: "Plot 10 leftover restated Northeast Mirpur Road vs Southeast",
      },
      {
        left: row("Plot # 10, Airport Road, Sheikh Northeast Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Shaikh Southeast Airpark, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh Northeast Airport/i,
        otherRe: /Shaikh Southeast Airpark/i,
        otherName: "Plot 10 leftover Sheikh Northeast Airport vs Shaikh Southeast Airpark",
      },
      {
        left: row("Plot # 10, Airport Road, New Northeast Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Old Southeast Airport, Dhaka", "BKMEA", "factory"),
        keepRe: /New Northeast Airport/i,
        otherRe: /Old Southeast Airport/i,
        otherName: "Plot 10 leftover New Northeast Airport vs Old Southeast Airport",
      },
      {
        left: row("Plot # 10, Airport Road, Inner Northeast Airport, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Outer Southeast Airport, Dhaka", "BKMEA", "factory"),
        keepRe: /Inner Northeast Airport/i,
        otherRe: /Outer Southeast Airport/i,
        otherName: "Plot 10 leftover Inner Northeast vs Outer Southeast Airport",
      },
      {
        left: row("Plot # 10, Airport Road, Northeast Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, West Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Northeast Joydebpur/i,
        otherRe: /West Joydebpur/i,
        otherName: "Plot 10 leftover Northeast Joydebpur vs West Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, North East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, Southeast Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /North East Joydebpur/i,
        otherRe: /Southeast Joydebpur/i,
        otherName: "Plot 10 leftover spaced North East Joydebpur vs oneword Southeast",
      },
      {
        left: row("Plot # 10, Airport Road, Northeast Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, South East Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /Northeast Joydebpur/i,
        otherRe: /South East Joydebpur/i,
        otherName: "Plot 10 leftover Northeast Joydebpur vs spaced South East Joydebpur",
      },
      {
        left: row("Plot # 10, Airport Road, North East Joydebpur, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, Airport Road, South East Joydebpur, Sonda", "BKMEA", "factory"),
        keepRe: /North East Joydebpur/i,
        otherRe: /South East Joydebpur/i,
        otherName: "Plot 10 leftover spaced North East Joydebpur vs South East Joydebpur",
      },
      {
        left: row("Plot # 10, Sheikh_Airport East, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh_Airpark West, Dhaka", "BKMEA", "factory"),
        keepRe: /Sheikh_Airport East/i,
        otherRe: /Shaikh_Airpark West/i,
        otherName: "Plot 10 Sheikh_Airport East vs Shaikh_Airpark West",
      },
      {
        left: row("Plot # 10, ShahidAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shahed Airpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /ShahidAirport|Shahidairport/i,
        otherRe: /Shahed Airpark/i,
        otherName: "Plot 10 ShahidAirport glued vs Shahed Airpark spaced",
      },
      {
        left: row("Plot # 10, SheikhAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, Shaikh Airpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /SheikhAirport|Sheikhairport/i,
        otherRe: /Shaikh Airpark/i,
        otherName: "Plot 10 SheikhAirport glued vs Shaikh Airpark spaced",
      },
      {
        left: row("Plot # 10, NewShahidAirport Road, Dhaka", "BGMEA", "factory"),
        right: row("Plot # 10, OldShahedAirpark Road, Dhaka", "BKMEA", "factory"),
        keepRe: /NewShahidAirport|Newshahidairport/i,
        otherRe: /OldShahedAirpark|Oldshahedairpark/i,
        otherName: "Plot 10 NewShahidAirport vs OldShahedAirpark",
      },
      {
        left: row("Plot # 10, NewBabaAirport Road, Sonda", "BGMEA", "factory"),
        right: row("Plot # 10, OldBabuAirpark Road, Sonda", "BKMEA", "factory"),
        keepRe: /NewBabaAirport|Newbabaairport/i,
        otherRe: /OldBabuAirpark|Oldbabuairpark/i,
        otherName: "Plot 10 NewBabaAirport vs OldBabuAirpark at Sonda",
      },
      {
        left: row("Plot # 23-24, Dogri-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Dogri-Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Dogri-Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Faridabad-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Faridabad-Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Faridabad-Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Chandona-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Chandona-Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Chandona-Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Chandora-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Chandora-Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Chandora-Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Chandra-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Chandra-Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Chandra-Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Sreepur-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Sreepur-Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Sreepur-Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Tetultola-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Tetultola-Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Tetultola-Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Dogri/Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Dogri\/Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Dogri/Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Dogri_Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Dogri_Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Dogri_Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Dogri.Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Dogri\.Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Dogri.Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Dogri. Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Dogri\.\s*Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Dogri. Union vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Dogri-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village of Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Dogri-Union/i,
        otherRe: /Village of Hemayetpur/i,
        otherName: "Dogri-Union vs Village of Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Dogri-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, The Village of Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Dogri-Union/i,
        otherRe: /The Village of Hemayetpur/i,
        otherName: "Dogri-Union vs The Village of Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Faridabad Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village of Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Faridabad Union/i,
        otherRe: /Village of Hemayetpur/i,
        otherName: "Faridabad Union vs Village of Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Union, Tetultola, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Tetultola/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Union comma Tetultola vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Tetultola Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Tetultola Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Tetultola Union title-after vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Chandra Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Chandra Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Chandra Union title-after vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Chandora Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Chandora Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Chandora Union title-after vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Sreepur Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Sreepur Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Sreepur Union title-after vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Nawabganj Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Nawabganj Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Nawabganj Union title-after vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Kaliakoir Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Kaliakoir Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Kaliakoir Union title-after vs Village Hemayetpur",
      },
      {
        left: row("Plot # 23-24, Dhamrai Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
        right: row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        keepRe: /Dhamrai Union/i,
        otherRe: /Village,\s*Hemayetpur/i,
        otherName: "Dhamrai Union title-after vs Village Hemayetpur",
      },
    ];
    for (const c of cases) {
      assertSplitAddressRowHtml(c.left, c.right, c.keepRe, c.otherRe, c.otherName);
    }
  });

  it("keeps concatenated BabuAirpark out of Also recorded as of BabaAirport with Green as its own row", () => {
    const baba = row("Plot # 10, BabaAirport Road, Dhaka", "BGMEA", "factory");
    const babu = row("Plot # 10, BabuAirpark Road, Dhaka", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [baba, babu, green],
      [baba, green, babu],
      [babu, baba, green],
      [babu, green, baba],
      [green, baba, babu],
      [green, babu, baba],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 3);
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/BabaAirport|Babaairport/i.test(disp)) {
          assert.equal(also.length, 0, "Babuairpark must not sit in Also of Babaairport");
          assert.ok(!/BabuAirpark|Babuairpark/i.test(alsoText));
        }
        if (/BabuAirpark|Babuairpark/i.test(disp)) {
          assert.ok(!/BabaAirport|Babaairport/i.test(alsoText));
        }
      }
    }
  });

  it("keeps mixed BabaAirport glued and Babu Airpark spaced as two rows with Green as its own row", () => {
    const baba = row("Plot # 10, BabaAirport Road, Dhaka", "BGMEA", "factory");
    const babu = row("Plot # 10, Babu Airpark Road, Dhaka", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [baba, babu, green],
      [baba, green, babu],
      [babu, baba, green],
      [babu, green, baba],
      [green, baba, babu],
      [green, babu, baba],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 3);
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/BabaAirport|Babaairport/i.test(disp)) {
          assert.ok(!/Babu Airpark|Babuairpark/i.test(alsoText));
        }
        if (/Babu Airpark/i.test(disp)) {
          assert.ok(!/BabaAirport|Babaairport/i.test(alsoText));
        }
      }
    }
  });

  it("keeps Airpark West out of Also recorded as of Airport East with Green as its own row", () => {
    const airport = row("Plot # 10, Airport East Road, Dhaka", "BGMEA", "factory");
    const airpark = row("Plot # 10, Airpark West Road, Dhaka", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [airport, airpark, green],
      [airport, green, airpark],
      [airpark, airport, green],
      [airpark, green, airport],
      [green, airport, airpark],
      [green, airpark, airport],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 3);
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport East/i.test(disp)) {
          assert.ok(!/Airpark West/i.test(alsoText));
        }
        if (/Airpark West/i.test(disp)) {
          assert.ok(!/Airport East/i.test(alsoText));
        }
      }
    }
  });

  it("keeps mixed no-Road Airport East out of Also recorded as of Airpark West Road with Green as its own row", () => {
    const airport = row("Plot # 10, Airport East, Dhaka", "BGMEA", "factory");
    const airpark = row("Plot # 10, Airpark West Road, Dhaka", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [airport, airpark, green],
      [airport, green, airpark],
      [airpark, airport, green],
      [airpark, green, airport],
      [green, airport, airpark],
      [green, airpark, airport],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 3, "mixed Airport East no-Road+Airpark West Road+Green matcher");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport East/i.test(disp) && !/Airpark West/i.test(disp)) {
          assert.ok(!/Airpark West/i.test(alsoText), "Airpark West must not sit in Also of Airport East");
        }
        if (/Airpark West/i.test(disp)) {
          assert.ok(!/Airport East/i.test(alsoText), "Airport East must not sit in Also of Airpark West");
        }
      }
    }
  });

  it("keeps East Joydebpur out of Also recorded as of West Joydebpur Road with Green as its own row", () => {
    const east = row("Plot # 10, East Joydebpur, Sonda", "BGMEA", "factory");
    const west = row("Plot # 10, West Joydebpur Road, Sonda", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Sonda", "OEKO_TEX", "factory");
    const perms = [
      [east, west, green],
      [east, green, west],
      [west, east, green],
      [west, green, east],
      [green, east, west],
      [green, west, east],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "East Joydebpur+West Joydebpur Road+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/East Joydebpur/i.test(disp) && !/West Joydebpur/i.test(disp)) {
          assert.ok(!/West Joydebpur/i.test(alsoText), "West Joydebpur must not sit in Also of East Joydebpur");
        }
        if (/West Joydebpur/i.test(disp)) {
          assert.ok(!/East Joydebpur/i.test(alsoText), "East Joydebpur must not sit in Also of West Joydebpur");
        }
      }
    }
  });

  it("keeps Airport Road, East out of Also recorded as of Airport Road, West with Green as its own row", () => {
    const east = row("Plot # 10, Airport Road, East, Dhaka", "BGMEA", "factory");
    const west = row("Plot # 10, Airport Road, West, Dhaka", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [east, west, green],
      [east, green, west],
      [west, east, green],
      [west, green, east],
      [green, east, west],
      [green, west, east],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "Airport Road, East+West+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport Road,\s*East/i.test(disp) && !/Airport Road,\s*West/i.test(disp)) {
          assert.ok(!/Airport Road,\s*West/i.test(alsoText), "Airport Road, West must not sit in Also of East");
        }
        if (/Airport Road,\s*West/i.test(disp)) {
          assert.ok(!/Airport Road,\s*East/i.test(alsoText), "Airport Road, East must not sit in Also of West");
        }
      }
    }
  });

  it("keeps South East Airport out of Also recorded as of North East Airport with Green as its own row", () => {
    const north = row("Plot # 10, North East Airport, Dhaka", "BGMEA", "factory");
    const south = row("Plot # 10, South East Airport, Dhaka", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [north, south, green],
      [north, green, south],
      [south, north, green],
      [south, green, north],
      [green, north, south],
      [green, south, north],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "North East+South East Airport+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/North East Airport/i.test(disp) && !/South East Airport/i.test(disp)) {
          assert.ok(!/South East Airport/i.test(alsoText), "South East must not sit in Also of North East");
        }
        if (/South East Airport/i.test(disp)) {
          assert.ok(!/North East Airport/i.test(alsoText), "North East must not sit in Also of South East");
        }
      }
    }
  });

  it("keeps Shaikh West Airpark out of Also recorded as of Sheikh East Airport with Green as its own row", () => {
    const sheikh = row("Plot # 10, Sheikh East Airport, Dhaka", "BGMEA", "factory");
    const shaikh = row("Plot # 10, Shaikh West Airpark, Dhaka", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [sheikh, shaikh, green],
      [sheikh, green, shaikh],
      [shaikh, sheikh, green],
      [shaikh, green, sheikh],
      [green, sheikh, shaikh],
      [green, shaikh, sheikh],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "Sheikh East Airport+Shaikh West Airpark+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Sheikh East Airport/i.test(disp) && !/Shaikh West Airpark/i.test(disp)) {
          assert.ok(!/Shaikh West Airpark/i.test(alsoText), "Airpark must not sit in Also of Airport");
        }
        if (/Shaikh West Airpark/i.test(disp)) {
          assert.ok(!/Sheikh East Airport/i.test(alsoText), "Airport must not sit in Also of Airpark");
        }
      }
    }
  });

  it("keeps Airport Road_West out of Also recorded as of Airport Road_East with Green as its own row", () => {
    const east = row("Plot # 10, Airport Road_East, Dhaka", "BGMEA", "factory");
    const west = row("Plot # 10, Airport Road_West, Dhaka", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [east, west, green],
      [east, green, west],
      [west, east, green],
      [west, green, east],
      [green, east, west],
      [green, west, east],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "Airport Road_East+West+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport Road_East/i.test(disp) && !/Airport Road_West/i.test(disp)) {
          assert.ok(!/Airport Road_West/i.test(alsoText), "Road_West must not sit in Also of Road_East");
        }
        if (/Airport Road_West/i.test(disp)) {
          assert.ok(!/Airport Road_East/i.test(alsoText), "Road_East must not sit in Also of Road_West");
        }
      }
    }
  });

  it("keeps Airport Road East Joydebpur out of Also recorded as of West with Green as its own row", () => {
    const east = row("Plot # 10, Airport Road East Joydebpur, Sonda", "BGMEA", "factory");
    const west = row("Plot # 10, Airport Road West Joydebpur, Sonda", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [east, west, green],
      [east, green, west],
      [west, east, green],
      [west, green, east],
      [green, east, west],
      [green, west, east],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "Airport Road East Joydebpur+West+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport Road East Joydebpur/i.test(disp) && !/Airport Road West Joydebpur/i.test(disp)) {
          assert.ok(
            !/Airport Road West Joydebpur/i.test(alsoText),
            "West Joydebpur must not sit in Also of East Joydebpur",
          );
        }
        if (/Airport Road West Joydebpur/i.test(disp)) {
          assert.ok(
            !/Airport Road East Joydebpur/i.test(alsoText),
            "East Joydebpur must not sit in Also of West Joydebpur",
          );
        }
      }
    }
  });

  it("keeps Airport Road_West Joydebpur out of Also recorded as of Road_East Joydebpur with Green as its own row", () => {
    const east = row("Plot # 10, Airport Road_East Joydebpur, Sonda", "BGMEA", "factory");
    const west = row("Plot # 10, Airport Road_West Joydebpur, Sonda", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [east, west, green],
      [east, green, west],
      [west, east, green],
      [west, green, east],
      [green, east, west],
      [green, west, east],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "Airport Road_East Joydebpur+West+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport Road_East Joydebpur/i.test(disp) && !/Airport Road_West Joydebpur/i.test(disp)) {
          assert.ok(
            !/Airport Road_West Joydebpur/i.test(alsoText),
            "Road_West Joydebpur must not sit in Also of Road_East Joydebpur",
          );
        }
        if (/Airport Road_West Joydebpur/i.test(disp)) {
          assert.ok(
            !/Airport Road_East Joydebpur/i.test(alsoText),
            "Road_East Joydebpur must not sit in Also of Road_West Joydebpur",
          );
        }
      }
    }
  });

  it("keeps leftover Shaikh West Airpark out of Also recorded as of Sheikh East Airport with Green as its own row", () => {
    const sheikh = row("Plot # 10, Airport Road, Sheikh East Airport, Dhaka", "BGMEA", "factory");
    const shaikh = row("Plot # 10, Airport Road, Shaikh West Airpark, Dhaka", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [sheikh, shaikh, green],
      [sheikh, green, shaikh],
      [shaikh, sheikh, green],
      [shaikh, green, sheikh],
      [green, sheikh, shaikh],
      [green, shaikh, sheikh],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "leftover Sheikh East Airport+Shaikh West Airpark+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Sheikh East Airport/i.test(disp) && !/Shaikh West Airpark/i.test(disp)) {
          assert.ok(!/Shaikh West Airpark/i.test(alsoText), "Airpark must not sit in Also of leftover Airport");
        }
        if (/Shaikh West Airpark/i.test(disp)) {
          assert.ok(!/Sheikh East Airport/i.test(alsoText), "Airport must not sit in Also of leftover Airpark");
        }
      }
    }
  });

  it("keeps leftover West Joydebpur out of Also recorded as of EastJoydebpur with Green as its own row", () => {
    const east = row("Plot # 10, Airport Road, EastJoydebpur, Sonda", "BGMEA", "factory");
    const west = row("Plot # 10, Airport Road, West Joydebpur, Sonda", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [east, west, green],
      [east, green, west],
      [west, east, green],
      [west, green, east],
      [green, east, west],
      [green, west, east],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "leftover EastJoydebpur+West Joydebpur+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/EastJoydebpur|Eastjoydebpur/i.test(disp) && !/West Joydebpur/i.test(disp)) {
          assert.ok(!/West Joydebpur/i.test(alsoText), "West Joydebpur must not sit in Also of EastJoydebpur");
        }
        if (/West Joydebpur/i.test(disp) && !/EastJoydebpur|Eastjoydebpur/i.test(disp)) {
          assert.ok(
            !/EastJoydebpur|Eastjoydebpur/i.test(alsoText),
            "EastJoydebpur must not sit in Also of West Joydebpur",
          );
        }
      }
    }
  });

  it("keeps leftover Airpark Shaikh West Joydebpur out of Also of Airport Sheikh East Joydebpur", () => {
    const east = row(
      "Plot # 10, Airport Road, Airport Sheikh East Joydebpur, Sonda",
      "BGMEA",
      "factory",
    );
    const west = row(
      "Plot # 10, Airport Road, Airpark Shaikh West Joydebpur, Sonda",
      "BKMEA",
      "factory",
    );
    for (const ordered of [
      [east, west],
      [west, east],
    ]) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        2,
        "leftover honorific-after-stem Joydebpur matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport Sheikh East Joydebpur/i.test(disp) && !/Airpark Shaikh West Joydebpur/i.test(disp)) {
          assert.ok(
            !/Airpark Shaikh West Joydebpur/i.test(alsoText),
            "Airpark must not sit in Also of leftover Airport Sheikh East Joydebpur",
          );
        }
        if (/Airpark Shaikh West Joydebpur/i.test(disp)) {
          assert.ok(
            !/Airport Sheikh East Joydebpur/i.test(alsoText),
            "Airport must not sit in Also of leftover Airpark Shaikh West Joydebpur",
          );
        }
      }
    }
  });

  it("keeps leftover Southeast Joydebpur out of Also of Northeast Joydebpur", () => {
    const north = row("Plot # 10, Airport Road, Northeast Joydebpur, Sonda", "BGMEA", "factory");
    const south = row("Plot # 10, Airport Road, Southeast Joydebpur, Sonda", "BKMEA", "factory");
    for (const ordered of [
      [north, south],
      [south, north],
    ]) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 2, "leftover Northeast vs Southeast Joydebpur matcher");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Northeast Joydebpur/i.test(disp) && !/Southeast Joydebpur/i.test(disp)) {
          assert.ok(
            !/Southeast Joydebpur/i.test(alsoText),
            "Southeast must not sit in Also of leftover Northeast Joydebpur",
          );
        }
        if (/Southeast Joydebpur/i.test(disp)) {
          assert.ok(
            !/Northeast Joydebpur/i.test(alsoText),
            "Northeast must not sit in Also of leftover Southeast Joydebpur",
          );
        }
      }
    }
  });

  it("keeps leftover honorific-after-stem Airpark out of Also of Airport with Green as its own row", () => {
    const east = row(
      "Plot # 10, Airport Road, Airport Sheikh East Joydebpur, Sonda",
      "BGMEA",
      "factory",
    );
    const west = row(
      "Plot # 10, Airport Road, Airpark Shaikh West Joydebpur, Sonda",
      "BKMEA",
      "factory",
    );
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [east, west, green],
      [east, green, west],
      [west, east, green],
      [west, green, east],
      [green, east, west],
      [green, west, east],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "leftover honorific-after-stem Joydebpur+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport Sheikh East Joydebpur/i.test(disp) && !/Airpark Shaikh West Joydebpur/i.test(disp)) {
          assert.ok(
            !/Airpark Shaikh West Joydebpur/i.test(alsoText),
            "Airpark must not sit in Also of leftover Airport with Green",
          );
        }
        if (/Airpark Shaikh West Joydebpur/i.test(disp)) {
          assert.ok(
            !/Airport Sheikh East Joydebpur/i.test(alsoText),
            "Airport must not sit in Also of leftover Airpark with Green",
          );
        }
      }
    }
  });

  it("keeps leftover Southeast Joydebpur out of Also of Northeast with Green as its own row", () => {
    const north = row("Plot # 10, Airport Road, Northeast Joydebpur, Sonda", "BGMEA", "factory");
    const south = row("Plot # 10, Airport Road, Southeast Joydebpur, Sonda", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [north, south, green],
      [north, green, south],
      [south, north, green],
      [south, green, north],
      [green, north, south],
      [green, south, north],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        3,
        "leftover Northeast Joydebpur+Southeast+Green matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Northeast Joydebpur/i.test(disp) && !/Southeast Joydebpur/i.test(disp)) {
          assert.ok(
            !/Southeast Joydebpur/i.test(alsoText),
            "Southeast must not sit in Also of leftover Northeast with Green",
          );
        }
        if (/Southeast Joydebpur/i.test(disp)) {
          assert.ok(
            !/Northeast Joydebpur/i.test(alsoText),
            "Northeast must not sit in Also of leftover Southeast with Green",
          );
        }
      }
    }
  });

  it("keeps leftover Airpark Shaikh West Circular out of Also of Airport Sheikh East Circular", () => {
    const east = row(
      "Plot # 10, Airport Road, Airport Sheikh East Circular, Sonda",
      "BGMEA",
      "factory",
    );
    const west = row(
      "Plot # 10, Airport Road, Airpark Shaikh West Circular, Sonda",
      "BKMEA",
      "factory",
    );
    for (const ordered of [
      [east, west],
      [west, east],
    ]) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 2, "leftover honorific-after-stem Circular matcher");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport Sheikh East Circular/i.test(disp) && !/Airpark Shaikh West Circular/i.test(disp)) {
          assert.ok(
            !/Airpark Shaikh West Circular/i.test(alsoText),
            "Airpark must not sit in Also of leftover Airport Sheikh East Circular",
          );
        }
        if (/Airpark Shaikh West Circular/i.test(disp)) {
          assert.ok(
            !/Airport Sheikh East Circular/i.test(alsoText),
            "Airport must not sit in Also of leftover Airpark Shaikh West Circular",
          );
        }
      }
    }
  });

  it("keeps leftover West Airport Joydevpur out of Also of East Airport Joydebpur", () => {
    const east = row("Plot # 10, Airport Road, East Airport Joydebpur, Sonda", "BGMEA", "factory");
    const west = row("Plot # 10, Airport Road, West Airport Joydevpur, Sonda", "BKMEA", "factory");
    for (const ordered of [
      [east, west],
      [west, east],
    ]) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 2, "leftover East Airport Joydebpur vs West Airport Joydevpur matcher");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/East Airport Joydebpur/i.test(disp) && !/West Airport Joydevpur/i.test(disp)) {
          assert.ok(
            !/West Airport Joydevpur/i.test(alsoText),
            "West Airport Joydevpur must not sit in Also of East Airport Joydebpur",
          );
        }
        if (/West Airport Joydevpur/i.test(disp)) {
          assert.ok(
            !/East Airport Joydebpur/i.test(alsoText),
            "East Airport Joydebpur must not sit in Also of West Airport Joydevpur",
          );
        }
      }
    }
  });

  it("keeps leftover Airparkcircular out of Also of Airportcircular", () => {
    const east = row("Plot # 10, Airport Road, AirportCircular, Sonda", "BGMEA", "factory");
    const west = row("Plot # 10, Airport Road, AirparkCircular, Sonda", "BKMEA", "factory");
    for (const ordered of [
      [east, west],
      [west, east],
    ]) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 2, "leftover AirportCircular vs AirparkCircular matcher");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airportcircular/i.test(disp) && !/Airparkcircular/i.test(disp)) {
          assert.ok(
            !/Airparkcircular/i.test(alsoText),
            "Airparkcircular must not sit in Also of Airportcircular",
          );
        }
        if (/Airparkcircular/i.test(disp)) {
          assert.ok(
            !/Airportcircular/i.test(alsoText),
            "Airportcircular must not sit in Also of Airparkcircular",
          );
        }
      }
    }
  });

  it("keeps leftover Airpark Shaikh West Circular with Plot omitted out of Also of Airport Sheikh East Circular", () => {
    const east = row("Airport Road, Airport Sheikh East Circular, Sonda", "BGMEA", "factory");
    const west = row("Airport Road, Airpark Shaikh West Circular, Sonda", "BKMEA", "factory");
    for (const ordered of [
      [east, west],
      [west, east],
    ]) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        2,
        "leftover honorific-after-stem Circular with Plot omitted matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport Sheikh East Circular/i.test(disp) && !/Airpark Shaikh West Circular/i.test(disp)) {
          assert.ok(
            !/Airpark Shaikh West Circular/i.test(alsoText),
            "Airpark must not sit in Also of leftover Airport Circular with Plot omitted",
          );
        }
        if (/Airpark Shaikh West Circular/i.test(disp)) {
          assert.ok(
            !/Airport Sheikh East Circular/i.test(alsoText),
            "Airport must not sit in Also of leftover Airpark Circular with Plot omitted",
          );
        }
      }
    }
  });

  it("keeps leftover West Airport Joydevpur with Plot omitted out of Also of East Airport Joydebpur", () => {
    const east = row("Airport Road, East Airport Joydebpur, Sonda", "BGMEA", "factory");
    const west = row("Airport Road, West Airport Joydevpur, Sonda", "BKMEA", "factory");
    for (const ordered of [
      [east, west],
      [west, east],
    ]) {
      const html = renderAddressRows(ordered);
      assert.equal(
        mergeUniqueLocations(ordered).length,
        2,
        "leftover East Airport Joydebpur vs West Airport Joydevpur Plot omitted matcher",
      );
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/East Airport Joydebpur/i.test(disp) && !/West Airport Joydevpur/i.test(disp)) {
          assert.ok(
            !/West Airport Joydevpur/i.test(alsoText),
            "West Airport Joydevpur must not sit in Also of East with Plot omitted",
          );
        }
        if (/West Airport Joydevpur/i.test(disp)) {
          assert.ok(
            !/East Airport Joydebpur/i.test(alsoText),
            "East Airport Joydebpur must not sit in Also of West with Plot omitted",
          );
        }
      }
    }
  });

  it("keeps leftover West Station Joydevpur out of Also of East Station Joydebpur", () => {
    const east = row("Plot # 10, Airport Road, East Station Joydebpur, Sonda", "BGMEA", "factory");
    const west = row("Plot # 10, Airport Road, West Station Joydevpur, Sonda", "BKMEA", "factory");
    for (const ordered of [
      [east, west],
      [west, east],
    ]) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 2, "leftover East Station Joydebpur vs West Station Joydevpur matcher");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/East Station Joydebpur/i.test(disp) && !/West Station Joydevpur/i.test(disp)) {
          assert.ok(
            !/West Station Joydevpur/i.test(alsoText),
            "West Station Joydevpur must not sit in Also of East Station Joydebpur",
          );
        }
        if (/West Station Joydevpur/i.test(disp)) {
          assert.ok(
            !/East Station Joydebpur/i.test(alsoText),
            "East Station Joydebpur must not sit in Also of West Station Joydevpur",
          );
        }
      }
    }
  });

  it("keeps leftover Airparkcircular out of Also of Airportcircular with Green as its own row", () => {
    const east = row("Plot # 10, Airport Road, AirportCircular, Sonda", "BGMEA", "factory");
    const west = row("Plot # 10, Airport Road, AirparkCircular, Sonda", "BKMEA", "factory");
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [east, west, green],
      [east, green, west],
      [west, east, green],
      [west, green, east],
      [green, east, west],
      [green, west, east],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 3, "leftover AirportCircular+AirparkCircular+Green matcher");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airportcircular/i.test(disp) && !/Airparkcircular/i.test(disp)) {
          assert.ok(
            !/Airparkcircular/i.test(alsoText),
            "Airparkcircular must not sit in Also of Airportcircular with Green",
          );
        }
        if (/Airparkcircular/i.test(disp)) {
          assert.ok(
            !/Airportcircular/i.test(alsoText),
            "Airportcircular must not sit in Also of Airparkcircular with Green",
          );
        }
      }
    }
  });

  it("keeps leftover honorific-after-stem Circular Airpark out of Also of Airport with Green as its own row", () => {
    const east = row(
      "Plot # 10, Airport Road, Airport Sheikh East Circular, Sonda",
      "BGMEA",
      "factory",
    );
    const west = row(
      "Plot # 10, Airport Road, Airpark Shaikh West Circular, Sonda",
      "BKMEA",
      "factory",
    );
    const green = row("Plot # 10, Green Road, Dhaka", "OEKO_TEX", "factory");
    const perms = [
      [east, west, green],
      [east, green, west],
      [west, east, green],
      [west, green, east],
      [green, east, west],
      [green, west, east],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 3, "leftover honorific-after-stem Circular+Green matcher");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Airport Sheikh East Circular/i.test(disp) && !/Airpark Shaikh West Circular/i.test(disp)) {
          assert.ok(
            !/Airpark Shaikh West Circular/i.test(alsoText),
            "Airpark must not sit in Also of leftover Airport Circular with Green",
          );
        }
        if (/Airpark Shaikh West Circular/i.test(disp)) {
          assert.ok(
            !/Airport Sheikh East Circular/i.test(alsoText),
            "Airport must not sit in Also of leftover Airpark Circular with Green",
          );
        }
      }
    }
  });

  it("keeps leftover West Joydevpur in Also recorded as of leftover East Joydebpur", () => {
    assertMergedAddressRowHtml(
      row("Plot # 10, Airport Road, East Joydebpur, Sonda", "BGMEA", "factory"),
      row("Plot # 10, Airport Road, West Joydevpur, Sonda", "BKMEA", "factory"),
      /East Joydebpur|West Joydevpur/i,
      /East Joydebpur|West Joydevpur/i,
      "leftover East Joydebpur vs West Joydevpur KEEP spelling",
    );
    assertMergedAddressRowHtml(
      row("Plot # 10, Airport Road, Sheikh East Joydebpur, Sonda", "BGMEA", "factory"),
      row("Plot # 10, Airport Road, Shaikh West Joydevpur, Sonda", "BKMEA", "factory"),
      /Sheikh East Joydebpur|Shaikh West Joydevpur/i,
      /Sheikh East Joydebpur|Shaikh West Joydevpur/i,
      "leftover Sheikh East Joydebpur vs Shaikh West Joydevpur KEEP spelling",
    );
  });

  it("keeps Village Dogri off the Telulzora-Union row that wraps Village Hemayetpur", () => {
    const union = row("Plot # 23-24, Telulzora-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory");
    const villageH = row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory");
    const villageD = row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar", "OEKO_TEX", "factory");
    const perms = [
      [union, villageH, villageD],
      [union, villageD, villageH],
      [villageH, union, villageD],
      [villageH, villageD, union],
      [villageD, union, villageH],
      [villageD, villageH, union],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 2, "Telulzora-Union+VH+VD matcher");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Telulzora-Union|Village,\s*Hemayetpur/i.test(disp) && !/Village,\s*Dogri/i.test(disp)) {
          assert.ok(!/Village,\s*Dogri/i.test(alsoText), "Village Dogri must not sit in Also of Telulzora-Union");
        }
      }
    }
  });

  it("keeps Village Hemayetpur out of Also recorded as of Dogri, Union when Village Dogri sits with the union", () => {
    const union = row("Plot # 23-24, Dogri, Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory");
    const villageH = row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory");
    const villageD = row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar", "OEKO_TEX", "factory");
    const perms = [
      [union, villageH, villageD],
      [union, villageD, villageH],
      [villageH, union, villageD],
      [villageH, villageD, union],
      [villageD, union, villageH],
      [villageD, villageH, union],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 2, "Dogri, Union+VH+VD matcher");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Dogri,\s*Union|Village,\s*Dogri/i.test(disp)) {
          assert.ok(
            !/Village,\s*Hemayetpur/i.test(alsoText),
            "Village Hemayetpur must not sit in Also of Dogri, Union",
          );
        }
      }
    }
  });

  it("keeps Village Hemayetpur out of Also recorded as of Faridabad-Union when Village Dogri is a third row", () => {
    const union = row("Plot # 23-24, Faridabad-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory");
    const villageH = row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory");
    const villageD = row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar", "OEKO_TEX", "factory");
    const perms = [
      [union, villageH, villageD],
      [union, villageD, villageH],
      [villageH, union, villageD],
      [villageH, villageD, union],
      [villageD, union, villageH],
      [villageD, villageH, union],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 3);
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Faridabad-Union/i.test(disp)) {
          assert.ok(!/Village,\s*Hemayetpur/i.test(alsoText));
        }
      }
    }
  });

  it("keeps Village Hemayetpur out of Also recorded as of Dogri-Union", () => {
    const union = row("Plot # 23-24, Dogri-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory");
    const villageH = row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory");
    const villageD = row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar", "OEKO_TEX", "factory");
    const perms = [
      [union, villageH, villageD],
      [union, villageD, villageH],
      [villageH, union, villageD],
      [villageH, villageD, union],
      [villageD, union, villageH],
      [villageD, villageH, union],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 2, "Dogri-Union merges Village Dogri, not Village Hemayetpur");
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Dogri-Union/i.test(disp) || /Village,\s*Dogri/i.test(disp)) {
          assert.ok(!/Village,\s*Hemayetpur/i.test(alsoText));
        }
      }
    }
  });

  it("keeps Village Hemayetpur out of Also recorded as of Faridabad Union when Village Dogri is a third row", () => {
    const union = row("Plot # 23-24, Faridabad Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory");
    const villageH = row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory");
    const villageD = row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar", "OEKO_TEX", "factory");
    const perms = [
      [union, villageH, villageD],
      [union, villageD, villageH],
      [villageH, union, villageD],
      [villageH, villageD, union],
      [villageD, union, villageH],
      [villageD, villageH, union],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 3);
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      for (const chunk of locationChunks(html)) {
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const alsoText = also.join(" ");
        if (/Faridabad Union/i.test(disp)) {
          assert.ok(!/Village,\s*Hemayetpur/i.test(alsoText));
        }
      }
    }
  });

  it("shows three Locations rows for Joydebpur, Tejgaon and Station with Valuka after the road", () => {
    const joy = row("Plot # 10, Joydebpur Road, Valuka", "BGMEA", "factory");
    const tej = row("Plot # 10, Tejgaon Road, Valuka", "BKMEA", "factory");
    const sta = row("Plot # 10, Station Road, Valuka", "OEKO_TEX", "factory");
    const perms = [
      [joy, tej, sta],
      [joy, sta, tej],
      [tej, joy, sta],
      [tej, sta, joy],
      [sta, joy, tej],
      [sta, tej, joy],
    ];
    for (const ordered of perms) {
      const html = renderAddressRows(ordered);
      assert.equal(mergeUniqueLocations(ordered).length, 3);
      assert.equal((html.match(/data-location-row=""/g) ?? []).length, 3);
      const chunks = locationChunks(html);
      assert.equal(chunks.length, 3);
      for (const chunk of chunks) {
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        assert.equal(also.length, 0, "Valuka-after named roads must not sit in each other's Also");
      }
    }
    const beforeJoy = row("Plot # 10, Valuka, Joydebpur Road, Dhaka", "BGMEA", "factory");
    const beforeTej = row("Plot # 10, Valuka, Tejgaon Road, Dhaka", "BKMEA", "factory");
    const beforeSta = row("Plot # 10, Valuka, Station Road, Dhaka", "OEKO_TEX", "factory");
    const htmlBefore = renderAddressRows([beforeJoy, beforeTej, beforeSta]);
    assert.equal(mergeUniqueLocations([beforeJoy, beforeTej, beforeSta]).length, 3);
    assert.equal((htmlBefore.match(/data-location-row=""/g) ?? []).length, 3);
    for (const chunk of locationChunks(htmlBefore)) {
      const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
      assert.equal(also.length, 0, "village-before named roads must not sit in each other's Also");
    }
  });

  it("keeps Dogri out of Also recorded as of the Telulzora/Holding 87 row", () => {
    const telulzora = row(
      "Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar",
      "BGMEA",
      "factory",
    );
    const dogri = row(
      "Plot # 23-24, Union, Dogri, Hemayetpur, Dhaka, Savar",
      "BKMEA",
      "factory",
    );
    const holding87 = row(
      "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      "OEKO_TEX",
      "factory",
    );
    const perms = [
      [telulzora, dogri, holding87],
      [telulzora, holding87, dogri],
      [dogri, telulzora, holding87],
      [dogri, holding87, telulzora],
      [holding87, telulzora, dogri],
      [holding87, dogri, telulzora],
    ];
    for (const ordered of perms) {
      const locs = mergeUniqueLocations(ordered);
      assert.equal(locs.length, 2, "three-string Telulzora+Dogri+Holding 87 matcher");
      const html = renderAddressRows(ordered);
      assert.equal(
        (html.match(/data-location-row=""/g) ?? []).length,
        2,
        "three-string Telulzora+Dogri+Holding 87 row count",
      );
      const chunks = locationChunks(html);
      const holding = chunks.find((chunk) => /Holding No\. 87/i.test(displayHtml(chunk)));
      const dogriRow = chunks.find((chunk) => /Dogri/i.test(displayHtml(chunk)));
      assert.ok(holding, "Holding 87 / Telulzora row missing");
      assert.ok(dogriRow, "Dogri row missing");
      assert.notEqual(holding, dogriRow, "Dogri fused into Holding 87 row");
      const also = holding!.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
      assert.ok(
        !also.some((block) => /Dogri/i.test(block)),
        "Dogri must not sit in Also recorded as on the Telulzora/Holding 87 row",
      );
    }
  });

  it("keeps Village Dogri out of Also recorded as of the Telulzora/Holding 87 row", () => {
    const telulzora = row(
      "Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar",
      "BGMEA",
      "factory",
    );
    const villageDogri = row(
      "Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar",
      "BKMEA",
      "factory",
    );
    const holding87 = row(
      "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      "OEKO_TEX",
      "factory",
    );
    const perms = [
      [telulzora, villageDogri, holding87],
      [telulzora, holding87, villageDogri],
      [villageDogri, telulzora, holding87],
      [villageDogri, holding87, telulzora],
      [holding87, telulzora, villageDogri],
      [holding87, villageDogri, telulzora],
    ];
    for (const ordered of perms) {
      const locs = mergeUniqueLocations(ordered);
      assert.equal(locs.length, 2, "three-string Telulzora+Village Dogri+Holding 87 matcher");
      const html = renderAddressRows(ordered);
      assert.equal(
        (html.match(/data-location-row=""/g) ?? []).length,
        2,
        "three-string Telulzora+Village Dogri+Holding 87 row count",
      );
      const chunks = locationChunks(html);
      const holding = chunks.find((chunk) => /Holding No\. 87/i.test(displayHtml(chunk)));
      const dogriRow = chunks.find((chunk) => /Dogri/i.test(displayHtml(chunk)));
      assert.ok(holding, "Holding 87 / Telulzora row missing");
      assert.ok(dogriRow, "Village Dogri row missing");
      assert.notEqual(holding, dogriRow, "Village Dogri fused into Holding 87 row");
      const also = holding!.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
      assert.ok(
        !also.some((block) => /Dogri/i.test(block)),
        "Village Dogri must not sit in Also recorded as on the Telulzora/Holding 87 row",
      );
    }
  });

  it("keeps Village of Dogri out of Also recorded as of the Telulzora/Holding 87 row", () => {
    const telulzora = row(
      "Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar",
      "BGMEA",
      "factory",
    );
    const villageOfDogri = row(
      "Plot # 23-24, Village of Dogri, Hemayetpur, Dhaka, Savar",
      "BKMEA",
      "factory",
    );
    const holding87 = row(
      "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      "OEKO_TEX",
      "factory",
    );
    const perms = [
      [telulzora, villageOfDogri, holding87],
      [telulzora, holding87, villageOfDogri],
      [villageOfDogri, telulzora, holding87],
      [villageOfDogri, holding87, telulzora],
      [holding87, telulzora, villageOfDogri],
      [holding87, villageOfDogri, telulzora],
    ];
    for (const ordered of perms) {
      const locs = mergeUniqueLocations(ordered);
      assert.equal(locs.length, 2, "three-string Telulzora+Village of Dogri+Holding 87 matcher");
      const html = renderAddressRows(ordered);
      assert.equal(
        (html.match(/data-location-row=""/g) ?? []).length,
        2,
        "three-string Telulzora+Village of Dogri+Holding 87 row count",
      );
      const chunks = locationChunks(html);
      const holding = chunks.find((chunk) => /Holding No\. 87/i.test(displayHtml(chunk)));
      const dogriRow = chunks.find((chunk) => /Dogri/i.test(displayHtml(chunk)));
      assert.ok(holding, "Holding 87 / Telulzora row missing");
      assert.ok(dogriRow, "Village of Dogri row missing");
      assert.notEqual(holding, dogriRow, "Village of Dogri fused into Holding 87 row");
      const also = holding!.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
      assert.ok(
        !also.some((block) => /Dogri/i.test(block)),
        "Village of Dogri must not sit in Also recorded as on the Telulzora/Holding 87 row",
      );
    }
  });

  it("keeps Union Plaza out of Also recorded as of the Telulzora/Holding 87 row", () => {
    const telulzora = row(
      "Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar",
      "BGMEA",
      "factory",
    );
    const plaza = row(
      "Plot # 23-24, Union Plaza, Hemayetpur, Dhaka, Savar",
      "BKMEA",
      "factory",
    );
    const holding87 = row(
      "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      "OEKO_TEX",
      "factory",
    );
    const perms = [
      [telulzora, plaza, holding87],
      [telulzora, holding87, plaza],
      [plaza, telulzora, holding87],
      [plaza, holding87, telulzora],
      [holding87, telulzora, plaza],
      [holding87, plaza, telulzora],
    ];
    for (const ordered of perms) {
      const locs = mergeUniqueLocations(ordered);
      assert.equal(locs.length, 2, "three-string Telulzora+Union Plaza+Holding 87 matcher");
      const html = renderAddressRows(ordered);
      assert.equal(
        (html.match(/data-location-row=""/g) ?? []).length,
        2,
        "three-string Telulzora+Union Plaza+Holding 87 row count",
      );
      const chunks = locationChunks(html);
      const holding = chunks.find((chunk) => /Holding No\. 87/i.test(displayHtml(chunk)));
      const plazaRow = chunks.find((chunk) => /Union Plaza/i.test(displayHtml(chunk)));
      assert.ok(holding, "Holding 87 / Telulzora row missing");
      assert.ok(plazaRow, "Union Plaza row missing");
      assert.notEqual(holding, plazaRow, "Union Plaza fused into Holding 87 row");
      const also = holding!.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
      assert.ok(
        !also.some((block) => /Union Plaza/i.test(block)),
        "Union Plaza must not sit in Also recorded as on the Telulzora/Holding 87 row",
      );
    }
  });

  it("shows Village, Hemayetpur as Also recorded as of the Telulzora/Holding 87 row", () => {
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Village,\s*Hemayetpur|Holding No\. 87/i,
      /Village,\s*Hemayetpur|Holding No\. 87/i,
      "Village Hemayetpur vs Holding 87",
    );
    const telulzora = row(
      "Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar",
      "BGMEA",
      "factory",
    );
    const villageHem = row(
      "Plot # 23-24, Village, Hemayetpur, Dhaka, Savar",
      "BKMEA",
      "factory",
    );
    const holding87 = row(
      "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      "OEKO_TEX",
      "factory",
    );
    const perms = [
      [telulzora, villageHem, holding87],
      [telulzora, holding87, villageHem],
      [villageHem, telulzora, holding87],
      [villageHem, holding87, telulzora],
      [holding87, telulzora, villageHem],
      [holding87, villageHem, telulzora],
    ];
    for (const ordered of perms) {
      assert.equal(
        mergeUniqueLocations(ordered).length,
        1,
        "three-string hyphen+Village Hemayetpur+Holding 87 matcher",
      );
      const html = renderAddressRows(ordered);
      assert.equal(
        (html.match(/data-location-row=""/g) ?? []).length,
        1,
        "three-string hyphen+Village Hemayetpur+Holding 87 row count",
      );
    }
  });

  it("shows Village of the Hemayetpur as Also recorded as of the Telulzora/Holding 87 row", () => {
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Village of the Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Village of the Hemayetpur|Holding No\. 87/i,
      /Village of the Hemayetpur|Holding No\. 87/i,
      "Village of the Hemayetpur vs Holding 87",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, The Village of Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /The Village of Hemayetpur|Holding No\. 87/i,
      /The Village of Hemayetpur|Holding No\. 87/i,
      "The Village of Hemayetpur vs Holding 87",
    );
  });

  it("keeps Union House out of Also recorded as of the Telulzora/Holding 87 row", () => {
    const telulzora = row(
      "Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar",
      "BGMEA",
      "factory",
    );
    const house = row(
      "Plot # 23-24, Union House, Hemayetpur, Dhaka, Savar",
      "BKMEA",
      "factory",
    );
    const holding87 = row(
      "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      "OEKO_TEX",
      "factory",
    );
    const perms = [
      [telulzora, house, holding87],
      [telulzora, holding87, house],
      [house, telulzora, holding87],
      [house, holding87, telulzora],
      [holding87, telulzora, house],
      [holding87, house, telulzora],
    ];
    for (const ordered of perms) {
      const locs = mergeUniqueLocations(ordered);
      assert.equal(locs.length, 2, "three-string Telulzora+Union House+Holding 87 matcher");
      const html = renderAddressRows(ordered);
      assert.equal(
        (html.match(/data-location-row=""/g) ?? []).length,
        2,
        "three-string Telulzora+Union House+Holding 87 row count",
      );
      const chunks = locationChunks(html);
      const holding = chunks.find((chunk) => /Holding No\. 87/i.test(displayHtml(chunk)));
      const houseRow = chunks.find((chunk) => /Union House/i.test(displayHtml(chunk)));
      assert.ok(holding, "Holding 87 / Telulzora row missing");
      assert.ok(houseRow, "Union House row missing");
      assert.notEqual(holding, houseRow, "Union House fused into Holding 87 row");
      const also = holding!.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
      assert.ok(
        !also.some((block) => /Union House/i.test(block)),
        "Union House must not sit in Also recorded as on the Telulzora/Holding 87 row",
      );
    }
  });

  it("keeps Village Hemayetpur out of Also recorded as of Village Dogri", () => {
    const telulzora = row(
      "Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar",
      "BGMEA",
      "factory",
    );
    const villageHem = row(
      "Plot # 23-24, Village, Hemayetpur, Dhaka, Savar",
      "BKMEA",
      "factory",
    );
    const villageDogri = row(
      "Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar",
      "OEKO_TEX",
      "factory",
    );
    const perms = [
      [telulzora, villageHem, villageDogri],
      [telulzora, villageDogri, villageHem],
      [villageHem, telulzora, villageDogri],
      [villageHem, villageDogri, telulzora],
      [villageDogri, telulzora, villageHem],
      [villageDogri, villageHem, telulzora],
    ];
    for (const ordered of perms) {
      const locs = mergeUniqueLocations(ordered);
      assert.equal(locs.length, 2, "three-string Telulzora+Village Hemayetpur+Village Dogri matcher");
      const html = renderAddressRows(ordered);
      assert.equal(
        (html.match(/data-location-row=""/g) ?? []).length,
        2,
        "three-string Telulzora+Village Hemayetpur+Village Dogri row count",
      );
      const chunks = locationChunks(html);
      const dogriRow = chunks.find((chunk) => /Village,\s*Dogri/i.test(displayHtml(chunk)));
      assert.ok(dogriRow, "Village Dogri row missing");
      const telulzoraRow = chunks.find((chunk) => /Telulzora/i.test(displayHtml(chunk)));
      const hemayetpurRow = chunks.find((chunk) =>
        /Village,\s*Hemayetpur/i.test(displayHtml(chunk)),
      );
      assert.ok(
        telulzoraRow || hemayetpurRow,
        "Telulzora / Village Hemayetpur row missing",
      );
      assert.notEqual(telulzoraRow, dogriRow, "Telulzora fused into Village Dogri");
      assert.notEqual(hemayetpurRow, dogriRow, "Village Hemayetpur fused into Village Dogri");
      const dogriAlso = dogriRow!.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
      assert.ok(
        !dogriAlso.some((block) => /Village,\s*Hemayetpur/i.test(block)),
        "Village Hemayetpur must not sit in Also recorded as on the Village Dogri row",
      );
      assert.ok(
        !dogriAlso.some((block) => /Telulzora/i.test(block)),
        "Telulzora must not sit in Also recorded as on the Village Dogri row",
      );
      const keepRow = telulzoraRow ?? hemayetpurRow!;
      const keepAlso = keepRow.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
      assert.ok(
        !keepAlso.some((block) => /Village,\s*Dogri/i.test(block)),
        "Village Dogri must not sit in Also recorded as of Telulzora/Hemayetpur",
      );
      if (telulzoraRow) {
        assert.ok(
          keepAlso.some((block) => /Village,\s*Hemayetpur/i.test(block)),
          "Village Hemayetpur must sit in Also recorded as of Telulzora, not Dogri",
        );
      } else {
        assert.ok(
          keepAlso.some((block) => /Telulzora/i.test(block)),
          "Telulzora must sit in Also recorded as of Village Hemayetpur, not Dogri",
        );
      }
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
    {
      const commaT = row(
        "Plot # 23-24, Union, Telulzora, Hemayetpur, Dhaka, Savar",
        "BGMEA",
        "factory",
      );
      const villageH = row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory");
      for (const ordered of [
        [commaT, villageH],
        [villageH, commaT],
      ]) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          1,
          "Union comma Telulzora vs Village Hemayetpur matcher merge",
        );
        const html = renderAddressRows(ordered);
        assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1);
        const chunk = locationChunks(html)[0]!;
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const tDisp = /Union,\s*Telulzora/i.test(disp);
        const hDisp = /Village,\s*Hemayetpur/i.test(disp);
        const tAlso = also.some((block) => /Union,\s*Telulzora/i.test(block));
        const hAlso = also.some((block) => /Village,\s*Hemayetpur/i.test(block));
        assert.ok(
          (tDisp && hAlso && !tAlso) || (hDisp && tAlso && !hAlso),
          "Union comma Telulzora vs Village Hemayetpur Also <li> isolation",
        );
      }
    }
    {
      const east = row("Plot # 10, East Joydebpur Road, Sonda", "BGMEA", "factory");
      const west = row("Plot # 10, West Joydevpur Road, Sonda", "BKMEA", "factory");
      for (const ordered of [
        [east, west],
        [west, east],
      ]) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          1,
          "Plot 10 East Joydebpur vs West Joydevpur matcher merge",
        );
        const html = renderAddressRows(ordered);
        assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1);
        const chunk = locationChunks(html)[0]!;
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const eastDisp = /East Joydebpur Road/i.test(disp);
        const westDisp = /West Joydevpur Road/i.test(disp);
        const eastAlso = also.some((block) => /East Joydebpur Road/i.test(block));
        const westAlso = also.some((block) => /West Joydevpur Road/i.test(block));
        assert.ok(
          (eastDisp && westAlso && !eastAlso) || (westDisp && eastAlso && !westAlso),
          "Plot 10 East Joydebpur vs West Joydevpur Also <li> isolation",
        );
      }
    }
    {
      const hyphenT = row(
        "Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar",
        "BGMEA",
        "factory",
      );
      const villageH = row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory");
      for (const ordered of [
        [hyphenT, villageH],
        [villageH, hyphenT],
      ]) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          1,
          "Union hyphen Telulzora vs Village Hemayetpur matcher merge",
        );
        const html = renderAddressRows(ordered);
        assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1);
        const chunk = locationChunks(html)[0]!;
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const tDisp = /Union\s*-\s*Telulzora/i.test(disp);
        const hDisp = /Village,\s*Hemayetpur/i.test(disp);
        const tAlso = also.some((block) => /Union\s*-\s*Telulzora/i.test(block));
        const hAlso = also.some((block) => /Village,\s*Hemayetpur/i.test(block));
        assert.ok(
          (tDisp && hAlso && !tAlso) || (hDisp && tAlso && !hAlso),
          "Union hyphen Telulzora vs Village Hemayetpur Also <li> isolation",
        );
      }
    }
    {
      const hariken = row("Plot # 10, Hariken Road, Dhaka", "BGMEA", "factory");
      const harican = row("Plot # 10, Harican Road, Dhaka", "BKMEA", "factory");
      for (const ordered of [
        [hariken, harican],
        [harican, hariken],
      ]) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          1,
          "Plot 10 Hariken vs Harican matcher merge",
        );
        const html = renderAddressRows(ordered);
        assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1);
        const chunk = locationChunks(html)[0]!;
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const kenDisp = /Hariken Road/i.test(disp);
        const canDisp = /Harican Road/i.test(disp);
        const kenAlso = also.some((block) => /Hariken Road/i.test(block));
        const canAlso = also.some((block) => /Harican Road/i.test(block));
        assert.ok(
          (kenDisp && canAlso && !kenAlso) || (canDisp && kenAlso && !canAlso),
          "Plot 10 Hariken vs Harican Also <li> isolation",
        );
      }
    }
    {
      const fixtureKen = row(
        "701, Kamarjuri, Hariken Road, National University, Gazipur - 1704, Bangladesh",
        "BGMEA",
        "factory",
      );
      const fixtureCan = row(
        "701, KAMARIJUR, HARICAN ROAD, NATIONAL UNIVERSITY, GAZIPUR",
        "BKMEA",
        "factory",
      );
      for (const ordered of [
        [fixtureKen, fixtureCan],
        [fixtureCan, fixtureKen],
      ]) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          1,
          "701 Kamarjuri Hariken vs Harican matcher merge",
        );
        const html = renderAddressRows(ordered);
        assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1);
        const chunk = locationChunks(html)[0]!;
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        assert.ok(also.length > 0, "701 Kamarjuri Hariken vs Harican Also recorded as pill");
        const alsoText = also.join(" ");
        const disp = displayHtml(chunk);
        const kenOnDisp = /Hariken/i.test(disp);
        const canOnDisp = /Harican/i.test(disp);
        assert.ok(
          (kenOnDisp && /Harican/i.test(alsoText)) || (canOnDisp && /Hariken/i.test(alsoText)),
          "701 Kamarjuri Hariken vs Harican Also <li> isolation",
        );
      }
    }
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
    {
      const shahriar = row("Plot # 636, Shahriar Road, Sonda", "BGMEA", "factory");
      const sharifpur = row("636, Sharifpur Road, Sonda", "BKMEA", "factory");
      for (const ordered of [
        [shahriar, sharifpur],
        [sharifpur, shahriar],
      ]) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          1,
          "Plot 636 Shahriar vs Sharifpur at Sonda matcher merge",
        );
        const html = renderAddressRows(ordered);
        assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1);
        const chunk = locationChunks(html)[0]!;
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        const shahDisp = /Shahriar Road/i.test(disp);
        const sharDisp = /Sharifpur Road/i.test(disp);
        const shahAlso = also.some((block) => /Shahriar Road/i.test(block));
        const sharAlso = also.some((block) => /Sharifpur Road/i.test(block));
        assert.ok(
          (shahDisp && sharAlso && !shahAlso) || (sharDisp && shahAlso && !sharAlso),
          "Plot 636 Shahriar vs Sharifpur Also <li> isolation",
        );
      }
    }
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
    {
      const telulzora = row(
        "Plot # 23-24, Union - Telulzora, Hemayetpur\nDhaka\nSavar",
        "BGMEA",
        "factory",
      );
      const holding87 = row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      );
      for (const ordered of [
        [telulzora, holding87],
        [holding87, telulzora],
      ]) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          1,
          "neighbour Plot 23-24 Telulzora vs Holding 87 matcher merge",
        );
        const html = renderAddressRows(ordered);
        assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1);
        const chunk = locationChunks(html)[0]!;
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        assert.ok(!also.some((block) => /Dogri/i.test(block)), "Dogri must not sit in neighbour Also");
        const unionDisp = /Union\s*-\s*Telulzora/i.test(disp);
        const holdDisp = /Holding No\. 87/i.test(disp);
        const unionAlso = also.some((block) => /Union\s*-\s*Telulzora/i.test(block));
        const holdAlso = also.some((block) => /Holding No\. 87/i.test(block));
        assert.ok(
          (holdDisp && unionAlso) || (unionDisp && holdAlso),
          "neighbour Also must name Union - Telulzora or Holding 87, not only Hemayetpur",
        );
      }
    }
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Telulzora Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Telulzora Union|Holding No\. 87/i,
      /Telulzora Union|Holding No\. 87/i,
      "Telulzora Union title-after vs Holding 87",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Telulzora-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Telulzora-Union|Holding No\. 87/i,
      /Telulzora-Union|Holding No\. 87/i,
      "Telulzora-Union vs Holding 87",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Dogri-Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row("Plot # 23-24, Union - Dogri, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
      /Dogri-Union|Union\s*-\s*Dogri/i,
      /Dogri-Union|Union\s*-\s*Dogri/i,
      "Dogri-Union vs Union hyphen Dogri",
    );
    for (const spelling of [
      "Union - Telulzor",
      "Telulzor Union",
      "Village, Telulzor",
      "Union, Telulzor",
      "Union - Tezulzor",
      "Telulzor-Union",
    ]) {
      assertMergedAddressRowHtml(
        row(`Plot # 23-24, ${spelling}, Hemayetpur, Dhaka, Savar`, "BGMEA", "factory"),
        row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
        new RegExp(`${spelling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|Holding No\\. 87`, "i"),
        new RegExp(`${spelling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|Holding No\\. 87`, "i"),
        `${spelling} vs Holding 87`,
      );
    }
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Telulzora, Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Telulzora,\s*Union|Holding No\. 87/i,
      /Telulzora,\s*Union|Holding No\. 87/i,
      "Telulzora, Union vs Holding 87",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Telulzor, Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Telulzor,\s*Union|Holding No\. 87/i,
      /Telulzor,\s*Union|Holding No\. 87/i,
      "Telulzor, Union vs Holding 87",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Dogri, Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row("Plot # 23-24, Union - Dogri, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
      /Dogri,\s*Union|Union\s*-\s*Dogri/i,
      /Dogri,\s*Union|Union\s*-\s*Dogri/i,
      "Dogri, Union vs Union hyphen Dogri",
    );
    for (const spelling of ["Telulzora-Union", "Tetuljhora-Union", "Telulzor-Union", "Telulzora_Union"]) {
      assertMergedAddressRowHtml(
        row(`Plot # 23-24, ${spelling}, Hemayetpur, Dhaka, Savar`, "BGMEA", "factory"),
        row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
        new RegExp(`${spelling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|Village,\\s*Hemayetpur`, "i"),
        new RegExp(`${spelling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|Village,\\s*Hemayetpur`, "i"),
        `${spelling} vs Village Hemayetpur`,
      );
    }
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Telulzora_Union, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Telulzora_Union|Holding No\. 87/i,
      /Telulzora_Union|Holding No\. 87/i,
      "Telulzora_Union vs Holding 87",
    );
    assertMergedAddressRowHtml(
      row(
        "Simco Complex, 43, Chalaban, Shah Kabir Mazar Road, Dakshinkhan, Uttara, Dhaka - 1230, Bangladesh",
        "BGMEA",
        "factory",
      ),
      row(
        "Simco Complex, 43, Chalaban, Shah Kabir Mazar Road, Dakkhin Khan, Dhaka",
        "BKMEA",
        "factory",
      ),
      /Dakshinkhan|Dakkhin Khan/i,
      /Dakshinkhan|Dakkhin Khan/i,
      "olio-apparels Dakshinkhan vs Dakkhin Khan",
    );
    assertMergedAddressRowHtml(
      row("02, Dr. M.A. Rashid Road, South Auchpara, Ward # 54, Tongi, Dhaka", "BGMEA", "factory"),
      row("02, DR. M A RASHID ROAD, AUCHPARA, TONGI, GAZIPUR - 1711, Bangladesh", "BKMEA", "factory"),
      /Auchpara|AUCHPARA/i,
      /Auchpara|AUCHPARA/i,
      "stuff South Auchpara vs Auchpara",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Union_Telulzora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
      /Union_Telulzora|Village,\s*Hemayetpur/i,
      /Union_Telulzora|Village,\s*Hemayetpur/i,
      "Union_Telulzora vs Village Hemayetpur",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Union_Telulzora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Union_Telulzora|Holding No\. 87/i,
      /Union_Telulzora|Holding No\. 87/i,
      "Union_Telulzora vs Holding 87",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Union_Telulzora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
      /Union_Telulzora|Union\s*-\s*Telulzora/i,
      /Union_Telulzora|Union\s*-\s*Telulzora/i,
      "Union_Telulzora vs Union hyphen Telulzora",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Union_Telulzora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row("Plot # 23-24, Telulzora_Union, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
      /Union_Telulzora|Telulzora_Union/i,
      /Union_Telulzora|Telulzora_Union/i,
      "Union_Telulzora vs Telulzora_Union",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Village_Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row("Plot # 23-24, Union, Telulzora, Hemayetpur, Dhaka, Savar", "BKMEA", "factory"),
      /Village_Hemayetpur|Union,\s*Telulzora/i,
      /Village_Hemayetpur|Union,\s*Telulzora/i,
      "Village_Hemayetpur vs Union, Telulzora",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Village_Hemayetpur, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Village_Hemayetpur|Holding No\. 87/i,
      /Village_Hemayetpur|Holding No\. 87/i,
      "Village_Hemayetpur vs Holding 87",
    );
    assertMergedAddressRowHtml(
      row("Plot # 23-24, Hemayetpur_Village, Dhaka, Savar", "BGMEA", "factory"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      /Hemayetpur_Village|Holding No\. 87/i,
      /Hemayetpur_Village|Holding No\. 87/i,
      "Hemayetpur_Village vs Holding 87",
    );
    {
      const union = row("Plot # 23-24, Union_Telulzora, Hemayetpur, Dhaka, Savar", "BGMEA", "factory");
      const villageH = row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar", "BKMEA", "factory");
      const villageD = row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar", "OEKO_TEX", "factory");
      const perms = [
        [union, villageH, villageD],
        [union, villageD, villageH],
        [villageH, union, villageD],
        [villageH, villageD, union],
        [villageD, union, villageH],
        [villageD, villageH, union],
      ];
      for (const ordered of perms) {
        const html = renderAddressRows(ordered);
        assert.equal(mergeUniqueLocations(ordered).length, 2, "Union_Telulzora+VH+VD matcher");
        assert.equal((html.match(/data-location-row=""/g) ?? []).length, 2);
        for (const chunk of locationChunks(html)) {
          const disp = displayHtml(chunk);
          const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
          const alsoText = also.join(" ");
          if (/Union_Telulzora|Village,\s*Hemayetpur/i.test(disp) && !/Village,\s*Dogri/i.test(disp)) {
            assert.ok(!/Village,\s*Dogri/i.test(alsoText), "Village Dogri must not sit in Also of Union_Telulzora");
          }
        }
      }
    }
    {
      const hyphen = row(
        "Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar",
        "BGMEA",
        "factory",
      );
      const titleAfter = row(
        "Plot # 23-24, Telulzora Union, Hemayetpur, Dhaka, Savar",
        "BKMEA",
        "factory",
      );
      const holding87 = row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        "OEKO_TEX",
        "factory",
      );
      const perms = [
        [hyphen, titleAfter, holding87],
        [hyphen, holding87, titleAfter],
        [titleAfter, hyphen, holding87],
        [titleAfter, holding87, hyphen],
        [holding87, hyphen, titleAfter],
        [holding87, titleAfter, hyphen],
      ];
      for (const ordered of perms) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          1,
          "three-string hyphen+title-after Telulzora+Holding 87 matcher",
        );
        const html = renderAddressRows(ordered);
        assert.equal(
          (html.match(/data-location-row=""/g) ?? []).length,
          1,
          "three-string hyphen+title-after Telulzora+Holding 87 row count",
        );
        const chunk = locationChunks(html)[0]!;
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        assert.ok(also.length > 0, "three-string Telulzora Union Also recorded as pill");
        assert.ok(
          !also.some((block) => /Dogri/i.test(block)),
          "Dogri must not sit in title-after Telulzora Also",
        );
      }
    }
    {
      const singair = row(
        "244, Singair Road, Hemayetpur, Savar, Dhaka",
        "BGMEA",
        "factory",
      );
      const hemayetpur = row("244, Hemayetpur, Savar, Dhaka", "BKMEA", "factory");
      for (const ordered of [
        [singair, hemayetpur],
        [hemayetpur, singair],
      ]) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          1,
          "244 Singair vs Hemayetpur matcher merge",
        );
        const html = renderAddressRows(ordered);
        assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1, "244 row count");
        const chunk = locationChunks(html)[0]!;
        const disp = displayHtml(chunk);
        const also = chunk.match(/<li[^>]*data-also-recorded-as=""[^>]*>[\s\S]*?<\/li>/g) ?? [];
        assert.ok(also.length > 0, "244 Also recorded as pill");
        const singDisp = /244,\s*Singair Road/i.test(disp);
        const hemDisp = /244,\s*Hemayetpur, Savar, Dhaka/i.test(disp);
        const singAlso = also.some((block) => /244,\s*Singair Road/i.test(block));
        const hemAlso = also.some((block) => /244,\s*Hemayetpur, Savar, Dhaka/i.test(block));
        assert.ok(
          (singDisp && hemAlso) || (hemDisp && singAlso),
          "244 Hemayetpur must sit in Also recorded as when Singair is the display, both orders",
        );
      }
    }
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
