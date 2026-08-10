import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyPlaceLexicon } from "./bd-place-lexicon";
import { normaliseAddressKey } from "./dedup-addresses";

// Helper: canonical form of a place-name token as it appears in the
// normaliseAddressKey output (lowercase, lexicon applied).
function lex(s: string): string {
  return applyPlaceLexicon(s.toLowerCase());
}

// ---- applyPlaceLexicon — approved pairs (checklist A1–A2, B1–B7, C1, C2) ----

describe("applyPlaceLexicon — new pairs A1–A2", () => {
  it("Valuka → bhaluka", () => assert.equal(lex("valuka"), "bhaluka"));
  it("Bhaluka stays canonical", () => assert.equal(lex("bhaluka"), "bhaluka"));
  it("Jamairdia → jamirdia", () => assert.equal(lex("jamairdia"), "jamirdia"));
  it("Jamirdia stays canonical", () => assert.equal(lex("jamirdia"), "jamirdia"));
  it("merges full address: Jamairdia, Valuka, Mymensingh", () => {
    assert.equal(lex("jamirdia, valuka, mymensingh"), "jamirdia, bhaluka, mymensingh");
  });
});

describe("applyPlaceLexicon — B series (UI transliterations)", () => {
  it("Chittagong → chattogram", () => assert.equal(lex("chittagong"), "chattogram"));
  it("CTG → chattogram", () => assert.equal(lex("ctg"), "chattogram"));
  it("Dacca → dhaka", () => assert.equal(lex("dacca"), "dhaka"));
  it("Bayzid → baizid", () => assert.equal(lex("bayzid"), "baizid"));
  it("Dhanmandi → dhanmondi", () => assert.equal(lex("dhanmandi"), "dhanmondi"));
  it("Narayangonj → narayanganj", () => assert.equal(lex("narayangonj"), "narayanganj"));
  it("N.ganj → narayanganj", () => assert.equal(lex("n.ganj"), "narayanganj"));
  it("N ganj → narayanganj", () => assert.equal(lex("n ganj"), "narayanganj"));
  it("Siddirgonj → siddhirganj", () => assert.equal(lex("siddirgonj"), "siddhirganj"));
  it("Siddhirgonj → siddhirganj", () => assert.equal(lex("siddhirgonj"), "siddhirganj"));
  it("Maymashingo → mymensingh", () => assert.equal(lex("maymashingo"), "mymensingh"));
  it("Maymanshingh → mymensingh", () => assert.equal(lex("maymanshingh"), "mymensingh"));
  it("Mymensing → mymensingh", () => assert.equal(lex("mymensing"), "mymensingh"));
});

describe("applyPlaceLexicon — C1 district corrections", () => {
  it("Kishorganj → kishoreganj", () => assert.equal(lex("kishorganj"), "kishoreganj"));
  it("Manikgonj → manikganj", () => assert.equal(lex("manikgonj"), "manikganj"));
  it("Munshigonj → munshiganj", () => assert.equal(lex("munshigonj"), "munshiganj"));
  it("Narshingdi → narsingdi", () => assert.equal(lex("narshingdi"), "narsingdi"));
  it("Comilla → cumilla", () => assert.equal(lex("comilla"), "cumilla"));
  it("Coxs Bazar → cox's bazar", () => assert.equal(lex("coxs bazar"), "cox's bazar"));
  it("Cox Bazar → cox's bazar", () => assert.equal(lex("cox bazar"), "cox's bazar"));
  it("Cox's Bazar stays canonical", () => assert.equal(lex("cox's bazar"), "cox's bazar"));
  it("Khagrachari → khagrachhari", () => assert.equal(lex("khagrachari"), "khagrachhari"));
  it("Laxmipur → lakshmipur", () => assert.equal(lex("laxmipur"), "lakshmipur"));
  it("Bogra → bogura", () => assert.equal(lex("bogra"), "bogura"));
  it("Jaipurhat → joypurhat", () => assert.equal(lex("jaipurhat"), "joypurhat"));
  it("Chapai Nawabganj → chapainawabganj", () =>
    assert.equal(lex("chapai nawabganj"), "chapainawabganj"));
  it("Sirajgonj → sirajganj", () => assert.equal(lex("sirajgonj"), "sirajganj"));
  it("Jessore → jashore", () => assert.equal(lex("jessore"), "jashore"));
  it("Jhenidah → jhenaidah", () => assert.equal(lex("jhenidah"), "jhenaidah"));
  it("Barisal → barishal", () => assert.equal(lex("barisal"), "barishal"));
  it("Jhalokathi → jhalokati", () => assert.equal(lex("jhalokathi"), "jhalokati"));
  it("Habigonj → habiganj", () => assert.equal(lex("habigonj"), "habiganj"));
  it("Moulavibazar → moulvibazar", () => assert.equal(lex("moulavibazar"), "moulvibazar"));
  it("Sunamgonj → sunamganj", () => assert.equal(lex("sunamgonj"), "sunamganj"));
  it("Panchagar → panchagarh", () => assert.equal(lex("panchagar"), "panchagarh"));
  it("Netrakona → netrokona", () => assert.equal(lex("netrakona"), "netrokona"));
  it("B.Baria → brahmanbaria", () => assert.equal(lex("b.baria"), "brahmanbaria"));
  it("B Baria → brahmanbaria", () => assert.equal(lex("b baria"), "brahmanbaria"));
  it("B. Baria → brahmanbaria", () => assert.equal(lex("b. baria"), "brahmanbaria"));
});

