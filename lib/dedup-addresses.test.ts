import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
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
        row("C H PLOT NO.# 1260, BAONIA, TURAG, DHAKA"),
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
});
