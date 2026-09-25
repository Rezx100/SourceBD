// `withoutContactDetails` against the published addresses that carry contact
// details, verbatim from production (SQL over v_supplier_addresses and
// suppliers.address_raw, 25 Sep 2026), and against the ones that only look as
// if they might.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
  [
    "263, Bara Moghbazar, (3rd Floor) Sorder M. Nur-Uz-Zaman, Moghbazar, Dhaka Managing Director",
    "263, Bara Moghbazar, (3rd Floor) Sorder M. Nur-Uz-Zaman, Moghbazar, Dhaka",
  ],
  ["Plot-53, Block-B, Banani C/A, Dhaka - 1213, Bangladesh, janata-sadat-jute.com/", "Plot-53, Block-B, Banani C/A, Dhaka - 1213, Bangladesh"],
  // A principal product: `shanghai-deck-lace-bd` files its gated website as one.
  ["shdeck.com", ""],
  // Cycle 4: how Bangladeshi numbers are really grouped, each of which the first version kept whole or in part.
  ["Plot 5, Dhaka, 01711528388/01811528388", "Plot 5, Dhaka"],
  ["Dhaka, 01711-528388/01819-123456", "Dhaka"],
  ["Plot 5, Dhaka, 0171 152 8388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka, 01711.528388", "Plot 5, Dhaka"],
  ["Plot 5, Dhaka.01711528388", "Plot 5, Dhaka"],
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

  it("each rule stands on its own: an unlabelled e-mail, a bare mobile, a bare domain", () => {
    // Every fixture e-mail above is labelled, so removing the e-mail rule
    // passed them all (cycle 4). These have nothing else that would catch them.
    assert.equal(withoutContactDetails("Plot 5, Dhaka, sales.team@abc-garments.com"), "Plot 5, Dhaka");
    assert.equal(withoutContactDetails("Plot 5, Dhaka, 01911223344"), "Plot 5, Dhaka");
    assert.equal(withoutContactDetails("Plot 5, Dhaka, abc-garments.net"), "Plot 5, Dhaka");
  });

  it("null stays null", () => {
    assert.equal(withoutContactDetails(null), null);
  });
});
