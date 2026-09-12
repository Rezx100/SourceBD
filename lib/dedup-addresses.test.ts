import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLocationOverview,
  cleanAddressString,
  idSetsOverlap,
  mergeUniqueLocations,
  normaliseAddressKey,
  premisesIdentifiers,
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

  it("REZ-112: merges Epyllion Bahadurpur short BGMEA + long OEKO (Bhawal/Vawal)", () => {
    const merged = mergeUniqueLocations([
      row(
        "Bahadurpur, P.O.-Bhawal, Mirzapur, Gazipur Sadar\nGazipur\nGazipur",
        "BGMEA",
        "factory",
      ),
      row(
        "Bahadurpur, Post: Vawal Mirzapur, Gazipur Sadar, Gazipur - 1703, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      row(
        "Nayapara, Bhawal, Mirzapur, Gazipur Sadar, Gazipur - 1703, Bangladesh",
        "OEKO_TEX",
        "factory",
      ),
      row(
        "Nina Kabbo, 227/A, Gulshan-Tejgaon Link Road, Tejgaon\nDhaka\nDhaka",
        "BGMEA",
        "mailing",
      ),
    ]);
    const factories = merged.filter((l) => l.types.includes("factory"));
    const mailings = merged.filter((l) => l.types.includes("mailing"));
    assert.equal(factories.length, 2, "Nayapara + one Bahadurpur");
    assert.equal(mailings.length, 1);
    const bahadurpur = factories.find((l) =>
      /bahadurpur/i.test(l.displayAddress),
    );
    assert.ok(bahadurpur);
    assert.deepEqual(bahadurpur!.authorities.sort(), ["BGMEA", "OEKO_TEX"]);
    assert.ok(factories.some((l) => /nayapara/i.test(l.displayAddress)));
  });

  it("REZ-112: does not merge Nayapara with Bahadurpur when both use Post/P.O. Bhawal", () => {
    assert.equal(
      mergeUniqueLocations([
        row(
          "Bahadurpur, P.O.-Bhawal, Mirzapur, Gazipur Sadar",
          "BGMEA",
          "factory",
        ),
        row(
          "Nayapara, Post: Vawal Mirzapur, Gazipur Sadar, Gazipur - 1703, Bangladesh",
          "OEKO_TEX",
          "factory",
        ),
      ]).length,
      2,
    );
    assert.equal(
      mergeUniqueLocations([
        row("Bahadurpur, P.O.-Bhawal, Mirzapur, Gazipur Sadar", "BGMEA"),
        row("Nayapara, P.O.-Bhawal, Mirzapur, Gazipur Sadar", "OEKO_TEX"),
      ]).length,
      2,
    );
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

  it("REZ-112: Vawal → bhawal and P.O./Post: → post", () => {
    assert.match(normaliseAddressKey("Post: Vawal Mirzapur"), /bhawal/);
    assert.match(normaliseAddressKey("P.O.-Bhawal, Mirzapur"), /bhawal/);
    assert.match(normaliseAddressKey("P.O.-Bhawal"), /\bpost\b/);
    assert.match(normaliseAddressKey("Post: Vawal"), /\bpost\b/);
  });

  it("maps Bangla script road/bazar words into English comparison tokens", () => {
    assert.match(normaliseAddressKey("মৌজা Kewa রোড"), /mouza/);
    assert.match(normaliseAddressKey("মৌজা Kewa রোড"), /road/);
  });
});

