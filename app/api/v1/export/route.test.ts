// GET /api/v1/export — the CSV behind Download CSV on Saved, Compliance and Certificate expiry
// (gap row 16), at the route: status codes, headers, the bytes of the file, and the invariants
// (no contact column, a failed read is a 503 and never a short file that looks whole).

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { CONTACT_KEY_RE, fake, resetFake } from "../route-test-fake";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the fake client must be installed before the route loads.
const { GET } = require("./route") as typeof import("./route");

const get = (query: string) => GET(new Request(`https://sourcebd.net/api/v1/export${query}`));
const lines = (csv: string) => csv.split("\r\n").filter(Boolean);
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const S1 = "0f1e2d3c-0000-4000-8000-000000000001";
const S2 = "0f1e2d3c-0000-4000-8000-000000000002";

const saved = (over: Record<string, unknown> = {}) => ({
  id: S1,
  slug: "aboni",
  company_name: "Aboni Knitwear Ltd.",
  entity_type: "factory",
  city: "Savar",
  district: "Dhaka",
  source_tags: [],
  t13_source_count: 8,
  employees_total: 1408,
  saved_at: "2026-10-01T09:30:00Z",
  total_count: 2,
  email_primary: "sales@aboni.example",
  ...over,
});
const cert = (sid: string, name: string, kind: string, no: string | null, expires_on: string, over: Record<string, unknown> = {}) => ({
  kind,
  certificate_no: no,
  issuer: "Bureau",
  expires_on,
  supplier: { id: sid, slug: `slug-${sid.slice(-1)}`, company_name: name, entity_type: "factory", city: "Dhaka", district: "Dhaka", email_primary: "leak@example.com", ...over },
});
const list = (rows: unknown[]) => ({ data: { total: rows.length, rows }, error: null });
const down = { data: null, error: { message: "down" } };

beforeEach(resetFake);

describe("GET /api/v1/export without a buyer", () => {
  it("answers 401 with no session, 403 for a supplier, 400 for an unknown file, and reads nothing", async () => {
    fake.userId = null;
    assert.equal((await get("?kind=saved")).status, 401);
    resetFake();
    fake.role = "supplier";
    assert.equal((await get("?kind=certificates")).status, 403);
    resetFake();
    assert.equal((await get("")).status, 400);
    assert.equal((await get("?kind=suppliers")).status, 400);
    assert.equal(fake.rpcCalls.length, 0);
  });
});

