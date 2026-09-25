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
      assert.doesNotMatch(out, /\d{6,}|@|www\.|\b(?:tel|fax|email|web|pho)\b\s*:/i, out);
    }
  });

  it("null stays null", () => {
    assert.equal(withoutContactDetails(null), null);
  });
});
