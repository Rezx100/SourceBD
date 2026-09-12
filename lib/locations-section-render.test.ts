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
    ];
    for (const c of cases) {
      assertSplitAddressRowHtml(c.left, c.right, c.keepRe, c.otherRe, c.otherName);
    }
  });

  it("shows HOUSE #14 as Also recorded as of House 14, Apt # 2 (one Locations row)", () => {
    const html = renderAddressRows([
      row("House # 14, Apt # 2, Road # 20, Sector # 04, Uttara Model Town, Dhaka", "BGMEA", "factory"),
      row("HOUSE #14, ROAD #20, SECTOR #04, UTTARA, DHAKA", "BKMEA", "factory"),
    ]);
    assert.equal((html.match(/data-location-row=""/g) ?? []).length, 1, html);
    assert.match(html, /House # 14, Apt # 2/);
    assert.match(html, /House #14/);
    assert.match(html, /Also recorded as/);
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
