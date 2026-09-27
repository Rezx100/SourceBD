// The product form's pure half: the variant matrix (every combination, capped,
// an empty option adding nothing), validation (a name, a price of 0 or more,
// a whole MOQ), the payload the route receives, and the read back from
// `buyer_product_get`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  VARIANT_CAP,
  cleanValues,
  emptyProduct,
  fileNameOf,
  fromProduct,
  releasedFiles,
  routeSentence,
  toPayload,
  validateProduct,
  variantMatrix,
} from "./product-form-model";

describe("variantMatrix", () => {
  it("2 × 3 options make 6 rows, the first option varying slowest", () => {
    const m = variantMatrix([
      { name: "Colour", values: ["Mid-wash", "Black"] },
      { name: "Waist", values: ["28", "30", "32"] },
    ]);
    assert.equal(m.total, 6);
    assert.deepEqual(m.columns, ["Colour", "Waist"]);
    assert.deepEqual(m.rows, [
      ["Mid-wash", "28"],
      ["Mid-wash", "30"],
      ["Mid-wash", "32"],
      ["Black", "28"],
      ["Black", "30"],
      ["Black", "32"],
    ]);
  });

  it("stops at 500 rows and still says how many combinations there are", () => {
    const ten = Array.from({ length: 10 }, (_, i) => String(i));
    const m = variantMatrix([
      { name: "A", values: ten },
      { name: "B", values: ten },
      { name: "C", values: ten },
    ]);
    assert.equal(VARIANT_CAP, 500);
    assert.equal(m.rows.length, 500);
    assert.equal(m.total, 1000);
    assert.deepEqual(m.rows[499], ["4", "9", "9"]);
  });

  it("an option with no values contributes nothing; blank and repeated values do not count", () => {
    const m = variantMatrix([
      { name: "Waist", values: ["28", " 30 ", "30", ""] },
      { name: "Colour", values: [] },
      { name: "Fit", values: ["  "] },
    ]);
    assert.deepEqual(m.columns, ["Waist"]);
    assert.deepEqual(m.rows, [["28"], ["30"]]);
    assert.equal(m.total, 2);
    assert.deepEqual(variantMatrix([]), { options: [], columns: [], rows: [], total: 0 });
    assert.deepEqual(variantMatrix([{ name: "Colour", values: [] }]).rows, []);
  });

  it("a nameless option is named by its place", () => {
    assert.deepEqual(variantMatrix([{ name: " ", values: ["S"] }]).columns, ["Option 1"]);
  });
});

describe("validateProduct", () => {
  const ok = { name: "Stretch jeans", price_usd: "", moq: "" };

  it("requires a name", () => {
    assert.ok(validateProduct({ ...ok, name: "   " }).name);
    assert.deepEqual(validateProduct(ok), {});
  });

  it("takes a price of 0 or more, never a negative or a word", () => {
    assert.equal(validateProduct({ ...ok, price_usd: "0" }).price_usd, undefined);
    assert.equal(validateProduct({ ...ok, price_usd: "8.50" }).price_usd, undefined);
    assert.ok(validateProduct({ ...ok, price_usd: "-1" }).price_usd);
    assert.ok(validateProduct({ ...ok, price_usd: "eight" }).price_usd);
  });

  it("takes a whole MOQ", () => {
    assert.equal(validateProduct({ ...ok, moq: "1200" }).moq, undefined);
    assert.ok(validateProduct({ ...ok, moq: "12.5" }).moq);
    assert.ok(validateProduct({ ...ok, moq: "-3" }).moq);
  });
});

