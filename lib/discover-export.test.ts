import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { csvContainsContactHeader, csvFilename, runDiscoverExport } from "./discover-export";
import { CSV_CONTACT_HEADERS } from "@/lib/dashboard/build-discover-row";
import { PII_KEYS } from "@/lib/discover-v32-rpc";
import { discoverRowsToCsv } from "./dashboard/build-discover-row";
import type { DiscoverV32Row } from "./discover-v32-rpc";
import { discoverRowHasPii } from "./discover-v32-rpc";

const TODAY = new Date("2026-09-21T00:00:00Z");

/**
 * The RPC's own per-call row ceiling, read out of the migration rather than
 * restated here. The previous version of the paging test hard-coded 100 in its
 * own stub, so it asserted its own premise: drop the SQL clamp to 50 and the
 * loop would stop after one page while the test stayed green.
 */
const RPC_LIMIT_CEILING = (() => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/0104_discover_v32.sql"),
    "utf8",
  );
  const m = sql.match(/least\(\s*coalesce\(\s*p_limit\s*,\s*\d+\s*\)\s*,\s*(\d+)\s*\)/);
  assert.ok(m, "could not read the p_limit ceiling out of 0104");
  return Number(m[1]);
})();

const ROW: DiscoverV32Row = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "aboni-knitwear",
  company_name: "Aboni Knitwear Ltd",
  entity_type: "factory",
  city: "Gazipur",
  district: "Gazipur",
  source_tags: ["BGMEA", "EPB"],
  t13_source_count: 2,
  completeness_pct: 80,
  employees_total: 1200,
  established_date: "2001-01-01",
  principal_products: ["knit"],
  factory_types: [],
  rsc_progress_pct: null,
  parent_group_name: null,
  primary_address: null,
  total_count: 1,
  is_sanctioned: false,
  cert_summary: [],
  hs_codes: ["6105"],
  brand_codes: [],
  registries: ["BGMEA"],
  top_tier: 2,
};

