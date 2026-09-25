// `withoutContactDetails` against the published addresses that carry contact
// details, verbatim from production (SQL over v_supplier_addresses and
// suppliers.address_raw, 25 Sep 2026), and against the ones that only look as
// if they might.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { withoutContactDetails } from "./contact-text";

const LEAKING: [string, string][] = [
  [
    "House # 373, Road # 28, New DOHS, (Reg: 1391) Mohakhali, Dhaka, 6, Mohammadi Tel: 8815178, 0171591599",
    "House # 373, Road # 28, New DOHS, (Reg: 1391) Mohakhali, Dhaka, 6, Mohammadi",
  ],
  ["Block -KA (Gr Fl), House # 49, Road # 13, Sector # 11, Uttara, Dhaka, 011029958", "Block -KA (Gr Fl), House # 49, Road # 13, Sector # 11, Uttara, Dhaka"],
  [
    "Banani, Dhaka, Tengra (Near ASA Office) Plot # 543, P.O., Sarulia Tel: 8861860, 9886079,, Demra, Dhaka Email: info@afldac.com",
    "Banani, Dhaka, Tengra (Near ASA Office) Plot # 543, P.O., Sarulia, Demra, Dhaka",
  ],
  ["CI House # 153 (5th Floor), Road # 01,, Baridhara DOHS, Dhaka, 9125191 Tel: 01732476815", "CI House # 153 (5th Floor), Road # 01, Baridhara DOHS, Dhaka"],
  ["39, MM Ali Road, Lalkhan Bazar, 01711528388, Khulshi, Chittagong", "39, MM Ali Road, Lalkhan Bazar, Khulshi, Chittagong"],
  ["House # 297 (Apt # 2/A), Road # 4, Baridhara DOHS, Dhaka, 01730-014933", "House # 297 (Apt # 2/A), Road # 4, Baridhara DOHS, Dhaka"],
  [
    "BANGLADESH SPINNERS & KNITTERS (PVT) LTD. PLOT NO. 6 TO 11, SECTOR - 4/A, CHITTAGONG EXPORT PROCESSING ZONE, CHITTAGONG TEL: 741872, 741889, 741890 FAX: 00 88 031 741870",
    "BANGLADESH SPINNERS & KNITTERS (PVT) LTD. PLOT NO. 6 TO 11, SECTOR - 4/A, CHITTAGONG EXPORT PROCESSING ZONE, CHITTAGONG",
  ],
  [
    "House # 262 (1st Floor), Road # 19, New, # I DOHS, Mohakhali, Dhaka, 9884817 Tel: 01718167375, 8715141-2",
    "House # 262 (1st Floor), Road # 19, New, # I DOHS, Mohakhali, Dhaka",
  ],
  ["House # 192, Road # 2, Baridhara DOHS, Dhaka, 018-238019", "House # 192, Road # 2, Baridhara DOHS, Dhaka"],
  ["Kewa, Sreepur, Gazipur - 1740, Bangladesh, www.divinetextile.com", "Kewa, Sreepur, Gazipur - 1740, Bangladesh"],
  ["House # 09 Road#8, Sec #1\nUttara,\nWeb:www.silvergroupbd.com\nDhaka\nDhaka", "House # 09 Road#8, Sec #1\nUttara\nDhaka\nDhaka"],
  ["34, Azimpur Road, Lalbagh, Dhaka -1205 Pho:9660638, 258614989", "34, Azimpur Road, Lalbagh, Dhaka -1205"],
  [
    "F.R. Tower (10th Floor), 32, Kamal Ataturk 205, Baizid Bostami Road,, Avenue Bayezid Bostami, Chittagong, Banani, Dhaka Tel: 88-02-41380606, 01615576763",
    "F.R. Tower (10th Floor), 32, Kamal Ataturk 205, Baizid Bostami Road, Avenue Bayezid Bostami, Chittagong, Banani, Dhaka",
  ],
  // Shapes the gated columns hold, as they would read inside an address.
  ["Plot 5, Road 2, Dhaka +880 1700 000000", "Plot 5, Road 2, Dhaka"],
  ["Plot 5, Road 2, Dhaka, Web: leak-test-website.invalid, Email: a@b.invalid", "Plot 5, Road 2, Dhaka"],
  // Cycle 4: published rows the first version let through (live SQL, 25 Sep).
  ["PLOT NO: 55-56, MONGLA EPZ, 9351, MONGLA, BAGERHAT, Bangladesh, Your contact:  Md. Sohel Ahmed", "PLOT NO: 55-56, MONGLA EPZ, 9351, MONGLA, BAGERHAT, Bangladesh"],
  ["Mohd. Abid Hossain Belal, Proprietor", ""],
  ["A.S.M. Shafiquzzaman, Proprietor", ""],
  ["Md. Moniruzzaman Monir, # 132, Gulshan, Managing Director", "# 132, Gulshan"],
  ["Managing Director, # 08, Rd # 01,", "# 08, Rd # 01"],
  ["Plot-53, Block-B, Banani C/A, Dhaka - 1213, Bangladesh, janata-sadat-jute.com/", "Plot-53, Block-B, Banani C/A, Dhaka - 1213, Bangladesh"],
  // A principal product: `shanghai-deck-lace-bd` files its gated website as one.
  ["shdeck.com", ""],
  // Cycle 4: how Bangladeshi numbers are really grouped, each of which the first version kept whole or in part.
  ["Plot 5, Dhaka, 01711528388/01811528388", "Plot 5, Dhaka"],
  ["Dhaka, 01711-528388/01819-123456", "Dhaka"],
  ["Plot 5, Dhaka, 0171 152 8388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, 01711.528388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka.01711528388", "Plot 5, Dhaka."],
  ["Plot 5, Dhaka, Contact: 01711-52-83-88", "Plot 5, Dhaka"],
  ["Road 12, Uttara, Dhaka-1230, 01711 52 83 88", "Road 12, Uttara, Dhaka-1230"],
  ["Plot 5, Dhaka 01711 528388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, T: 01711 528388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Hotline 09612 345678", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Tel/Fax: 88-02-9898989", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Mob-01711528388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Cell#01711528388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Tel No: 912 5191", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, info [at] abc.com", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Contact: info@abc.com", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, abc.com.bd", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, silvergroupbd.com", "Plot 5, Dhaka"],
  // Cycle 5: a role not next to the name it labels (live rows), and the shapes the audits probed.
  [
    "Saddam Hossain, 60, Gausul Azam Avenue, Sector # 13, Proprietor, Uttara, Dhaka, Beetex Sourcing (Reg:",
    "60, Gausul Azam Avenue, Sector # 13, Uttara, Dhaka, Beetex Sourcing (Reg:",
  ],
  [
    "263, Bara Moghbazar, (3rd Floor) Sorder M. Nur-Uz-Zaman, Moghbazar, Dhaka Managing Director",
    "263, Bara Moghbazar, (3rd Floor), Moghbazar, Dhaka",
  ],
  ["Karim Uddin (Proprietor), Plot 5, Dhaka", "Plot 5, Dhaka"],
  // Cycle 6: a name just before a role anywhere in the text, not only at the start.
  ["House 5, Road 3, Abdul Karim, Chairman, Dhaka", "House 5, Road 3, Dhaka"],
  ["House 5, Dhaka, Abdul Karim, Owner", "House 5, Dhaka"],
  ["House 5, Road 3, Karim Uddin, Proprietor, Dhaka", "House 5, Road 3, Dhaka"],
  ["Karim Uddin - Proprietor, Plot 5, Dhaka", "Plot 5, Dhaka"],
  ["Karim Uddin (MD), Plot 5, Dhaka", "Plot 5, Dhaka"],
  ["Contact person Md Karim, Plot 5, Dhaka", "Plot 5, Dhaka"],
  ["Jacket, call 9125191", "Jacket"],
  // A role joined to its name by a bare hyphen (cycle 7: reopened by the Chairman-Bari fix).
  ["Plot 5, Dhaka, Proprietor-Md Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Managing Director-Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Owner-Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, CEO- Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Chairman-Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Director-Rokeya Begum", "Plot 5, Dhaka"],
  ["Contact: Karim Uddin, Plot 5", "Plot 5"],
  ["Plot 5, Contact Name: Rokeya Begum", "Plot 5"],
  // A name with its role beside it, each role on its own (cycle 7: dropping
  // owner|ceo|chairman, or the spaced-dash label, left every case green).
  ["Abdul Karim - Owner, Plot 5, Dhaka", "Plot 5, Dhaka"],
  ["Abdul Karim - CEO, Plot 5, Dhaka", "Plot 5, Dhaka"],
  ["Abdul Karim (Chairman), Plot 5, Dhaka", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Abdul Karim (Director)", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Abdul Karim - GM", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Owner - Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, CEO – Abdul Karim", "Plot 5, Dhaka"],
  // …and when a numbered place opens the name's stretch, the place up to its
  // last number stays and the name goes. An address word does not mark a place
  // here: it is a name too (cycle 8 — "Abdul Bari (MD)" was kept whole, "Bari"
  // being on the address list). Privacy over completeness: "Nur Mansion (MD)"
  // and "Rahman Villa" lose their place.
  ["House 5 Road 3 Md Karim (MD), Dhaka", "House 5 Road 3, Dhaka"],
  ["House 12 Road 3 Karim Uddin (Proprietor), Dhaka", "House 12 Road 3, Dhaka"],
  ["Holding 7 Station Road Abdul Karim - CEO, Tongi", "Holding 7, Tongi"],
  ["Plot 5, Rahman Villa Abdul Karim - Owner, Dhaka", "Plot 5, Dhaka"],
  ["Abdul Bari (MD), Plot 5, Dhaka", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Abdul Bari - Proprietor", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Md. Abdul Bari (Chairman)", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Karim Park (Owner)", "Plot 5, Dhaka"],
  ["Rokeya Nagar - CEO, Plot 5", "Plot 5"],
  ["Nur Mansion (MD), Dhaka", "Dhaka"],
  ["House 12, Road 5 Abdul Karim (MD), Dhaka", "House 12, Road 5, Dhaka"],
  ["Sector 7 Uttara Abdul Karim (Chairman), Dhaka", "Sector 7, Dhaka"],
  ["Road 7 Abdul Karim - Proprietor", "Road 7"],
  ["Plot 5, Dhaka, Abdul Karim Tower - Owner", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Owner - Road Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Abdul Karim - General Manager", "Plot 5, Dhaka"],
  ["Attention: Abdul Karim, Plot 5", "Plot 5"],
  ["Plot 5, Adamjee EPZ, Mr. Park Jong-ho (MD)", "Plot 5, Adamjee EPZ"],
  ["Plot 5, Dhaka, MD- Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, MD: Abdul Karim", "Plot 5, Dhaka"],
  // A place word after a role's dash is a name unless place words run to the end of the part.
  ["Plot 5, Dhaka, Proprietor - Bari Ahmed", "Plot 5, Dhaka"],
  ["Chairman-Road Karim, Dhaka", "Dhaka"],
  // A SPACED dash is always a label, even before a lone place word: Park is a surname.
  ["Plot 5, Adamjee EPZ, Chairman - Park", "Plot 5, Adamjee EPZ"],
  ["Plot 5, Adamjee EPZ, Chairman -Park", "Plot 5, Adamjee EPZ"],
  ["Owner- House of Abdul Karim, Dhaka", "Dhaka"],
  ["Chairman — Abdul Karim, Dhaka", "Dhaka"],
  // Places named by an address word stay beside a role (each word added in cycle 6).
  ["Adamjee EPZ, Narayanganj, Managing Director", "Adamjee EPZ, Narayanganj"],
  ["Kaliakoir Union, Gazipur, Proprietor", "Kaliakoir Union, Gazipur"],
  ["Kashimpur Village, Gazipur, Your contact: Md. Karim", "Kashimpur Village, Gazipur"],
  ["Uttara Sector, Dhaka, Proprietor", "Uttara Sector, Dhaka"],
  ["Savar Upazila, Dhaka, Proprietor", "Savar Upazila, Dhaka"],
  ["Tongi Thana, Gazipur, Proprietor", "Tongi Thana, Gazipur"],
  ["BSCIC Estate, Tongi, Proprietor", "BSCIC Estate, Tongi"],
  ["Mill Area, Tongi, Proprietor", "Mill Area, Tongi"],
  ["Staff Colony, Tongi, Proprietor", "Staff Colony, Tongi"],
  ["Rupganj Industrial, Narayanganj, Proprietor", "Rupganj Industrial, Narayanganj"],
  // …and the places beside a role stay (cycle 6 found each of these cut).
  ["Kashimpur, Gazipur, Your contact: Md. Karim", "Kashimpur, Gazipur"],
  ["Dhaka Export Processing Zone, Savar, Managing Director", "Dhaka Export Processing Zone, Savar"],
  ["Ashulia, Savar\nProprietor: Md. Karim", "Ashulia, Savar"],
  ["Mirpur D. Section, Dhaka, Proprietor", "Mirpur D. Section, Dhaka"],
  ["Plot 5, Dhaka, Contact Person: Md. Karim Uddin", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Attn: Mr. Rahman", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, C/O Mr. Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, CEO: Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, (01711) 528388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, 01711 - 528388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, 01711—528388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Tel: (02) 912 5191", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, PABX 989 8989", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, WhatsApp 01711528388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, info @ abc.com", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, abc(at)gmail(dot)com", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, e-mail: x at y dot com", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Skype: abc.garments", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, abcfashion.shop", "Plot 5, Dhaka"],
  // Cycle 6: a case for every rule the comment names that had none.
  ["Plot 5, Dhaka, Director: Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, GM: Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, General Manager: Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Owner: Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Chairman: Abdul Karim", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, IMO: 912 5191", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, Viber 912 5191", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, abcfashion.store", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, abcfashion.online", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, abcfashion.xyz", "Plot 5, Dhaka"],
  // Six digits after a label is a phone; six from a leading 0 is a phone.
  ["Plot 5, Dhaka, Tel: 91-2519", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, 012519", "Plot 5, Dhaka"],
  // An honorific and a name, with no role anywhere in the text.
  ["Plot 5, Md. Karim Uddin, Dhaka", "Plot 5, Dhaka"],
  ["Mr. Rahman, Plot 5, Dhaka", "Plot 5, Dhaka"],
  // Brackets emptied by a cut go with it.
  ["Plot 5, Dhaka (Tel: 01711528388)", "Plot 5, Dhaka"],
];

const CLEAN = [
  "Abder, Telehati, Join Bazar, Sreepur, Gazipur.",
  "Telecom Bhaban (Level-4), 53/1 Box Nagar, Zoo Road, Mirpur-1\nDhaka\nDhaka",
  "18926-18930 & 18895, Khilla Para, Bhatiary Link Road, Hathhazari, Chattogram",
  "B-164-165-166-185-186-187, BSCIC I/E, SHASONGAON, FATULLAH, NARAYANGANJ, FATULLAH, NARAYANGANJ",
  "Plot No. 12893-12895, Beside Bahaddarhat Bus Terminal, Chandgaon, Chandgaon, PS-Chattogram-4367",
  "House # 483 (4th floor, Lift-5), Road @ 8 (East Side), DOHS, Baridhara, Dhaka",
  "Flat @ 4C, 1/10, Block # C, Lalmatia, Dhaka",
  "Sattara Center (9th Floor), 30/A, Naya Paltan (Hotel Victory), Dhaka-1000",
  "414,kouchakuri,telirchala,mouchak,kaliakoir,, 1751, Gazipur, Bangladesh",
  "SHAITALIA, TELEHATI, , GAZIPUR",
  // Cycle 4: real address text the first version cut, changing what a register filed.
  "Makka Tower, Plot # 110072, Holding # 61/A, Master Para, Uttarkhan\nDhaka\nDhaka",
  "Bangladesh\n314102 Jiashan",
  "Room 101,No.113 South Button Road,Xitang town,, 314102, Jiashan, Bangladesh",
  "Hangzhou Bay Shangyu Economic and Technological Development Zone, Shangyu, 312300, Shaoxing, Bangladesh",
  "Web Tower (5th Floor), Gulshan-1, Dhaka",
  "Road 3, Sector 10, Ph. 12, Uttara, Dhaka",
  "Email Road, Dhaka",
  "Holding 1234567, Konabari, Gazipur",
  "Web Belt",
  // Names that are places, and a company whose name is a domain.
  "Dr. Panjab Ali, Dr. Assaduzzaman Industrial Park, Kathora, National University, Gazipur - 1704, Bangladesh",
  "Chunkutia Chowdhury Para, Chairman Bari Road, Keranigonj, Dhaka-1310",
  "CHAIRMAN MARKET, DHAKIN KHAN BAZAR, UTTARA, DHAKA",
  "House # 441 (Ground Floor), Road # 30, New Apparel.com Limited (Reg:, DOHS Mustafa Arcade, Flat # A4,, 1/A, House #18, Mohakhali, Dhaka",
  "Contact Address: House - 1/C (3rd Floor) Road - 10, Baridhara Diplomatic Zone, Dhaka - 1212. Head Office: 26, Shyamolibag, Mirpur Road, Dhaka-1207.",
  "Md. Ali Mansion, Dhaka",
  "Chairman-Bari, Tongi, Gazipur",
  "Chairman Market, Tongi",
  "Chairman-Bari Road, Tongi",
  "Road @ 8, Gulshan, Dhaka",
];

describe("withoutContactDetails — contact details filed inside an address", () => {
  for (const [filed, shown] of LEAKING) {
    it(`strips them from "${filed.slice(0, 48)}…"`, () => {
      assert.equal(withoutContactDetails(filed), shown);
    });
  }

  it("leaves a clean address byte for byte, however much it looks like one that is not", () => {
    for (const text of CLEAN) assert.equal(withoutContactDetails(text), text);
  });

  it("no digit run of six or more, no @ and no www survives any real leaking row", () => {
    for (const [filed] of LEAKING) {
      const out = withoutContactDetails(filed);
      assert.doesNotMatch(out, /\d{6,}|@|www\.|\.(?:com|net|org)\b|\b(?:tel|fax|email|web|pho|hotline|contact|proprietor|managing director)\b/i, out);
    }
  });

  it("each rule stands on its own: nothing else in the text would catch these", () => {
    // Every fixture e-mail above was labelled, so removing the e-mail rule
    // passed them all (cycle 4); removing the international and URL rules
    // passed everything too (cycle 5). One case per rule, with no label and
    // no other shape another rule could take.
    const alone: [rule: string, filed: string][] = [
      ["e-mail", "Plot 5, Dhaka, sales.team@abc-garments.com"],
      // Spaced: unbroken, the bare-number rule would take it too.
      ["mobile", "Plot 5, Dhaka, 0191 122 3344"],
      ["domain", "Plot 5, Dhaka, abc-garments.net"],
      ["international", "Plot 5, Dhaka, +44 20 7946 0958"],
      ["URL", "Plot 5, Dhaka, www.abcfashion.garden"],
      ["bare number from 0, nine digits in groups", "Plot 5, Dhaka, 02-9898-989"],
      ["standalone role", "Chairman, Plot 5, Dhaka"],
    ];
    for (const [rule, filed] of alone) assert.equal(withoutContactDetails(filed), "Plot 5, Dhaka", rule);
  });

  it("a product entry keeps its long numbers: an HS code is not a phone", () => {
    assert.equal(withoutContactDetails("Knit T-shirt 61091000", { bareNumbers: false }), "Knit T-shirt 61091000");
    assert.equal(withoutContactDetails("Knit T-shirt 61091000"), "Knit T-shirt", "guard: in an address the same number is a phone");
    // Everything else still applies to a product entry.
    assert.equal(withoutContactDetails("shdeck.com", { bareNumbers: false }), "");
    assert.equal(withoutContactDetails("Polo shirts, call 01711528388", { bareNumbers: false }), "Polo shirts");
  });

  it("null stays null", () => {
    assert.equal(withoutContactDetails(null), null);
  });
});

// The population guard (`ops/check_contact_text.mjs`) routes every text that
// names a person to hand review. Its detector had no test: widening or
// narrowing it passed every suite (cycle 8). Run it over a fixture.
describe("the population guard sends every text naming a person to review", () => {
  const run = (rows: object[]) => {
    const dir = mkdtempSync(path.join(tmpdir(), "ct-guard-"));
    const file = path.join(dir, "rows.json");
    writeFileSync(file, JSON.stringify(rows));
    try {
      return spawnSync(process.execPath, [path.join(process.cwd(), "ops", "check_contact_text.mjs"), file], { encoding: "utf8" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it("flags each shape the stripper removes a name from", () => {
    const named = [
      "Plot 5, Dhaka, Proprietor: Md Karim",
      "Plot 5, Dhaka, Owner-Abdul Karim",
      "Plot 5, Dhaka, CEO: Abdul Karim",
      "Plot 5, Dhaka, MD: Abdul Karim",
      "Plot 5, Dhaka, Abdul Karim (MD)",
      "Plot 5, Dhaka, Abdul Karim - Owner",
      "Plot 5, Dhaka, Abdul Karim, Chairman",
      "Plot 5, Contact: Karim Uddin",
      "Plot 5, Your contact: Md Karim",
      "House 5, c/o Abdul Karim, Dhaka",
    ];
    const out = run(named.map((address_raw, i) => ({ slug: `probe-${i}`, address_raw })));
    assert.equal(out.status, 1, out.stdout + out.stderr);
    named.forEach((t, i) => assert.match(out.stdout, new RegExp(`FAIL probe-${i} \\(address\\): a text naming a person whose output nobody has reviewed`), `not sent to review: ${t}`));
  });

  it("passes a place that only looks like a role", () => {
    const out = run(["Chairman-Bari, Tongi, Gazipur", "Chairman Market, Tongi", "Plot 5, Road 3, Dhaka"].map((address_raw, i) => ({ slug: `place-${i}`, address_raw })));
    assert.equal(out.status, 0, out.stdout + out.stderr);
  });
});