describe("applyPlaceLexicon — C2 locality / EPZ aliases", () => {
  it("Kaliakoir → kaliakair", () => assert.equal(lex("kaliakoir"), "kaliakair"));
  it("Rupgonj → rupganj", () => assert.equal(lex("rupgonj"), "rupganj"));
  it("Sitakundu → sitakunda", () => assert.equal(lex("sitakundu"), "sitakunda"));
  it("Mirsharai → mirsarai", () => assert.equal(lex("mirsharai"), "mirsarai"));
  it("Asadgonj → asadganj", () => assert.equal(lex("asadgonj"), "asadganj"));
  it("Keraneganj → keraniganj", () => assert.equal(lex("keraneganj"), "keraniganj"));
  it("DEPZ → savar", () => assert.equal(lex("depz"), "savar"));
  it("AEPZ → adamjee epz", () => assert.equal(lex("aepz"), "adamjee epz"));
  it("Adamjee → adamjee epz", () => assert.equal(lex("adamjee"), "adamjee epz"));
  it("Adamjee EPZ stays canonical (no double EPZ)", () =>
    assert.equal(lex("adamjee epz"), "adamjee epz"));
  it("CEPZ → chattogram epz", () => assert.equal(lex("cepz"), "chattogram epz"));
  it("KEPZ → karnaphuli epz", () => assert.equal(lex("kepz"), "karnaphuli epz"));
  it("Karnaphuli → karnaphuli epz", () => assert.equal(lex("karnaphuli"), "karnaphuli epz"));
  it("Karnaphuli EPZ stays canonical", () =>
    assert.equal(lex("karnaphuli epz"), "karnaphuli epz"));
  it("Korean EPZ → karnaphuli epz", () => assert.equal(lex("korean epz"), "karnaphuli epz"));
  it("Korean Export Processing Zone → karnaphuli epz", () =>
    assert.equal(lex("korean export processing zone"), "karnaphuli epz"));
  it("MEPZ → mongla epz", () => assert.equal(lex("mepz"), "mongla epz"));
  it("Mongla → mongla epz", () => assert.equal(lex("mongla"), "mongla epz"));
  it("Mongla EPZ stays canonical", () => assert.equal(lex("mongla epz"), "mongla epz"));
  it("IEPZ → ishwardi epz", () => assert.equal(lex("iepz"), "ishwardi epz"));
  it("UEPZ → uttara epz", () => assert.equal(lex("uepz"), "uttara epz"));
  it("CCEPZ → cumilla epz", () => assert.equal(lex("ccepz"), "cumilla epz"));
  it("Dhour → turag", () => assert.equal(lex("dhour"), "turag"));
  it("Banasree → rampura", () => assert.equal(lex("banasree"), "rampura"));
  it("BSMRAU → salna", () => assert.equal(lex("bsmrau"), "salna"));
  it("National University → board bazar", () =>
    assert.equal(lex("national university"), "board bazar"));
});

// ---- Negatives (D) — must NOT merge ----

describe("applyPlaceLexicon — D negatives", () => {
  it("Sreepur stays sreepur (≠ sripur)", () => assert.equal(lex("sreepur"), "sreepur"));
  it("Sripur stays sripur (≠ sreepur)", () => assert.equal(lex("sripur"), "sripur"));
  it("bare Nawabganj does not map to chapainawabganj", () =>
    assert.equal(lex("nawabganj"), "nawabganj"));
  it("Chapainawabganj stays canonical", () =>
    assert.equal(lex("chapainawabganj"), "chapainawabganj"));
});

// ---- Integration: normaliseAddressKey merges place-variant addresses ----

describe("normaliseAddressKey — merges place-variant full addresses", () => {
  it("Jamirdia, Valuka, Mymensingh === Jamirdia, Bhaluka, Mymensingh", () => {
    assert.equal(
      normaliseAddressKey("Jamirdia, Valuka, Mymensingh"),
      normaliseAddressKey("Jamirdia, Bhaluka, Mymensingh"),
    );
  });
  it("Chittagong EPZ === Chattogram EPZ (via CEPZ also canonical)", () => {
    assert.equal(
      normaliseAddressKey("Chittagong EPZ, Chittagong"),
      normaliseAddressKey("Chattogram EPZ, Chattogram"),
    );
  });
  it("Comilla address === Cumilla address", () => {
    assert.equal(
      normaliseAddressKey("Plot 1, Comilla EPZ, Comilla"),
      normaliseAddressKey("Plot 1, Cumilla EPZ, Cumilla"),
    );
  });
  it("DEPZ address equals Savar address (EPZ acronym)", () => {
    assert.equal(
      normaliseAddressKey("DEPZ, Dhaka"),
      normaliseAddressKey("Savar, Dhaka"),
    );
  });
  it("Barisal road equals Barishal road", () => {
    assert.equal(
      normaliseAddressKey("123, Barisal Road, Dhaka"),
      normaliseAddressKey("123, Barishal Road, Dhaka"),
    );
  });

  it("REZ-112: Vawal equals Bhawal", () => {
    assert.equal(
      normaliseAddressKey("Bahadurpur, Vawal, Mirzapur"),
      normaliseAddressKey("Bahadurpur, Bhawal, Mirzapur"),
    );
  });

  it("REZ-112: applyPlaceLexicon maps vawal directly", () => {
    assert.equal(lex("vawal"), "bhawal");
  });

  // Negatives: different addresses must NOT merge
  it("Sreepur and Sripur are NOT merged", () => {
    assert.notEqual(
      normaliseAddressKey("Plot 5, Sreepur, Gazipur"),
      normaliseAddressKey("Plot 5, Sripur, Gazipur"),
    );
  });
  it("bare Nawabganj and Chapainawabganj are NOT merged", () => {
    assert.notEqual(
      normaliseAddressKey("Nawabganj, Dhaka"),
      normaliseAddressKey("Chapainawabganj"),
    );
  });
});