describe("GET /api/v1/export?kind=saved", () => {
  it("is a CSV attachment of the saved list: fixed columns, a certificate to check, no contact field", async () => {
    fake.answers.buyer_saved_list = { data: [saved(), saved({ id: S2, slug: "tex", company_name: "=HYPERLINK(\"http://x\")", city: null, district: null, employees_total: null, t13_source_count: null, saved_at: null })], error: null };
    fake.answers.compliance_expired_certs = list([cert(S1, "Aboni", "wrap", "7865", "2026-09-29")]);
    fake.answers.compliance_expiring_certs = list([]);
    const res = await get("?kind=saved&sort=name");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/csv; charset=utf-8");
    assert.equal(res.headers.get("Content-Disposition"), `attachment; filename="sourcebd-saved-suppliers-${today()}.csv"`);
    assert.equal(res.headers.get("Cache-Control"), "private, no-store");
    assert.equal(res.headers.get("X-SourceBD-Rows"), "2");
    const body = await res.text();
    const rows = lines(body);
    assert.equal(rows[0], "company,slug,type,city,district,workers,workers_source,profile_workers,profile_workers_source,sources,certificates_to_check,saved_on");
    assert.match(rows[1]!, /^Aboni Knitwear Ltd\.,aboni,Factory,Savar,Dhaka,1408,.*,8,WRAP 2026-09-29,2026-10-01$/);
    assert.match(rows[2]!, /^"'=HYPERLINK\(""http:\/\/x""\)"/, "a formula in a supplier's name is defused");
    assert.match(rows[2]!, /,0,,$/, "no certificate to check and no saved day are empty cells");
    assert.doesNotMatch(body, CONTACT_KEY_RE);
    assert.doesNotMatch(body, /aboni\.example/);
    assert.ok(fake.rpcCalls.some((c) => c.fn === "buyer_saved_list" && c.args?.p_sort === "name" && c.args?.p_offset === 0));
  });

  it("an unknown sort is the default; a certificate read that failed says 'not read', never an empty 'nothing to check'", async () => {
    fake.answers.buyer_saved_list = { data: [saved({ total_count: 1 })], error: null };
    fake.answers.compliance_expired_certs = down;
    fake.answers.compliance_expiring_certs = list([]);
    const res = await get("?kind=saved&sort=bogus");
    assert.equal(res.status, 200);
    assert.ok(fake.rpcCalls.some((c) => c.fn === "buyer_saved_list" && c.args?.p_sort === "recent"));
    assert.match(lines(await res.text())[1]!, /,8,not read,2026-10-01$/);
  });

  it("a failed list is a 503 and no file", async () => {
    fake.answers.buyer_saved_list = down;
    const res = await get("?kind=saved");
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("Content-Type"), "application/json; charset=utf-8");
    assert.deepEqual(await res.json(), { error: "export unavailable" });
  });

  it("past 1,000 rows the file stops there and says so in its name and headers", async () => {
    const page = Array.from({ length: 100 }, (_, i) => saved({ id: `0f1e2d3c-0000-4000-8000-${String(i).padStart(12, "0")}`, slug: `s-${i}`, total_count: 1500 }));
    fake.answers.buyer_saved_list = { data: page, error: null };
    fake.answers.compliance_expired_certs = list([]);
    fake.answers.compliance_expiring_certs = list([]);
    const res = await get("?kind=saved");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Disposition"), `attachment; filename="sourcebd-saved-suppliers-${today()}-first-1000-of-1500.csv"`);
    assert.equal(res.headers.get("X-SourceBD-Truncated"), "1");
    assert.equal(res.headers.get("X-SourceBD-Matched"), "1500");
    assert.equal(lines(await res.text()).length, 1001);
    assert.deepEqual(fake.rpcCalls.filter((c) => c.fn === "buyer_saved_list").map((c) => c.args?.p_offset), [0, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });
});

describe("GET /api/v1/export?kind=certificates", () => {
  const lapsed = cert(S1, "Aboni Knitwear Ltd.", "wrap", "7865", inDays(-5));
  const soon = cert(S2, "Mondol Intimates Ltd.", "gots", "GOTS-26992", inDays(10), { city: "Gazipur", district: "Gazipur" });
  const later = cert("0f1e2d3c-0000-4000-8000-000000000003", "Tex Town Ltd.", "gots", null, inDays(60));
  const give = () => {
    fake.answers.compliance_expired_certs = list([lapsed]);
    fake.answers.compliance_expiring_certs = list([soon, later]);
  };

  it("lists expired first, then those lapsing soonest, with the day each lapses", async () => {
    give();
    const res = await get("?kind=certificates");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "text/csv; charset=utf-8");
    assert.equal(res.headers.get("Content-Disposition"), `attachment; filename="sourcebd-certificates-to-check-${today()}.csv"`);
    assert.equal(res.headers.get("X-SourceBD-Rows"), "3");
    const body = await res.text();
    const rows = lines(body);
    assert.equal(rows[0], "status,expires_on,days_to_expiry,certificate,certificate_no,supplier,slug,location,issued_by");
    assert.equal(rows[1], `expired,${inDays(-5)},,WRAP,7865,Aboni Knitwear Ltd.,slug-1,Dhaka,Bureau`);
    assert.equal(rows[2], `expiring,${inDays(10)},10,GOTS,GOTS-26992,Mondol Intimates Ltd.,slug-2,Gazipur,Bureau`);
    assert.match(rows[3]!, new RegExp(`^expiring,${inDays(60)},60,GOTS,,Tex Town Ltd\\.,slug-3,Dhaka,Bureau$`));
    assert.doesNotMatch(body, CONTACT_KEY_RE);
    assert.doesNotMatch(body, /leak@example\.com/);
  });

  it("?show= writes the group the page shows, and says which in the name", async () => {
    give();
    const expired = await get("?kind=certificates&show=expired");
    assert.equal(lines(await expired.text()).length, 2);
    assert.match(expired.headers.get("Content-Disposition")!, /sourcebd-certificates-expired-/);
    const thirty = await get("?kind=certificates&show=30");
    assert.deepEqual(lines(await thirty.text()).slice(1).map((l) => l.split(",")[5]), ["Mondol Intimates Ltd."]);
    assert.match(thirty.headers.get("Content-Disposition")!, /sourcebd-certificates-expiring-30-days-/);
    const ninety = await get("?kind=certificates&show=90");
    assert.deepEqual(lines(await ninety.text()).slice(1).map((l) => l.split(",")[5]), ["Tex Town Ltd."]);
    const bogus = await get("?kind=certificates&show=bogus");
    assert.equal(lines(await bogus.text()).length, 4, "anything but a group is the whole list");
  });

  it("an empty list is a header and no rows; either read failing is a 503, not half a list", async () => {
    fake.answers.compliance_expired_certs = list([]);
    fake.answers.compliance_expiring_certs = list([]);
    assert.equal(lines(await (await get("?kind=certificates")).text()).length, 1);
    fake.answers.compliance_expired_certs = down;
    fake.answers.compliance_expiring_certs = list([soon]);
    const res = await get("?kind=certificates");
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "export unavailable" });
    fake.answers.compliance_expired_certs = list([lapsed]);
    fake.answers.compliance_expiring_certs = down;
    assert.equal((await get("?kind=certificates")).status, 503);
  });
});