describe("discover CSV export boundary", () => {
  it("401 when the caller is not a buyer or admin", async () => {
    const res = await runDiscoverExport({
      role: null,
      supabase: { rpc: async () => ({ data: [ROW], error: null }) },
      search: "q=knit",
      today: TODAY,
    });
    assert.equal(res.status, 401);
    assert.match(res.body, /unauthorised/);
    assert.doesNotMatch(res.body, /Aboni/);
  });

  it("200 CSV has no contact headers and no @", async () => {
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [ROW], error: null }) },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers["Content-Type"], "text/csv; charset=utf-8");
    assert.match(res.headers["Content-Disposition"] ?? "", /sourcebd-suppliers-2026-09-21\.csv/);
    assert.equal(csvContainsContactHeader(res.body), false);
    assert.doesNotMatch(res.body, /@/);
    assert.match(res.body, /Aboni Knitwear Ltd/);
    assert.match(res.body, /aboni-knitwear/);
  });

  it("pages past the RPC's 100-row ceiling instead of truncating in silence", async () => {
    // The RPC clamps p_limit to 100, so the single call this export used to
    // make could never return the 1,000 rows MAX_ROWS promises. A buyer
    // exporting a 350-supplier search received exactly 100 rows, with no
    // warning, and sourced against them as the whole set. Goes red if the
    // paging loop is removed.
    const TOTAL = 250;
    const all = Array.from({ length: TOTAL }, (_, i) => ({
      ...ROW,
      id: `1111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
      slug: `supplier-${i}`,
      company_name: `Supplier ${i} Ltd`,
      total_count: TOTAL,
    }));
    const seenOffsets: number[] = [];
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (_fn: string, args?: Record<string, unknown>) => {
          const offset = Number(args?.p_offset ?? 0);
          const limit = Math.min(RPC_LIMIT_CEILING, Number(args?.p_limit ?? RPC_LIMIT_CEILING));
          seenOffsets.push(offset);
          return { data: all.slice(offset, offset + limit), error: null };
        },
      },
      search: "q=knit",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    const dataLines = res.body.trim().split(/\r?\n/).slice(1);
    assert.equal(
      dataLines.length,
      TOTAL,
      `exported ${dataLines.length} of ${TOTAL} rows — the rest were dropped silently`,
    );
    assert.match(res.body, /Supplier 249 Ltd/, "the last row of the set must be present");
    assert.ok(seenOffsets.length > 1, `expected several pages, saw offsets ${JSON.stringify(seenOffsets)}`);
  });

  it("a search of exactly the ceiling is complete — not 'the first 1000 of 1000'", async () => {
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (fn: string, args?: Record<string, unknown>) => {
          if (fn !== "discover_suppliers") return { data: [], error: null };
          const offset = Number(args?.p_offset ?? 0);
          const limit = Number(args?.p_limit ?? 100);
          const n = Math.max(0, Math.min(limit, 1000 - offset));
          return { data: Array.from({ length: n }, (_, i) => ({ ...ROW, id: `r${offset + i}`, slug: `s${offset + i}`, total_count: 1000 })), error: null };
        },
      },
      search: "q=knit",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers["X-SourceBD-Rows"], "1000");
    assert.equal(res.headers["X-SourceBD-Truncated"], undefined);
    assert.doesNotMatch(res.headers["Content-Disposition"] ?? "", /first-/);
  });

  it("stops at the documented ceiling rather than pulling the whole database", async () => {
    // The other side of the same loop: paging must terminate.
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (_fn: string, args?: Record<string, unknown>) => {
          const limit = Math.min(RPC_LIMIT_CEILING, Number(args?.p_limit ?? RPC_LIMIT_CEILING));
          return {
            data: Array.from({ length: limit }, (_, i) => ({
              ...ROW,
              slug: `s-${args?.p_offset}-${i}`,
              company_name: `S ${args?.p_offset}-${i}`,
            })),
            error: null,
          };
        },
      },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    const dataLines = res.body.trim().split(/\r?\n/).slice(1);
    assert.equal(dataLines.length, 1000, `expected the 1000-row cap, got ${dataLines.length}`);
  });

  it("the contact-field check knows all four columns, in any shape, by a list of its own", () => {
    // The other checks loop over PII_KEYS itself, so a shorter list passed
    // them by construction. The founder's four, written out here.
    const FOUR = ["contact_name", "contact_role", "email_primary", "phones"];
    assert.deepEqual([...PII_KEYS].sort(), FOUR);
    for (const [key, value] of [
      ["email_primary", "a@b.example"],
      ["phones", ["+8801700000000"]],
      ["contact_name", "Rahim"],
      ["contact_role", "Manager"],
    ] as const) {
      assert.equal(discoverRowHasPii({ ...ROW, [key]: value }), true, `a row carrying ${key} passed`);
    }
  });

  it("refuses a payload that carries an email column", async () => {
    const leaked = { ...ROW, email_primary: "buyer@example.com" };
    assert.equal(discoverRowHasPii(leaked), true);
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [leaked], error: null }) },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 500);
    assert.doesNotMatch(res.body, /@/);
  });

  it("says so in the filename when the result set is larger than the export", async () => {
    // The defect was never the cap — it was giving a buyer 1,000 rows of a
    // 3,481-row search with nothing saying so. Goes red if the notice is
    // dropped, or if `truncated` stops being derived from the real count.
    //
    // The notice is in the filename and the headers, NOT in the body: as a
    // CSV data row it was a phantom 1,001st supplier to anything importing
    // the file, so the body must still be exactly the rows.
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (_fn: string, args?: Record<string, unknown>) => {
          const limit = Math.min(RPC_LIMIT_CEILING, Number(args?.p_limit ?? RPC_LIMIT_CEILING));
          return {
            data: Array.from({ length: limit }, (_, i) => ({
              ...ROW,
              slug: `s-${args?.p_offset}-${i}`,
              company_name: `S ${args?.p_offset}-${i}`,
              total_count: 3481,
            })),
            error: null,
          };
        },
      },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.match(
      res.headers["Content-Disposition"] ?? "",
      /filename="sourcebd-suppliers-\d{4}-\d{2}-\d{2}-first-1000-of-3481\.csv"/,
      `no truncation notice in the filename: ${res.headers["Content-Disposition"]}`,
    );
    assert.equal(res.headers["X-SourceBD-Truncated"], "1");
    assert.equal(res.headers["X-SourceBD-Matched"], "3481");
    // One header line plus exactly the rows — no note row among them.
    const lines = res.body.trim().split(/\r?\n/);
    assert.equal(lines.length, 1001, "the body carries something that is not a supplier");
    assert.doesNotMatch(res.body, /matching suppliers/i, "the notice leaked back into the CSV body");
  });

  it("says so just the same when the count arrives as a string", async () => {
    // `total_count` is a bigint, and PostgREST may send a bigint as a string —
    // `DiscoverV32Row.total_count` is `number | string` for exactly that
    // reason. The filename used to read the column off the rows itself and
    // accept only `typeof === "number"`, so a string total silently dropped
    // the notice, both headers and the "-first-1000-of-3481" from the name.
    // That is the same silence the test above exists to stop, arriving by a
    // different door.
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (_fn: string, args?: Record<string, unknown>) => {
          const limit = Math.min(RPC_LIMIT_CEILING, Number(args?.p_limit ?? RPC_LIMIT_CEILING));
          return {
            data: Array.from({ length: limit }, (_, i) => ({
              ...ROW,
              slug: `s-${args?.p_offset}-${i}`,
              company_name: `S ${args?.p_offset}-${i}`,
              total_count: "3481",
            })),
            error: null,
          };
        },
      },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.match(
      res.headers["Content-Disposition"] ?? "",
      /-first-1000-of-3481\.csv"/,
      `a string total_count lost the truncation notice: ${res.headers["Content-Disposition"]}`,
    );
    assert.equal(res.headers["X-SourceBD-Truncated"], "1");
    assert.equal(res.headers["X-SourceBD-Matched"], "3481");
  });

  it("says so even when the RPC never told us the total", async () => {
    // The last door the silence could come through. If `total_count` is absent
    // or unparseable on every page, `matched` is null and `matched > rows`
    // is false — so a buyer received exactly MAX_ROWS rows of a larger search
    // with nothing in the filename and no headers. Hitting the ceiling IS
    // truncation. The name says "first-1000" with no "of", because the total
    // is genuinely unknown and inventing one would be worse than omitting it.
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (_fn: string, args?: Record<string, unknown>) => {
          const limit = Math.min(RPC_LIMIT_CEILING, Number(args?.p_limit ?? RPC_LIMIT_CEILING));
          return {
            data: Array.from({ length: limit }, (_, i) => {
              const row = { ...ROW, slug: `s-${args?.p_offset}-${i}`, company_name: `S ${args?.p_offset}-${i}` } as Record<string, unknown>;
              delete row.total_count;
              return row;
            }),
            error: null,
          };
        },
      },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.match(
      res.headers["Content-Disposition"] ?? "",
      /-first-1000\.csv"/,
      `hitting the ceiling was not disclosed: ${res.headers["Content-Disposition"]}`,
    );
    assert.equal(res.headers["X-SourceBD-Truncated"], "1");
    assert.equal(res.headers["X-SourceBD-Matched"], undefined, "a total we do not have must not be invented");
    assert.equal(res.body.trim().split(/\r?\n/).length, 1001);
  });

  it("stays silent when the export is the whole result set", async () => {
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [{ ...ROW, total_count: 1 }], error: null }) },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.body, /matching suppliers/i, "a complete export must not claim truncation");
    assert.doesNotMatch(
      res.headers["Content-Disposition"] ?? "",
      /first-\d+-of-\d+/,
      "a complete export must not claim truncation in its filename either",
    );
    assert.equal(res.headers["X-SourceBD-Truncated"], undefined);
  });

  it("refuses a CSV whose header carries a contact column", async () => {
    // A reviewer proved this guard was never exercised: the 500 in the test
    // above comes from the row-shape check upstream, so the header guard could
    // be replaced with `if (false)` and every export test stayed green. This
    // drives it directly.
    const csv = "slug,company_name,email\na,b,c\r\n";
    assert.equal(csvContainsContactHeader(csv), true);
    assert.equal(csvContainsContactHeader("slug,company_name,city\na,b,c\r\n"), false);
  });

  it("no column the export actually emits is a contact column", () => {
    // This is the reachable half of the backstop, and the half that was
    // missing. `runDiscoverExport`'s `csvContainsContactHeader(csv)` branch
    // checks a header the same function just generated from `CSV_COLUMNS`, so
    // it cannot fire — replacing it with `if (false)` leaves every test green,
    // which a reviewer demonstrated. The invariant that CAN fail is the column
    // list itself: the day somebody adds a contact column to `CSV_COLUMNS`,
    // this goes red before the bytes are ever built.
    const header = discoverRowsToCsv([], new Date("2026-09-22T00:00:00Z")).split(/\r?\n/, 1)[0] ?? "";
    assert.ok(header.length > 0, "the export has no header row");
    assert.equal(csvContainsContactHeader(`${header}\r\n`), false, `CSV_COLUMNS carries a contact column: ${header}`);
    for (const key of PII_KEYS) {
      assert.ok(
        !header.split(",").includes(key),
        `${key} is a CSV column; the export carries contact data`,
      );
    }
  });

  it("covers every contact column the brief names, not just the two it was typed with", () => {
    // `CSV_CONTACT_HEADERS` was hand-listed as email/phone/contact/
    // email_primary/phones, so a header literally named `contact_name` or
    // `contact_role` — two of the four PII columns `discoverRowHasPii` knows
    // about — walked past a check whose comment claimed it was the backstop
    // for all four. It is derived from `PII_KEYS` now, so the two lists
    // cannot drift apart again.
    for (const key of PII_KEYS) {
      assert.equal(
        csvContainsContactHeader("slug,company_name," + key + "\na,b,c\r\n"),
        true,
        "the CSV backstop does not recognise " + key + ", which discoverRowHasPii treats as PII",
      );
      assert.ok(
        (CSV_CONTACT_HEADERS as readonly string[]).includes(key),
        key + " is missing from CSV_CONTACT_HEADERS",
      );
    }
    // Still not a substring match: a column that merely contains one of the
    // words is not a contact column.
    assert.equal(csvContainsContactHeader("slug,contact_count,phones_checked\na,b,c\r\n"), false);
  });

  it("does not refuse a legitimate value that merely looks like an address", async () => {
    // The old body-wide "@" scan meant one supplier could deny every buyer
    // this export by putting an address-shaped string in its own company name.
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async () => ({
          data: [{ ...ROW, company_name: "sales@knit Ltd", primary_address: "unit 4, sales@knit.com road" }],
          error: null,
        }),
      },
      search: "",
      today: TODAY,
    });
    assert.equal(res.status, 200, "supplier-controlled text must not be able to break the export");
  });

  it("carries the buyer's filters into the query", async () => {
    // Every other stub here ignores everything but offset and limit, so
    // replacing the parsed state with an empty one — turning the export into
    // the unfiltered top 1,000 suppliers rather than the search on screen —
    // left all of them green.
    const seen: Record<string, unknown>[] = [];
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (_fn: string, args?: Record<string, unknown>) => {
          seen.push(args ?? {});
          return { data: [ROW], error: null };
        },
      },
      search: "?q=knit&hs=6105,6110&cert=gots:valid&reg=BGMEA&sort=name",
      today: TODAY,
    });
    assert.equal(res.status, 200);
    const args = seen[0] ?? {};
    assert.equal(args.p_q, "knit", "the keywords never reached the query");
    assert.deepEqual(args.p_hs_codes, ["6105", "6110"], "the HS filter never reached the query");
    assert.deepEqual(args.p_cert_kinds, ["gots"], "the certificate filter never reached the query");
    assert.equal(args.p_cert_state, "valid");
    assert.deepEqual(args.p_registries, ["BGMEA"], "the register filter never reached the query");
    assert.equal(args.p_sort, "name", "the sort never reached the query");
    assert.equal(args.p_exclude_sanctioned, true, "sanctioned suppliers were not excluded by default");
  });

  it("a selected-rows export re-runs the buyer's own filters, never a bare id lookup", async () => {
    // The `?ids=` path keeps only ids the buyer's own search returns. With the
    // parsed state replaced (an empty search, or sanctioned let in), it could
    // hand back rows the page never showed, and every other ids test stayed
    // green because none looked past offset, limit and sort.
    const seen: Record<string, unknown>[] = [];
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (fn: string, args?: Record<string, unknown>) => {
          if (fn === "discover_suppliers") seen.push(args ?? {});
          return { data: [ROW], error: null };
        },
      },
      search: `?q=knit&hs=6105,6110&cert=gots:valid&reg=BGMEA&sort=name&ids=${ROW.id}`,
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.equal(seen.length, 1);
    const args = seen[0] ?? {};
    assert.equal(args.p_q, "knit");
    assert.deepEqual(args.p_hs_codes, ["6105", "6110"]);
    assert.deepEqual(args.p_cert_kinds, ["gots"]);
    assert.equal(args.p_cert_state, "valid");
    assert.deepEqual(args.p_registries, ["BGMEA"]);
    assert.equal(args.p_exclude_sanctioned, true, "a selected export let sanctioned suppliers in");
  });

  it("503 when the search cannot be read", async () => {
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: null, error: { message: "function not found" } }) },
      search: "q=knit",
      today: TODAY,
    });
    assert.equal(res.status, 503);
    assert.doesNotMatch(res.body, /Aboni/);
  });

  it("the csv builder's header never includes contact fields", () => {
    const csv = discoverRowsToCsv([ROW], TODAY);
    assert.equal(csvContainsContactHeader(csv), false);
    assert.equal(csvFilename(TODAY), "sourcebd-suppliers-2026-09-21.csv");
  });
});

describe("the bulk bar's selected-rows export (?ids=)", () => {
  const OTHER = {
    ...ROW,
    id: "22222222-2222-4222-8222-222222222222",
    slug: "beximco-textiles",
    company_name: "Beximco Textiles Ltd",
  };

  it("an admin may export like a buyer, full and selected", async () => {
    for (const search of ["q=knit", `ids=${ROW.id}`]) {
      const res = await runDiscoverExport({
        role: "admin",
        supabase: { rpc: async () => ({ data: [ROW], error: null }) },
        search,
        today: TODAY,
      });
      assert.equal(res.status, 200, search);
    }
  });

  it("403, not 401, for a signed-in supplier — with or without ids", async () => {
    for (const search of ["q=knit", `ids=${ROW.id}`]) {
      const res = await runDiscoverExport({
        role: "supplier",
        supabase: { rpc: async () => ({ data: [ROW], error: null }) },
        search,
        today: TODAY,
      });
      assert.equal(res.status, 403, search);
      assert.doesNotMatch(res.body, /Aboni/);
    }
  });

  it("re-runs the buyer's own page — its page, per-page and sort — not page one", async () => {
    // A buyer on page 3 of 25-per-page selects rows there. Re-running page 1
    // would drop every one of them and hand back an empty selection.
    const calls: Record<string, unknown>[] = [];
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (fn: string, args?: Record<string, unknown>) => {
          if (fn === "discover_suppliers") calls.push(args ?? {});
          return { data: [ROW], error: null };
        },
      },
      search: `q=knit&sort=name&page=3&per=25&ids=${ROW.id}`,
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.p_offset, 50);
    assert.equal(calls[0]?.p_limit, 25);
    assert.equal(calls[0]?.p_sort, "name");
  });

  it("the selected file carries the same response contract as the full export", async () => {
    const ok = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [ROW], error: null }) },
      search: `ids=${ROW.id}`,
      today: TODAY,
    });
    assert.equal(ok.status, 200);
    assert.match(ok.headers["Content-Type"] ?? "", /^text\/csv/);
    assert.equal(ok.headers["Cache-Control"], "private, no-store");
    const down = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: null, error: { code: "57014", message: "timeout" } }) },
      search: `ids=${ROW.id}`,
      today: TODAY,
    });
    assert.equal(down.status, 503);
    assert.match(down.body, /export unavailable/);
  });

  it("401 when the caller is not a buyer or admin, even with ids present", async () => {
    const res = await runDiscoverExport({
      role: null,
      supabase: { rpc: async () => ({ data: [ROW, OTHER], error: null }) },
      search: `ids=${ROW.id}`,
      today: TODAY,
    });
    assert.equal(res.status, 401);
  });

  it("400 on a malformed id, an empty list, or more ids than one page could ever hold", async () => {
    const stub = { rpc: async () => ({ data: [ROW], error: null }) };
    const notUuid = await runDiscoverExport({ role: "buyer", supabase: stub, search: "ids=not-a-uuid", today: TODAY });
    assert.equal(notUuid.status, 400);
    const empty = await runDiscoverExport({ role: "buyer", supabase: stub, search: "ids=", today: TODAY });
    assert.equal(empty.status, 400);
    // Well-formed ids, and ROW's among them, so the ONLY thing that can make
    // 101 fail where 100 passes is the cap — a malformed fixture once made
    // this case pass on the format check with the cap deleted.
    const validIds = (n: number) => [ROW.id, ...Array.from({ length: n - 1 }, (_, i) => `aaaaaaaa-1111-4111-8111-${String(i).padStart(12, "0")}`)];
    for (const id of validIds(101)) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const hundred = await runDiscoverExport({ role: "buyer", supabase: stub, search: `ids=${validIds(100).join(",")}`, today: TODAY });
    assert.equal(hundred.status, 200, "100 ids is one full page and must be allowed");
    const tooMany = await runDiscoverExport({ role: "buyer", supabase: stub, search: `ids=${validIds(101).join(",")}`, today: TODAY });
    assert.equal(tooMany.status, 400);
  });

  it("an id is matched whatever its case, and a repeated ids= is refused rather than half-read", async () => {
    // Hex LETTERS in the id: ROW.id is all digits, which upper-case to
    // themselves, so a case test built on it could not fail.
    const lettered = { ...ROW, id: "abcdef11-1111-4111-8111-11111111abcd" };
    const stub = { rpc: async () => ({ data: [lettered], error: null }) };
    assert.notEqual(lettered.id.toUpperCase(), lettered.id);
    const upper = await runDiscoverExport({ role: "buyer", supabase: stub, search: `ids=${lettered.id.toUpperCase()}`, today: TODAY });
    assert.equal(upper.status, 200);
    assert.equal(upper.headers["X-SourceBD-Rows"], "1");
    const twice = await runDiscoverExport({
      role: "buyer",
      supabase: stub,
      search: `ids=22222222-2222-4222-8222-222222222222&ids=${ROW.id}`,
      today: TODAY,
    });
    assert.equal(twice.status, 400);
  });

  it("a repeated id is one supplier, not two — the file is not called short", async () => {
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [ROW], error: null }) },
      search: `ids=${ROW.id},${ROW.id}`,
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers["X-SourceBD-Requested"], "1");
    assert.match(res.headers["Content-Disposition"] ?? "", /-selected-1\.csv"/);
  });

  it("a selection that matches nothing on the re-run page is a 409 with a reason, not an empty file", async () => {
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [ROW], error: null }) },
      search: "ids=22222222-2222-4222-8222-222222222222",
      today: TODAY,
    });
    assert.equal(res.status, 409);
    assert.match(res.headers["Content-Type"] ?? "", /application\/json/);
    assert.match(JSON.parse(res.body).error, /reload/);
  });

  it("exports only the selected ids out of the page, not the whole result set", async () => {
    // `fetchDiscoverV32` itself makes two calls per page (`discover_suppliers`
    // then the worker-enrichment batch RPC) — count only the paging RPC, the
    // same one the "pages past the ceiling" test above watches, to assert the
    // real invariant: a selection is bounded by one page.
    let discoverCalls = 0;
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: {
        rpc: async (fn: string) => {
          if (fn === "discover_suppliers") discoverCalls += 1;
          return { data: [ROW, OTHER], error: null };
        },
      },
      search: `q=knit&ids=${OTHER.id}`,
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.equal(discoverCalls, 1, "a selection is bounded by one page — it must not page through the 1000-row loop");
    assert.match(res.body, /Beximco Textiles Ltd/);
    assert.doesNotMatch(res.body, /Aboni Knitwear Ltd/, "an id not in the selection must not appear in its export");
    assert.match(res.headers["Content-Disposition"] ?? "", /-selected-1\.csv"/);
    assert.equal(res.headers["X-SourceBD-Rows"], "1");
  });

  it("an id the reproduced page no longer holds is dropped, not invented — the count says so honestly", async () => {
    // The RPC is re-run with the same filter state to get these rows; it is
    // never a raw id lookup. A selected id that fell off the page between
    // render and export (a stale selection) must not turn into a fabricated
    // row or a crash — just a smaller, honestly-counted export.
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [ROW], error: null }) },
      search: `ids=${ROW.id},${OTHER.id}`,
      today: TODAY,
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers["X-SourceBD-Rows"], "1");
    // Short, and the name the buyer reads first says so.
    assert.match(res.headers["Content-Disposition"] ?? "", /-selected-1-of-2\.csv"/);
    assert.equal(res.headers["X-SourceBD-Requested"], "2");
  });

  it("still refuses a selection whose row carries contact fields", async () => {
    const leaked = { ...ROW, email_primary: "buyer@example.com" };
    const res = await runDiscoverExport({
      role: "buyer",
      supabase: { rpc: async () => ({ data: [leaked], error: null }) },
      search: `ids=${ROW.id}`,
      today: TODAY,
    });
    assert.equal(res.status, 500);
    assert.doesNotMatch(res.body, /@/);
  });
});
