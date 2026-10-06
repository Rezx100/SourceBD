// POST /api/v1/evidence-pack (gap row 8, migration 0114), at the route: who may, what it will not
// take, what it calls, what the file holds and what each database refusal becomes. Also the
// dialog's download step (`runPackDownload`): a refusal saves nothing and says why.

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { packMessage, runPackDownload } from "@/components/compliance/pack";
import { CONTACT_KEY_RE, called, fake, resetFake } from "../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the route loads.
const { POST } = require("./route") as typeof import("./route");

const post = (body: unknown) =>
  POST(new Request("https://sourcebd.net/api/v1/evidence-pack", { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

const PACK = {
  generated_at: "2026-10-05T09:00:00Z",
  sections: ["cert_expiry", "uflpa", "sources"],
  format: "csv",
  supplier_count: 2,
  row_count: 4,
  rows: [
    { section: "cert_expiry", supplier: "Aboni Knitwear Ltd.", supplier_slug: "aboni-knitwear", item: "WRAP 7865", state: "expired", date: "2026-05-28", source: "WRAP", checked_on: "2026-09-30", address: null },
    { section: "cert_expiry", supplier: "=HYPERLINK(\"http://evil.example\")", supplier_slug: "evil", item: "GOTS", state: "no_expiry_date", date: null, source: null, checked_on: "2026-09-30", address: null },
    { section: "uflpa", supplier: "Aboni Knitwear Ltd.", supplier_slug: "aboni-knitwear", item: null, state: "no_link_found", date: null, source: "UFLPA Entity List", checked_on: "2026-10-01", address: null },
    { section: "sources", supplier: "Aboni Knitwear Ltd.", supplier_slug: "aboni-knitwear", item: "BKMEA · 1234", state: "tier2_association", date: null, source: "BKMEA", checked_on: "2026-08-14", address: "Plot 4, Gazipur, \"Zone B\"" },
  ],
};

beforeEach(resetFake);

describe("POST /api/v1/evidence-pack", () => {
  it("calls evidence_pack once under the session and returns the file named for the day", async () => {
    fake.answers.evidence_pack = { data: PACK, error: null };
    const res = await post({ sections: ["cert_expiry", "uflpa", "sources", "uflpa"], format: "csv" });
    assert.equal(res.status, 200);
    assert.deepEqual(called("evidence_pack").map((c) => c.args), [{ p_sections: ["cert_expiry", "uflpa", "sources"], p_format: "csv" }], "sections de-duplicated, csv recorded");
    assert.match(res.headers.get("content-type") ?? "", /^text\/csv/);
    assert.match(res.headers.get("content-disposition") ?? "", /^attachment; filename="sourcebd-evidence-pack-\d{4}-\d{2}-\d{2}\.csv"$/);
    assert.equal(res.headers.get("x-sourcebd-rows"), "4");
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
  });

  it("the file has the fixed columns, the product's words and dates, and no formula can run", async () => {
    fake.answers.evidence_pack = { data: PACK, error: null };
    const lines = (await (await post({ sections: ["cert_expiry"], format: "csv" })).text()).trimEnd().split("\r\n");
    assert.equal(lines[0], "Section,Supplier,Profile,Item,State,Date,Source,Checked on,Address");
    assert.equal(lines[1], "Certificate expiry,Aboni Knitwear Ltd.,aboni-knitwear,WRAP 7865,Expired,28 May 2026,From WRAP,30 Sep 2026,");
    assert.ok(lines[2]!.includes(`"'=HYPERLINK(""http://evil.example"")"`), "a supplier-supplied formula is defused");
    assert.ok(lines[2]!.includes(",No expiry date,,,30 Sep 2026,"), "no date and no source are empty cells");
    assert.ok(lines[3]!.includes("UFLPA check,Aboni Knitwear Ltd.,aboni-knitwear,,No link found,,From UFLPA Entity List,1 Oct 2026,"));
    assert.equal(lines[4], `Source,Aboni Knitwear Ltd.,aboni-knitwear,BKMEA · 1234,Tier 2,,From BKMEA,14 Aug 2026,"Plot 4, Gazipur, ""Zone B"""`);
    assert.doesNotMatch(lines.join("\n"), CONTACT_KEY_RE, "no contact column");
  });

  it("is 401 with no session, 403 for a supplier, and asks the database nothing", async () => {
    fake.userId = null;
    fake.role = null;
    assert.equal((await post({ sections: ["uflpa"], format: "csv" })).status, 401);
    resetFake();
    fake.role = "supplier";
    assert.equal((await post({ sections: ["uflpa"], format: "csv" })).status, 403);
    assert.equal(called("evidence_pack").length, 0);
  });

  it("refuses what it cannot build before the database is asked: no sections, unknown ones, PDF, a bad body", async () => {
    for (const body of [
      { sections: [], format: "csv" },
      { sections: ["secrets"], format: "csv" },
      { sections: "uflpa", format: "csv" },
      { sections: [7], format: "csv" },
      { format: "csv" },
    ]) assert.equal((await post(body)).status, 400, JSON.stringify(body));
    const pdf = await post({ sections: ["uflpa"], format: "pdf" });
    assert.equal(pdf.status, 400, "no PDF library: a CSV is never sent under a PDF's name");
    assert.deepEqual(await pdf.json(), { error: "format not available" });
    assert.equal((await post({ sections: ["uflpa"] })).status, 400);
    assert.equal((await post("{")).status, 400);
    assert.equal((await post([])).status, 400);
    assert.equal(called("evidence_pack").length, 0, "reading the rows is the download, so nothing refused may read them");
  });

  it("turns the database's refusals into statuses: the daily cap is 429, a signed-out call 401, the rest unavailable", async () => {
    for (const [code, status] of [["54000", 429], ["42501", 401], ["22023", 400], ["XX000", 503]] as const) {
      fake.answers.evidence_pack = { data: null, error: { message: "boom: secret detail", code } };
      const res = await post({ sections: ["uflpa"], format: "csv" });
      assert.equal(res.status, status, code);
      assert.doesNotMatch(await res.text(), /secret/);
    }
    fake.answers.evidence_pack = { data: { rows: "not a list" }, error: null };
    assert.equal((await post({ sections: ["uflpa"], format: "csv" })).status, 503, "an answer that is not rows is not a short file");
  });

  it("a pack with no rows is a file of headers, and says 0 rows", async () => {
    fake.answers.evidence_pack = { data: { ...PACK, rows: [], row_count: 0 }, error: null };
    const res = await post({ sections: ["sources"], format: "csv" });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-sourcebd-rows"), "0");
    assert.equal((await res.text()).trimEnd().split("\r\n").length, 1);
  });
});

describe("the dialog's download", () => {
  const response = (status: number, headers: Record<string, string> = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (n: string) => headers[n] ?? null }, blob: async () => "blob" });

  it("saves the file under the server's name and says how many rows", async () => {
    const saved: [unknown, string][] = [];
    const out = await runPackDownload(["uflpa"], { fetch: async () => response(200, { "Content-Disposition": 'attachment; filename="sourcebd-evidence-pack-2026-10-05.csv"', "X-SourceBD-Rows": "4" }), save: (b, f) => void saved.push([b, f]) });
    assert.deepEqual(out, { ok: true, message: "Evidence pack downloaded · 4 rows." });
    assert.deepEqual(saved, [["blob", "sourcebd-evidence-pack-2026-10-05.csv"]]);
    assert.equal(packMessage(200, 1), "Evidence pack downloaded · 1 row.");
  });

  it("a refusal saves nothing and says why; the daily cap and a lost connection have their own words", async () => {
    let saves = 0;
    const save = () => void saves++;
    assert.match((await runPackDownload(["uflpa"], { fetch: async () => response(429), save })).message, /50 evidence packs today/);
    assert.match((await runPackDownload(["uflpa"], { fetch: async () => response(401), save })).message, /Sign in again/);
    assert.match((await runPackDownload(["uflpa"], { fetch: async () => response(503), save })).message, /Nothing was downloaded/);
    const lost = await runPackDownload(["uflpa"], { fetch: async () => Promise.reject(new Error("offline")), save });
    assert.equal(lost.ok, false);
    assert.match(lost.message, /no connection/);
    assert.equal(saves, 0);
  });
});