describe("toPayload", () => {
  it("types the numbers, trims the text, drops empty rows and options, and names the status — in 0106's shape", () => {
    const v = {
      ...emptyProduct(),
      name: "  Stretch jeans ",
      price_usd: "8.5",
      moq: "1200",
      tags: ["SS27", "ss27", " "],
      options: [
        { name: "Waist", values: ["28", "30"] },
        { name: "Colour", values: [] },
      ],
      size_chart: [
        { code: "A", description: "Waist relaxed", tol_minus: "0.5", tol_plus: "0.5", base: "76" },
        { code: " ", description: "", tol_minus: "", tol_plus: "", base: "" },
      ],
    };
    const p = toPayload(v, "active");
    assert.equal(p.name, "Stretch jeans");
    assert.equal(p.price_usd, 8.5);
    assert.equal(p.moq, 1200);
    assert.equal(p.product_number, null);
    assert.deepEqual(p.tags, ["SS27"]);
    assert.deepEqual(p.variants, { options: [{ name: "Waist", values: ["28", "30"] }], rows: [{ Waist: "28" }, { Waist: "30" }] });
    assert.equal(p.size_chart.length, 1);
    assert.deepEqual(p.bom, []);
    assert.equal(p.tech_pack_url, null);
    assert.equal(p.status, "active");
    assert.ok(!("id" in p), "a new product sends no id");
    assert.equal(toPayload({ ...v, id: "p-1" }, "draft").id, "p-1");
  });
});

describe("fromProduct", () => {
  it("reads a saved product back into the form, and reads nothing it was not given", () => {
    const v = fromProduct({
      id: "p-1",
      name: "Stretch jeans",
      price_usd: 8.5,
      moq: 1200,
      status: "active",
      tags: ["SS27"],
      media: [
        { url: "https://x.test/a.jpg", kind: "image" },
        { url: "https://x.test/tp.pdf", kind: "tech_pack" },
        { url: "", kind: "image" },
      ],
      variants: { options: [{ name: "Waist", values: ["28", "30"] }], rows: [{ Waist: "28" }, { Waist: "30" }] },
      bom: [{ part: "Body", material: "Denim 12 oz", qty: "1.3 m", color: "Indigo", notes: "" }],
      tech_pack_url: "https://x.test/tp.pdf",
    });
    assert.equal(v.price_usd, "8.5");
    assert.equal(v.moq, "1200");
    assert.equal(v.status, "active");
    assert.equal(v.media.length, 2);
    assert.equal(v.bom[0]!.material, "Denim 12 oz");
    assert.equal(v.bom[0]!.color, "Indigo");
    assert.deepEqual(v.options, [{ name: "Waist", values: ["28", "30"] }]);
    assert.equal(v.tech_pack_url, "https://x.test/tp.pdf");
    assert.equal(v.size_chart.length, 1, "an empty chart starts with one blank row");
    const blank = fromProduct(null);
    assert.equal(blank.name, "");
    assert.equal(blank.status, "draft");
    assert.equal(fromProduct({ status: "published" }).status, "draft");
  });
});

describe("small helpers", () => {
  it("cleanValues trims, drops empties and repeats in any case", () => {
    assert.deepEqual(cleanValues([" Black", "black", "", "Navy "]), ["Black", "Navy"]);
  });
  it("routeSentence passes the route's sentence and never an RPC failure", () => {
    assert.equal(routeSentence({ error: "Give the product a name." }), "Give the product a name.");
    assert.equal(routeSentence({ error: "buyer_product_upsert failed", detail: "name is required" }), null);
    assert.equal(routeSentence({ error: "unauthorised" }), null);
    assert.equal(routeSentence(null), null);
  });
  it("fileNameOf reads the file's own name from its URL", () => {
    assert.equal(fileNameOf("https://x.test/o/tech%20pack%20v2.pdf?t=1"), "tech pack v2.pdf");
  });
});

describe("releasedFiles — what a save lets go of in the public bucket", () => {
  const B = "https://x.supabase.co/storage/v1/object/public/product-media/u1";
  const img = (n: number) => ({ url: `${B}/${n}.png`, kind: "image" as const });

  it("a removed image, a replaced tech pack, and an upload the buyer took back all leave storage", () => {
    const initial = { media: [img(1), img(2)], tech_pack_url: `${B}/old.pdf` };
    const saved = { media: [img(2), img(3)], tech_pack_url: `${B}/new.pdf` };
    const uploaded = [`${B}/3.png`, `${B}/4.png`, `${B}/new.pdf`];
    assert.deepEqual(releasedFiles(initial, uploaded, saved).sort(), [`${B}/1.png`, `${B}/4.png`, `${B}/old.pdf`].sort());
  });

  it("a file still on the product is never released, and nothing blank is", () => {
    const same = { media: [img(1)], tech_pack_url: "" };
    assert.deepEqual(releasedFiles(same, [], same), []);
    assert.deepEqual(releasedFiles(same, [`${B}/1.png`], same), []);
  });
});
