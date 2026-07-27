import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cleanAddressString,
  mergeUniqueLocations,
  normaliseAddressKey,
  type AddressRowRaw,
} from "./dedup-addresses";

// Every fixture below is real production data, pulled from the groups where
// several address strings geocoded to one coordinate. They assert the
// non-merges as strictly as the merges: a rule that collapses two genuinely
// different plots into one premises destroys registry facts, which is worse
// than leaving a duplicate row on the page.

let seq = 0;
function row(address: string, source_code = "BGMEA", kind = "factory"): AddressRowRaw {
  seq += 1;
  return {
    kind,
    address,
    source_code,
    fetched_at: `2026-07-${String((seq % 28) + 1).padStart(2, "0")}T00:00:00Z`,
  };
}

function displays(rows: AddressRowRaw[]): string[] {
  return mergeUniqueLocations(rows).map((l) => l.displayAddress);
}

describe("mergeUniqueLocations — merges variants of one premises", () => {
  it("merges a one-letter transliteration difference (Kainzanul / Kainjanul)", () => {
    const merged = mergeUniqueLocations([
      row(
        "Kainzanul, Mirzapur Bazar, Gazipur Sadar, Gazipur, Dhaka, Sadar, Gazipur",
        "BKMEA",
        "mailing",
      ),
      row("Kainjanul, Mirzapur, Gazipur Sadar Gazipur", "BGMEA", "factory"),
    ]);

    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0]!.authorities.sort(), ["BGMEA", "BKMEA"]);
  });

  it("keeps the most detailed variant, not the longest, and drops the repeated admin tail", () => {
    const merged = mergeUniqueLocations([
      row(
        "Kainzanul, Mirzapur Bazar, Gazipur Sadar, Gazipur, Dhaka, Sadar, Gazipur",
        "BKMEA",
      ),
      row("Kainjanul, Mirzapur, Gazipur Sadar Gazipur", "BGMEA"),
    ]);

    const display = merged[0]!.displayAddress;
    assert.match(display, /Mirzapur Bazar/i, "should keep the more specific 'Mirzapur Bazar'");
    assert.doesNotMatch(
      display,
      /Sadar,\s*Gazipur\s*$/i,
      "should not end with the repeated 'Sadar, Gazipur' tail",
    );
  });

  it("merges six floors of one building into one location and records the floors", () => {
    const merged = mergeUniqueLocations([
      row("Sena Kalyan  Comm. Complex (3rd Floor), Plot # 9, Block-F\nGazipur\nTongi"),
      row("Sena Kalyan  Comm. Complex (4th Floor), Plot # 9, Block-F\nGazipur\nTongi"),
      row("Sena Kalyan  Comm. Complex (6th & 8th Floor), Plot # 9, Block-F\nGazipur\nTongi"),
      row("Sena Kalyan  Comm. Complex (6th Floor), Plot # 9, Block-F\nGazipur\nTongi"),
      row("Sena Kalyan Commercial Complex (2nd Fl), Plot # 9, Block - F\nGazipur\nTongi"),
      row("Sena Kalyan Commercial Complex (7th Fl), Plot # 9, Block - F\nGazipur\nTongi"),
    ]);

    assert.equal(merged.length, 1);
    assert.ok(merged[0]!.floors.length >= 5, "should collect the floor markers it stripped");
  });

  it("merges spelling drift across seven variants at one holding (1670/2091)", () => {
    const merged = mergeUniqueLocations([
      row("1670/2091, Building # 3, West Sholashahar, Aturer Depu, Chattogram"),
      row("1670/2091, West Shaloshahar, Building # 3\nChittagong\nAturar Depot"),
      row("1670/2091, West Sholashahar, Aturar\nChittagong\nBaizid"),
      row("1670/2091, West Sholashahar, Aturar Depu\nChittagong\nBaizid"),
      row("1670/2091, West Sholashahar, Building # 3\nChittagong\nBaizid"),
      row("1670/2091, West Sholashahar, Building # 3,\nChittagong\nAturar Depot"),
      row("1670/2091, West Sholashahar, Building # 3, Aturar Depu\nChittagong\nBaizid"),
    ]);

    assert.equal(merged.length, 1);
  });

  it("merges House 14 and Plot 14 on the same road and sector", () => {
    const merged = mergeUniqueLocations([
      row("House # 14, Lake Drive Road , Sector # 7 , Uttara\nDhaka\nDhaka"),
      row("House # 14, Lake Drive Road, Sector # 07, Uttara\nDhaka\nDhaka"),
      row("Plot # 14, Lake Drive Road , Sector # 07 , Uttara\nDhaka\nDhaka"),
      row("Plot # 14, Lake Drive Road , Sector # 7 , Uttara ,  1230\nDhaka\nDhaka"),
      row("Plot # 14, Lake Drive Road, Sector # 7, Uttara\nDhaka\nDhaka"),
    ]);

    assert.equal(merged.length, 1);
  });

  it("merges Maymashingo and Mymensing variants at Sm Tower 80/6 with both authorities", () => {
    const merged = mergeUniqueLocations([
      row("Sm Tower, 80/6 Maymashingo Road, Dhaka", "EPB", "registered"),
      row("Sm Tower, 80/6 Mymensing Road, Dhaka", "BGMEA", "factory"),
    ]);

    assert.equal(merged.length, 1);
    assert.ok(merged[0]!.authorities.includes("EPB"));
    assert.ok(merged[0]!.authorities.includes("BGMEA"));
  });

  it("merges an ALL CAPS variant with its title-cased twin", () => {
    const merged = mergeUniqueLocations([
      row("68/V, Sagarica Road (2nd Floor),  Pahartoli\nChittagong\nChittagong"),
      row("68/V SAGORIKA ROAD, PAHARTALI, CHATTOGRAM., , CHATTOGRAM"),
    ]);

    assert.equal(merged.length, 1);
  });
});