describe("mergeUniqueLocations — one row per premises (founder posture)", () => {
  it("merges Habitus Fashion factory spellings into one premises with variants", () => {
    const merged = mergeUniqueLocations([
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
    ]);
    assert.equal(merged.length, 1, `expected one factory, got: ${merged.map((l) => l.displayAddress).join(" | ")}`);
    assert.deepEqual(merged[0]!.authorities.sort(), ["BGMEA", "BKMEA", "OEKO_TEX"]);
    assert.ok(merged[0]!.variants.length >= 1, "alternate spellings must stay visible");
    assert.ok(
      merged[0]!.variants.some((v) => v.authorities.includes("BGMEA") || v.authorities.includes("BKMEA")),
    );
  });

  it("merges Fakhruddin Textile Mills factory Kewa / Ghorgaria / Mouza Kewa", () => {
    const merged = mergeUniqueLocations([
      row("Kewa, Ghorgaria, Master Bari, Sreepur\nGazipur\nGazipur", "BGMEA"),
      row("MOUZA KEWA, SREEPUR, GAZIPUR", "BKMEA"),
      row(
        "Ghargaria Master Bari, Kewa, Sreepur, Gazipur - 1740, Bangladesh",
        "OEKO_TEX",
      ),
    ]);
    assert.equal(merged.length, 1, `expected one Kewa factory, got: ${merged.map((l) => l.displayAddress).join(" | ")}`);
    assert.deepEqual(merged[0]!.authorities.sort(), ["BGMEA", "BKMEA", "OEKO_TEX"]);
  });

  it("merges Fakir Khali / Fokirkhali mailing as one spelling variant", () => {
    assert.equal(
      displays([
        row("Fakir Khali Road, Boro Beraid, Badda\nDhaka\nDhaka", "BGMEA", "mailing"),
        row("FOKIRKHALI ROAD, BORO BERAID, BADDA, DHAKA, BADDA, DHAKA", "BKMEA", "mailing"),
      ]).length,
      1,
    );
  });

  it("joins High Way / Highway and Siddirganj / Siddirgonj as one premises", () => {
    assert.equal(
      displays([
        row("Lithe Complex, Asian High Way, Shanarpar\nNarayanganj\nSiddirganj"),
        row("LITHE COMPLEX, ASIAN HIGHWAY, SHANARPAR, SIDDIRGONJ,, , NARAYANGANJ"),
      ]).length,
      1,
    );
  });

  it("does not merge Sreepur with Sripur even on the same plot number", () => {
    assert.equal(
      displays([
        row("Plot 5, Sreepur, Gazipur"),
        row("Plot 5, Sripur, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge bare Nawabganj with Chapainawabganj", () => {
    assert.equal(
      displays([
        row("Nawabganj, Dhaka"),
        row("Chapainawabganj, Rajshahi"),
      ]).length,
      2,
    );
  });

  it("still keeps Nayapara and Bahadurpur apart when they share a Bhawal tail", () => {
    assert.equal(
      displays([
        row("Bahadurpur, P.O.-Bhawal, Mirzapur, Gazipur Sadar", "BGMEA"),
        row("Nayapara, P.O.-Bhawal, Mirzapur, Gazipur Sadar", "OEKO_TEX"),
      ]).length,
      2,
    );
  });

  it("does not merge a Dhaka mailing with a Narayanganj factory copied as mailing", () => {
    assert.equal(
      displays([
        row("39, Dilkusha C/A,\nDhaka\nMotijheel", "BGMEA", "mailing"),
        row("LITHE COMPLEX, ASIAN HIGHWAY, SHANARPAR, SIDDIRGONJ,, , NARAYANGANJ", "BKMEA", "mailing"),
      ]).length,
      2,
    );
  });

  it("merges Plot 01 / Sector 07 with Plot 1 / Sector 7 at CEPZ", () => {
    assert.equal(
      displays([
        row("Plot # 1, Sector # 7, CEPZ, Chittagong"),
        row("PLOT # 01, SECTOR # 07, CEPZ"),
      ]).length,
      1,
    );
  });

  it("merges Plot#5&7 Road-06 with Plot 5 & 7 Road 6 at Ashutia", () => {
    assert.equal(
      displays([
        row("Plot # 5 & 7, Road # 6, Ashutia, Dhour, Turag, Dhaka"),
        row("Plot#5&7, Road-06, Ashutia, Dhour, Turag, Dhaka-1230"),
      ]).length,
      1,
    );
  });

  it("merges House 17 Sector 01 Road 06 with House 17 Road 6 Sector 1 Uttara", () => {
    assert.equal(
      displays([
        row("House # 17, Road # 6, Sector # 1, Uttara, Dhaka-1230", "BGMEA", "mailing"),
        row("House- 17, Sector - 01, Road- 06, Uttara, Dhaka-1230", "BKMEA", "mailing"),
      ]).length,
      1,
    );
  });

  it("merges Holding 98 Choydana with 98 Choydana despite N-University lexicon drift", () => {
    assert.equal(
      displays([
        row("98, Choydana, N-University, Gasa, Gazipur, 1704, Dhaka, Bangladesh"),
        row("Holding # 98, Choydana, National University, Gazipur"),
      ]).length,
      1,
    );
  });

  it("does not merge House 1 Mirpur with Plot 1 CEPZ", () => {
    assert.equal(
      displays([
        row("House # 1, Road # 9, Block - A, Section # 12, Dhaka, Mirpur"),
        row("Plot # 1, Sector # 7, CEPZ, Chittagong"),
      ]).length,
      2,
    );
  });

  it("does not merge House 17 Road 6 with House 17 Road 3 in Uttara", () => {
    assert.equal(
      displays([
        row("House # 17, Road # 6, Sector # 1, Uttara, Dhaka-1230", "BGMEA", "mailing"),
        row("House # 17, Road # 3, Sector # 7, Uttara, Dhaka-1230", "BKMEA", "mailing"),
      ]).length,
      2,
    );
  });

  it("does not merge Plot 51 Uttara with Plot 51 CEPZ", () => {
    assert.equal(
      displays([
        row("Plot 51, Uttara, Dhaka"),
        row("Plot 51, CEPZ, Chittagong"),
      ]).length,
      2,
    );
  });

  it("merges Plot S-18-19 with Plot No: S-18-19 BSCIC I/E Konabari", () => {
    assert.equal(
      displays([
        row("Plot # S-18-19, BSCIC Industrial Estate, Konabari, Gazipur"),
        row("Plot No: S-18-19 BSCIC I/E, Konabari, Gazipur - 1700, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("merges Plot A 12/13 with A12-A13 at BSCIC Dhamrai", () => {
    assert.equal(
      displays([
        row("Plot No. A 12/13, BSCIC I/E, Dhamrai, 1350, Dhaka, Bangladesh"),
        row("Plot No. A12-A13, BSCIC I/E. Dhamrai, Dhaka"),
      ]).length,
      1,
    );
  });

  it("merges Jarun (South) with Jaurn (South) Kashimpur", () => {
    assert.equal(
      displays([
        row("Jarun (South), Kashimpur, Gazipur - 1700, Bangladesh"),
        row("JAURN (SOUTH), KASHIMPUR, GAZIPUR"),
      ]).length,
      1,
    );
  });

  it("merges 31/A Issha Khan Road with 31 Ishkha Road", () => {
    assert.equal(
      displays([
        row("31/A, Issha Khan Road, Narayangonj", "BGMEA", "mailing"),
        row("31 ISHKHA ROAD., SADAR, NARAYANGANJ", "BKMEA", "mailing"),
      ]).length,
      1,
    );
  });

  it("merges NEW 129/B Mokaroba with New 129/B Mokorba Road", () => {
    assert.equal(
      displays([
        row("NEW 129/B, MOKAROBA ROAD, NAGAR KHANPUR, NARAYANGANJ", "BGMEA", "mailing"),
        row("New 129/B Mokorba Road, Nagar Khanpur, Narayanganj", "BKMEA", "mailing"),
      ]).length,
      1,
    );
  });

  it("merges F-14 Eastern Housing with Plot 14 Block F Pallabi", () => {
    assert.equal(
      displays([
        row("Plot # 14, Block # F, Eastern Housing, Pollabi 2nd Part, Mirpur, Dhaka"),
        row("F-14, Eastern Housing Main Road Pallabi, 2nd part"),
      ]).length,
      1,
    );
  });

  it("merges Anwar Tower with Anower Tower at Gouripur Ashulia", () => {
    assert.equal(
      displays([
        row("ANWAR TOWER, B-BANGLA, GOURIPUR, ASHULIA, SAVAR, DHAKA, 1341, DHAKA, Bangladesh"),
        row("Anower Tower, B-Bangla, Gouripur, Ashulia, Savar, 1341, Dhaka, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("merges DEPZ FSSFB#2 with FS-SFB-2", () => {
    assert.equal(
      displays([
        row("FSSFB#2, DEPZ (Old Zone), Ashulia, 1349, Savar, Bangladesh"),
        row("FS-SFB-2, Dhaka EPZ (Old Zone), Ashulia, Savar"),
      ]).length,
      1,
    );
  });

  it("merges Kalurghat 12 P & 13 P with 12P AND 13P and keeps FIDC Road apart", () => {
    const merged = displays([
      row("Plot No. 12 P & 13 P, Kalurghat Heavy I/A, Chattogram - 4212, Bangladesh"),
      row("PLOT NO. 12P AND 13P, KALURGHAT INDUSTRIAL AREA, CHITTAGONG"),
      row("B-8/A-B, FIDC Road, BSCIC I/A, Chittagong"),
    ]);
    assert.equal(merged.length, 2);
    assert.ok(merged.some((d) => /12/i.test(d)));
    assert.ok(merged.some((d) => /FIDC/i.test(d)));
  });

  it("does not merge Green City Edge 86 Kakrail with 89 Kakrail", () => {
    assert.equal(
      displays([
        row("GREEN CITY EDGE (12-14TH FLOOR), 86 KAKRAIL C/A, PALTAN, DHAKA", "BGMEA", "mailing"),
        row("Green City Edge (12th -14th Floor), 89, Kakrail C/A Dhaka- 1000.", "BKMEA", "mailing"),
      ]).length,
      2,
    );
  });

  it("merges Baro Narayonpur with Boro Narayanpur at Dhamrai", () => {
    assert.equal(
      displays([
        row("Baro Narayonpur, Saturia - Kalampur Road, Saturia, Dhamrai, Dhaka - 1350, Bangladesh"),
        row("Boro Narayanpur, Amta, Dhamri, Dhaka"),
      ]).length,
      1,
    );
  });

  it("merges Akholia with Ahakhalia at Hazir Bazar", () => {
    assert.equal(
      displays([
        row("Akholia, Hazir Bazar, Mollikbari, Valuka, Mymensingh"),
        row("Ahakhalia, Hazir Bazar, Bhaluka, Mymensingh - 2240, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("merges Hazi Mohammad Ismail Chowdhury Bhaban with Haji Ismail Chowdhury Bhaban", () => {
    assert.equal(
      displays([
        row(
          "Hazi Mohammad Ismail Chowdhury Bhaban (2nd Floor), Chandana Chowrasta, Gazipur Sadar, Gazipur - 1702, Bangladesh",
        ),
        row("Haji Ismail Chowdhury Bhaban, Chandana Chowrasta, Gazipur"),
      ]).length,
      1,
    );
  });

  it("merges FSFB.1 with FSFB # 01 at Karnaphuli EPZ", () => {
    assert.equal(
      displays([
        row("FSFB.1, KARNAPHULI EXPORT PROCESSING ZONE, NORTH PATENGA, CHATTOGRAM"),
        row("FSFB # 01, KARNAFULI EPZ; Patenga PS; Chittagong-4204"),
      ]).length,
      1,
    );
  });

  it("merges MS-SFB-01&02 with Plot MS-SFB # 01 & 02 at Adamjee EPZ", () => {
    assert.equal(
      displays([
        row("MS-SFB-01&02 Adamjee EPZ, Shiddhirganj, Narayanganj, 1431, Narayanganj, Bangladesh"),
        row("Plot # MS-SFB # 01 & 02, Adamjee Nagar, Siddirgonj, Narayangonj"),
      ]).length,
      1,
    );
  });

  it("merges Plot 799 (Old #1010-1011) with 799 OLD PLOT 1010, 1011 at Ambag", () => {
    assert.equal(
      displays([
        row("Plot # 799(Old #1010-1011), Ambag, Mouza- Baghia, Gazipur"),
        row("799 (OLD PLOT NO.: 1010, 1011) AMBAG, MOUZA BAGHIA"),
      ]).length,
      1,
    );
  });

  it("merges A-69 & 76 BSCIC with A-76 at Fatullah", () => {
    assert.equal(
      displays([
        row("A-69 & 76 BSCIC I/A, Narayanganj, Fatullah"),
        row("A-76 BSCIC HOSIERY I/A, FATULLAH, NARAYANGANJ"),
      ]).length,
      1,
    );
  });

  it("merges Natun Para Baipail Beside-DEPZ-2 with Notun Para Baipal", () => {
    assert.equal(
      displays([
        row("Natun Para, Baipail (Beside-DEPZ-2), Savar, Dhaka, 1349, Dhaka, Bangladesh"),
        row("NOTUN PARA, BAIPAL, BESIDE DEPZ-2, SAVAR, DHAKA"),
      ]).length,
      1,
    );
  });

  it("merges Plot S.A.-179 RS-1356 Jamgara with Plot 179 Jamgora", () => {
    assert.equal(
      displays([
        row("Plot No. S.A.-179, R.S.-1356, Jamgara, Ashulia, Savar, Dhaka, Bangladesh, Zip Code-1349"),
        row("Plot # 179, RS-1356, Jamgora, Ashulia, Dhaka"),
      ]).length,
      1,
    );
  });

  it("merges Holding 574 (Former #295) with Holding 295 at Boherarchala", () => {
    assert.equal(
      displays([
        row(
          "Holding # 574 (Former #295)Block # C, Word # 9, Boherarchala, Sreepur Municipality, Ansar Road, Sreepur, Gazipur",
        ),
        row("Kewa, Boherarchala, Holding # 295, Block # C, Ward # 09, Sreepur, Gazipur-1740"),
      ]).length,
      1,
    );
  });

  it("merges Fac: Choto Benairchar with Choto Binair Char", () => {
    assert.equal(
      displays([
        row("Fac: Choto Benairchar, Araihazar, Narayangonj."),
        row("Choto Binair Char, Araihazar, Narayangonj."),
      ]).length,
      1,
    );
  });

  it("merges Kashor Habirbari with Kashor Master Bari Seed Store", () => {
    assert.equal(
      displays([
        row("Village: Kashor, Word No-06, PO: Habirbari, Thana: Bhaluka, Mymensingh - 2240, Bangladesh"),
        row("KASHOR, MASTER BARI, SEED STORE, BHALUKA, Mymensingh"),
      ]).length,
      1,
    );
  });

  it("merges H/0-10 Dalla with H/O-10 Dailla Demra", () => {
    assert.equal(
      displays([
        row("H/0-10, 13, Dalla, Demra, Dhaka"),
        row("H/O-10, Dailla, Demra, Dhaka - 1360, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("merges SSFB No-03 with Plot SSFB-3 at Adamjee EPZ", () => {
    assert.equal(
      displays([
        row("SSFB No-03, Plot-259-260, 277 & 278, EPZ, Siddhirganj, Narayanganj - 1431, Bangladesh"),
        row("Plot # SSFB-3, Narayanganj, Adamjee EPZ"),
      ]).length,
      1,
    );
  });

  it("merges G.P.TA-50 with GPTA 50 at Mohakhali", () => {
    assert.equal(
      displays([
        row("G.P.TA-50 (1st Floor), Airport Road, Mohakhali C/A, Gulshan, Dhaka-1212."),
        row("GPTA 50, Mohakhali C/A, Gulshan, Dhaka-1212."),
      ]).length,
      1,
    );
  });

  it("merges Nishchintapur with NISHNTIPUR at Mouchak", () => {
    assert.equal(
      displays([
        row("Nishchintapur, Mouchak, Kaliakoir, Gazipur - 1751, Bangladesh"),
        row("NISHNTIPUR, MOUCHAK, KALIAKOIR, GAZIPUR"),
      ]).length,
      1,
    );
  });

  it("merges CEPZ Plot 57-59 with a unit-list that also names Plot 57-59", () => {
    assert.equal(
      displays([
        row(
          "Unit-1 Production Unit Plot# 57-59, Sector 1, Export Processing Zone;, Unit-2 Washing Plot# 1-2, Sector 1, Export Processing Zone, 4223 Chittagong, Bangladesh",
        ),
        row("Plot#57, 58 & 59, Sector#1, CEPZ, Chattogram, Bangladesh, EPZ"),
      ]).length,
      1,
    );
  });

  it("merges Atlas Rangs Plaza with Altas Rangs Plaza at Agrabad", () => {
    assert.equal(
      displays([
        row("Atlas Rangs Plaza (6th floor), 7, Shekh Mujib Road, Agrabad C/A, Chattogram"),
        row("Altas Rangs Plaza (6th floor), 7, Shekh Mujib Road Agrabad C/A, Chattogram"),
      ]).length,
      1,
    );
  });

  it("merges Chanmary with Chandmari at Fatullah", () => {
    assert.equal(
      displays([
        row("Chanmary, Narayanganj, Fatullah", "BGMEA", "mailing"),
        row("CHANDMARI, FATULLAH, NARAYANGANJ", "BKMEA", "mailing"),
      ]).length,
      1,
    );
  });

  it("merges Borkan Monipur with Bokran Monipur", () => {
    assert.equal(
      displays([
        row("Borkan Monipur, Hotapara, Mirzapur Union, Gazipur, Joydevpur"),
        row("Bokran Monipur, Sadar, 1700, Gazipur, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("merges Shooghat/Saughatm with Vulta/Bholta as one village spelling", () => {
    assert.equal(
      displays([
        row("Shooghat, Vulta, Narayanganj, Rupganj"),
        row("SAUGHATM, BHOLTA, NARAYANGANJ"),
      ]).length,
      1,
    );
  });

  it("merges Horihorpara with Harihapara at the same industrial park", () => {
    assert.equal(
      displays([
        row("BSCIC INDUSTRIA PARK, HORIHORPARA, ENAYETNAGAR, FATULLAH, NARAYANGANJ"),
        row("Harihapara, Shilpo Park, Fatullah, Narayanganj"),
      ]).length,
      1,
    );
  });

  it("merges Dasergaw with Dasergaul at Lokhonkhola", () => {
    assert.equal(
      displays([
        row("Dasergaw, Lokhonkhola, Bandar, Narayanganj, 1400, Narayanganj, Bangladesh"),
        row("Dasergaul, Lokhonkhola, Bandar, Narayanganj-1400"),
      ]).length,
      1,
    );
  });

  it("merges Kharuli holding 160 with Kharuail ward 7 and keeps Voradoba apart", () => {
    const merged = mergeUniqueLocations([
      row("Holding: 160, Kharuli, Ward no-07, Madrasha Mohalla-L(136-161/10), Municipal Area"),
      row("Kharuail, 7 No. Ward, Bhaluka Municipality, Mymensingh - 2240, Bangladesh"),
      row("Purana, Voradoba, Valuka, Mymensingh"),
    ]);
    assert.equal(merged.length, 2, `got: ${merged.map((l) => l.displayAddress).join(" | ")}`);
  });

  it("merges Shrikedia with Serkondia at Molla Market", () => {
    assert.equal(
      displays([
        row("Shrikedia, Molla Market, Ashulia, Savar, 1341, Dhaka, Bangladesh"),
        row("Serkondia, Molla Market, Ashulia, Savar, Dhaka"),
      ]).length,
      1,
    );
  });

  it("merges Telirchala with Telir Chala and keeps Jogirchala apart", () => {
    const merged = mergeUniqueLocations([
      row(
        "414, Mouza, Kouchakuri (DAG No. SA 2006, 2008), Telirchala, Mouchak, Kaliakoir, Gazipur - 1751, Bangladesh",
      ),
      row("Jogirchala, Mouchak, Kaliakoir, Gazipur."),
      row("Telir Chala Mouchak, Gazipur, Kaliakoir"),
    ]);
    assert.equal(merged.length, 2, `got: ${merged.map((l) => l.displayAddress).join(" | ")}`);
  });

  it("merges Budichor/Burishchar Dofpool/Dhoppole at the same complex", () => {
    assert.equal(
      displays([
        row("A.T.M. COMPLEX, SOUTH BUDICHOR, DOFPOOL, HATHAZARI PS, CHITTAGONG-4330, BANGLADESH"),
        row("A.T.M. Complex, South Burishchar, Dhoppole, Hathazari, Chittagong"),
      ]).length,
      1,
    );
  });

  it("merges BEZA Zone-6 with Zone-06 at Mirsarai under two estate names", () => {
    assert.equal(
      displays([
        row("Bangabondhu Sheikh Mujib Shilpo Nagar Zone-6, BEZA, Mirsarai-4230, Chattogram."),
        row(
          "Bangladesh National Special Economic Zone, Zone-06, Mirsharai Economic Zone, BEZA, Mirsharai, Chittagong - 4320",
        ),
      ]).length,
      1,
    );
  });

  it("merges Le Meridien 79/A office-block wording with the shorter 79/A listing", () => {
    assert.equal(
      displays([
        row(
          "LE MERIDIEN DHAKA 5TH FLOOR (NORTH CORNER, OFFICE BLOCK-2, 3, 4) 79/A, COMMERCIAL AREA, AIRPORT ROAD, NIKUNJA-02, KHILKHET",
          "BGMEA",
          "mailing",
        ),
        row("Le Meridien (Level-05), 79/A, Commercial Space, Nikunja-2, Khilkhet, Dhaka", "BKMEA", "mailing"),
      ]).length,
      1,
    );
  });

  it("merges Kobi vs Kabi Jashimuddin Road 60/2-G and keeps the Adamjee factory apart", () => {
    const merged = mergeUniqueLocations([
      row("60/2-G, Kobi Jashimuddin Road, Tekpara, Pagar, Gazipur"),
      row("Plot # 111-114, Adamjee EPZ, Adamjee Nagar, Siddhirgonj, Narayangonj"),
      row("60/2-G Kabi Jashim Uddin Rd, Tekpara, Pegar, 1710, Tongi, Bangladesh"),
    ]);
    assert.equal(merged.length, 2, `got: ${merged.map((l) => l.displayAddress).join(" | ")}`);
  });

  it("merges Gazirchat with Gaziir Chat after stripping a dag number", () => {
    assert.equal(
      displays([
        row("Daag-49, Kaichabari Road, Gazirchat Alia Madrasha, Ashulia, Savar, Dhaka, Bangladesh"),
        row("Gaziir Chat Alia madrasha, Kaichabari Road, Dhamsona, Ashulia, Savar, Dhaka."),
      ]).length,
      1,
    );
  });

  it("merges Nayadingi with Nayadighi and keeps the Mirpur plot apart", () => {
    const merged = mergeUniqueLocations([
      row("Plot - I/10, Block - K, Rupnagar Industrial Area, Mirpur-2, Rupnagar, Dhaka - 1216, Bangladesh"),
      row("Nayadingi, Saturia, Saturia PS, Manikganj - 1810, Bangladesh"),
      row("Nayadighi, Manikganj, Saturia"),
    ]);
    assert.equal(merged.length, 2, `got: ${merged.map((l) => l.displayAddress).join(" | ")}`);
  });

  it("merges POLO-B-46-47 with B-46/47 at BSCIC Fatullah", () => {
    assert.equal(
      displays([
        row("B-46/47, 64/65, BLOCK-B, BSCIC HOSIERY I/E, FATULLAH, NARAYANGANJ"),
        row("POLO-B-46-47, BSCIC I/A, SHASONGAON, FATULLAH, NARAYANGANJ, BANGLADESH"),
      ]).length,
      1,
    );
  });

  it("merges Dag 439 with Dug 439 at Dhour and keeps Bara Rangamatia apart", () => {
    const merged = mergeUniqueLocations([
      row("Dag No. 439, Dhour, Turag, Uttara, Dhaka, 1230, DHAKA, Bangladesh"),
      row("Dug # 439, Dhour, Turag, Dhaka, Uttara"),
      row("Bara Rangamatia, Ashulia, Savar, Dhaka"),
    ]);
    assert.equal(merged.length, 2, `got: ${merged.map((l) => l.displayAddress).join(" | ")}`);
  });

  it("merges Dogorgaon with Dohargaon and keeps Dogair Demra apart", () => {
    const merged = mergeUniqueLocations([
      row("Dogair, Purbopara, Choto Murgir Firm Sarulia, Demra, Dhaka"),
      row("Dogorgaon, Baliapara, Rupgonj, Narayanganj, 1460, Narayanganj – Dhaka, Bangladesh"),
      row("Dohargaon, P.O.-Balipara, P.S.-Rupgonj, Narayanganj"),
    ]);
    assert.equal(merged.length, 2, `got: ${merged.map((l) => l.displayAddress).join(" | ")}`);
  });

  it("merges Rugunathpur with Ragunahpur behind a bhaban vs union wrapper", () => {
    assert.equal(
      displays([
        row("Chowdhury Bhaban, Rugunathpur, Jorargonj, Mirsharai, Chattogram"),
        row("Durgapur Union, Ragunahpur, Jorargonj, Mirsharai, Chattogram"),
      ]).length,
      1,
    );
  });

  it("merges Mirzapur Purbapara with cadastral SA/RS lists of the same mouza", () => {
    assert.equal(
      displays([
        row("SA/RS 595-1123, 592-1122, 593-1119, Mirzapur Mouza No # 8, Mirzapur Purba Para, Gazipur Sadar"),
        row("Mirzapur Purbapara, 08 No Mirzapur Mouza, Mirzapur, Gazipur Sadar, Gazipur - 1703, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("does not merge Mirpur with Mirzapur as a spelling of the same village", () => {
    assert.equal(
      displays([
        row("Mirpur, Dhaka"),
        row("Mirzapur, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not treat the word Village as a shared place named age", () => {
    assert.equal(
      displays([
        row("Village Kewa, Sreepur, Gazipur"),
        row("Village Konabari, Kaliakoir, Gazipur"),
      ]).length,
      2,
    );
  });

  it("merges Chandora holding D-84 with Chandora Shafipur as extra holding detail", () => {
    assert.equal(
      displays([
        row("Ward No. 07, Holding No. D-84, Area: Chandora, Kaliakoir Pouroshova Kaliakoir, Gazipur-1751"),
        row("Chandora, Shafipur, Kaliakoir, Gazipur"),
      ]).length,
      1,
    );
  });

  it("merges Plot 1113/A with the 1113-1115 list at Beron/Berun Jamgora", () => {
    assert.equal(
      displays([
        row("Plot No. 1113/A, Beron, Jamgora Ashulia, Savar, Dhaka - 1341, Bangladesh"),
        row("1113, 1114, 1115 Berun, Ashulia, Savar, Dhaka"),
      ]).length,
      1,
    );
  });

  it("merges Kamiz Achiya Chowdhury Complex with Kamis Asia Chowdhury Complex at Vogra", () => {
    assert.equal(
      displays([
        row(
          "Shee-101 Vogra Kamiz Achiya Chowdhury Commercial Complex, Vogra, Gazipur Sadar, Gazipur - 1703, Bangladesh",
        ),
        row("KAMIS ASIA CHOWDHURY COMMERCIAL COMPLEX, CHOWDHURY BARI, VOGRA, NATIONAL UNIVERSITY, GAZIPUR"),
      ]).length,
      1,
    );
  });

  it("merges Agrani Al-Monowar Apt D-5 with the same flat named by house 129", () => {
    assert.equal(
      displays([
        row("House # 129, Apt # D-5, Agrani Al-Monowar Apartment, Ramna, Dhaka-1217"),
        row("Agrani Al-Monowar Apartment, Flat # D-5, Ramna Century Avenue, Moghbazar, Ramna, Dhaka-1217"),
      ]).length,
      1,
    );
  });

  it("merges Peace Preenon house 167 with Peace Preennon house 167", () => {
    assert.equal(
      displays([
        row('House Name "Peace Preenon", House # 167, (1st Floor), Road # 01, DOHS, Mirpur-12, Dhaka'),
        row("PEACE PREENNON, HOUSE: 167(1ST FLOOR), ROAD-01, AVENUE-4, MIRPUR DOHS, MIRPUR, DHAKA"),
      ]).length,
      1,
    );
  });

  it("merges Ward 01 South Pahartali Mahmudabad with Fatehabad South Pahartali", () => {
    assert.equal(
      displays([
        row("Mahmudabad, Ward No. 01, South Pahartali, Hathazari, Chattogram"),
        row("South Pahartali, Ward # 01, Fatehabad, Hathazari, Chattogram"),
      ]).length,
      1,
    );
  });

  it("keeps Nandirhat apart from Mahmudabad even in the same South Pahartali ward", () => {
    assert.equal(
      displays([
        row("Mahmudabad, Ward No. 01, South Pahartali, Hathazari, Chattogram"),
        row("Nandirhat, Ward # 01, South Pahartali, Fatehabad, Hathazari, Chattogram"),
      ]).length,
      2,
    );
  });

  it("does not let a Fatehabad-only row fuse Nandirhat with Mahmudabad", () => {
    assert.equal(
      displays([
        row("Mahmudabad, Ward No. 01, South Pahartali, Hathazari, Chattogram"),
        row("South Pahartali, Ward # 01, Fatehabad, Hathazari, Chattogram"),
        row("Nandirhat, Ward # 01, South Pahartali, Fatehabad, Hathazari, Chattogram"),
      ]).length,
      2,
    );
  });

  it("merges Barendra with Barenda at Kashimpur", () => {
    assert.equal(displays([row("Barendra, Kashimpur, Gazipur"), row("BARENDA, GAZIPUR")]).length, 1);
  });

  it("merges Jamirdia with Jamidia at Bhaluka", () => {
    assert.equal(
      displays([
        row("Jamirdia, Valuka, Seedstore, Mymensingh - 2240, Bangladesh"),
        row("Jamidia, Valuka, Mymensingh"),
      ]).length,
      1,
    );
  });

  it("merges Anannya Shoping Complex with Ananna Shopping Complex at the same lane", () => {
    assert.equal(
      displays([
        row("Anannya Shoping Complex (4th Floor), Lane # 13, Baridhara DOHS, Dhaka"),
        row("ANANNA SHOPPING COMPLEX (4TH FLOOR), LANE-13, DHAKA"),
      ]).length,
      1,
    );
  });

  it("merges Jamirdia Square Masterbari with Jamirdia Hobirbari as the same village", () => {
    assert.equal(
      displays([
        row("Jamirdia, Square Masterbari, Bhaluka, 2240, Mymensingh, Bangladesh"),
        row("Jamirdia, Hobirbari, Mymensingh"),
      ]).length,
      1,
    );
  });

  it("merges Delpara Kutubpur with Delpara on the Dhaka-Narayanganj link road", () => {
    assert.equal(
      displays([
        row("Delpara, Kutubpur, Fatullah, Narayanganj, Narayangonj"),
        row("Dhaka Narayangonj Link Road, Delpara, Fatullah, Narayanganj - 1400, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("merges Dhonaid Tajpur Road after stripping an unlabelled RS dag", () => {
    assert.equal(
      displays([
        row("RS-61, Dhonaid, Tajpur Road, Yearpur, Zirabo, Ashulia, Savar, 1341, Dhaka, Bangladesh"),
        row("Dhonaid, Tajpur Road, Norsinghopur, Ashulia, Savar, Dhaka"),
      ]).length,
      1,
    );
  });

  it("merges South Panishail Zirani Bazar under Joydevpur or Kashimpur labels", () => {
    assert.equal(
      displays([
        row("South Panishail (Opposite of BKSP), Zirani Bazar, Gazipur, Joydevpur"),
        row("South Panishail, Zirani Bazar, 1740, Kashimpur, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("merges Uttar Narsingpur with Narsimpur at Kashipur Fatullah", () => {
    assert.equal(
      displays([
        row("Uttar Narsingpur, Kashipur, Fatullah, Narayanganj - 1400, Bangladesh"),
        row("NARSIMPUR, KASHIPUR, NARAYANGANJ"),
      ]).length,
      1,
    );
  });

  it("merges Haji Complex Iron Market with N.GANJ Iron Market at Police Line", () => {
    assert.equal(
      displays([
        row("Haji Complex, Iron Market, Police Line, Narayanganj, Fatullah"),
        row("HAJI COMPLEX, N.GANJ IRON MARKET, POLICE LINE, NARAYANGANJ"),
      ]).length,
      1,
    );
  });

  it("merges Talla Road Khapur with Knanpur at Fatullah", () => {
    assert.equal(
      displays([
        row("Talla Road, Khapur, Fatullah, Narayanganj., 1400, Narayanganj, Bangladesh"),
        row("TALLA ROAD, KNANPUR, FATULLAH, NARAYANGANJ"),
      ]).length,
      1,
    );
  });

  it("merges Chadni Housing with Enayetnagar near Chandni Housing at Fatullah", () => {
    assert.equal(
      displays([
        row("Chadni Housing, Fatullah, 1400, Narayanganj, Bangladesh"),
        row("ENAYETNAGAR (NEAR CHANDNI HOUSING), FATULLAH, NARAYANGANJ."),
      ]).length,
      1,
    );
  });

  it("merges Shamser Plaza with Sreepur Stand at the same Ganakbari village", () => {
    assert.equal(
      displays([
        row("Shamser Plaza (3rd Floor), Ganak Bari, Ashulia, Dhaka, Savar"),
        row("SREEPUR STAND, GANAKBARI, ASHULIA, SAVAR, DHAKA"),
      ]).length,
      1,
    );
  });

  it("merges two Sreepur Stand wordings when one also names Ganakbari", () => {
    assert.equal(
      displays([
        row("Sreepur Bus stand, Sreepur, Ashulia, Savar, Dhaka - 1349, Bangladesh"),
        row("Sreepur Stand, Ganakbari, Ashulia, Dhaka, Savar"),
      ]).length,
      1,
    );
  });

  it("merges Plot 1 Road 1 Dhour with Sarkar Bari at Dhour Chowrasta", () => {
    assert.equal(
      displays([
        row("Plot # 01, Road # 01, Dhour, Nishatnagar, Turag, Dhaka"),
        row("Sarkar Bari, Dhour Chowrasta, Turag, 1230, Dhaka, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("merges Takkarmath Stadium Road Siachor with Kutubpur Siachar Fatullah", () => {
    assert.equal(
      displays([
        row("Takkarmath, Stadium Road, Siachor, Fatullah, Narayanganj - 1420, Bangladesh"),
        row("KUTUBPUR, SIACHAR, FATULLAH, FATULLAH, NARAYANGANJ"),
      ]).length,
      1,
    );
  });

  it("does not merge Chandra with Chandona in Kaliakoir", () => {
    assert.equal(
      displays([
        row("Chandra, Kaliakoir, Gazipur - 1751, Bangladesh"),
        row("Chandona, Kaliakoir, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge a company-name-plus-postcode row with a named Fatullah village", () => {
    assert.equal(
      displays([
        row("Shantidhara, Bhuigar, Fatullah, Narayanganj, Narayangonj"),
        row("ZAS APPARELS (PVT.) LTD., 1420, Narayangonj, Bangladesh"),
      ]).length,
      2,
    );
  });

  it("does not merge Jamirdia with Square Masterbari when Jamirdia is named on only one side", () => {
    assert.equal(
      displays([
        row("Holding#1125, Ideal Mor, Square Masterbari, Bhaluka, Mymensingh"),
        row("Jamirdia, Habirbari, Valuka, Mymensingh"),
      ]).length,
      2,
    );
  });

  it("does not merge Hotapara with Bishia Kuribari Monipur", () => {
    assert.equal(
      displays([
        row("Bishia, Kuribari, Monipur, Gazipur."),
        row("Hotapara, Gazipur"),
      ]).length,
      2,
    );
  });

  it("still merges Mariam Complex with Chowdhury Bari at Vogra", () => {
    assert.equal(
      displays([
        row("Chowdhury Bari, Gazipur, Vogra"),
        row("MARIAM COMPLEX, CHOWDHURY BARI, GAZIPUR"),
      ]).length,
      1,
    );
  });

  it("does not merge two named towers in Gulshan that have different plots", () => {
    assert.equal(
      displays([
        row("Plot # 10, Taher Tower (9th Floor), Gulshan North Circle, Dhaka, Gulshan-2"),
        row("GREEN MEHER TOWER 12/A, GULSHAN NORTH AVENUE, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
  });

  it("does not merge Mansur Plaza at Board Bazar with Kathora Industrial Park", () => {
    assert.equal(
      displays([
        row("Mansur Plaza (3rd - 6th Floor), National University, Gazipur, Board Bazar"),
        row("Dr. Panjab Ali, Dr. Assaduzzaman Industrial Park, Kathora, National University, Gazipur - 1704, Bangladesh"),
      ]).length,
      2,
    );
  });

  it("does not merge a Board Bazar post-office row with East Kolmeshwar tower", () => {
    assert.equal(
      displays([
        row("Takwoa Tower, Holding No : 1773, Ward No: 35, East Kolmeshwar, Board Bazar, 1704, Gazipur, Bangladesh"),
        row("Board Bazar, National University, Gazipur Sadar"),
      ]).length,
      2,
    );
  });

  it("keeps concatenated Adamjee plots 246-249 and 97-101 apart from the 97-101-only row", () => {
    assert.equal(
      displays([
        row("Address 1st: Plot #246-249, Adamjee, EPZ and Address 2nd: 97-101 Adamjee"),
        row("Plot # 97 - 101, Adamjee EPZ, Siddirgonj, Narayanganj, Narayangonj"),
      ]).length,
      2,
    );
  });

  it("keeps Address 1st/2nd wording apart even when the second plot list is parseable", () => {
    assert.equal(
      displays([
        row("Address 1st: Plot #246-249, 97-101, Adamjee EPZ and Address 2nd: 97-101 Adamjee"),
        row("Plot # 97 - 101, Adamjee EPZ, Siddirgonj, Narayanganj, Narayangonj"),
      ]).length,
      2,
    );
  });

  it("still merges a Comilla extra-plot subset when both sides list 220-227", () => {
    assert.equal(
      displays([
        row("Plot 12-14, 220-227, Comilla EPZ"),
        row("Plot 220-227, Comilla EPZ"),
      ]).length,
      1,
    );
  });

  it("merges the same BSCIC plot under Enayetnagar or Shasongaon labels", () => {
    assert.equal(
      displays([
        row("Plot # A-81, BSCIC Industrial Area, Enayetnagar, Fatullah, Narayanganj"),
        row("A-81, BSCIC I/E, SHASONGAON, FATULLAH, NARAYANGANJ"),
      ]).length,
      1,
    );
  });

  it("does not merge Plot 5 Nayapara with Plot 5 Bahadurpur", () => {
    assert.equal(
      displays([
        row("Plot 5, Nayapara, Bhawal, Mirzapur, Gazipur Sadar"),
        row("Plot 5, Bahadurpur, P.O.-Bhawal, Mirzapur, Gazipur Sadar"),
      ]).length,
      2,
    );
  });

  it("does not merge Plot 1 Nandirhat with Plot 1 Mahmudabad", () => {
    assert.equal(
      displays([
        row("Plot 1, Mahmudabad, South Pahartali, Hathazari, Chattogram"),
        row("Plot 1, Nandirhat, South Pahartali, Hathazari, Chattogram"),
      ]).length,
      2,
    );
  });

  it("does not merge House 1 Shamoli with House 1 Hajee Delgoni Mohammadpur", () => {
    assert.equal(
      displays([
        row("1/D, Uttar Adabar, Ring Road, Dhaka, Shamoli", "BGMEA", "mailing"),
        row("1, HAJEE DELGONI MARKET, MOHAMMADPUR, DHAKA", "BKMEA", "mailing"),
      ]).length,
      2,
    );
  });

  it("does not merge House 16 Sector 1 with House 01 (D-1) Sector 10 in Uttara", () => {
    assert.equal(
      displays([
        row("House #16 (3rd fl), Road # 10, Sector # 1, Uttara Model Town, Dhaka-1230"),
        row("House # 01 (D-1), Road # 03, Sector # 10 Uttara Model Town, Uttara, Dhaka."),
      ]).length,
      2,
    );
  });

  it("does not merge House 3 Banani with Hosue 5 Nikunjo", () => {
    assert.equal(
      displays([
        row("House # 3, Road # 17, Block-C, Banani, Dhaka"),
        row("Hosue # 5, Road # 6, Nikunjo, Dhaka"),
      ]).length,
      2,
    );
  });

  it("does not merge Plot I/6 Road37 with Plot I/6 Road 7", () => {
    assert.equal(
      displays([
        row("Plot# 1/6, Road37, Section# 7, Mirpur industrial Area, Dhaka"),
        row("Plot # I/6, Road # 7, Sec. # 7, Mirpur I/A, Dhaka"),
      ]).length,
      2,
    );
  });

  it("does not merge Chandra, Chandona and Chandora as one premises", () => {
    assert.equal(
      displays([
        row("Chandra, Kaliakoir, Gazipur - 1751, Bangladesh"),
        row("Chandona, Kaliakoir, Gazipur"),
        row("Chandora, Kaliakoir, Gazipur"),
      ]).length,
      3,
    );
  });

  it("does not merge Kewa Sreepur with Sreepur Stand at Ganakbari", () => {
    assert.equal(
      displays([
        row("Kewa, Sreepur, Gazipur"),
        row("SREEPUR STAND, GANAKBARI, ASHULIA, SAVAR, DHAKA"),
      ]).length,
      2,
    );
  });

  it("does not merge Shamser Plaza with Anwar Plaza at the same Ganakbari village", () => {
    assert.equal(
      displays([
        row("Shamser Plaza (3rd Floor), Ganak Bari, Ashulia, Dhaka, Savar"),
        row("Anwar Plaza (3rd Floor), Ganak Bari, Dhaka, Savar"),
      ]).length,
      2,
    );
  });

  it("does not merge Chandra with Chandona on the same plot number", () => {
    assert.equal(
      displays([
        row("Plot 5, Chandra, Kaliakoir, Gazipur"),
        row("Plot 5, Chandona, Kaliakoir, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not fuse Chandra into Chandora via a shared holding", () => {
    const merged = mergeUniqueLocations([
      row("Holding D-84, Chandora, Shafipur, Kaliakoir, Gazipur"),
      row("Holding D-84, Chandora, Kaliakoir, Gazipur"),
      row("Holding D-84, Chandra, Kaliakoir, Gazipur"),
    ]);
    assert.equal(merged.length, 2);
    assert.equal(merged.filter((l) => /\bChandra\b/i.test(l.displayAddress)).length, 1);
    assert.equal(merged.filter((l) => /\bChandora\b/i.test(l.displayAddress)).length, 1);
  });

  it("does not merge Kewa Sreepur with Kewa Sripur", () => {
    assert.equal(
      displays([
        row("Kewa, Sreepur, Gazipur"),
        row("Kewa, Sripur, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not fuse Sreepur with Sripur through a Kewa-only middle string", () => {
    assert.equal(
      displays([
        row("Kewa, Sreepur, Gazipur"),
        row("Kewa, Gazipur"),
        row("Kewa, Sripur, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge hyphenated Chapai-Nawabganj with bare Nawabganj", () => {
    assert.equal(
      displays([
        row("Chapai-Nawabganj, Rajshahi"),
        row("Nawabganj, Dhaka"),
      ]).length,
      2,
    );
  });

  it("does not merge Plot 12-14 Road 6 with Plot 12-14 Road 3", () => {
    assert.equal(
      displays([
        row("Plot # 12-14, Road # 6, Sector # 1, Uttara, Dhaka"),
        row("Plot # 12-14, Road # 3, Sector # 1, Uttara, Dhaka"),
      ]).length,
      2,
    );
  });

  it("does not merge Sreepur Stand at Sreepur with Sreepur Stand at Sripur", () => {
    assert.equal(
      displays([
        row("Sreepur Stand, Sreepur, Gazipur"),
        row("Sreepur Stand, Sripur, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Nayapara with Bahadurpur just because both mention BSCIC", () => {
    assert.equal(
      displays([
        row("Plot 5, Nayapara, near BSCIC, Gazipur"),
        row("Plot 5, Bahadurpur, BSCIC, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Harirampur with Baonia on CH Plot 1260 when both mention EPZ", () => {
    assert.equal(
      displays([
        row("CH Plot # 1260, Harirampur, Turag, Dhaka, EPZ"),
        row("C H PLOT NO.# 1260, BAONIA, TURAG, DHAKA, EPZ"),
      ]).length,
      2,
    );
  });

  it("does not chain CEPZ Plot 1-5 onto Plot 57-59 through a unit-list that names both", () => {
    assert.equal(
      displays([
        row("Plot # 1-5, Sector 1/A, CEPZ, Chattogram"),
        row("Plot#57, 58 & 59, Sector#1, CEPZ, Chattogram"),
        row(
          "Unit-1 Production Unit Plot# 57-59, Sector 1, Export Processing Zone;, Unit-2 Washing Plot# 1-2, Sector 1, Export Processing Zone, 4223 Chittagong, Bangladesh",
        ),
      ]).length,
      2,
    );
  });

  it("merges the same holding written as present and old numbers despite one-sided Tecknogopara", () => {
    assert.equal(
      displays([
        row("Holding-213/1 (Present-D-119/1), Gazipur"),
        row("Holding # D-119/1 (Old C-213/1), Tecknogopara, Gazipur"),
      ]).length,
      1,
    );
  });

  it("merges Plot 636 Shahriar Road with Sharifpur Road at Sonda", () => {
    assert.equal(
      displays([
        row("Plot # 636, Shahriar Road, Sonda"),
        row("636, Sharifpur Road, Sonda"),
      ]).length,
      1,
    );
  });

  it("does not repeat a case-only spelling as Also recorded as", () => {
    const merged = mergeUniqueLocations([
      row("122/A, Tejgaon I/A, Dhaka", "BGMEA", "mailing"),
      row("122/A, TEJGAON I/A, DHAKA", "BKMEA", "mailing"),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.variants.length, 0);
  });
});

describe("premisesIdentifiers — Ka/K, prefixes, brackets, slash lists", () => {
  it("treats Plot Ka-12 and Plot K-12 as the same identifier", () => {
    const a = premisesIdentifiers("Plot Ka-12, BSCIC I/A");
    const b = premisesIdentifiers("Plot K-12, BSCIC I/A");
    assert.ok(idSetsOverlap(a, b), `Ka-12 vs K-12: ${[...a]} vs ${[...b]}`);
  });

  it("reads CH Plot # 1260 and C H PLOT NO.# 1260 as the same holding", () => {
    assert.equal(
      displays([
        row("CH Plot # 1260, Harirampur, Turag, Dhaka"),
        row("C H PLOT NO.# 1260, HARIRAMPUR, TURAG, DHAKA"),
      ]).length,
      1,
    );
  });

  it("reads a plot number through brackets", () => {
    assert.equal(
      displays([
        row("Plot (B-336), BSCIC Hosiery I/A, Fatullah"),
        row("PLOT NO- B-336, BSCIC HOSIERY I/A, FATULLAH"),
      ]).length,
      1,
    );
  });

  it("treats D/ 9-12 and D-9-12 as the same plot range", () => {
    const a = premisesIdentifiers("Plot No. D/ 9-12, Block B, BSCIC I/E");
    const b = premisesIdentifiers("Plot # D-9-12, Block - B, BSCIC I/A");
    assert.ok(idSetsOverlap(a, b), `D/ 9-12 vs D-9-12: ${[...a]} vs ${[...b]}`);
  });

  it("treats A-169/170 and A-169-170 as the same plots", () => {
    const a = premisesIdentifiers("Plot No. A-169/170, BSCIC I/A");
    const b = premisesIdentifiers("PLOT NO A-169-170, BSCIC I/A");
    assert.ok(idSetsOverlap(a, b), `slash vs dash: ${[...a]} vs ${[...b]}`);
  });

  it("does not let a floor list split plot P/04 into two premises", () => {
    assert.equal(
      displays([
        row("Plot # P/04 (3rd & 4th Floor), Mohora CDA I/A, Kalurghat"),
        row("PLOT NO. P/04 (1ST, 3RD & 4TH FLOOR), MOHORA, CDA INDUSTRIAL AREA, KALURGHAT"),
        row("Plot No. P/04, Mohora CDA Industrial Area, Kalurghat"),
      ]).length,
      1,
    );
  });

  it("reads PLOT NO. 6 TO 11 as the same range as Plot 6-11", () => {
    const a = premisesIdentifiers("PLOT NO. 6 TO 11, SECTOR 4/A, CEPZ");
    const b = premisesIdentifiers("Plot # 6-11, Sector # 4/A, CEPZ");
    assert.ok(idSetsOverlap(a, b), `6 TO 11 vs 6-11: ${[...a]} vs ${[...b]}`);
  });

  it("does not treat telephone numbers as plot identifiers", () => {
    const ids = premisesIdentifiers(
      "PLOT NO. 6 TO 11, SECTOR - 4/A, CHITTAGONG TEL: 741872, 741889, 741890 FAX: 00 88 031 741870",
    );
    assert.ok([...ids].every((id) => Number(id) <= 11), `phone leaked into ids: ${[...ids]}`);
    assert.ok(ids.has("6") && ids.has("11"));
  });

  it("reads Holding C-120/14 (B) as the same holding as C-120/14 B", () => {
    assert.equal(
      displays([
        row("Holding No. C-120/14 B, Ward No. 09, Sofipur, Kaliakair, Gazipur"),
        row("Holding # C-120/14 (B), Shafipur, Ward # 9, Kaliakoir, Gazipur."),
      ]).length,
      1,
    );
  });

  it("merges Uttara Export Processing Zone with Uttara EPZ on the same SFB", () => {
    assert.equal(
      displays([
        row("MS-SFB # 1 & 2, Uttara Export Processing Zone, Shongalshi, Saidpur, Nilphamari"),
        row("MSSFB # 1 & 2, Uttara EPZ, Shongalshi, Nilphamari, Dhaka"),
      ]).length,
      1,
    );
  });

  it("reads House # 01 (D-1) as house 1 so it can conflict with House 16", () => {
    const ids = premisesIdentifiers("House # 01 (D-1), Road # 03, Sector # 10 Uttara Model Town");
    assert.ok(ids.has("1"), `House 01 (D-1) ids: ${[...ids]}`);
  });

  it("reads Hosue # 5 as house 5", () => {
    const ids = premisesIdentifiers("Hosue # 5, Road # 6, Nikunjo, Dhaka");
    assert.ok(ids.has("5"), `Hosue # 5 ids: ${[...ids]}`);
  });
});

describe("mergeUniqueLocations — empty rows, duplicates, overview buckets", () => {
  it("drops null, empty and whitespace-only rows", () => {
    const merged = mergeUniqueLocations([
      { kind: "factory", address: "", source_code: "BGMEA", fetched_at: "2026-07-01T00:00:00Z" },
      { kind: "factory", address: "   ", source_code: "BKMEA", fetched_at: "2026-07-02T00:00:00Z" },
      row("Gajaria Para, Kauitis, Gazipur"),
    ]);
    assert.equal(merged.length, 1);
  });

  it("same spelling twice with two authorities is one location and no Also recorded as pill", () => {
    const merged = mergeUniqueLocations([
      row("Gajaria Para, Kauitis, Gazipur", "BGMEA"),
      row("Gajaria Para, Kauitis, Gazipur", "OEKO_TEX"),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.variants.length, 0);
    assert.deepEqual(merged[0]!.authorities.sort(), ["BGMEA", "OEKO_TEX"]);
  });

  it("re-merging source_rows of a merged location is idempotent", () => {
    const first = mergeUniqueLocations([
      row("Gajaria Para, Kauitis\nGazipur\nGazipur", "BGMEA"),
      row("Gojariapara, Vhawal Mirzapur, Gazipur Sadar PS, Gazipur - 1703, Bangladesh", "OEKO_TEX"),
    ]);
    assert.equal(first.length, 1);
    const second = mergeUniqueLocations(first[0]!.source_rows);
    assert.equal(second.length, 1);
    assert.equal(second[0]!.source_rows.length, first[0]!.source_rows.length);
  });

  it("buildLocationOverview buckets mixed factory and mailing into two groups", () => {
    const overview = buildLocationOverview([
      row("Gajaria Para, Kauitis, Gazipur", "BGMEA", "factory"),
      row("Fakir Khali Road, Boro Beraid, Badda, Dhaka", "BGMEA", "mailing"),
    ]);
    assert.equal(overview.uniqueLocationCount, 2);
    assert.equal(overview.sourceRecordCount, 2);
    assert.deepEqual(
      overview.groups.map((g) => [g.title, g.locations.length]),
      [
        ["Factories", 1],
        ["Mailing addresses", 1],
      ],
    );
  });
});
