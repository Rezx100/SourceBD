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

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) {
      out.push([items[i]!, ...rest]);
    }
  }
  return out;
}

function assertBothOrders(a: AddressRowRaw, b: AddressRowRaw, n: number, msg: string) {
  assert.equal(displays([a, b]).length, n, msg);
  assert.equal(displays([b, a]).length, n, `${msg} reverse`);
}

function campusRow() {
  return row("House # 50, Road # 3, Gulshan-1, Dhaka");
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
    assert.equal(
      displays([
        row("671, Dattopara, Hossain Market, Tongi, Gazipur"),
        row("Hossain Market, 670, Datta Para, Tongi, Gazipur"),
        row("670-671, Datta Para, Tongi, Gazipur"),
      ]).length,
      2,
      "670 vs 671 stay two holdings even with a 670-671 bridge row",
    );
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

  it("keeps a Unit-1; Unit-2 semicolon list apart from the Plot 57-59 campus-only row", () => {
    assert.equal(
      displays([
        row(
          "Unit-1 Production Unit Plot# 57-59, Sector 1, Export Processing Zone;, Unit-2 Washing Plot# 1-2, Sector 1, Export Processing Zone, 4223 Chittagong, Bangladesh",
        ),
        row("Plot#57, 58 & 59, Sector#1, CEPZ, Chattogram, Bangladesh, EPZ"),
      ]).length,
      2,
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

  it("merges B-329/330 Enayetnagar with Sashongaon as the same Fatullah BSCIC plot", () => {
    assert.equal(
      displays([
        row("B-329/330, BSCIC I/A, ENAYETNAGAR, , NARAYANGANJ"),
        row("B-329/330, BSCIC  I/A, Sashongaon, Fatullah,, 1400, Narayanganj, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("merges A-45 Enayetnagar with Shasangaon as the same Fatullah BSCIC plot", () => {
    assert.equal(
      displays([
        row("A-45, BSCIC I/A, Enayetnagar, Fatullah, Narayanganj"),
        row("A-45, BSCIC I/A, Shasangaon, Fatullah, Narayanganj"),
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
      3,
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

  it("does not merge Nandirhat with Mahmudabad on Plot 12-14", () => {
    assert.equal(
      displays([
        row("Plot 12-14, Mahmudabad, South Pahartali, Hathazari, Chattogram"),
        row("Plot 12-14, Nandirhat, South Pahartali, Hathazari, Chattogram"),
      ]).length,
      2,
    );
  });

  it("does not merge Nayapara with Bahadurpur on lettered Plot A-5 BSCIC", () => {
    assert.equal(
      displays([
        row("Plot A-5, Nayapara, near BSCIC, Gazipur"),
        row("Plot A-5, Bahadurpur, BSCIC, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge BSCIC A-81 Enayetnagar with A-81 Sripur", () => {
    assert.equal(
      displays([
        row("Plot # A-81, BSCIC Industrial Area, Enayetnagar, Fatullah, Narayanganj"),
        row("A-81, BSCIC I/E, Sripur, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Sreepur Stand at Sreepur Gazipur with Ganakbari Ashulia", () => {
    assert.equal(
      displays([
        row("Sreepur Stand, Sreepur, Gazipur"),
        row("Sreepur Stand, Ganakbari, Ashulia, Dhaka, Savar"),
      ]).length,
      2,
    );
  });

  it("does not merge Plot 12-14 in Uttara with Plot 12-14 at CEPZ", () => {
    assert.equal(
      displays([
        row("Plot # 12-14, Sector # 1, Uttara, Dhaka"),
        row("Plot # 12-14, Sector # 1, CEPZ, Chattogram"),
      ]).length,
      2,
    );
  });

  it("does not merge Holding 50/1 with Holding 51/1", () => {
    assert.equal(
      displays([
        row("Holding 50/1, Tongi, Gazipur"),
        row("Holding 51/1, Tongi, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Mohammadpur Plot 2/1 with Chattogram 2800/2", () => {
    assert.equal(
      displays([
        row("Plot 2/1, Mohammadpur, Dhaka"),
        row("2800/2, Chattogram"),
      ]).length,
      2,
    );
  });

  it("does not merge Purbachandra with Purba Chandona on the same holding", () => {
    assert.equal(
      displays([
        row("Holding 1, Shaheed Mosharaf Hossain Road, Purbachandra, Kaliakoir, Gazipur"),
        row("Holding 1, Shaheed Mosharaf Hossain Road, Purba Chandona, Kaliakoir, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Nayapara with Bahadurpur on Holding 1 just because both sit on Shaheed Mosharaf Hossain Road", () => {
    assert.equal(
      displays([
        row("Holding 1, Shaheed Mosharaf Hossain Road, Nayapara, Gazipur"),
        row("Holding 1, Shaheed Mosharaf Hossain Road, Bahadurpur, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Satrapara with Sreepur", () => {
    assert.equal(
      displays([
        row("Satrapara, Trishal, Mymensingh"),
        row("Sreepur, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Moishtek Sonargaon with Mouchak Kaliakoir", () => {
    assert.equal(
      displays([
        row("Moishtek, Sonargaon, Narayangonj."),
        row("Mouchak, Kaliakoir, Gazipur."),
      ]).length,
      2,
    );
  });

  it("does not fuse two campuses through an ampersand concatenation", () => {
    assert.equal(
      displays([
        row("G-88/1, Chandra, Pallibyddut, Kaliakoir, Gazipur"),
        row("Ramarbag, Kutubpur, Fatullah, Narayanganj"),
        row(
          "RAMARBAG, KUTUBPUR, FATULLAH, NARAYANGANJ & G-88/1, CHANDRA, PALLI BIDDYUT, KALIAKOIR, GAZIPUR",
        ),
      ]).length,
      3,
    );
  });

  it("does not merge Holding 12/1 with Plot 12-14", () => {
    assert.equal(
      displays([
        row("Holding 12/1, Tongi, Gazipur"),
        row("Plot 12-14, Tongi, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Holding 12/1 with Plot 12-13 or Plot 12 or Holding 12", () => {
    assert.equal(
      displays([
        row("Holding 12/1, Tongi, Gazipur"),
        row("Plot 12-13, Tongi, Gazipur"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Holding 12/1, Tongi, Gazipur"),
        row("Plot 12, Tongi, Gazipur"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Holding 12/1, Tongi, Gazipur"),
        row("Holding 12, Tongi, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Holding 50/1 with Plot 50-51", () => {
    assert.equal(
      displays([
        row("Holding 50/1, Tongi, Gazipur"),
        row("Plot 50-51, Tongi, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge 65/2 Nayamati with A-65/66 BSCIC", () => {
    assert.equal(
      displays([
        row("65/2, NAYAMATI ROAD, NARAYANGANJ"),
        row("A-65/66 BSCIC, Fatullah, Narayanganj"),
      ]).length,
      2,
    );
  });

  it("does not merge B-329 Sonargaon with B-329 Enayetnagar", () => {
    assert.equal(
      displays([
        row("B-329, Sonargaon, Narayanganj"),
        row("B-329, Enayetnagar, Fatullah"),
      ]).length,
      2,
    );
  });

  it("does not merge Moishtek Sonargaon with Sashongaon when they share no plot", () => {
    assert.equal(
      displays([
        row("Moishtek, Sonargaon, Narayangonj."),
        row("B-329/330, Sashongaon, Fatullah"),
      ]).length,
      2,
    );
  });

  it("does not mint house 12 from Present-D-119/12", () => {
    assert.equal(
      displays([
        row("Holding-213/1 (Present-D-119/12), Gazipur"),
        row("House 12, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not fuse two campuses through AND or a glued ampersand", () => {
    assert.equal(
      displays([
        row("G-88/1, Chandra, Pallibyddut, Kaliakoir, Gazipur"),
        row("Ramarbag, Kutubpur, Fatullah, Narayanganj"),
        row(
          "RAMARBAG, KUTUBPUR, FATULLAH, NARAYANGANJ AND G-88/1, CHANDRA, PALLI BIDDYUT, KALIAKOIR, GAZIPUR",
        ),
      ]).length,
      3,
    );
    assert.equal(
      displays([
        row("G-88/1, Chandra, Pallibyddut, Kaliakoir, Gazipur"),
        row("Ramarbag, Kutubpur, Fatullah, Narayanganj"),
        row("RAMARBAG, KUTUBPUR, FATULLAH, NARAYANGANJ&G-88/1, CHANDRA, PALLI BIDDYUT, KALIAKOIR, GAZIPUR"),
      ]).length,
      3,
    );
  });

  it("merges the same house when a floor or room list uses &", () => {
    assert.equal(
      displays([
        row("367/1, Senpara, Parbatta, Mirpur-10"),
        row("367/1, GROUND TO 3RD FLOOR & 6TH FLOOR TO 10TH FLOOR, SENPARA, PARBATA, MIRPUR-10"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("Mehnaz Mansur Tower, House # 11/A, Road # 130, Gulshan-1"),
        row("MEHNAZ MANSUR TOWER, HOUSE # 11/A, LEVEL # 6 & 7, ROAD # 130, GULSHAN # 1, GULSHAN, DHAKA"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("89, Motijheel C/A (1st floor), Room # 22, Dhaka-1000."),
        row("89 Motijheel C/A (1st Floor), Room No- 22 & 34, Dhaka-1000."),
      ]).length,
      1,
    );
  });

  it("does not merge Holding C-120/14 with Plot C-14", () => {
    assert.equal(
      displays([
        row("Holding No. C-120/14, Shafipur, Gazipur"),
        row("Plot C-14, Shafipur, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Holding C-120/14 with Plot C-120", () => {
    assert.equal(
      displays([
        row("Holding No. C-120/14, Shafipur, Gazipur"),
        row("Plot C-120, Shafipur, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Sreepur Stand at Gazipur Dhaka with Ganakbari Ashulia", () => {
    assert.equal(
      displays([
        row("Sreepur Stand, Sreepur, Gazipur, Dhaka"),
        row("Sreepur Stand, Ganakbari, Ashulia, Dhaka, Savar"),
      ]).length,
      2,
    );
  });

  it("does not merge Shamser Plaza at Uttara with Shamser Plaza at Mirpur", () => {
    assert.equal(
      displays([
        row("Shamser Plaza, Uttara, Dhaka"),
        row("Shamser Plaza, Mirpur, Dhaka"),
      ]).length,
      2,
    );
  });

  it("does not merge the same plot lists at Comilla EPZ and CEPZ", () => {
    assert.equal(
      displays([
        row("Plot # 12-14, 220-227, Comilla EPZ"),
        row("Plot # 12-14, 220-227, CEPZ, Chattogram"),
      ]).length,
      2,
    );
  });

  it("does not merge Plot 12-14 Kakrail with Plot 12-14 Banani", () => {
    assert.equal(
      displays([
        row("Plot 12-14, Kakrail, Dhaka"),
        row("Plot 12-14, Banani, Dhaka"),
      ]).length,
      2,
    );
  });

  it("does not let a present-holding unit suffix merge House 1", () => {
    assert.equal(
      displays([
        row("Holding-213/1 (Present-D-119/1), Gazipur"),
        row("House 1, Gazipur"),
      ]).length,
      2,
    );
  });

  it("does not merge Nayapara with Bahadurpur on Kazi Nazrul Islam Road", () => {
    assert.equal(
      displays([
        row("Nayapara, Kazi Nazrul Islam Road, Gazipur"),
        row("Bahadurpur, Kazi Nazrul Islam Road, Gazipur"),
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

  it("does not fuse competing villages through a shared thana or Kewa hinge", () => {
    assert.equal(
      displays([
        row("7, Kewa Mouja, Bhangnaati, Sreepur, Gazipur"),
        row("Dhanua, Maona, Sreepur, Gazipur"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("7, Kewa Mouja, Bhangnaati, Sreepur, Gazipur"),
        row("Satiabari, Rajendrapur, Sreepur, Gazipur-1740"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Dhanua, Maona, Sreepur, Gazipur"),
        row("Satiabari, Rajendrapur, Sreepur, Gazipur-1740"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Vogra, National University, Gazipur, Joydevpur"),
        row("242 SHARIFPUR, NATIONAL UNIVERSITY, JOYDEVPUR, GAZIPUR, BANGLADESH"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Nayamati, Kutubpur, Fatullah, Narayanganj-1400"),
        row("PLOT # B-94, 95, 96 & 111 BSCIC HOSIERY I/A, FATULLAH,, FATULLAH, NARAYANGANJ"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("MOUNA (MASTERBARI) KEYA, SREEPUR, GAZIPUR., 1740, Gazipur, Bangladesh"),
        row("Plot-2023(SA), Gilarchala, Sreepur Mouza-Kewa 1740 Gazipur, Gazipur, Bangladesh"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Nayapara, Kathgora, Ashulia, Savar PS, Dhaka - 1341, Bangladesh"),
        row("62, Kathgara, Bishmail, Zirabo Road, Ashulia, Dhaka, Savar"),
      ]).length,
      2,
    );
  });

  it("keeps Ext-only EPZ plots apart from an Ext+Old concatenation", () => {
    assert.equal(
      displays([
        row("Plot # 167-169, Dhaka EPZ-Ext. Area, Savar, Dhaka-1349"),
        row(
          "Plot No. 167-169, Dhaka EPZ-Ext. Area, and 17-20 & 29-32, Dhaka EPZ-Old. Area, Savar, Dhaka - 1349, Bangladesh",
        ),
      ]).length,
      2,
    );
  });

  it("does not fuse Kewa, Sreepur with Dhanua or Satiabari through the thana", () => {
    assert.equal(
      displays([
        row("Kewa, Sreepur, Gazipur"),
        row("Dhanua, Maona, Sreepur, Gazipur"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("MOUZA KEWA, SREEPUR, GAZIPUR"),
        row("Dhanua, Maona, Sreepur, Gazipur"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("SA Plot No-47, Kewa, Sreepur, Gazipur - 1740, Bangladesh"),
        row("S.A Plot # 47, Teknog Para, Chodhona, Dhaka, Sreepur"),
      ]).length,
      2,
    );
  });

  it("does not treat Ismail as Bishmail", () => {
    assert.equal(
      displays([
        row("Ismail, Ashulia, Savar, Dhaka"),
        row("62, Kathgara, Bishmail, Zirabo Road, Ashulia, Dhaka, Savar"),
      ]).length,
      2,
    );
  });

  it("keeps House 62-only apart from a House 62 and House 82 concatenation", () => {
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row(
          "Bodywears International, House # 62, Road # 3, Block B, Niketon, House # 82 (1st Floor), Gulshan-1, Dhaka",
        ),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Niketon, Gulshan, Dhaka"),
        row("House # 82, Road # 3, Niketon, Gulshan, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row(
          "Bodystretch Bangladesh, House # 62, Road # 3, Block-B, Niketon, 87, New Eskaton Road, Gulshan-1, Dhaka, New Eskaton, Dhaka",
        ),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row(
          "Bodystretch Bangladesh, House # 62, Road # 3, Block-B, Niketon, 87, New Eskaton Road, Gulshan-1, Dhaka, New Eskaton, Dhaka",
        ),
        row(
          "Bodywears International, House # 62, Road # 3, Block B, Niketon, House # 82 (1st Floor), Gulshan-1, Dhaka",
        ),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row(
          "Bodystretch Bangladesh, House # 62, Road # 3, Block-B, Niketon, 87 New Eskaton Road, Gulshan-1, Dhaka",
        ),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87 Banani, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87 Mohakhali, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87 Farmgate, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon 87 Eskaton, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, 87 Niketon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Tejgaon, Dhaka"),
        row("House # 62, 87 Tejgaon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No. 87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No 87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, Holding No. 87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, Holding # 87, Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, Holding # 87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87/A Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87/1 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("H/O-62, 87 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("H/0-62, 87 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("Holding # 62, 87 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("HOUSE 62 ROAD 3 BLOCK B NIKETON GULSHAN"),
        row("HOUSE 62 ROAD 3 BLOCK B NIKETON 87 BADDA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No: 87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No:87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No-87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No . 87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, #87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87-A Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87A Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87.A Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("HO-62, 87 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("HO- 62, 87 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("HO-62 87 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, H/O-87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, HO-87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, H.O. 87 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House 10, Dailla, Demra, Dhaka"),
        row("House 10, 13 Dailla, Demra, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House 10, Dailla, Demra, Dhaka"),
        row("House 10, Dailla, 13 Demra, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House 10, Demra, Dhaka"),
        row("House 10, Demra, 13 Dailla, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row(
          "South Avenue Tower, 6th floor, House # 50, Road # 3, 7, Gulshan Avenue, Gulshan-1, Dhaka-1212",
        ),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Gulshan, Gulshan-1, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7, Gulshan, Gulshan-1, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Gulshan Ave, Gulshan-1, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 62, Tejgaon, Dhaka"),
        row("House # 62, 13 Tejgaon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Tejgaon, Dhaka"),
        row("House # 62, 19 Tejgaon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Tejgaon, Dhaka"),
        row("House # 62, 20 Tejgaon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Tejgaon, Dhaka"),
        row("House # 62, 7 Tejgaon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Tejgaon, Dhaka"),
        row("House # 62, 7, Tejgaon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Uttara, Dhaka"),
        row("House # 62, 13 Uttara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Mirpur, Dhaka"),
        row("House # 62, 13 Mirpur, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Savar, Dhaka"),
        row("House # 62, 13 Savar, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Tongi, Dhaka"),
        row("House # 62, 13 Tongi, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Ashulia, Dhaka"),
        row("House # 62, 13 Ashulia, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Baridhara, Dhaka"),
        row("House # 62, 13 Baridhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 1 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 10 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 13 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 19 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Gulshan, Dhaka"),
        row("House # 62, 10 Gulshan Avenue, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Dhaka, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 187 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 13 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 100 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, #187 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.13 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.100 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Aftabnagar, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Tejgaon, Dhaka"),
        row("House # 62, No. 87, Tejgaon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.13 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.100 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, No. 87, Tejgaon, Dhaka"),
        row("House # 62, No. 13, Tejgaon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, No. 87, Tejgaon, Dhaka"),
        row("House # 62, 13 Tejgaon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 187 Bashundhara, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, Holding # 187, Bashundhara, Dhaka"),
      ]).length,
      1,
    );
    {
      const extras = mergeUniqueLocations([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.13 Bashundhara, Dhaka"),
      ]);
      assert.equal(extras.length, 3);
      const no187 = extras.find((loc) =>
        loc.source_rows.some((r) => /No\.187 Bashundhara/.test(r.address)),
      );
      const no13 = extras.find((loc) =>
        loc.source_rows.some((r) => /No\.13 Bashundhara/.test(r.address)),
      );
      assert.ok(no187);
      assert.ok(no13);
      assert.notEqual(no187, no13);
    }
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Aftabnagar, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, 187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 187 Aftabnagar, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 187 Aftabnagar, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, 187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Aftabnagar, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, 13 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 13 Aftabnagar, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, Number 187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, Number 187 Aftabnagar, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, Number 187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, Number 13 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, Number 187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, Holding # 187, Aftabnagar, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, 187 Badda, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 187 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    {
      const bridged = mergeUniqueLocations([
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 187 Aftabnagar, Dhaka"),
      ]);
      assert.equal(bridged.length, 2);
      const aftab = bridged.find((loc) =>
        loc.source_rows.some((r) => /Aftabnagar/.test(r.address)),
      );
      const bash = bridged.find((loc) =>
        loc.source_rows.some((r) => /Bashundhara/.test(r.address)),
      );
      assert.ok(aftab);
      assert.ok(bash);
      assert.notEqual(aftab, bash);
    }
    {
      const numbered = mergeUniqueLocations([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, Number 187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, Number 13 Bashundhara, Dhaka"),
      ]);
      assert.equal(numbered.length, 3);
      const n187 = numbered.find((loc) =>
        loc.source_rows.some((r) => /Number 187 Bashundhara/.test(r.address)),
      );
      const n13 = numbered.find((loc) =>
        loc.source_rows.some((r) => /Number 13 Bashundhara/.test(r.address)),
      );
      assert.ok(n187);
      assert.ok(n13);
      assert.notEqual(n187, n13);
    }
    assert.equal(
      displays([
        row("House # 02/02, Road #03, Durgapur, Zirabo, Ashulia, Savar, Dhaka"),
        row(
          "Holding no: 02/02, Road No: 03, Durgapur, Zirabo, Ashulia, Savar, Dhaka-1341. Bangladesh",
        ),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House No.6/2, Road No-02, Block# B, Dhorengartek, Nishat Nagar, Turag Dhaka"),
        row(
          "House no: 6/2, Road no-2, Block - B, Dhorengartek, Nishat nagar, Turag, 1230, Dhaka, Bangladesh",
        ),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("Holding # 306/1, Shirin Chowdhury Industrial tower, Vogra (Chowdhury Bari), Gazipur"),
        row(
          "SHIRIN CHOWDHURY INDUSTRIAL TOWER, HOLDING NO. B-306/1, VOGRA (CHOWDHURY BARI), NATIONAL UNIVERSITY, GAZIPUR",
        ),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row(
          "Holding # 85/3, Road # 1, Block -A, 793/120 Amtola, Kathgora, Ashulia, Dhaka",
        ),
        row(
          "Holding -85/3, Road-01, Block- A, 792/120, Amtola, Kathgora, Ashulia PS, 1340, Dhaka, Bangladesh",
        ),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House 10, Amtola, Ashulia, Dhaka"),
        row("House 10, No.793 Amtola, Ashulia, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House 10, Kewa, Sreepur, Gazipur"),
        row("House 10, No.12 Kewa, Sreepur, Gazipur"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House 10, Kewa, Sreepur, Gazipur"),
        row("House 10, 12 Kewa, Sreepur, Gazipur"),
      ]).length,
      1,
    );
    assert.equal(
      mergeUniqueLocations([
        row(
          "Plot # 10, Holding # 1/A, Road # 9, Block-A, Gulshan, Dhaka-1212, Bangladesh",
        ),
        row("Plot # 8 & 10, Holding # 1/A, Gulshan, Dhaka"),
        row("Holding # 1/A, Dag 10, Gulshan, Dhaka"),
      ]).length,
      2,
    );
    {
      const plot10 = row(
        "Plot # 10, Holding # 1/A, Road # 9, Block-A, Gulshan, Dhaka-1212, Bangladesh",
      );
      const plotEight = row("Plot # 8 & 10, Holding # 1/A, Gulshan, Dhaka");
      const dag = row("Holding # 1/A, Dag 10, Gulshan, Dhaka");
      for (const ordered of permutations([plot10, plotEight, dag])) {
        const leftover = mergeUniqueLocations(ordered);
        assert.equal(leftover.length, 2, "Holding leftover 3-row must stay two Locations rows");
        const eightLoc = leftover.find((loc) =>
          loc.source_rows.some((r) => /Plot # 8 & 10/.test(r.address)),
        );
        const dagLoc = leftover.find((loc) =>
          loc.source_rows.some((r) => /Dag 10/.test(r.address)),
        );
        assert.ok(eightLoc, "Plot 8 & 10 Holding row missing");
        assert.ok(dagLoc, "Dag 10 row missing");
        assert.notEqual(eightLoc, dagLoc);
        assert.ok(
          !eightLoc!.source_rows.some((r) => /Plot # 10, Holding/.test(r.address)),
          "Plot 8 & 10 Holding must not sit on the Plot 10 location",
        );
        assert.ok(
          dagLoc!.source_rows.some((r) => /Plot # 10, Holding/.test(r.address)),
          "Dag 10 must sit with Plot 10",
        );
      }
    }
    {
      const leftover = mergeUniqueLocations([
        row(
          "Plot # 10, Holding # 1/A, Road # 9, Block-A, Gulshan, Dhaka-1212, Bangladesh",
        ),
        row("Plot # 8 & 10, Gulshan, Dhaka"),
        row(
          "Holding # 1/A, Dag 10, Road # 9, Block-A, Gulshan, Dhaka-1212, Bangladesh",
        ),
      ]);
      assert.equal(leftover.length, 2);
      const plotEight = leftover.find((loc) =>
        loc.source_rows.some((r) => /Plot # 8 & 10/.test(r.address)),
      );
      const dag = leftover.find((loc) =>
        loc.source_rows.some((r) => /Dag 10/.test(r.address)),
      );
      assert.ok(plotEight, "Plot 8 & 10 row missing");
      assert.ok(dag, "Dag 10 row missing");
      assert.notEqual(plotEight, dag);
      assert.ok(
        !plotEight!.source_rows.some((r) => /Plot # 10, Holding/.test(r.address)),
        "Plot 8 & 10 must not sit on the Plot 10 location",
      );
      assert.ok(
        dag!.source_rows.some((r) => /Plot # 10, Holding/.test(r.address)),
        "Dag 10 must sit with Plot 10",
      );
    }
    assert.equal(
      displays([
        row("Plot # 8 & 10, Gulshan, Dhaka"),
        row("House 10, Gulshan, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("132/142, Nasirabad I/A, Chittagong"),
        row("135/142, Nasirabad Industrial Area, Chittagong, Chattogram - 4210, Bangladesh"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 49/1, Block # A, Tak Kathora, Word # 20, Salna Bazar, Gazipur"),
        row(
          "Holding No. 49/1, Block A, Vill- Tak Kathora, Word No- 20, Post- Salna Bazar, Gazipur City Corporation, Gazipur - 1703, Bangladesh",
        ),
      ]).length,
      1,
      "Plot 49/1 vs Holding 49/1 of the same cadastral id is one premises",
    );
    assert.equal(
      displays([
        row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
        row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        ),
      ]).length,
      1,
      "neighbour Plot 23-24 vs Plot 23, 24, 25 stays one row even with extra holding 87",
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Dag 10, Gulshan, Dhaka"),
        row("House 8, House 1, Gulshan, Dhaka"),
      ]).length,
      2,
      "Plot 8 + Holding 1 vs House 1 + House 8 restatement stays two rows",
    );
    {
      const cepz = mergeUniqueLocations([
        row("Plot # 31-32, Sector # 01, CEPZ, Chittagong"),
        row(
          "PLOT NO# 31-32, SECTOR# 01, & PLOT NO# 29 (PART), SECTOR# 05, CEPZ, CHOTTOGRAM, CEPZ, CHATTOGRAM",
        ),
        row(
          "Plot #31-31, Sector #01, Plot #29 (Part), Sector #05, EPZ, Chittagong EPZ PS, Chattogram - 4223, Bangladesh",
        ),
      ]);
      assert.equal(cepz.length, 2, "pacific-casuals campus-only vs two-campus concat");
      const campusOnly = cepz.find((loc) =>
        loc.source_rows.some((r) => /Plot # 31-32, Sector # 01, CEPZ/.test(r.address)),
      );
      const concat = cepz.find((loc) =>
        loc.source_rows.some((r) => /PLOT NO# 29 \(PART\), SECTOR# 05/.test(r.address)),
      );
      assert.ok(campusOnly, "campus-only row missing");
      assert.ok(concat, "concat row missing");
      assert.notEqual(campusOnly, concat);
      assert.ok(
        concat!.source_rows.some((r) =>
          /Plot #31-31, Sector #01, Plot #29 \(Part\)/.test(r.address),
        ),
        "comma two-campus spelling must sit on the concat row",
      );
    }
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 07 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 07 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, No.7 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, #7 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, No.07 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, No.7 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, No.187 Bashundhara, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Avenue, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, No.7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, No.7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    {
      const avenues = mergeUniqueLocations([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Avenue, Dhaka"),
      ]);
      assert.equal(avenues.length, 2);
      const campus = avenues.find((loc) =>
        loc.source_rows.some((r) => /House # 50, Road # 3, Gulshan-1, Dhaka/.test(r.address)),
      );
      const banani = avenues.find((loc) =>
        loc.source_rows.some((r) => /Banani Avenue/.test(r.address)),
      );
      assert.ok(campus);
      assert.ok(banani);
      assert.notEqual(campus, banani);
      assert.ok(
        campus!.source_rows.some((r) => /7 Gulshan Avenue/.test(r.address)),
        "House 50 must stay with 7 Gulshan Avenue",
      );
    }
    assert.equal(
      displays([
        row("House # 50, Road # 3, No.7 Gulshan, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, No.7 Gulshan, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, No.7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, 7 Gulshan, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, No.7 Banani, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    for (const bananiTail of [
      "7 Banani Street",
      "7 Banani Lane",
      "7 Banani Boulevard",
      "7 Banani Drive",
      "7 Banani Close",
    ]) {
      assert.equal(
        displays([
          row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
          row(`House # 50, Road # 3, ${bananiTail}, Gulshan-1, Dhaka`),
        ]).length,
        2,
        `7 Gulshan Avenue vs ${bananiTail}`,
      );
    }
    assert.equal(
      displays([
        row("House # 50, Road # 3, 7 Gulshan Lane, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, SAT 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, SAT 7 Gulshan, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, SAT 7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, No.7 Banani Road, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    for (const adj of [
      "South",
      "North",
      "Old",
      "Uttar",
      "Dakhin",
      "Dakshin",
      "Purba",
      "Purbo",
      "Poschim",
      "Boro",
      "Baro",
      "Choto",
      "Chhoto",
      "Moddho",
      "Madhya",
      "Part",
      "Near",
      "Opposite",
      "Former",
      "Current",
      "Present",
    ]) {
      assertBothOrders(
        campusRow(),
        row(`House # 50, Road # 3, 7 ${adj} Banani, Gulshan-1, Dhaka`),
        2,
        `House 50 vs 7 ${adj} Banani`,
      );
      assertBothOrders(
        row(`House # 50, Road # 3, 7 ${adj} Gulshan, Gulshan-1, Dhaka`),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
        2,
        `7 ${adj} Gulshan vs 7 Banani Road`,
      );
    }
    for (const stacked of [
      "South East",
      "South West",
      "North East",
      "North West",
      "New South",
      "Old South",
      "East South",
      "New East",
      "South-East",
      "South-West",
      "North-East",
      "South–East",
      "South/East",
      "SE",
      "S.E.",
      "SouthEast",
      "New-South",
      "Southern",
      "Northern",
      "Eastern",
      "Western",
      "Paschim",
      "Pashchim",
      "Pachim",
      "Dokkhin",
      "Dokhin",
      "Uttor",
      "Purbbo",
      "Dakkhin",
      "Poshchim",
      "Street",
      "S-E",
      "S/E",
      "SE.",
    ]) {
      assertBothOrders(
        campusRow(),
        row(`House # 50, Road # 3, 7 ${stacked} Banani, Gulshan-1, Dhaka`),
        2,
        `House 50 vs 7 ${stacked} Banani`,
      );
      assertBothOrders(
        row(`House # 50, Road # 3, 7 ${stacked} Gulshan, Gulshan-1, Dhaka`),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
        2,
        `7 ${stacked} Gulshan vs 7 Banani Road`,
      );
    }
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 South Gulshan, Gulshan-1, Dhaka"),
      1,
      "House 50 vs 7 South Gulshan",
    );
    assertBothOrders(
      row("House # 50, Road # 3, No.7 South Banani, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      1,
      "No.7 South Banani vs 7 Banani Road",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, SAT7 South Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs SAT7 South Banani",
    );
    for (const sat of [
      "SAT7 Gulshan",
      "SAT7 South Gulshan",
      "SAT-7 South Gulshan",
      "SAT7 South-East Gulshan",
    ]) {
      assertBothOrders(
        row(`House # 50, Road # 3, ${sat}, Gulshan-1, Dhaka`),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
        2,
        `${sat} vs 7 Banani Road`,
      );
    }
    assertBothOrders(
      row("Plot # 10, 10 Gulshan, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Banani Road, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Gulshan vs 10 Banani Road",
    );
    for (const adj of [
      "Choto",
      "Baro",
      "Chhoto",
      "Part",
      "South East",
      "South-East",
      "Paschim",
      "Street",
    ]) {
      assertBothOrders(
        row(`Plot # 10, 10 ${adj} Gulshan, Gulshan-1, Dhaka`),
        row("Plot # 10, 10 Banani Road, Gulshan-1, Dhaka"),
        2,
        `Plot 10 ${adj} Gulshan vs 10 Banani Road`,
      );
    }
    assertBothOrders(
      row("Plot # 10, 10 Station Road, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Banani Road, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Station Road vs 10 Banani Road",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Airport Road, Gulshan-1, Dhaka"),
      2,
      "7 Gulshan Avenue vs 7 Airport Road",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Green Road, Gulshan-1, Dhaka"),
      2,
      "7 Gulshan Avenue vs 7 Green Road",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport Road, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green Road, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport Road vs Plot 10 Green Road",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport vs Plot 10 Green",
    );
    assertBothOrders(
      row("4 JUBILEE ROAD, JIBAN BIMA BHABAN, CHATTOGRAM"),
      row("Jiban Bima Bhaban, 4, Chittagong, Jublee Road"),
      1,
      "Jubilee Road vs Jublee Road inverted Jiban Bima Bhaban",
    );
    assertBothOrders(
      row("216, Shamim Complex, Sataish Road, Gazipura, Tongi, Gazipur"),
      row("Shamim Complex, 216, Sataish Road, Gazipura, Tongi, Gazipur"),
      1,
      "Shamim Complex 216 inverted vs Sataish Road",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7 Airport Avenue, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Green Avenue, Gulshan-1, Dhaka"),
      2,
      "7 Airport Avenue vs 7 Green Avenue",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7 Kazi Nazrul Islam Avenue, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Airport Road, Gulshan-1, Dhaka"),
      2,
      "7 Kazi Nazrul Islam Avenue vs 7 Airport Road",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7 Shaheed Tajuddin Ahmed Avenue, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Airport Road, Gulshan-1, Dhaka"),
      2,
      "7 Shaheed Tajuddin Ahmed Avenue vs 7 Airport Road",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 Panthapath, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 Panthapath",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport Road, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport Road vs Plot 10 Green unsuffixed",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green Road, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport vs Plot 10 Green Road",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green Ave, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport vs Plot 10 Green Ave",
    );
    assertBothOrders(
      row("Plot # 10, Airport, Gulshan-1, Dhaka"),
      row("Plot # 10, Green, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport vs Plot 10 Green without restated digit",
    );
    assertBothOrders(
      row("7 Airport, Gulshan-1, Dhaka"),
      row("7 Green, Gulshan-1, Dhaka"),
      2,
      "7 Airport vs 7 Green without Plot",
    );
    assertBothOrders(
      row("Plot # 10, 10 Kazi Nazrul Islam Avenue, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Airport, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Kazi Nazrul Islam Avenue vs Plot 10 Airport",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7 Kazi Nazrul Islam Avenue, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Panthapath, Gulshan-1, Dhaka"),
      2,
      "7 Kazi Nazrul Islam Avenue vs 7 Panthapath",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7 Airport Avenue, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Green, Gulshan-1, Dhaka"),
      2,
      "7 Airport Avenue vs 7 Green unsuffixed",
    );
    for (const extra of ["7 Airport", "7 Green", "7 DIT", "7 Pantha Path"]) {
      assertBothOrders(
        campusRow(),
        row(`House # 50, Road # 3, ${extra}, Gulshan-1, Dhaka`),
        2,
        `House 50 vs ${extra} unsuffixed`,
      );
    }
    {
      const mixed = [
        campusRow(),
        row("House # 50, Road # 3, 7 Airport, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Green, Gulshan-1, Dhaka"),
      ];
      for (const ordered of permutations(mixed)) {
        const locs = mergeUniqueLocations(ordered);
        assert.equal(locs.length, 3, "House50 + 7 Airport + 7 Green unsuffixed");
        const campus = locs.find((loc) =>
          loc.source_rows.some((r) => /House # 50, Road # 3, Gulshan-1, Dhaka/.test(r.address)),
        );
        assert.ok(campus);
        assert.ok(
          !campus!.source_rows.some((r) => /7 Airport/.test(r.address)),
          "campus must not sit on 7 Airport",
        );
        assert.ok(
          !campus!.source_rows.some((r) => /7 Green/.test(r.address)),
          "campus must not sit on 7 Green",
        );
      }
    }
    for (const stacked of [
      "Outer",
      "Upper",
      "Lower",
      "Middle",
      "Central",
      "South.East",
      "S−E",
      "S‑E",
      "Poshim",
      "Pashim",
      "S E",
      "Inner",
    ]) {
      assertBothOrders(
        campusRow(),
        row(`House # 50, Road # 3, 7 ${stacked} Banani, Gulshan-1, Dhaka`),
        2,
        `House 50 vs 7 ${stacked} Banani`,
      );
    }
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, SAT.7 South Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs SAT.7 South Banani",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7-Baro Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7-Baro Banani glued",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7-South-East Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7-South-East Banani glued",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7SE Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7SE Banani glued",
    );
    assertBothOrders(
      row("Plot # 10, 10 Choto Banani, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Gulshan, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Choto Banani vs Plot 10 Gulshan",
    );
    assertBothOrders(
      row("Plot # 7, 7 Gulshan, Gulshan-1, Dhaka"),
      row("Plot # 7, 7 Banani Road, Gulshan-1, Dhaka"),
      2,
      "Plot 7 Gulshan vs 7 Banani Road",
    );
    assertBothOrders(
      row("Plot # 7, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
      row("Plot # 7, 7 Banani, Gulshan-1, Dhaka"),
      2,
      "Plot 7 Gulshan Avenue vs 7 Banani",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka"),
      2,
      "House 187 vs House 13 Plot+Holding Tejgaon",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187, Bashundhara, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, House # 13, Bashundhara, Dhaka"),
      2,
      "House 187 vs House 13 Plot+Holding Bashundhara",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, H/O-13, Tejgaon, Dhaka"),
      2,
      "House 187 vs H/O-13 Plot+Holding",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, H/O-187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka"),
      2,
      "H/O-187 vs House 13 Plot+Holding",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, H/O-187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, H/O-13, Tejgaon, Dhaka"),
      2,
      "H/O-187 vs H/O-13 Plot+Holding",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, HO-187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka"),
      2,
      "HO-187 vs House 13 Plot+Holding",
    );
    for (const labelled of [
      "Building # 187",
      "Building No. 187",
      "Bldg # 187",
      "Flat # 187",
      "Apt # 187",
      "Unit # 187",
    ]) {
      assertBothOrders(
        row(`House # 62, Plot # 10, Holding # 1, ${labelled}, Tejgaon, Dhaka`),
        row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka"),
        2,
        `${labelled} vs House 13 Plot+Holding`,
      );
    }
    assertBothOrders(
      row("House # 14, Apt # 2/C, Road # 20, Sector # 04, Uttara Model Town, Dhaka"),
      row("HOUSE #14, ROAD #20, SECTOR #04, UTTARA, DHAKA"),
      1,
      "House 14 Apt 2/C is the same house as House 14",
    );
    for (const unit of ["Apt # 2", "Flat # 2", "Unit # 2", "Apt # 401"]) {
      assertBothOrders(
        row(`House # 14, ${unit}, Road # 20, Sector # 04, Uttara Model Town, Dhaka`),
        row("HOUSE #14, ROAD #20, SECTOR #04, UTTARA, DHAKA"),
        1,
        `House 14 ${unit} is the same house as House 14`,
      );
    }
    assertBothOrders(
      row("House # 14, Unit # 11-J, Road # 20, Sector # 04, Uttara Model Town, Dhaka"),
      row("HOUSE #14, ROAD #20, SECTOR #04, UTTARA, DHAKA"),
      1,
      "House 14 Unit 11-J is the same house as House 14",
    );
    assertBothOrders(
      row("House # 26, Apt # 401, Road # 13, Sector # 4, Uttara, Dhaka"),
      row("House # 26, Road # 13, Sector # 4, Uttara, Dhaka"),
      1,
      "House 26 Apt 401 is the same house as House 26",
    );
    assertBothOrders(
      row("House # 139, Lane # 1, Apt # 4 (1st Floor), DOHS, Dhaka"),
      row("House # 139, Lane # 1, DOHS, Dhaka"),
      1,
      "House 139 Apt 4 is the same house as House 139",
    );
    assertBothOrders(
      row("01, Hariken Road, Doulatpur, National University, 1704, Gazipur, Bangladesh"),
      row("01, Haricane Road, Dowlatpur, National University, Gazipur"),
      1,
      "Hariken Road vs Haricane Road spelling",
    );
    assertBothOrders(
      row("93, Shuhrawardhi Avenue (2nd Fl), Dhaka, Baridhara"),
      row("93 Shorawardi Avenue, Baridhara, Dhaka."),
      1,
      "Shuhrawardhi Avenue vs Shorawardi Avenue spelling",
    );
    assertBothOrders(
      row("196, Kobi Jasimuddin Road, Pagar, Tongi, Gazipur Sadar PS, Gazipur - 1710, Bangladesh"),
      row("196, Kazi Jashim Uddin Road, Pagar, Gazipur, Tongi"),
      1,
      "Jasimuddin Road vs Jashim Uddin Road spelling",
    );
    assertBothOrders(
      row(
        "Police Plaza Concord, Floor # 11, Unit # 11-J, Plot # 02, Road # 144, Gulshan Model Town, Gulshan-1, Dhaka-1212.",
      ),
      row("Police Plaza Cocord, Floor-11, Unit-11-J, Plot # 02, Road # 144, Gulshan, Dhaka"),
      1,
      "Police Plaza Concord vs Cocord with Unit 11-J",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, Building # 13, Tejgaon, Dhaka"),
      2,
      "House 187 vs Building # 13 Plot+Holding",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, H-O-13, Tejgaon, Dhaka"),
      2,
      "House 187 vs H-O-13 Plot+Holding",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, Head Office 13, Tejgaon, Dhaka"),
      2,
      "House 187 vs Head Office 13 Plot+Holding",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, Head-Office 13, Tejgaon, Dhaka"),
      2,
      "House 187 vs Head-Office 13 Plot+Holding",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, HeadOffice 13, Tejgaon, Dhaka"),
      2,
      "House 187 vs HeadOffice 13 Plot+Holding",
    );
    for (const subunit of ["Apt # 2/C", "Unit # 11-J", "Apt D-5", "Apt # 187/A"]) {
      assertBothOrders(
        row(`House # 62, Plot # 10, Holding # 1, ${subunit}, Tejgaon, Dhaka`),
        row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka"),
        2,
        `${subunit} vs House 13 Plot+Holding`,
      );
    }
    for (const building of ["Building # 13", "Bldg # 13", "Building No. 13"]) {
      assertBothOrders(
        row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka"),
        row(`House # 62, Plot # 10, Holding # 1, ${building}, Tejgaon, Dhaka`),
        1,
        `House 13 vs ${building} Plot+Holding`,
      );
    }
    for (const subunit of ["Apt # 2/C", "Unit # 11-J", "Apt D-5", "Apt # 187/A"]) {
      assertBothOrders(
        row(`House # 62, Plot # 10, Holding # 1, ${subunit}, Tejgaon, Dhaka`),
        row("House # 62, Plot # 10, Holding # 1, Building # 13, Tejgaon, Dhaka"),
        2,
        `${subunit} vs Building 13 Plot+Holding`,
      );
    }
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, Apt # 2/C, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, Building # 187, Tejgaon, Dhaka"),
      2,
      "Apt # 2/C vs Building 187 Plot+Holding",
    );
    assertBothOrders(
      row("67, City Heart Building, Suite # 4/3, Naya Paltan, Dhaka"),
      row("SUIT-4/3, CITY HEART, 67 NAYAPALTAN, PALTAN, DHAKA"),
      1,
      "City Heart Building 67 vs inverted Naya Paltan",
    );
    assertBothOrders(
      row("Plot # 702, Jhajar, National University, Board bazar, Gazipur"),
      row("Plot-702, Jajhar, National University, Gazipur"),
      1,
      "Plot 702 Jhajar vs Jajhar spelling",
    );
    assertBothOrders(
      row("16, Naya Palton (4th Floor), Mosjid Goli, Dhaka"),
      row("16, Noya Paltan (3rd fl), Masjid Goli, Dhaka"),
      1,
      "16 Naya Palton vs Noya Paltan spelling",
    );
    assertBothOrders(
      row("Plot - 404, Shutivola, Fakirkhali Road, Badda, 1212, Dhaka, Bangladesh"),
      row("Shutivola, 404, Fakirkhali Road, Badda, Dhaka"),
      1,
      "Plot 404 Shutivola inverted vs Fakirkhali Road",
    );
    assertBothOrders(
      row(
        "687, AL-HAJ NURUL AMIN SOWDAGOR LANE, SOUTH AGRABAD, ROAD# 20, CDA R/A, AGRABAD, CHITTAGONG, BANGLADESH",
      ),
      row("687, CDA R/A, Road # 20, Alhaj Nurul Amin Sowdagar Lane, Chittagong, South Agrabad"),
      1,
      "687 Sowdagor Lane inverted vs CDA R/A",
    );
    assertBothOrders(
      row("Munna Complex, 228 Dighirpar, Nazma Khatun Lane, Dewanhat, Chittagong"),
      row("MUNNA COMPLEX, 228, DIGHIR PAR, DEWANHAT, DOUBLEMOORING, CHATTOGRAM"),
      1,
      "Munna Complex 228 Dighirpar vs Dighir Par",
    );
    assertBothOrders(
      row("1236/E, Baker Ali Fakir Tack, 38, South Middle Halishahar, Chittagong, Bandar"),
      row("1236/E Baker Ali Fakir Tack, 38/South Middle Halishahar"),
      1,
      "1236/E Halishahar vs 38/South Middle Halishahar",
    );
    assertBothOrders(
      row("12/1, Hossain Uddin Khan 1st Lane, Lalbag, Nabanganj, Dhaka, Lalbagh"),
      row("12/1 Hossain Uddin Khan, 1st Lane, Lalbagh Road, Lalbagh, 1211, Dhaka, Bangladesh"),
      1,
      "12/1 Hossain Uddin Khan 1st Lane vs inverted Lalbagh Road",
    );
    assertBothOrders(
      row("12/1, Hossain Uddin Khan 1st Lane, Lalbag, Dhaka"),
      row("12/1, Hossain Uddin Khan 2nd Lane, Lalbag, Dhaka"),
      2,
      "12/1 1st Lane vs 2nd Lane",
    );
    assertBothOrders(
      row("Plot # 10, 1st Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Lane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Lane vs 2nd Lane",
    );
    assertBothOrders(
      row("Plot # 10, 1st Street, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Street, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Street vs 2nd Street",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport Road, Green, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green Road, Airport, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport Road, Green vs Green Road, Airport",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7 Airport Road, Green, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Green Road, Airport, Gulshan-1, Dhaka"),
      2,
      "House 50 7 Airport Road, Green vs 7 Green Road, Airport",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport Road, Green House, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green Road, Airport Plaza, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport Road, Green House vs Green Road, Airport Plaza",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport Road, Green, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green, Airport, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport Road, Green vs Green, Airport leftover",
    );
    assertBothOrders(
      row("Plot # 10, Airport, Green, Gulshan-1, Dhaka"),
      row("Plot # 10, Green, Airport, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport, Green vs Green, Airport leftover",
    );
    assertBothOrders(
      row("Plot # 10, Airport, Green, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green Road, Airport, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport, Green vs Green Road, Airport leftover",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport Avenue, Green, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green, Airport, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport Avenue, Green vs Green, Airport leftover",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 Airport Road, Green, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 Airport Road, Green leftover",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7 Airport Road, Green, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Green, Airport, Gulshan-1, Dhaka"),
      2,
      "House 50 7 Airport Road, Green vs 7 Green, Airport leftover",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7 Airport Road, Green, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Green, Airport, Gulshan-1, Dhaka"),
      2,
      "7 Airport Road, Green vs 7 Green, Airport leftover",
    );
    assertBothOrders(
      row("Plot # 10, 10 Banani, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Barani, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Banani vs Plot 10 Barani",
    );
    assertBothOrders(
      row("Plot # 10, 10 Banani, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Bananipur, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Banani vs Plot 10 Bananipur",
    );
    assertBothOrders(
      row("Plot # 10, 10 Green, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Greenpur, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Green vs Plot 10 Greenpur",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport Road, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Greenpur, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport Road vs Plot 10 Greenpur",
    );
    assertBothOrders(
      row("Plot # 10, 10 Green Road, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Greenpur, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Green Road vs Plot 10 Greenpur",
    );
    assertBothOrders(
      row("Plot # 10, 10 Green Road, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Bananipur, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Green Road vs Plot 10 Bananipur",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport Road, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Bananipur, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Airport Road vs Plot 10 Bananipur",
    );
    for (const other of ["Greenpara", "Greenpar", "Greenbari", "Greennagar"]) {
      assertBothOrders(
        row("Plot # 10, 10 Green, Gulshan-1, Dhaka"),
        row(`Plot # 10, 10 ${other}, Gulshan-1, Dhaka`),
        2,
        `Plot 10 Green vs Plot 10 ${other}`,
      );
    }
    assertBothOrders(
      row("244, Singair Road, Hemayetpur, Savar, Dhaka"),
      row("244, Hemayetpur, Savar, Dhaka"),
      1,
      "244 Singair Road Hemayetpur vs 244 Hemayetpur",
    );
    assertBothOrders(
      row("309, Polash Bari, Ashuliya, Savar, Dhaka"),
      row("309, Palashbari, Ashulia, Savar, Dhaka"),
      1,
      "309 Polash Bari vs Palashbari",
    );
    assertBothOrders(
      row("138, BAIZID BOSTAMI ROAD, CHATTOGRAM"),
      row("138 BAIZID BOSTAMI ROAD NASIRABAD I/A, Bayjid Bostami, Chattogram"),
      1,
      "138 Baizid Bostami Road vs Nasirabad I/A",
    );
    assertBothOrders(
      row("671, Dattopara, Hossain Market, Tongi, Gazipur"),
      row("Hossain Market, 671, Datta Para, Tongi, Gazipur"),
      1,
      "671 Dattopara vs 671 Datta Para",
    );
    assertBothOrders(
      row("Plot # 10, 10 Rampura, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Rampur, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Rampura vs Plot 10 Rampur",
    );
    assertBothOrders(
      row("Plot # 10, Green View, Gulshan-1, Dhaka"),
      row("Plot # 10, Airport City, Gulshan-1, Dhaka"),
      2,
      "Plot 10 Green View vs Plot 10 Airport City",
    );
    assertBothOrders(
      row("Plot # 10, 1st Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, 3rd Lane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Lane vs 3rd Lane",
    );
    assertBothOrders(
      row("Plot # 10, 1st Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, 1st Road, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Lane vs 1st Road",
    );
    assertBothOrders(
      row("Plot # 10, 1st Avenue, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Avenue, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Avenue vs 2nd Avenue",
    );
    assertBothOrders(
      row("House # 12, 1st Lane, Lalbag, Dhaka"),
      row("House # 12, 2nd Lane, Lalbag, Dhaka"),
      2,
      "House 12 1st Lane vs 2nd Lane",
    );
    assertBothOrders(
      row("Plot # 10, 1st Ln, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Ln, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Ln vs 2nd Ln",
    );
    assertBothOrders(
      row("Plot # 10, 1st Ln, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Lane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Ln vs 2nd Lane",
    );
    assertBothOrders(
      row("Plot # 10, 1st-Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd-Lane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st-Lane vs 2nd-Lane hyphen",
    );
    assertBothOrders(
      row("Plot # 10, 1stLane, Gulshan-1, Dhaka"),
      row("Plot # 10, 2ndLane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1stLane vs 2ndLane glued",
    );
    assertBothOrders(
      row("Plot # 10, Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Lane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 un-ordinal Lane vs 2nd Lane",
    );
    assertBothOrders(
      row("Plot # 10, 1st Gali, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Gali, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Gali vs 2nd Gali",
    );
    for (const word of ["Boulevard", "Blvd", "Drive", "Close"]) {
      assertBothOrders(
        row(`Plot # 10, 1st ${word}, Gulshan-1, Dhaka`),
        row(`Plot # 10, 2nd ${word}, Gulshan-1, Dhaka`),
        2,
        `Plot 10 1st ${word} vs 2nd ${word}`,
      );
    }
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 S‐E Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 S-E Banani U+2010 hyphen",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 S‒E Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 S-E Banani U+2012 figure dash",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 S―E Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 S-E Banani U+2015 horizontal bar",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 S_E Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 S_E Banani underscore",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 S\u00ADE Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 S-E Banani U+00AD soft hyphen",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 S\uFF0DE Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 S-E Banani U+FF0D fullwidth hyphen-minus",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 S\uFE63E Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 S-E Banani U+FE63 small hyphen-minus",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 S\uFE58E Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 S-E Banani U+FE58 small em dash",
    );
    assertBothOrders(
      campusRow(),
      row("House # 50, Road # 3, 7 S\u2E3AE Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 S-E Banani U+2E3A two-em dash",
    );
    for (const other of [
      "House # 13 (Old Zone 2)",
      "House # 13 (Old #13)",
      "House # 13 (old 2)",
      "House # 13 (Old, Plot 2)",
    ]) {
      assertBothOrders(
        row("House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka"),
        row(`House # 62, Plot # 10, Holding # 1, ${other}, Tejgaon, Dhaka`),
        2,
        `House 187 vs ${other} Plot+Holding`,
      );
    }
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187 (Old Zone 2), Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka"),
      2,
      "House 187 (Old Zone 2) vs House 13 Plot+Holding",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187 (Former #187), Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, House # 13, Tejgaon, Dhaka"),
      2,
      "House 187 (Former #187) vs House 13 Plot+Holding",
    );
    assertBothOrders(
      row("House # 62, Plot # 10, Holding # 1, House # 187, Tejgaon, Dhaka"),
      row("House # 62, Plot # 10, Holding # 1, House # 13 (Old Zone), Tejgaon, Dhaka"),
      2,
      "House 187 vs House 13 (Old Zone) Plot+Holding",
    );
    {
      const southBanani = [
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Gulshan, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 South Banani, Gulshan-1, Dhaka"),
      ];
      for (const ordered of permutations(southBanani)) {
        const locs = mergeUniqueLocations(ordered);
        assert.equal(locs.length, 2, "House50 + 7 Gulshan + 7 South Banani");
        const campus = locs.find((loc) =>
          loc.source_rows.some((r) => /House # 50, Road # 3, Gulshan-1, Dhaka/.test(r.address)),
        );
        assert.ok(campus);
        assert.ok(
          campus!.source_rows.some((r) => /7 Gulshan/.test(r.address)),
          "House 50 must stay with 7 Gulshan",
        );
        assert.ok(
          !campus!.source_rows.some((r) => /South Banani/.test(r.address)),
          "7 South Banani must not sit on the House 50 / 7 Gulshan row",
        );
      }
    }
    {
      const southGulshan = [
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 South Gulshan, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ];
      for (const ordered of permutations(southGulshan)) {
        const locs = mergeUniqueLocations(ordered);
        assert.equal(locs.length, 2, "House50 + 7 South Gulshan + 7 Banani Road");
        const campus = locs.find((loc) =>
          loc.source_rows.some((r) => /House # 50, Road # 3, Gulshan-1, Dhaka/.test(r.address)),
        );
        assert.ok(campus);
        assert.ok(
          campus!.source_rows.some((r) => /7 South Gulshan/.test(r.address)),
          "House 50 must stay with 7 South Gulshan",
        );
        assert.ok(!campus!.source_rows.some((r) => /Banani Road/.test(r.address)));
      }
    }
    for (const extra of [
      "7 Choto Banani",
      "7 Baro Banani",
      "7 South East Banani",
      "7 South-East Banani",
      "7 Southern Banani",
      "7 Paschim Banani",
    ]) {
      const mixed = [
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Gulshan, Gulshan-1, Dhaka"),
        row(`House # 50, Road # 3, ${extra}, Gulshan-1, Dhaka`),
      ];
      for (const ordered of permutations(mixed)) {
        const locs = mergeUniqueLocations(ordered);
        assert.equal(locs.length, 2, `House50 + 7 Gulshan + ${extra}`);
        const campus = locs.find((loc) =>
          loc.source_rows.some((r) => /House # 50, Road # 3, Gulshan-1, Dhaka/.test(r.address)),
        );
        assert.ok(campus);
        assert.ok(
          campus!.source_rows.some((r) => /7 Gulshan/.test(r.address)),
          `House 50 must stay with 7 Gulshan beside ${extra}`,
        );
        assert.ok(
          !campus!.source_rows.some((r) => r.address.includes(extra)),
          `${extra} must not sit on the House 50 / 7 Gulshan row`,
        );
      }
    }
    for (const gulshanExtra of [
      "7 Choto Gulshan",
      "7 Baro Gulshan",
      "7 South-East Gulshan",
    ]) {
      const mixed = [
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row(`House # 50, Road # 3, ${gulshanExtra}, Gulshan-1, Dhaka`),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ];
      for (const ordered of permutations(mixed)) {
        const locs = mergeUniqueLocations(ordered);
        assert.equal(locs.length, 2, `House50 + ${gulshanExtra} + 7 Banani Road`);
        const campus = locs.find((loc) =>
          loc.source_rows.some((r) => /House # 50, Road # 3, Gulshan-1, Dhaka/.test(r.address)),
        );
        assert.ok(campus);
        assert.ok(
          campus!.source_rows.some((r) => r.address.includes(gulshanExtra)),
          `House 50 must stay with ${gulshanExtra}`,
        );
        assert.ok(
          !campus!.source_rows.some((r) => /Banani Road/.test(r.address)),
          `7 Banani Road must not sit on the House 50 / ${gulshanExtra} row`,
        );
      }
    }
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, SAT 7 Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      1,
    );
    for (const other of [
      "7 Tejgaon Road",
      "7 Mirpur Road",
      "7 Uttara Road",
      "7 Pallabi Road",
      "7 Baridhara Road",
      "7 Airport Road",
      "7 Green Road",
      "7 Tejgaon",
      "7 Mohakhali",
      "7 Badda",
      "7 Eskaton",
    ]) {
      assert.equal(
        displays([
          row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
          row(`House # 50, Road # 3, ${other}, Gulshan-1, Dhaka`),
        ]).length,
        2,
        `7 Gulshan Avenue vs ${other} with Gulshan-1`,
      );
    }
    {
      const mixed = [
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Gulshan, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ];
      for (const ordered of permutations(mixed)) {
        const locs = mergeUniqueLocations(ordered);
        assert.equal(locs.length, 2, "House50 + 7 Gulshan + 7 Banani Road");
        const campus = locs.find((loc) =>
          loc.source_rows.some((r) => /House # 50, Road # 3, Gulshan-1, Dhaka/.test(r.address)),
        );
        const banani = locs.find((loc) =>
          loc.source_rows.some((r) => /Banani Road/.test(r.address)),
        );
        assert.ok(campus);
        assert.ok(banani);
        assert.notEqual(campus, banani);
        assert.ok(
          campus!.source_rows.some((r) => /7 Gulshan/.test(r.address)),
          "House 50 must stay with 7 Gulshan",
        );
        assert.ok(
          !campus!.source_rows.some((r) => /Banani Road/.test(r.address)),
          "7 Banani Road must not sit on the House 50 / 7 Gulshan row",
        );
      }
    }
    {
      const withGulshan1 = [
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Gulshan Avenue, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 7 Banani Road, Gulshan-1, Dhaka"),
      ];
      for (const ordered of permutations(withGulshan1)) {
        const locs = mergeUniqueLocations(ordered);
        assert.equal(locs.length, 2, "House50 + 7 Gulshan Avenue + 7 Banani Road Gulshan-1");
        const campus = locs.find((loc) =>
          loc.source_rows.some((r) => /House # 50, Road # 3, Gulshan-1, Dhaka/.test(r.address)),
        );
        assert.ok(campus);
        assert.ok(
          campus!.source_rows.some((r) => /7 Gulshan Avenue/.test(r.address)),
          "House 50 must stay with 7 Gulshan Avenue",
        );
        assert.ok(
          !campus!.source_rows.some((r) => /Banani Road/.test(r.address)),
        );
      }
    }
    assert.equal(
      displays([
        row("House # 62, Plot # 10, Number 187 Bashundhara, Dhaka"),
        row("House # 62, Plot # 10, Number 13 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Plot # 10, 187 Bashundhara, Dhaka"),
        row("House # 62, Plot # 10, 13 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Holding # 1, Number 187 Bashundhara, Dhaka"),
        row("House # 62, Holding # 1, Number 13 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, House # 10, Number 187 Bashundhara, Dhaka"),
        row("House # 62, House # 10, Number 13 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, Number 187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, Number 100 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, Number 187 Bashundhara, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, Number 186 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Number 87, Tejgaon, Dhaka"),
        row("House # 62, Number 13, Tejgaon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, 187, Aftabnagar, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Bashundhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62, Road # 3, Block-B, Niketon, 12 Badda, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 12 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8 & 10, Block-A, Gulshan, Dhaka"),
        row("Plot # 8, Block-A & Plot # 10, Block-A, Gulshan, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("Plot # 31-32, Sector # 01, CEPZ, Chittagong"),
        row("Plot # 31-32, Sector # 01, Plot # 33, Sector # 01, CEPZ, Chittagong"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 50, Road # 3, Gulshan-1, Dhaka"),
        row("House # 50, Road # 3, 87, Gulshan Avenue, Gulshan-1, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87 Gulshan Avenue, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87 Gulshan Road, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87 Gulshan, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 87 Banani Road, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 10 Gulshan Avenue, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, 13 Niketon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, 20 Niketon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, 29 Niketon, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 12 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 25 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 12 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 29 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 187 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, 100 Badda, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 62 (1st Floor), Road # 3, Block-B, Niketon, Gulshan, Dhaka"),
        row("House # 62, Road # 3, Block-B, Niketon, No.187 Eskaton, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, Turag, 12 Dhour, Dhaka-1230"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, 20 Dhour, Turag, Dhaka-1230"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, Turag, 30 Dhour, Dhaka-1230"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, 30 Dhour, Turag, Dhaka-1230"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, 32 Dhour, Turag, Dhaka-1230"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, 87 Dhour, Turag, Dhaka-1230"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, Turag, No. 12 Dhour, Dhaka-1230"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, Turag, #12 Dhour, Dhaka-1230"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, Turag, 12-A Dhour, Dhaka-1230"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House 10, Dailla, Demra, Dhaka"),
        row("House 10, Dailla, 30 Demra, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, 10 storied, Turag, Dhaka-1230"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 161 (5th Floor), Road # 1, DOHS, Baridhara DOHS, Dhaka"),
        row("74 East Kazipara, House # 161 (5th Floor), Road # 1, DOHS, Baridhara DOHS, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 430, Road # 30, New DOHS, Baridhara, Dhaka"),
        row("292 Inner Circular Rd, House # 430, Road # 30, New DOHS, Baridhara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 161 (5th Floor), Road # 1, DOHS, Baridhara DOHS, Dhaka"),
        row(
          "74, East Kazipara, House # 161 (5th Floor), Road # 1, DOHS, Mirpur, Dhaka, Baridhara DOHS, Dhaka",
        ),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House # 161 (5th Floor), Road # 1, DOHS, Baridhara DOHS, Dhaka"),
        row("House # 161, Road # 1, Pallabi, Mirpur DOHS, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Baridhara DOHS, Dhaka, House # 430, Road # 30, New DOHS"),
        row("Shatabdi Center, 292, Inner Circular Rd, House # 430, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("403, KULGAON, HATHAZARI ROAD, JALALABAD, BAIZID"),
        row(
          "403 Kulgoan, Hathazari Road, Jalalabad, Biazid, Bayjid Bostami PS, Chattogram - 4214, Bangladesh",
        ),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("HOUSE-4, (GR &1ST FLOOR), ROAD-13, SECTOR-04, DHAKA"),
        row("House # 4 (Gr. & 1st floor), Road # 13, Sector # 04, Uttara Model Town, Dhaka-1230."),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("Plot No-1703-04, Gacha Road, Gacha"),
        row("Gacha, Plot # 1703-1704, Gacha Road, Gacha"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("Ramarbag, Fatullah & G-88/1, BSCIC, Fatullah"),
        row("Ramarbag, Fatullah"),
      ]).length,
      2,
    );
  });

  it("merges hyphenated floor lists with the same house", () => {
    assert.equal(
      displays([
        row("Siaam Tower, Level-9 & 10, Plot # 15, Sector # 3, Dhaka, Uttara"),
        row("SIAAM TOWER (LEVEL 9TH & 10TH), PLOT 15, SECTOR 3, UTTARA NEW MODEL TOWN"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("380/3, (Ground & 2nd Floor), Banasree Road, East Rampura, Dhaka"),
        row("380/3 BANASREE ROAD, EAST RAMPURA"),
      ]).length,
      1,
    );
  });

  it("merges Senakalayan Bhaban with Sena Kalyan Bhaban at the same suite", () => {
    assert.equal(
      displays([
        row("Senakalayan Bhaban (Floor # 11), Suite # 1106, 195 Motijheel C/A, Dhaka-1000."),
        row("Sena Kalyan Bhaban (Floor-11) Suite # 1106, 195 Motijheel C/A, Dhaka."),
      ]).length,
      1,
    );
  });

  it("merges Sujat Plaza house 2 at Mirpur-12 with Pallabi", () => {
    assert.equal(
      displays([
        row("2 No, Sujat Nagar, Sujat Plaza, Dhaka, Mirpur-12"),
        row("2, SUJAT NAGAR, SUJAT PLAZA, PALLABI, DHAKA"),
      ]).length,
      1,
    );
  });

  it("merges Degerchala with Degerchala Road Chaydana on holding 72", () => {
    assert.equal(
      displays([
        row("72, DEGERCHALA, NATIONAL UNIVERSITY, GAZIPUR"),
        row("72, Degerchala Road, Chaydana, National University, Gazipur"),
      ]).length,
      1,
    );
  });

  it("merges Emerald with Emeraid and Baktarpur with UttorBoktarpur on the same house", () => {
    assert.equal(
      displays([
        row("ADD Emerald, House # 18/3, Tallabagh, Sobhanbagh, Dhaka-1207"),
        row("ADDL Emeraid, Apt # A1 & B1, 18/3, Tallabagh, Sobhanbagh, Dhaka-1207"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("A-99/1 Baktarpur, Kaliakoir, 1750, Gazipur, Bangladesh"),
        row("A-99/1, UttorBoktarpur, Gazipur, B. Baria"),
      ]).length,
      1,
    );
  });

  it("merges a company-name CEPZ dump with Plot 6-11 South Halisahar", () => {
    assert.equal(
      displays([
        row(
          "BANGLADESH SPINNERS & KNITTERS (PVT) LTD. PLOT NO. 6 TO 11, SECTOR - 4/A, CHITTAGONG EXPORT PROCESSING ZONE, CHITTAGONG TEL: 741872",
        ),
        row("Plot # 6-11, Sector # 4/A, South Halisahar, CEPZ, Bandar, 4223, Chattogram, Bangladesh"),
      ]).length,
      1,
    );
  });

  it("does not absorb Jamirdia-only into a Jamirdia and Meherbari concatenation", () => {
    assert.equal(
      displays([
        row("Jamirdia, Habirbari, Valuka, Mymensingh & Meherbari, Valuka, Mymensingh."),
        row("Jamirdia, Habirbari, P.S: Valuka, Mymensingh - 2240, Bangladesh"),
      ]).length,
      2,
    );
  });

  it("does not fuse Bora Dharmapur in Comilla with Kaicha Bari in Ashulia", () => {
    assert.equal(
      displays([
        row("Bora Dharmapur, Lalmai, Kotwali, Comilla."),
        row("Kaicha Bari, Ashulia, Dhaka."),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Bora, Sreepur, Gazipur"),
        row("Master Bari, Sreepur, Gazipur"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Hatimara, Kashimpur, Gazipur"),
        row("SURA BARI, KASHIMPUR, GAZIPUR"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Bora, Sreepur, Gazipur"),
        row("Boro Bari, Sreepur, Gazipur"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Bera, Sreepur, Gazipur"),
        row("Baro Bari, Sreepur, Gazipur"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Bora, Sreepur, Gazipur"),
        row("Bara Bari, Sreepur, Gazipur"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Bora Dharmapur, Lalmai, Kotwali, Comilla."),
        row("Kaichabari, Savar, Dhaka."),
      ]).length,
      2,
    );
  });

  it("does not merge the same house at a plaza in Uttara with Mirpur or Gazipur with Ashulia", () => {
    assert.equal(
      displays([
        row("2, City Plaza, Uttara, Dhaka"),
        row("2, City Plaza, Mirpur, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("2, Shamser Plaza, Gazipur"),
        row("2, Shamser Plaza, Ashulia"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("2, Sreepur Stand, Gazipur"),
        row("2, Sreepur Stand, Ashulia"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("2, Sujat Plaza, Mirpur-12, Dhaka"),
        row("2, Sujat Plaza, Uttara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Anwar Tower, House 12, Uttara, Dhaka"),
        row("Anwar Tower, House 12, Mirpur, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("2, City Plaza, CEPZ, Chattogram"),
        row("2, City Plaza, DEPZ, Savar"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("House 2, Pallabi, Dhaka"),
        row("House 2, Uttara, Mirpur, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("2, Sujat Plaza, Pallabi, Dhaka"),
        row("2, Sujat Plaza, Mirpur-12, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House 2, Pallabi, Uttara, Dhaka"),
        row("House 2, Mirpur, Uttara, Dhaka"),
      ]).length,
      2,
    );
  });

  it("merges Office and Factory wording with the same village spelling", () => {
    assert.equal(
      displays([
        row("Office & Factory: Kotwalirchar, Madhabdi, Narsingdi."),
        row("Kotwalirchar, Madhabdi, Norshindi."),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("Office & Factory: Vogra, Gazipur"),
        row("Vogra, Gazipur"),
      ]).length,
      1,
    );
  });

  it("merges Malanchanagar with Malanacho Nagar on the same road", () => {
    assert.equal(
      displays([
        row("MALANCHANAGAR, ROAD NO-03, POLICE LINE, TAGARPAR, FATULLAH"),
        row("Malanacho Nagar, Road # 03, West Esdair, Tagarpar"),
      ]).length,
      1,
    );
  });

  it("merges the same holdings when one spelling omits a comma or plot label", () => {
    assert.equal(
      displays([
        row(
          "South Avenue Tower, 6th floor, House # 50, Road # 3, 7, Gulshan Avenue, Gulshan-1, Dhaka-1212",
        ),
        row(
          "South Avenue Tower (6th floor), House # 50, Road # 03, 7 Gulshan Avenue, Gulshan-1, Dhaka-1212",
        ),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("323, 324, Moynarbagh, Hossain Market, Uttar Badda, Dhaka"),
        row("House# 323, 324, Moynarbagh, Hossain Market, Uttar Badda, 1212, Dhaka, Bangladesh"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("Plot # S.A.-7,8, R.S.-11,12,13, Karamtola, Pubail"),
        row("PLOT NO-S.A. 7-8, R.S-11,12,13 MOUZA, KARAMTOLA, PUBAIL,, , GAZIPUR"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row(
          "PLOT NO-215, 216 & 217/B, BSCIC I/A, SHASONGAON, FATULLAH, NARAYANGANJ., FATULLAH, NARAYANGANJ",
        ),
        row("PLOT # 215,216 & 217/B, BSCIC I/A, SHASONGAON"),
      ]).length,
      1,
    );
  });

  it("does not absorb Plot 27 Holding 1/A into House 1 at Mirpur-12", () => {
    assert.equal(
      displays([
        row("Plot # 27, Holding # 1/A, Milk Vita Road, Sec-7, Pallabi, Dhaka, Mirpur"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, MIRPUR-12, DHAKA-1216, , DHAKA"),
      ]).length,
      2,
    );
  });

  it("does not expand Plot 62-8 into plots 62 through 68", () => {
    const ids = premisesIdentifiers("Plot 62-8, Niketon, Dhaka");
    assert.equal(ids.has("65"), false);
    assert.equal(ids.has("68"), false);
    assert.equal(ids.has("62"), true);
    assert.equal(ids.has("8"), true);
    assert.equal(
      displays([
        row("Plot 62-8, Niketon, Dhaka"),
        row("Plot 68, Niketon, Dhaka"),
      ]).length,
      2,
    );
  });

  it("completes a 2-digit abbreviated range end without promoting a 1-digit end", () => {
    const konabari = premisesIdentifiers("Plot# 371-72, BSCIC, Konabari");
    assert.equal(konabari.has("371"), true);
    assert.equal(konabari.has("372"), true);
    assert.equal(konabari.has("72"), false);
    const peace = premisesIdentifiers("Plot 167-69, Dhaka EPZ");
    assert.equal(peace.has("167"), true);
    assert.equal(peace.has("169"), true);
    const talent = premisesIdentifiers("Plot 215-16, BSCIC");
    assert.equal(talent.has("215"), true);
    assert.equal(talent.has("216"), true);
    const epz = premisesIdentifiers("Plot 1703-04, DEPZ");
    assert.equal(epz.has("1703"), true);
    assert.equal(epz.has("1704"), true);
    assert.equal(
      displays([
        row("Plot# 371-72, BSCIC, Konabari"),
        row("Plot No. 371-372, Basic, Konabari"),
      ]).length,
      1,
    );
  });

  it("keeps an unlabelled old/new holding pair on the same road as one premises", () => {
    assert.equal(
      displays([
        row("60, B.B. Road, Enayet Nagor, Narayanganj"),
        row("60 (OLD), 86 (NEW) B. B. ROAD, SADAR, NARAYANGANJ"),
      ]).length,
      1,
    );
  });

  it("two different Gulshan buildings stay two (Moyeen Center vs Bilquis Tower)", () => {
    const bilquis = premisesIdentifiers(
      "Bilquis Tower (4th Floor), Plot-6 ( New), Gulshan-02 Circle, Dhaka-1212",
    );
    assert.equal(bilquis.has("6"), true);
    assert.equal(premisesIdentifiers("Plot No. 6 (New), Gulshan").has("6"), true);
    assert.equal(premisesIdentifiers("Plot No 6 (New), Gulshan").has("6"), true);
    assert.equal(
      displays([
        row("Moyeen Center, House # 9B, Road # 3(2), Gulshan, Dhaka"),
        row("Bilquis Tower (4th Floor), Plot-6 ( New), Gulshan-02 Circle, Dhaka-1212"),
      ]).length,
      2,
    );
  });

  it("does not absorb a leftover plot into a house-only row", () => {
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Gulshan, Dhaka"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 10, Holding # 1/A, Gulshan, Dhaka"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 11, Holding # 1/A, Tejgaon, Dhaka"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, TEJGAON, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Milk Vita Road, Sec-7, Pallabi, Dhaka, Mirpur"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, MIRPUR-12, DHAKA-1216, , DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 27, Holding # 1/A, Niketon, Dhaka"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, NIKETON, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 27, Holding # 1/A, Banani, Dhaka"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, BANANI, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 2, Holding # 50, Gulshan, Dhaka"),
        row("HOUSE NO-50, ROAD NO.-09, BLOCK-A, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8 & 10, Holding # 1/A, Gulshan, Dhaka"),
        row("HOUSE NO-01, HOUSE NO-10, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8 & 10, Holding # 1/A, Gulshan, Dhaka"),
        row("HOLDING NO-01, HOLDING NO-10, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8 & 10, Holding # 1/A, Gulshan, Dhaka"),
        row("H/O-01, H/O-10, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8 & 10, Holding # 1/A, Gulshan, Dhaka"),
        row("HOUSE NO-10, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 10, Holding # 1/A, 10 Banani Road, Gulshan, Dhaka"),
        row("HOUSE NO-01, 10 Banani Road, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 10, Holding # 1/A, Gulshan, Dhaka"),
        row("HOUSE NO-01, 10 Banani Road, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Gulshan, Dhaka"),
        row("HOUSE NO-01, HOUSE NO-08, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Shamser Plaza, Uttara, Dhaka"),
        row("HOUSE NO-01, Shamser Plaza, Uttara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Shamser Plaza, Pallabi, Dhaka"),
        row("HOUSE NO-01, Shamser Plaza, MIRPUR-12, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, 10 Banani Road, Gulshan, Dhaka"),
        row("HOUSE NO-01, 10 Banani Road, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Gulshan, Dhaka"),
        row("H/O-01, ROAD NO.-09, BLOCK-A, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Gulshan, Dhaka"),
        row("HO-08, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Gulshan, Dhaka"),
        row("HOLDING NO-08, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 10, Holding # 1/A, Gulshan, Dhaka"),
        row("HOLDING NO-10, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 10, Holding # 1/A, 10 Banani Road, Gulshan, Dhaka"),
        row("HOLDING NO-01, 10 Banani Road, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Shamser Plaza, Uttara, Dhaka"),
        row("HOLDING NO-08, Shamser Plaza, Uttara, Dhaka"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Gulshan, Dhaka"),
        row("HO-01, ROAD NO.-09, BLOCK-A, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 8, Holding # 1/A, Gulshan, Dhaka"),
        row("HO 01, ROAD NO.-09, BLOCK-A, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 10, Holding # 1/A, Milk Vita Road, Sec-7, Pallabi, Dhaka, Mirpur"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, MIRPUR-12, DHAKA-1216, , DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 27, Holding # 1/A, Mohakhali, Dhaka"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, MOHAKHALI, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 27, Holding # 1/A, Dhanmondi, Dhaka"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, DHANMONDI, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 27, Holding # 1/A, Gulshan, Dhaka"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, GULSHAN, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 27, Holding # 1/A, Tejgaon, Dhaka"),
        row("HOUSE NO-01, ROAD NO.-09, BLOCK-A, TEJGAON, DHAKA"),
      ]).length,
      2,
    );
    assert.equal(
      displays([
        row("Plot # 389, Baridhara DOHS, Dhaka"),
        row("Plot # 389, House 6, Baridhara DOHS, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("Plot 1 & 27, Mirpur, Dhaka"),
        row("Plot 1, Mirpur, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("Plot 1 & 14, Mirpur, Dhaka"),
        row("Plot 1, Mirpur, Dhaka"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("Holding # 137/1, Dag No.-1977-1978, Fordnagor, Dhalla Bazar, Singair, Manikganj."),
        row(
          "Holding No. 137/1, Plot No. 1977-1978, Ford Nagar, Dhalla Bazar, Singair, Manikganj - 1820, Bangladesh",
        ),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 06, Road-07, Block-B, Turag, Dhaka-1230"),
        row("House # 06, Road-07, Block-B, 390 Dhour, P.O- Nishat Nagar, Turag, Dhaka-1230"),
      ]).length,
      1,
    );
  });

  it("merges Holding 106 Faidabad/Faridabad and Plot 140 Baron DEPZ / D EPZ", () => {
    assertBothOrders(
      row(
        "Holding # 106, Ward # 5, East Faridabad, Baitur Rahmat Jame Mosque Road\nDhaka\nDakshinkhan",
      ),
      row(
        "Holding No. 106, Ward No. 5, Baitur Rahmat Jame Mosque Road, East Faidabad (Atipara), Dakshinkhan, Dhaka - 1230, Bangladesh",
      ),
      1,
      "Holding 106 East Faridabad vs East Faidabad with Ward 5",
    );
    assertBothOrders(
      row("Union Plaza, Plot # 140, Baron, D EPZ Road, Ashulia\nDhaka\nDhaka"),
      row("Union Plaza, 140 Baron, DEPZ Road, Ashulia, Savar, Dhaka - 1349, Bangladesh"),
      1,
      "Union Plaza 140 Baron D EPZ vs DEPZ Road",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport Road, Green, Gulshan-1, Dhaka"),
      row("Plot # 10, 10 Green Road, Airport, Gulshan-1, Dhaka"),
      2,
      "Airport Road leftover vs Green Road leftover stays two rows",
    );
    assertBothOrders(
      row("House # 50, Road # 3, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Gulshan, Gulshan-1, Dhaka"),
      1,
      "House 50 vs 7 Gulshan after DEPZ join",
    );
  });

  it("keeps two named extras apart when they share a third extra, un-ordinal streets, and C DA vs DA", () => {
    assertBothOrders(
      row("Plot # 10, Gulshan, Airport Road, Dhaka"),
      row("Plot # 10, Gulshan, Green, Dhaka"),
      2,
      "Plot 10 Gulshan Airport Road vs Gulshan Green",
    );
    assertBothOrders(
      row("Plot # 10, 10, Gulshan, Airport Road, Dhaka"),
      row("Plot # 10, 10, Gulshan, Green, Dhaka"),
      2,
      "Plot 10 stuffed Gulshan Airport Road vs Gulshan Green",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7, Gulshan, Airport Road, Dhaka"),
      row("House # 50, Road # 3, 7, Gulshan, Green, Dhaka"),
      2,
      "7 Gulshan Airport Road vs 7 Gulshan Green",
    );
    assertBothOrders(
      row("Plot # 10, Banani, Airport Road, Dhaka"),
      row("Plot # 10, Banani, Green, Dhaka"),
      2,
      "Plot 10 Banani Airport Road vs Banani Green",
    );
    assertBothOrders(
      row("Plot # 10, Dhanmondi, Airport Road, Dhaka"),
      row("Plot # 10, Dhanmondi, Green, Dhaka"),
      2,
      "Plot 10 Dhanmondi Airport Road vs Dhanmondi Green",
    );
    assertBothOrders(
      row("Plot # 10, Hemayetpur, Airport Road, Dhaka"),
      row("Plot # 10, Hemayetpur, Green, Dhaka"),
      2,
      "Plot 10 Hemayetpur Airport Road vs Hemayetpur Green",
    );
    assertBothOrders(
      row("Plot # 10, 10 Gulshan, Airport Road, Dhaka"),
      row("Plot # 10, 10 Gulshan, Green Road, Dhaka"),
      2,
      "Plot 10 Gulshan Airport Road vs Gulshan Green Road both-road",
    );
    assertBothOrders(
      row("Plot # 10, 10 Kazi Nazrul Islam Avenue, Green, Dhaka"),
      row("Plot # 10, 10 Green, Nazrul, Dhaka"),
      2,
      "Kazi Nazrul Islam Avenue leftover vs Green Nazrul",
    );
    assertBothOrders(
      row("Plot # 10, 10 Shaheed Tajuddin Ahmed Avenue, Green, Dhaka"),
      row("Plot # 10, 10 Green, Tajuddin, Dhaka"),
      2,
      "Tajuddin Ahmed Avenue leftover vs Green Tajuddin",
    );
    assertBothOrders(
      row("Plot # 10, 10 Kobi Jasimuddin Road, Green, Dhaka"),
      row("Plot # 10, 10 Green, Jasimuddin, Dhaka"),
      2,
      "Jasimuddin Road leftover vs Green Jasimuddin",
    );
    assertBothOrders(
      row("Plot # 10, Street, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Street, Gulshan-1, Dhaka"),
      2,
      "Plot 10 un-ordinal Street vs 2nd Street",
    );
    assertBothOrders(
      row("Plot # 10, Gali, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Gali, Gulshan-1, Dhaka"),
      2,
      "Plot 10 un-ordinal Gali vs 2nd Gali",
    );
    assertBothOrders(
      row("Plot # 10, Ln, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Ln, Gulshan-1, Dhaka"),
      2,
      "Plot 10 un-ordinal Ln vs 2nd Ln",
    );
    assertBothOrders(
      row("Plot # 10, Boulevard, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Boulevard, Gulshan-1, Dhaka"),
      2,
      "Plot 10 un-ordinal Boulevard vs 2nd Boulevard",
    );
    assertBothOrders(
      row("12/1, Hossain Uddin Khan Street, Lalbag, Dhaka"),
      row("12/1, Hossain Uddin Khan 2nd Street, Lalbag, Dhaka"),
      2,
      "12/1 Hossain Street vs 2nd Street",
    );
    assertBothOrders(
      row("Plot # 10, First Street, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Street, Gulshan-1, Dhaka"),
      2,
      "Plot 10 First Street vs 2nd Street",
    );
    assertBothOrders(
      row("Plot # 10, 1st Street, Gulshan-1, Dhaka"),
      row("Plot # 10, Second Street, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Street vs Second Street",
    );
    assertBothOrders(
      row("Plot # 10, 2nd Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, Second Lane, Gulshan-1, Dhaka"),
      1,
      "Plot 10 2nd Lane vs Second Lane",
    );
    assertBothOrders(
      row("Plot # 10, 1st Goli, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Goli, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Goli vs 2nd Goli",
    );
    assertBothOrders(
      row("Plot # 10, 1st Path, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Path, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Path vs 2nd Path",
    );
    assertBothOrders(
      row("Plot # 10, 1st Sarak, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Sarak, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Sarak vs 2nd Sarak",
    );
    assertBothOrders(
      row("10, C DA Road, Chittagong"),
      row("10, DA Road, Chittagong"),
      2,
      "C DA Road vs DA Road",
    );
    assertBothOrders(
      row("Plot # 10, 10 C DA Avenue, Chittagong"),
      row("Plot # 10, 10 DA Avenue, Chittagong"),
      2,
      "C DA Avenue vs DA Avenue",
    );
    assertBothOrders(
      row("10, I A Road, Dhaka"),
      row("10, A Road, Dhaka"),
      2,
      "I A Road vs A Road",
    );
    assertBothOrders(
      row("10, C DA Road, Chittagong"),
      row("10, CDA Road, Chittagong"),
      1,
      "C DA Road vs CDA Road spelling",
    );
    assertBothOrders(
      row("10, I A Road, Dhaka"),
      row("10, IA Road, Dhaka"),
      1,
      "I A Road vs IA Road spelling",
    );
    assertBothOrders(
      row("Union Plaza, Plot # 140, Baron, D EPZ Road, Ashulia\nDhaka\nDhaka"),
      row("Union Plaza, 140 Baron, DEPZ Road, Ashulia, Savar, Dhaka - 1349, Bangladesh"),
      1,
      "140 Baron D EPZ vs DEPZ after C DA join",
    );
    assertBothOrders(
      row("244, Singair Road, Hemayetpur, Savar, Dhaka"),
      row("244, Hemayetpur, Savar, Dhaka"),
      1,
      "244 Singair Road Hemayetpur vs 244 Hemayetpur after third-extra XOR",
    );
    assertBothOrders(
      row("Munna Complex, 228 Dighirpar, Nazma Khatun Lane, Dewanhat, Chittagong"),
      row("MUNNA COMPLEX, 228, DIGHIR PAR, DEWANHAT, DOUBLEMOORING, CHATTOGRAM"),
      1,
      "Munna Complex Dighirpar vs Dighir Par after third-extra XOR",
    );
    assertBothOrders(
      row("12/1, Hossain Uddin Khan 1st Lane, Lalbag, Nabanganj, Dhaka, Lalbagh"),
      row("12/1 Hossain Uddin Khan, 1st Lane, Lalbagh Road, Lalbagh, 1211, Dhaka, Bangladesh"),
      1,
      "12/1 1st Lane inverted Lalbagh Road after un-ordinal streets",
    );
    assertBothOrders(
      row("60, Bangabandhu Road, Narayanganj"),
      row("60, B.B ROAD, NARAYANGANJ"),
      1,
      "Bangabandhu Road vs B.B Road initials",
    );
    assertBothOrders(
      row("285, (147/3 New), Hazaribag, Godnail, Siddhirganj PS, Narayanganj - 1432, Bangladesh"),
      row("285, (147/3 New) Hazaribag, Godnail"),
      1,
      "Hazaribag Godnail comma vs parenthetical on same holding",
    );
    assertBothOrders(
      row("Ward No. 06, Holding No. B-50/3, Area: Kalampur, Kaliakoir Pouroshova Kaliakoir, Gazipur-1751"),
      row("Ward No-6, Holding -B-50/3, Kalampur, Kaliakoir, Gazipur"),
      1,
      "Ward 6 Area Kalampur vs Kalampur holding",
    );
    assertBothOrders(
      row("89, MOTIJHEEL, C/A, LUCKY CHAMBER (4TH FLOOR), ROOM NO.77-79 & 82-84, DHAKA"),
      row("Lucky Chamber (4th Floor), Rm # 77 -79 & 82-84, 89 Motijheel C/A, Dhaka"),
      1,
      "Lucky Chamber Motijheel vs room-list Motijheel",
    );
    assertBothOrders(
      row("778, D. T. ROAD, ASHKARABAD, DOUBLEMOORING, CHATTOGRAM"),
      row("778, Asharabad, Chittagong, D.T. Road"),
      1,
      "D.T. Road Ashkarabad vs Asharabad D.T. Road",
    );
    assertBothOrders(
      row("House No: 04, Road No: 02, Block No: A, Chanduddan, Mohammadpur, Dhaka - 1207, Bangladesh"),
      row("House # 04, Road # 02, Block # A, Chand Uddan, Mohammadpur, Dhaka"),
      1,
      "Chanduddan vs Chand Uddan at Road 02",
    );
    assertBothOrders(
      row("101/1/A, BARABAGH, SECTION-2, MIRPUR-2, 1216, MIRPUR, DHAKA"),
      row("101/1/A, Baro Bagh, Section-02, Mirpur, Dhaka - 1216, Bangladesh"),
      1,
      "Barabagh vs Baro Bagh section 2",
    );
    assertBothOrders(
      row("Plot # 10, Gulshan, Airport Road, Dhaka"),
      row("Plot # 10, Gulshan, Green, Dhaka"),
      2,
      "Gulshan third extra still does not fuse Airport vs Green",
    );
    assertBothOrders(
      row("83, Borpa, Tarabo, Rupganj PS, Narayanganj - 1460, Bangladesh"),
      row("Borpa, Holding # 83, Rupganj, Narayangonj"),
      1,
      "Holding 83 Borpa vs Borpa Holding 83 Rupganj",
    );
    assertBothOrders(
      row("BSCIC I/A, Plot No: B-218, 219, 220, 221, 225, 226 Shasongaon, Fatullah, 1421, Narayanganj, Bangladesh"),
      row("BSCIC I/A, Plot No: B-218, 219, 220, 221, 225, 226 Shasongaon"),
      1,
      "BSCIC plot list Shasongaon vs Shasongaon Fatullah",
    );
    assertBothOrders(
      row("375, Shaheed Siddik Road, South Khaikur, National University, 1704, Gazipur, Bangladesh"),
      row("375, South Khailkur, National University, Gazipur"),
      1,
      "Siddik Road South Khaikur vs South Khailkur",
    );
    assertBothOrders(
      row("160 Shashongaon, Enayetnagor, Fatullah, Narayanganj - 1400, Bangladesh"),
      row("160, SHASHONGAON, ENAYETNAGAR, FATULLAH, NARAYANGANJ"),
      1,
      "Shashongaon Enayetnagor vs Shashongaon Enayetnagar",
    );
    assertBothOrders(
      row("33, Rajabari, Atipara, Uttarkhan, 1230, Dhaka, Bangladesh"),
      row("33, RAZA BARI, ATEPARA, UTTAR KHAN, DHAKA"),
      1,
      "Rajabari Atipara vs Raza Bari Atepara",
    );
    assertBothOrders(
      row("168 NO, GODNAIL, ARAMBAG, SHIDDIRGANG. NARAYANGANJ., SIDDIRGONJ"),
      row("168 NO.GODNAIL, ARAMBAG"),
      1,
      "168 Godnail comma vs 168 NO.GODNAIL glued",
    );
    assertBothOrders(
      row("21/A, Chanpara, Uttarkhan, Uttara, Dhaka - 1230, Bangladesh"),
      row("21/A Chanpara, Uttarkhan, Uttara, Dhaka-1230"),
      1,
      "21/A comma Chanpara vs 21/A space Chanpara",
    );
    assertBothOrders(
      row("NANDIR HAT, FATEHABAD, 1, SOUTH PAHARTOLI, HATHAZARI, CHATTOGRAM"),
      row("Nandirhat, Fatehabad, 1 No. South Pahartoli, Hathazari, Chittagong"),
      1,
      "Nandir Hat Fatehabad 1 Pahartoli vs Nandirhat Fatehabad",
    );
    assertBothOrders(
      row("138/1 Teknagopara, Chandona, Bason, Gazipur City, 1702, Gazipur, Bangladesh"),
      row("138/1, Teknagapara, Chandona, Bason, Gazipur City"),
      1,
      "Teknagopara vs Teknagapara at 138/1 Chandona",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur\nDhaka\nSavar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      1,
      "neighbour Plot 23-24 Union Telulzora vs Holding 87 Hemayetpur (fixture newlines)",
    );
    assertBothOrders(
      row("South Nayapara, 6, Dogri Mouja, Bhawal\nGazipur\nMirjapur"),
      row(
        "South Noyapara, 6 No Dogri, P.O : Bhawal, Mirzapur, Gazipur Sadar PS, Gazipur - 1703, Bangladesh",
      ),
      1,
      "6 Dogri Mouja vs 6 No Dogri Noyapara",
    );
    assertBothOrders(
      row(
        "Plot # 16 - 18, Dakhin Panishail, EPZ-Kaliakoir Road, Kashimpur, Gazipur - 1349, Bangladesh",
      ),
      row("PLOT # 16-18, KAKHIN PANISHALI, EPZ-KALIAKOIR, KASHIMPUR, GAZIPUR"),
      1,
      "Dakhin Panishail vs Kakhin Panishali at Plot 16-18",
    );
    assertBothOrders(
      row("553/2, Sharifpur, National University, Gacha, Gazipur Sadar, Gazipur - 1700, Bangladesh"),
      row("553/2, Sharifpur, Gacha, National University, Gazipur"),
      1,
      "553/2 Sharifpur Gacha vs Sharifpur National University Gacha",
    );
    assertBothOrders(
      row("808/1, Shewrapara, Begum Rokeya Sarani, Mirpur, Dhaka"),
      row("808/1, 808/2, Shewrapara, Mirpur PS, Dhaka - 1216, Bangladesh"),
      1,
      "808/1 Shewrapara vs 808/1 808/2 Shewrapara",
    );
  });

  it("keeps two roads apart when they only share a village, and still merges union and ordinal spellings", () => {
    for (const village of ["Valuka", "Satarkul", "Fatullah", "Kaliakoir"]) {
      assertBothOrders(
        row(`Plot # 10, ${village}, Airport Road, Dhaka`),
        row(`Plot # 10, ${village}, Green, Dhaka`),
        2,
        `Plot 10 ${village} Airport Road vs Green`,
      );
      assertBothOrders(
        row(`Plot # 10, 10, ${village}, Airport Road, Dhaka`),
        row(`Plot # 10, 10, ${village}, Green, Dhaka`),
        2,
        `Plot 10 stuffed ${village} Airport Road vs Green`,
      );
    }
    assertBothOrders(
      row("Plot # 10, Bhaluka, Airport Road, Dhaka"),
      row("Plot # 10, Valuka, Green, Dhaka"),
      2,
      "Plot 10 Bhaluka Airport Road vs Valuka Green",
    );
    assertBothOrders(
      row("7, Valuka, Airport Road, Dhaka"),
      row("7, Valuka, Green, Dhaka"),
      2,
      "7 Valuka Airport Road vs Green",
    );
    assertBothOrders(
      row("House # 50, Road # 3, 7, Valuka, Airport Road, Dhaka"),
      row("House # 50, Road # 3, 7, Valuka, Green, Dhaka"),
      2,
      "House50 7 Valuka Airport Road vs Green",
    );
    assertBothOrders(
      row("Plot # 10, Mouja, Airport Road, Dhaka"),
      row("Plot # 10, Mouja, Green, Dhaka"),
      2,
      "Plot 10 Mouja Airport Road vs Green",
    );
    assertBothOrders(
      row("Plot # 10, Hemayetpur, Airport Road, Dhaka"),
      row("Plot # 10, Hemayetpur, Greenpur, Dhaka"),
      2,
      "Plot 10 Hemayetpur Airport Road vs Greenpur",
    );
    assertBothOrders(
      row("Plot # 10, 10 Hemayetpur, Airport Road, Dhaka"),
      row("Plot # 10, 10 Greenpur, Dhaka"),
      2,
      "Plot 10 stuffed Hemayetpur Airport vs Greenpur",
    );
    assertBothOrders(
      row("Plot # 10, Kashimpur, Airport Road, Dhaka"),
      row("Plot # 10, Kashimpur, Greenpur, Dhaka"),
      2,
      "Plot 10 Kashimpur Airport Road vs Greenpur",
    );
    assertBothOrders(
      row("Plot # 10, Hemayetpur, Dhaka"),
      row("Plot # 10, Greenpara, Dhaka"),
      2,
      "Plot 10 Hemayetpur vs Greenpara",
    );
    assertBothOrders(
      row("Plot # 10, Satarkul, Badda, Dhaka"),
      row("Plot # 10, Satarkul, Jiban, Dhaka"),
      1,
      "Plot 10 Satarkul Badda vs Jiban leftover villages",
    );
    assertBothOrders(
      row("Plot # 10, Airport Road, Dhaka"),
      row("Plot # 10, Green, Dhaka"),
      2,
      "Plot # 10 Airport Road vs unsuffixed Green without restated 10",
    );
    assertBothOrders(
      row("Plot # 10, Airport Road, Dhaka"),
      row("Plot # 10, Green Road, Dhaka"),
      2,
      "Plot # 10 Airport Road vs Green Road without restated 10",
    );
    {
      const three = [
        row("Plot # 10, Airport Road, Dhaka"),
        row("Plot # 10, Green Road, Dhaka"),
        row("Plot # 10, Green, Dhaka"),
      ];
      for (const ordered of permutations(three)) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          2,
          "Plot # 10 Airport Road stays apart from Green Road / unsuffixed Green",
        );
      }
    }
    assertBothOrders(
      row("Plot # 10, C DA Road, Chittagong"),
      row("Plot # 10, DA Road, Chittagong"),
      2,
      "Plot # 10 C DA Road vs DA Road without restated 10",
    );
    assertBothOrders(
      row("Plot # 140, C DA Road, Chittagong"),
      row("Plot # 140, DA Road, Chittagong"),
      2,
      "Plot # 140 C DA Road vs DA Road",
    );
    assertBothOrders(
      row("Plot # 10, I A Road, Dhaka"),
      row("Plot # 10, A Road, Dhaka"),
      2,
      "Plot # 10 I A vs A Road without restated 10",
    );
    assertBothOrders(
      row("Plot # 10, 10 Airport Road, Green, Dhaka"),
      row("Plot # 10, 10 Green, Airport, Dhaka"),
      2,
      "leftover with restated 10 Airport vs Green still two rows",
    );
    assertBothOrders(
      row("10 C DA Road, Chittagong"),
      row("10 CDA Road, Chittagong"),
      1,
      "10 C DA vs CDA spelling without comma",
    );
    assertBothOrders(
      row("10 D EPZ Road, Ashulia"),
      row("10 DEPZ Road, Ashulia"),
      1,
      "10 D EPZ vs DEPZ spelling",
    );
    {
      const house50roads = [
        row("House # 50, Road # 3, 7 Airport Road, Dhaka"),
        row("House # 50, Road # 3, 7 Green Road, Dhaka"),
      ];
      for (const ordered of permutations(house50roads)) {
        assert.equal(
          mergeUniqueLocations(ordered).length,
          2,
          "House50 7 Airport Road vs 7 Green Road",
        );
      }
    }
    assertBothOrders(
      row("Plot # 10, Airport Path, Dhaka"),
      row("Plot # 10, Green Path, Dhaka"),
      2,
      "Airport Path leftover vs Green Path",
    );
    assertBothOrders(
      row("Plot # 10, Bir Uttam Aminul Haque Sarak, Dhaka"),
      row("Plot # 10, Green, Aminul, Dhaka"),
      2,
      "Bir Uttam Aminul Haque Sarak leftover vs Green Aminul",
    );
    assertBothOrders(
      row("10, C DA Gali, Chittagong"),
      row("10, DA Gali, Chittagong"),
      2,
      "C DA Gali vs DA Gali",
    );
    assertBothOrders(
      row("10, C DA Path, Chittagong"),
      row("10, DA Path, Chittagong"),
      2,
      "C DA Path vs DA Path",
    );
    assertBothOrders(
      row("10, C DA Sarak, Chittagong"),
      row("10, DA Sarak, Chittagong"),
      2,
      "C DA Sarak vs DA Sarak",
    );
    assertBothOrders(
      row("10, I A Gali, Dhaka"),
      row("10, A Gali, Dhaka"),
      2,
      "I A Gali vs A Gali",
    );
    assertBothOrders(
      row("10, C DA Road, Chittagong"),
      row("10, DA, Chittagong"),
      2,
      "C DA Road vs unsuffixed DA",
    );
    for (const word of ["Gully", "Gulley", "Galli"]) {
      assertBothOrders(
        row(`Plot # 10, 1st ${word}, Gulshan-1, Dhaka`),
        row(`Plot # 10, 2nd ${word}, Gulshan-1, Dhaka`),
        2,
        `Plot 10 1st ${word} vs 2nd ${word}`,
      );
    }
    assertBothOrders(
      row("Plot # 10, Street, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Lane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 un-ordinal Street vs 2nd Lane",
    );
    assertBothOrders(
      row("Plot # 10, Road, Gulshan-1, Dhaka"),
      row("Plot # 10, 2nd Street, Gulshan-1, Dhaka"),
      2,
      "Plot 10 un-ordinal Road vs 2nd Street",
    );
    assertBothOrders(
      row("Plot # 10, 6th Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, Sixth Lane, Gulshan-1, Dhaka"),
      1,
      "Plot 10 6th Lane vs Sixth Lane",
    );
    assertBothOrders(
      row("Plot # 10, 1st Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, Sixth Lane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Lane vs Sixth Lane",
    );
    assertBothOrders(
      row("Plot # 10, First Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, Sixth Lane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 First Lane vs Sixth Lane",
    );
    for (const other of [
      "Greenpark",
      "Greenfield",
      "Greenland",
      "Greenwich",
      "Greenway",
      "Greenwood",
      "Greenbelt",
      "Greenhill",
      "Greenview",
      "Greenacre",
      "Greentown",
      "Greenridge",
      "Greenbank",
      "Greenwoods",
      "Greenpoint",
      "Greenmount",
      "Greenleaf",
    ]) {
      assertBothOrders(
        row("Plot # 10, 10 Green, Gulshan-1, Dhaka"),
        row(`Plot # 10, 10 ${other}, Gulshan-1, Dhaka`),
        2,
        `Plot 10 Green vs Plot 10 ${other}`,
      );
    }
    assertBothOrders(
      row("Plot # 10, Green, Dhaka"),
      row("Plot # 10, Greenwood, Dhaka"),
      2,
      "Plot 10 Green vs Greenwood without restated 10",
    );
    for (const word of ["Gully", "Gulley", "Galli"]) {
      assertBothOrders(
        row(`10, C DA ${word}, Chittagong`),
        row(`10, DA ${word}, Chittagong`),
        2,
        `C DA ${word} vs DA ${word}`,
      );
      assertBothOrders(
        row(`Plot # 10, C DA ${word}, Chittagong`),
        row(`Plot # 10, DA ${word}, Chittagong`),
        2,
        `Plot # 10 C DA ${word} vs DA ${word}`,
      );
      assertBothOrders(
        row(`10, C DA ${word}, Chittagong`),
        row(`10, CDA ${word}, Chittagong`),
        1,
        `C DA ${word} vs CDA ${word} spelling`,
      );
    }
    assertBothOrders(
      row("10, I A Gully, Dhaka"),
      row("10, A Gully, Dhaka"),
      2,
      "I A Gully vs A Gully",
    );
    assertBothOrders(
      row("10, C DA Gully, Chittagong"),
      row("10, DA Gali, Chittagong"),
      2,
      "C DA Gully vs DA Gali",
    );
    for (const word of ["Alley", "Gally", "Guli"]) {
      assertBothOrders(
        row(`Plot # 10, 1st ${word}, Gulshan-1, Dhaka`),
        row(`Plot # 10, 2nd ${word}, Gulshan-1, Dhaka`),
        2,
        `Plot 10 1st ${word} vs 2nd ${word}`,
      );
    }
    assertBothOrders(
      row("Plot # 10, 12th Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, Twelfth Lane, Gulshan-1, Dhaka"),
      1,
      "Plot 10 12th Lane vs Twelfth Lane",
    );
    assertBothOrders(
      row("Plot # 10, 12th Street, Gulshan-1, Dhaka"),
      row("Plot # 10, Twelfth Street, Gulshan-1, Dhaka"),
      1,
      "Plot 10 12th Street vs Twelfth Street",
    );
    assertBothOrders(
      row("Plot # 10, 13th Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, Thirteenth Lane, Gulshan-1, Dhaka"),
      1,
      "Plot 10 13th Lane vs Thirteenth Lane",
    );
    assertBothOrders(
      row("Plot # 10, 20th Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, Twentieth Lane, Gulshan-1, Dhaka"),
      1,
      "Plot 10 20th Lane vs Twentieth Lane",
    );
    assertBothOrders(
      row("Plot # 10, 1st Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, Twelfth Lane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Lane vs Twelfth Lane",
    );
    assertBothOrders(
      row("Plot # 10, First Lane, Gulshan-1, Dhaka"),
      row("Plot # 10, Twelfth Lane, Gulshan-1, Dhaka"),
      2,
      "Plot 10 First Lane vs Twelfth Lane",
    );
    assertBothOrders(
      row("Plot # 10, 1st Street, Gulshan-1, Dhaka"),
      row("Plot # 10, Twelfth Street, Gulshan-1, Dhaka"),
      2,
      "Plot 10 1st Street vs Twelfth Street",
    );
    assertBothOrders(
      row("Plot # 10, Joydebpur Road, Dhaka"),
      row("Plot # 10, Tejgaon Road, Dhaka"),
      2,
      "Plot 10 Joydebpur Road vs Tejgaon Road",
    );
    assertBothOrders(
      row("Plot # 10, Singair Road, Dhaka"),
      row("Plot # 10, Joydebpur Road, Dhaka"),
      2,
      "Plot 10 Singair Road vs Joydebpur Road",
    );
    assertBothOrders(
      row("Plot # 10, Shahriar Road, Dhaka"),
      row("Plot # 10, Sharifpur Road, Dhaka"),
      2,
      "Plot 10 Shahriar Road vs Sharifpur Road without Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Valuka, Joydebpur Road, Dhaka"),
      row("Plot # 10, Valuka, Tejgaon Road, Dhaka"),
      2,
      "Plot 10 Valuka Joydebpur Road vs Tejgaon Road",
    );
    assertBothOrders(
      row("Plot # 10, Valuka, Kazi Nazrul Islam Road, Dhaka"),
      row("Plot # 10, Valuka, Tejgaon Road, Dhaka"),
      2,
      "Plot 10 Valuka Kazi vs Tejgaon Road",
    );
    assertBothOrders(
      row("Plot # 10, Valuka, Singair Road, Dhaka"),
      row("Plot # 10, Valuka, Joydebpur Road, Dhaka"),
      2,
      "Plot 10 Valuka Singair vs Joydebpur Road",
    );
    assertBothOrders(
      row("Plot # 10, 10, Valuka, Joydebpur Road, Dhaka"),
      row("Plot # 10, 10, Valuka, Tejgaon Road, Dhaka"),
      2,
      "stuffed Plot 10 Valuka Joydebpur vs Tejgaon",
    );
    assertBothOrders(
      row("Plot # 10, Satarkul, Joydebpur Road, Dhaka"),
      row("Plot # 10, Satarkul, Tejgaon Road, Dhaka"),
      2,
      "Plot 10 Satarkul Joydebpur vs Tejgaon",
    );
    assertBothOrders(
      row("Plot # 10, Hemayetpur, Joydebpur Road, Dhaka"),
      row("Plot # 10, Hemayetpur, Tejgaon Road, Dhaka"),
      2,
      "Plot 10 Hemayetpur Joydebpur vs Tejgaon",
    );
    assertBothOrders(
      row("Plot # 636, Shahriar Road, Sonda"),
      row("636, Sharifpur Road, Sonda"),
      1,
      "Plot 636 Shahriar vs Sharifpur at Sonda after named-road XOR",
    );
    assertBothOrders(
      row("Plot # 10, C DA Road, Chittagong"),
      row("Plot # 10, DA, Chittagong"),
      2,
      "Plot # 10 C DA Road vs Plot # unsuffixed DA",
    );
    assertBothOrders(
      row("Plot # 140, C DA Road, Chittagong"),
      row("Plot # 140, DA, Chittagong"),
      2,
      "Plot # 140 C DA Road vs unsuffixed DA",
    );
    assertBothOrders(
      row("Plot # 10, C DA Gali, Chittagong"),
      row("Plot # 10, DA, Chittagong"),
      2,
      "Plot # 10 C DA Gali vs Plot # unsuffixed DA",
    );
    assertBothOrders(
      row("Plot # 10, I A Road, Dhaka"),
      row("Plot # 10, A, Dhaka"),
      2,
      "Plot # 10 I A Road vs Plot # unsuffixed A",
    );
    assertBothOrders(
      row("10, I A Road, Dhaka"),
      row("10, A, Dhaka"),
      2,
      "unlabelled I A Road vs unsuffixed A",
    );
    assertBothOrders(
      row("10 CDA Road, Chittagong"),
      row("10 DA, Chittagong"),
      2,
      "10 CDA Road vs 10 DA no comma",
    );
    assertBothOrders(
      row("10, C DA Road, Chittagong"),
      row("10 DA, Chittagong"),
      2,
      "10 C DA Road vs 10 DA no comma",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Union, Dogri, Hemayetpur, Dhaka, Savar"),
      2,
      "Plot 23-24 Union Telulzora vs Union Dogri",
    );
    assert.equal(
      displays([
        row("Plot # 10, Valuka, Joydebpur Road, Dhaka"),
        row("Plot # 10, Valuka, Tejgaon Road, Dhaka"),
        row("Plot # 10, Valuka, Station Road, Dhaka"),
      ]).length,
      3,
      "three-string Valuka Joydebpur+Tejgaon+Station",
    );
    assertBothOrders(
      row("House # 50, Road # 3, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Kakhin Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 Kakhin Banani",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Union, Telulzora, Hemayetpur, Dhaka, Savar"),
      1,
      "Plot 23-24 Union hyphen vs Union comma Telulzora",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      1,
      "neighbour Plot 23-24 Union hyphen vs Holding 87 after union-comma merge",
    );
    assertBothOrders(
      row("House # 50, Road # 3, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 South Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 South Banani still two rows",
    );
    assertBothOrders(
      row("House # 50, Road # 3, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Dakhin Banani, Gulshan-1, Dhaka"),
      2,
      "House 50 vs 7 Dakhin Banani still two rows",
    );
    assertBothOrders(
      row("House # 50, Road # 3, Gulshan-1, Dhaka"),
      row("House # 50, Road # 3, 7 Baro Gulshan, Gulshan-1, Dhaka"),
      1,
      "House 50 vs 7 Baro Gulshan still one row",
    );
    assertBothOrders(
      row("12/1, Hossain Uddin Khan 1st Lane, Lalbag, Nabanganj, Dhaka, Lalbagh"),
      row("12/1 Hossain Uddin Khan, 1st Lane, Lalbagh Road, Lalbagh, 1211, Dhaka, Bangladesh"),
      1,
      "12/1 1st Lane inverted Lalbagh Road after un-ordinal Street vs Lane",
    );
    assertBothOrders(
      row(
        "687, AL-HAJ NURUL AMIN SOWDAGOR LANE, SOUTH AGRABAD, ROAD# 20, CDA R/A, AGRABAD, CHITTAGONG, BANGLADESH",
      ),
      row("687, CDA R/A, Road # 20, Alhaj Nurul Amin Sowdagar Lane, Chittagong, South Agrabad"),
      1,
      "Sowdagor Lane vs CDA after Path/Sarak tails",
    );
    assertBothOrders(
      row("House 10, Amtola, Ashulia, Dhaka"),
      row("House 10, No.793 Amtola, Ashulia, Dhaka"),
      1,
      "House 10 Amtola vs No.793 Amtola after village third-extra",
    );
    assertBothOrders(
      row("House 10, Kewa, Ashulia, Dhaka"),
      row("House 10, No.12 Kewa, Ashulia, Dhaka"),
      1,
      "House 10 Kewa vs No.12 Kewa after village third-extra",
    );
    assertBothOrders(
      row("House No: 04, Road No: 02, Block No: A, Chanduddan, Mohammadpur, Dhaka - 1207, Bangladesh"),
      row("House # 04, Road # 02, Block # A, Chand Uddan, Mohammadpur, Dhaka"),
      1,
      "Chanduddan vs Chand Uddan after Greenpark false-path",
    );
    assertBothOrders(
      row("Plot # 397, Chandona, Chowrasta, Joydevpur\nGazipur\nGazipur"),
      row(
        "Plot # 397 joydebpur road,chandona Chowrast, Gazipur Sadar, Gazipur 1702, Bangladesh, Gazipur, Bangladesh",
      ),
      1,
      "Plot 397 Chandona vs Joydebpur Road Chandona",
    );
    assertBothOrders(
      row("186, Maddya Gazirchat, Ashulia-EPZ Road\nDhaka\nSavar"),
      row("186, Maddhya Gazir Chat, Ashulia EPZ Road, , DHAKA"),
      1,
      "186 Maddya Gazirchat vs Maddhya Gazir Chat Ashulia EPZ Road",
    );
    assertBothOrders(
      row("Plot # 10, Airport Road, Dhaka"),
      row("Plot # 10, Joydebpur Road, Dhaka"),
      2,
      "Plot 10 Airport Road vs Joydebpur Road",
    );
    assertBothOrders(
      row("244, Singair Road, Hemayetpur, Savar, Dhaka"),
      row("244, Hemayetpur, Savar, Dhaka"),
      1,
      "244 Singair Road Hemayetpur vs 244 Hemayetpur after village-on-road KEEP",
    );
    assertBothOrders(
      row("778, Asharabad, Chittagong, D.T. Road"),
      row("778, D.T. Road, Asharabad, Chittagong"),
      1,
      "D.T. Road Asharabad vs unsuffixed DA leftover wiring",
    );
    assertBothOrders(
      row("10, C DA Road, Chittagong"),
      row("10, CDA Road, Chittagong"),
      1,
      "10 C DA vs CDA spelling after unsuffixed DA leftover",
    );
    assertBothOrders(
      row("Plot # 10, C DA Road, Chittagong"),
      row("Plot # 10, DA Chittagong"),
      2,
      "Plot # 10 C DA Road vs Plot # DA Chittagong no comma",
    );
    assertBothOrders(
      row("10, C DA Road, Chittagong"),
      row("10, DA Chittagong"),
      2,
      "10 C DA Road vs 10 DA Chittagong no comma",
    );
    assertBothOrders(
      row("10, C DA Road, Chittagong"),
      row("10 DA Chittagong"),
      2,
      "10 C DA Road vs 10 DA Chittagong no comma after digit",
    );
    assertBothOrders(
      row("Plot # 10, I A Road, Dhaka"),
      row("Plot # 10, A Dhaka"),
      2,
      "Plot # 10 I A Road vs Plot # A Dhaka no comma",
    );
    assertBothOrders(
      row("Plot # 10, Joydebpur Road, Valuka"),
      row("Plot # 10, Tejgaon Road, Valuka"),
      2,
      "Plot 10 Joydebpur vs Tejgaon Valuka after the road",
    );
    assertBothOrders(
      row("Plot # 10, Joydebpur Road, Valuka, Dhaka"),
      row("Plot # 10, Tejgaon Road, Valuka, Dhaka"),
      2,
      "Plot 10 Joydebpur vs Tejgaon Valuka after with Dhaka",
    );
    assertBothOrders(
      row("Plot # 10, Singair Road, Hemayetpur"),
      row("Plot # 10, Joydebpur Road, Hemayetpur"),
      2,
      "Plot 10 Singair vs Joydebpur Hemayetpur after the road",
    );
    assertBothOrders(
      row("Plot # 10, Shahriar Road, Valuka"),
      row("Plot # 10, Sharifpur Road, Valuka"),
      2,
      "Plot 10 Shahriar vs Sharifpur Valuka after the road",
    );
    assertBothOrders(
      row("Plot # 10, Joydebpur Road, Sonda"),
      row("Plot # 10, Tejgaon Road, Sonda"),
      2,
      "Plot 10 Joydebpur vs Tejgaon Sonda after the road",
    );
    assertBothOrders(
      row("Plot # 636, Shahriar Road, Sonda"),
      row("636, Sharifpur Road, Sonda"),
      1,
      "Plot 636 Shahriar vs Sharifpur at Sonda after village-after XOR",
    );
    assert.equal(
      displays([
        row("Plot # 10, Joydebpur Road, Valuka"),
        row("Plot # 10, Tejgaon Road, Valuka"),
        row("Plot # 10, Station Road, Valuka"),
      ]).length,
      3,
      "three-string Joydebpur+Tejgaon+Station Valuka after",
    );
    assertBothOrders(
      row("Plot # 23-24, Union, Dogri, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Union Dogri vs Holding 87 Tetuljhora must not share a Locations row",
    );
    assert.equal(
      displays([
        row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
        row("Plot # 23-24, Union, Dogri, Hemayetpur, Dhaka, Savar"),
        row(
          "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        ),
      ]).length,
      2,
      "three-string Telulzora+Dogri+Holding 87 Dogri stays its own row",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Union, Dogri, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        2,
        "three-string Telulzora+Dogri+Holding 87 permutation",
      );
    }
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Union, Telulzora, Hemayetpur, Dhaka, Savar"),
      1,
      "Union hyphen vs comma Telulzora after Dogri XOR",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur\nDhaka\nSavar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      1,
      "neighbour Plot 23-24 Telulzora vs Holding 87 after Dogri XOR",
    );
    assertBothOrders(
      row("244, Singair Road, Hemayetpur, Savar, Dhaka"),
      row("244, Hemayetpur, Savar, Dhaka"),
      1,
      "244 Singair vs Hemayetpur after village-after named-road XOR",
    );
    assertBothOrders(
      row("Plot # 10, Faridabad Road, Sonda"),
      row("Plot # 10, Faridpur Road, Sonda"),
      2,
      "Plot 10 Faridabad vs Faridpur at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Faridabad Road, Dhaka"),
      row("Plot # 10, Faridpur Road, Dhaka"),
      2,
      "Plot 10 Faridabad vs Faridpur no Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Sharifpur Road, Sonda"),
      row("Plot # 10, Faridpur Road, Sonda"),
      2,
      "Plot 10 Sharifpur vs Faridpur at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Sharifpur Road, Dhaka"),
      row("Plot # 10, Faridpur Road, Dhaka"),
      2,
      "Plot 10 Sharifpur vs Faridpur no Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Mohammadpur Road, Sonda"),
      row("Plot # 10, Shahjadpur Road, Sonda"),
      2,
      "Plot 10 Mohammadpur vs Shahjadpur at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Rampura Road, Sonda"),
      row("Plot # 10, Rampur Road, Sonda"),
      2,
      "Plot 10 Rampura vs Rampur at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Rampura Road, Dhaka"),
      row("Plot # 10, Rampur Road, Dhaka"),
      2,
      "Plot 10 Rampura vs Rampur no Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Keraniganj Road, Dhaka"),
      row("Plot # 10, Narayanganj Road, Dhaka"),
      2,
      "Plot 10 Keraniganj vs Narayanganj",
    );
    assertBothOrders(
      row("Plot # 10, Airport Road, Dhaka"),
      row("Plot # 10, Airpark Road, Dhaka"),
      2,
      "Plot 10 Airport vs Airpark",
    );
    assertBothOrders(
      row("Plot # 10, Hariken Road, Dhaka"),
      row("Plot # 10, Horizon Road, Dhaka"),
      2,
      "Plot 10 Hariken vs Horizon",
    );
    assertBothOrders(
      row("Plot # 10, Hariken Road, Dhaka"),
      row("Plot # 10, Harijan Road, Dhaka"),
      2,
      "Plot 10 Hariken vs Harijan",
    );
    assertBothOrders(
      row("Plot # 10, Green Road, Dhaka"),
      row("Plot # 10, Grain Road, Dhaka"),
      2,
      "Plot 10 Green vs Grain",
    );
    assertBothOrders(
      row("Plot # 10, Station Road, Sonda"),
      row("Plot # 10, Staten Road, Sonda"),
      2,
      "Plot 10 Station vs Staten at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Station Road, Sonda"),
      row("Plot # 10, Stationary Road, Sonda"),
      2,
      "Plot 10 Station vs Stationary at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Mirpur Road, Sonda"),
      row("Plot # 10, Rampur Road, Sonda"),
      2,
      "Plot 10 Mirpur vs Rampur at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Chandora Road, Sonda"),
      row("Plot # 10, Bashundhara Road, Sonda"),
      2,
      "Plot 10 Chandora vs Bashundhara at Sonda",
    );
    assertBothOrders(
      row("Plot # 23-24, Telulzora Union, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      1,
      "Telulzora Union title-after vs Holding 87",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Telulzora Union, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        1,
        "three-string hyphen+title-after Telulzora+Holding 87 permutation",
      );
    }
    assertBothOrders(
      row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Village Dogri vs Holding 87 Tetuljhora",
    );
    assertBothOrders(
      row("Plot # 23-24, Vill, Dogri, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Vill Dogri vs Holding 87 Tetuljhora",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        2,
        "three-string Telulzora+Village Dogri+Holding 87 permutation",
      );
    }
    assertBothOrders(
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      1,
      "Village Hemayetpur vs Holding 87",
    );
    assertBothOrders(
      row("Plot # 23-24, Vill, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      1,
      "Vill Hemayetpur vs Holding 87",
    );
    assertBothOrders(
      row("Plot # 23-24, Hemayetpur Village, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      1,
      "Hemayetpur Village title-after vs Holding 87",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        1,
        "three-string hyphen+Village Hemayetpur+Holding 87 permutation",
      );
    }
    assertBothOrders(
      row("Plot # 23-24, Union Plaza, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Union Plaza vs Holding 87 Tetuljhora",
    );
    assertBothOrders(
      row("Plot # 23-24, Union Complex, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Union Complex vs Holding 87 Tetuljhora",
    );
    assertBothOrders(
      row("Plot # 23-24, Union Tower, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Union Tower vs Holding 87 Tetuljhora",
    );
    assertBothOrders(
      row("Plot # 23-24, Union Market, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Union Market vs Holding 87 Tetuljhora",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Union Plaza, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        2,
        "three-string hyphen+Union Plaza+Holding 87 permutation",
      );
    }
    assertBothOrders(
      row("Plot # 23-24, Village of Dogri, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Village of Dogri vs Holding 87 Tetuljhora",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village of Dogri, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        2,
        "three-string Telulzora+Village of Dogri+Holding 87 permutation",
      );
    }
    assertBothOrders(
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar"),
      2,
      "Village Hemayetpur vs Village Dogri",
    );
    assertBothOrders(
      row("Plot # 23-24, Vill, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village of Dogri, Hemayetpur, Dhaka, Savar"),
      2,
      "Vill Hemayetpur vs Village of Dogri",
    );
    assertBothOrders(
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Union, Dogri, Hemayetpur, Dhaka, Savar"),
      2,
      "Village Hemayetpur vs Union Dogri",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar"),
    ])) {
      assert.equal(
        displays(ordered).length,
        2,
        "three-string Telulzora+Village Hemayetpur+Village Dogri permutation",
      );
    }
    assertBothOrders(
      row("Plot # 23-24, Village, Hemayetpur, Dogri, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Village Hemayetpur Dogri vs Holding 87 Tetuljhora",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Hemayetpur, Dogri, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        2,
        "three-string Telulzora+Village Hemayetpur Dogri+Holding 87 permutation",
      );
    }
    assertBothOrders(
      row("Plot # 23-24, Union House, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Union House vs Holding 87 Tetuljhora",
    );
    assertBothOrders(
      row("Plot # 23-24, Union Housing, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Union Housing vs Holding 87 Tetuljhora",
    );
    assertBothOrders(
      row("Plot # 23-24, Union of Plaza, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Union of Plaza vs Holding 87 Tetuljhora",
    );
    assertBothOrders(
      row("Plot # 23-24, Union the Plaza, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Union the Plaza vs Holding 87 Tetuljhora",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Union House, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        2,
        "three-string hyphen+Union House+Holding 87 permutation",
      );
    }
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Union of Plaza, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        2,
        "three-string hyphen+Union of Plaza+Holding 87 permutation",
      );
    }
    assertBothOrders(
      row("Plot # 10, East Airport Road, Dhaka"),
      row("Plot # 10, West Airport Road, Dhaka"),
      2,
      "Plot 10 East Airport vs West Airport",
    );
    assertBothOrders(
      row("Plot # 10, East Airport Road, Sonda"),
      row("Plot # 10, West Airport Road, Sonda"),
      2,
      "Plot 10 East Airport vs West Airport at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Baba Airport Road, Dhaka"),
      row("Plot # 10, Babu Airpark Road, Dhaka"),
      2,
      "Plot 10 Baba Airport vs Babu Airpark",
    );
    assertBothOrders(
      row("Plot # 10, New Eskaton Road, Dhaka"),
      row("Plot # 10, Old Eskaton Road, Dhaka"),
      2,
      "Plot 10 New Eskaton vs Old Eskaton",
    );
    assertBothOrders(
      row("Plot # 10, East Rampura Road, Dhaka"),
      row("Plot # 10, West Rampura Road, Dhaka"),
      2,
      "Plot 10 East Rampura vs West Rampura",
    );
    assertBothOrders(
      row("Plot # 10, Inner Airport Road, Dhaka"),
      row("Plot # 10, Outer Airport Road, Dhaka"),
      2,
      "Plot 10 Inner Airport vs Outer Airport",
    );
    assertBothOrders(
      row("Plot # 10, North Gulshan Road, Dhaka"),
      row("Plot # 10, South Gulshan Road, Dhaka"),
      2,
      "Plot 10 North Gulshan vs South Gulshan",
    );
    assertBothOrders(
      row("Plot # 10, East Joydebpur Road, Chandona"),
      row("Plot # 10, West Joydevpur Road, Chandona"),
      1,
      "Plot 10 East Joydebpur vs West Joydevpur spelling",
    );
    assertBothOrders(
      row("Plot # 23-24, Village of the Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      1,
      "Village of the Hemayetpur vs Holding 87",
    );
    assertBothOrders(
      row("Plot # 23-24, The Village of Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      1,
      "The Village of Hemayetpur vs Holding 87",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village of the Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        1,
        "three-string hyphen+Village of the Hemayetpur+Holding 87 permutation",
      );
    }
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, The Village of Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
    ])) {
      assert.equal(
        displays(ordered).length,
        1,
        "three-string hyphen+The Village of Hemayetpur+Holding 87 permutation",
      );
    }
    assertBothOrders(
      row("Plot # 23-24, Village of the Dogri, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "Village of the Dogri vs Holding 87 Tetuljhora",
    );
    assertBothOrders(
      row("Plot # 23-24, The Village of Dogri, Hemayetpur, Dhaka, Savar"),
      row(
        "Holding No. 87, Plot No. 23, 24, 25, Hemayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
      ),
      2,
      "The Village of Dogri vs Holding 87 Tetuljhora",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar"),
      2,
      "Union hyphen Telulzora vs Village Dogri",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village of Dogri, Hemayetpur, Dhaka, Savar"),
      2,
      "Union hyphen Telulzora vs Village of Dogri",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Vill, Dogri, Hemayetpur, Dhaka, Savar"),
      2,
      "Union hyphen Telulzora vs Vill Dogri",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village of the Dogri, Hemayetpur, Dhaka, Savar"),
      2,
      "Union hyphen Telulzora vs Village of the Dogri",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, The Village of Dogri, Hemayetpur, Dhaka, Savar"),
      2,
      "Union hyphen Telulzora vs The Village of Dogri",
    );
    assertBothOrders(
      row("Plot # 23-24, Union, Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar"),
      1,
      "Union comma Telulzora vs Village Hemayetpur",
    );
    assertBothOrders(
      row("Plot # 23-24, Union - Dogri, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar"),
      2,
      "Union hyphen Dogri vs Village Hemayetpur",
    );
    for (const ordered of permutations([
      row("Plot # 23-24, Union, Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Dogri, Hemayetpur, Dhaka, Savar"),
    ])) {
      assert.equal(
        displays(ordered).length,
        2,
        "three-string comma Telulzora+Village Hemayetpur+Village Dogri permutation",
      );
    }
    for (const ordered of permutations([
      row("Plot # 23-24, Union - Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Union, Telulzora, Hemayetpur, Dhaka, Savar"),
      row("Plot # 23-24, Village, Hemayetpur, Dhaka, Savar"),
    ])) {
      assert.equal(
        displays(ordered).length,
        1,
        "three-string hyphen+comma Telulzora+Village Hemayetpur permutation",
      );
    }
    assertBothOrders(
      row("Plot # 10, East Mirpur Road, Sonda"),
      row("Plot # 10, West Mirpur Road, Sonda"),
      2,
      "Plot 10 East Mirpur vs West Mirpur at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, East Mirpur Road, Dhaka"),
      row("Plot # 10, West Mirpur Road, Dhaka"),
      2,
      "Plot 10 East Mirpur vs West Mirpur at Dhaka",
    );
    assertBothOrders(
      row("Plot # 10, East Mirpur Road"),
      row("Plot # 10, West Mirpur Road"),
      2,
      "Plot 10 East Mirpur vs West Mirpur no village",
    );
    assertBothOrders(
      row("Plot # 10, East Tejgaon Road, Sonda"),
      row("Plot # 10, West Tejgaon Road, Sonda"),
      2,
      "Plot 10 East Tejgaon vs West Tejgaon at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, East Tejgaon Road, Dhaka"),
      row("Plot # 10, West Tejgaon Road, Dhaka"),
      2,
      "Plot 10 East Tejgaon vs West Tejgaon at Dhaka",
    );
    assertBothOrders(
      row("Plot # 10, East Joydebpur Road, Sonda"),
      row("Plot # 10, West Joydebpur Road, Sonda"),
      2,
      "Plot 10 East Joydebpur vs West Joydebpur same remainder",
    );
    assertBothOrders(
      row("Plot # 10, East Circular Road, Dhaka"),
      row("Plot # 10, West Circular Road, Dhaka"),
      2,
      "Plot 10 East Circular vs West Circular",
    );
    assertBothOrders(
      row("Plot # 10, North Mirpur Road, Sonda"),
      row("Plot # 10, South Mirpur Road, Sonda"),
      2,
      "Plot 10 North Mirpur vs South Mirpur at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, Eastern Mirpur Road, Sonda"),
      row("Plot # 10, Western Mirpur Road, Sonda"),
      2,
      "Plot 10 Eastern Mirpur vs Western Mirpur at Sonda",
    );
    assertBothOrders(
      row("Plot # 10, EastAirport Road, Dhaka"),
      row("Plot # 10, WestAirport Road, Dhaka"),
      2,
      "Plot 10 EastAirport vs WestAirport concatenated",
    );
    assertBothOrders(
      row("Plot # 10, East Airport Road, Dhaka"),
      row("Plot # 10, WestAirport Road, Dhaka"),
      2,
      "Plot 10 East Airport spaced vs WestAirport glued",
    );
    assertBothOrders(
      row("Plot # 10, North East Airport Road, Dhaka"),
      row("Plot # 10, South West Airport Road, Dhaka"),
      2,
      "Plot 10 North East Airport vs South West Airport",
    );
    assertBothOrders(
      row("Plot # 10, New East Airport Road, Dhaka"),
      row("Plot # 10, Old West Airport Road, Dhaka"),
      2,
      "Plot 10 New East Airport vs Old West Airport",
    );
    for (const ordered of permutations([
      row("Plot # 10, East Mirpur Road, Dhaka"),
      row("Plot # 10, West Mirpur Road, Dhaka"),
      row("Plot # 10, Green Road, Dhaka"),
    ])) {
      assert.equal(
        displays(ordered).length,
        3,
        "three-string East Mirpur+West Mirpur+Green permutation",
      );
    }
    for (const ordered of permutations([
      row("Plot # 10, EastAirport Road, Dhaka"),
      row("Plot # 10, WestAirport Road, Dhaka"),
      row("Plot # 10, Green Road, Dhaka"),
    ])) {
      assert.equal(
        displays(ordered).length,
        3,
        "three-string EastAirport+WestAirport+Green permutation",
      );
    }
    for (const ordered of permutations([
      row("Plot # 10, East Airport Road, Dhaka"),
      row("Plot # 10, WestAirport Road, Dhaka"),
      row("Plot # 10, Green Road, Dhaka"),
    ])) {
      assert.equal(
        displays(ordered).length,
        3,
        "three-string East Airport+WestAirport glued+Green permutation",
      );
    }
    for (const ordered of permutations([
      row("Plot # 10, North East Airport Road, Dhaka"),
      row("Plot # 10, South West Airport Road, Dhaka"),
      row("Plot # 10, Green Road, Dhaka"),
    ])) {
      assert.equal(
        displays(ordered).length,
        3,
        "three-string North East+South West Airport+Green permutation",
      );
    }
  });

  it("merges neighbour plot lists and keeps House 365/4 Baridhara together", () => {
    assert.equal(
      displays([
        row("PLOT # 10 & 14, ROAD # 2, BLOCK # K, RUPNAGAR I/A, MIRPUR-2"),
        row("Plot No # 14, Road No # 2, Block # K, Rupnagar I/A, Mirpur-2"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("HOUSE # 365/4, ROAD # 06, (WEST) BARIDARA, DOHS, DHAKA-1206, NARAYANGANJ"),
        row("House # 365/4, Road # 6 (west0, Dhaka, Baridhara DOHS"),
      ]).length,
      1,
    );
    assert.equal(
      displays([
        row("House # 365/4, Road # 6, Dhaka, Baridhara DOHS"),
        row("House # 365/4, Road # 6, Dhaka, Baridhara DOHS"),
      ]).length,
      1,
    );
  });
});