describe("mergeUniqueLocations — refuses to merge different premises", () => {
  it("keeps disjoint BSCIC plot sets apart", () => {
    const out = displays([
      row("Plot # A-23, S-6, BSCIC I/E, Kalurghat\nChittagong\nChittagong"),
      row("Plot # A-49-50, BSCIC I/E, Kalurghat\nChittagong\nChittagong"),
    ]);
    assert.equal(out.length, 2, `A-23 and A-49-50 are different plots, got: ${out.join(" | ")}`);
  });

  it("treats overlapping plot sets as the same premises", () => {
    const out = displays([
      row("Plot # A-23, S-6, BSCIC I/E, Kalurghat\nChittagong\nChittagong"),
      row("Plot # A-23, 24, 25 & 26, BSCIC I/E, Kalurghat\nChittagong\nChittagong"),
    ]);
    assert.equal(out.length, 1, "both name plot A-23, so they are one premises");
  });

  it("keeps two different plot ranges in the same EPZ apart", () => {
    const out = displays([
      row("Plot # 246-249, Adamjee EPZ, Siddirgonj\nNarayangonj\nNarayangonj"),
      row("Plot # 97 - 101, Adamjee EPZ, Siddirgonj\nNarayanganj\nNarayangonj"),
    ]);
    assert.equal(out.length, 2, `different EPZ plots, got: ${out.join(" | ")}`);
  });

  it("keeps adjacent holding numbers apart (686 vs 687 CDA R/A)", () => {
    const out = displays([
      row("686, CDA R/A (2nd Floor), Road # 20 , Agrabad\nChittagong\nChittagong"),
      row("687, CDA R/A, Road # 20 , Agrabad\nChittagong\nChittagong"),
    ]);
    assert.equal(out.length, 2, `686 and 687 are different holdings, got: ${out.join(" | ")}`);
  });

  it("keeps two unrelated streets apart even though they share a district", () => {
    const out = displays([
      row("29, Baniatila, Station Road, Pahartoli\nChittagong\nChittagong"),
      row("68/V, Sagarica Road (2nd Floor),  Pahartoli\nChittagong\nChittagong"),
    ]);
    assert.equal(out.length, 2, `different roads, got: ${out.join(" | ")}`);
  });

  it("never merges on administrative words alone", () => {
    const out = displays([
      row("Konabari, Gazipur Sadar, Gazipur, Dhaka"),
      row("Chandra, Gazipur Sadar, Gazipur, Dhaka"),
    ]);
    assert.equal(out.length, 2, `Konabari and Chandra are different places, got: ${out.join(" | ")}`);
  });

  it("splits a market's two holdings rather than guessing they are one", () => {
    // 670 and 671 Datta Para are adjacent holdings of the same market. We
    // deliberately keep them separate: conservative, and no registry fact lost.
    const out = displays([
      row("671, Dattopara, Hossain Market, Tongi, Gazipur - 1712, Bangladesh"),
      row("Hossain Market (4th & 5th Fl), 670, Datta Para, Tongi\nGazipur\nGazipur"),
      row("Hossain Market (4th & 5th Fl), 671, Datta Para , Tongi\nGazipur\nGazipur"),
      row("Hossain Market (5th Floor), 670, Datta Para, Tongi\nGazipur\nGazipur"),
      row("Hossain Market (5th Floor), 671, Datta Para,Tongi\nGazipur\nGazipur"),
    ]);
    assert.equal(out.length, 2, `expected one location per holding, got: ${out.join(" | ")}`);
  });
});

describe("mergeUniqueLocations — block letters", () => {
  it("merges a bare plot number with the same number carrying a block letter", () => {
    const out = displays([
      row("Plot# A-51, BSCIC I/E, Shasongaon, Fatullah, Narayanganj., 1420, Narayanganj"),
      row("ROAD # 1, PLOT # 50-51, BSCIC I/E, SHASONGAON, FATULLAH, NARAYANGANJ"),
    ]);
    assert.equal(out.length, 1, `A-51 and 50-51 name plot 51, got: ${out.join(" | ")}`);
  });

  it("keeps the same number in different blocks apart", () => {
    const out = displays([
      row("Plot # A-23, BSCIC I/E, Kalurghat\nChittagong\nChittagong"),
      row("Plot # B-23, BSCIC I/E, Kalurghat\nChittagong\nChittagong"),
    ]);
    assert.equal(out.length, 2, `block A and block B differ, got: ${out.join(" | ")}`);
  });

  it("reads a plot number through 'PLOT NO-' and slash-written ranges", () => {
    const out = displays([
      row("Plot # B/336 - 337, Bscic Hosiery I/A, Shasangaon, Fatullah, 1420, Narayanganj"),
      row("PLOT NO- B-336 & 337, BSCIC HOSIERY I/A, SHASHONGAON, FATULLAH, NARAYANGANJ., SADAR"),
    ]);
    assert.equal(out.length, 1, `same plots written two ways, got: ${out.join(" | ")}`);
  });

  it("keeps different plots in the same block apart (I/10 vs I/16)", () => {
    const out = displays([
      row("Plot-I/16, Block-K, Rupnagar-I/A, Section-2, Mirpur PS, Dhaka - 1216, Bangladesh"),
      row("Plot-I/10, Block-K, Rupnagar-I/A, Section-2, Mirpur, Dhaka"),
    ]);
    assert.equal(out.length, 2, `plot I/10 is not plot I/16, got: ${out.join(" | ")}`);
  });

  it("merges two identical addresses whose every word is administrative", () => {
    const out = displays([
      row("Plot # C5-C7, BSCIC Industrial Area, Kalurghat, Chattogram, Chittagong"),
      row("Plot# C5-C7 BSCIS Industrial Area, Kalurghat, Chittagong"),
    ]);
    assert.equal(out.length, 1, `same plots C5-C7, got: ${out.join(" | ")}`);
  });

  it("treats FS-02 and FS-2 as one plot", () => {
    const out = displays([
      row("Plot # FS-02, Road # 2, Chittagong, CEPZ"),
      row("Plot # FS-2, Road # 2, Chittagong, CEPZ"),
    ]);
    assert.equal(out.length, 1, `leading zero is formatting, got: ${out.join(" | ")}`);
  });
});

describe("cleanAddressString", () => {
  it("drops empty segments so double commas never render", () => {
    assert.equal(
      cleanAddressString("Sm Tower,, 80/6 Road, , Dhaka"),
      "Sm Tower, 80/6 Road, Dhaka",
    );
  });

  it("splits embedded newlines into comma-separated segments", () => {
    assert.equal(
      cleanAddressString("Plot # 9, Block-F\nGazipur\nTongi"),
      "Plot # 9, Block-F, Gazipur, Tongi",
    );
  });

  it("removes a trailing admin token that already appears earlier", () => {
    assert.equal(
      cleanAddressString("Kainzanul, Mirzapur Bazar, Gazipur Sadar, Gazipur, Dhaka, Sadar, Gazipur"),
      "Kainzanul, Mirzapur Bazar, Gazipur Sadar, Gazipur, Dhaka",
    );
  });

  it("leaves a genuinely distinct tail alone", () => {
    assert.equal(
      cleanAddressString("29, Baniatila, Station Road, Pahartoli, Chittagong"),
      "29, Baniatila, Station Road, Pahartoli, Chittagong",
    );
  });
});

describe("normaliseAddressKey", () => {
  it("normalises spelling variants to the same token key", () => {
    const a = normaliseAddressKey("Sm Tower, 80/6 Maymashingo Road, Dhaka");
    const b = normaliseAddressKey("Sm Tower, 80/6 Mymensing Road, Dhaka");
    assert.ok(a.includes("mymensingh"));
    assert.ok(b.includes("mymensingh"));
  });

  it("expands industrial-estate abbreviations to one form", () => {
    for (const variant of [
      "BSCIC I/E, Kalurghat",
      "BSCIC I/A, Kalurghat",
      "BSCIC In/Estate, Kalurghat",
      "BSCIC Industrial Estat, Kalurghat",
    ]) {
      assert.match(
        normaliseAddressKey(variant),
        /industrial estate/,
        `${variant} should normalise to 'industrial estate'`,
      );
    }
  });

  it("normalises CTG to chattogram", () => {
    assert.match(normaliseAddressKey("Kalurghat, CTG"), /chattogram/);
  });
});
