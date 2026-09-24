// The three record routes, at the boundary (closed-loop §14, AGENTS 16).
//
// `components/dashboard/record-sheet.test.ts` proves the sheet component does
// not print a contact value, renders every section and disables Send RFQ on a
// sanctioned record. Nothing proved the ROUTES pass it the right thing — and
// that is the gap REZ-72 shipped through: 361 green tests, every one asserting
// a pure helper, over a route that never emitted the redirect they were about.
// `app/dev/ds/dashboard-screens.test.ts` exists for the same reason one layer
// up, and its header says so.
//
// So this imports the route modules themselves, runs them with a fake Supabase
// client over the production fixtures, and asserts the HTML a browser receives.
//
// What it does NOT cover: the real database. The client here is a stub, so
// these tests say what the routes do with a given payload, not that the RPCs
// return one. That is `ops/plans/rez-c-0105-dry-run.md`'s job.

import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { after, describe, it } from "node:test";
import path from "node:path";

import { aboniInput, sanctionedInput, TODAY } from "@/lib/dashboard/fixtures";

// ---------------------------------------------------------------------------
// A fake `@/lib/supabase/server`, installed into the module cache before the
// routes are imported. The routes reach the database only through it.
// ---------------------------------------------------------------------------

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
const resolved = (mod: string) => require.resolve(path.join(OUT, mod));

type Rpc = { data: unknown; error: unknown };
type Answers = {
  profile?: Rpc;
  hscodes?: Rpc;
  workers?: Rpc;
  contactCounts?: Rpc;
  rfqs?: { data: unknown; error: unknown; count: number | null };
  saved?: { data: unknown };
  userId?: string | null;
  discover?: Rpc;
};

/** Every `.from(...)` call the routes make, so a test can assert the filters. */
type FromCall = { table: string; filters: { op: string; args: unknown[] }[] };
let fromCalls: FromCall[] = [];

/**
 * ONE stub, installed once, reading a mutable `answers`.
 *
 * Re-installing per test does not work: a route module captures
 * `createSupabaseServerClient` when it is first required, so every later
 * `require.cache` swap is invisible to it — and the whole file then silently
 * ran against the first test's payload.
 */
let answers: Answers = {};

function fakeClient() {
  const rpc = (fn: string): Rpc => {
    if (fn === "buyer_supplier_profile") return answers.profile ?? { data: null, error: null };
    if (fn === "supplier_epb_hscodes") return answers.hscodes ?? { data: [], error: null };
    if (fn === "supplier_contact_counts") return answers.contactCounts ?? { data: null, error: null };
    if (fn === "production_workers_display_batch") return answers.workers ?? { data: [], error: null };
    if (fn === "discover_suppliers") return answers.discover ?? { data: [], error: null };
    if (fn === "supplier_epb_hscodes_batch") return { data: [], error: null };
    return { data: null, error: null };
  };
  return {
    rpc: async (fn: string) => rpc(fn),
    auth: { getUser: async () => ({ data: { user: answers.userId === null ? null : { id: answers.userId ?? "buyer-1" } } }) },
    from(table: string) {
      const call: FromCall = { table, filters: [] };
      fromCalls.push(call);
      const result = () =>
        table === "rfqs"
          ? Promise.resolve(answers.rfqs ?? { data: [], error: null, count: 0 })
          : Promise.resolve({ data: [], error: null, count: 0 });
      const chain = {
        select: (_cols?: string, _opts?: unknown) => chain,
        eq: (...args: unknown[]) => (call.filters.push({ op: "eq", args }), chain),
        in: (...args: unknown[]) => (call.filters.push({ op: "in", args }), chain),
        contains: (...args: unknown[]) => (call.filters.push({ op: "contains", args }), chain),
        order: () => chain,
        limit: () => result(),
        maybeSingle: () => Promise.resolve(answers.saved ?? { data: null }),
        then: (res: (v: unknown) => unknown) => result().then(res),
      };
      return chain;
    },
  };
}

/** Set the payloads for one test. */
function given(a: Answers): void {
  fromCalls = [];
  answers = a;
}

{
  // `next/navigation`'s CLIENT hooks need a mounted App Router, which
  // `renderToStaticMarkup` does not provide — `SelectionBar` calls `useRouter`.
  // The SERVER halves must keep their real behaviour: `notFound()` and
  // `redirect()` throw, and three of these tests are about exactly which one a
  // route reaches. So the real module is kept and only the hooks are replaced.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must exist before any route loads.
  const navId = require.resolve("next/navigation");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const realNav = require("next/navigation");
  require.cache[navId] = {
    id: navId,
    filename: navId,
    loaded: true,
    children: [],
    paths: [],
    exports: {
      ...realNav,
      useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
      useSearchParams: () => new URLSearchParams(),
      usePathname: () => "/app/discover",
      useParams: () => ({}),
    },
  } as unknown as NodeJS.Module;
}

{
  const client = fakeClient();
  for (const [mod, exports] of [
    ["lib/supabase/server.js", { createSupabaseServerClient: async () => client }],
    [
      "lib/dashboard/load-buyer-shell.js",
      {
        // The real shell reads `buyer_dashboard` and `settings_get`; these
        // routes are not what that is about, so it is stubbed with a valid
        // `SidebarModel`/`TopbarModel` and nothing more.
        loadBuyerShell: async () => ({
          sidebar: {
            active: "suppliers" as const,
            activeExact: false,
            counts: { suppliers: null, rfqs: null, saved: null },
            recent: [],
            plan: { name: "Free · public beta", note: null, used: null, allowance: null },
          },
          topbar: { caption: "", searchQuery: "" },
        }),
      },
    ],
  ] as const) {
    const id = resolved(mod);
    require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [] } as unknown as NodeJS.Module;
  }
}

after(() => {
  for (const mod of ["lib/supabase/server.js", "lib/dashboard/load-buyer-shell.js"]) delete require.cache[resolved(mod)];
});

/** `notFound()` and `redirect()` throw; this names which one a route reached. */
async function outcome(run: () => Promise<ReactElement>): Promise<{ html: string } | { threw: string }> {
  try {
    return { html: renderToStaticMarkup(await run()) };
  } catch (err) {
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string") return { threw: digest };
    throw err;
  }
}

const html = (r: { html: string } | { threw: string }): string => {
  assert.ok("html" in r, `the route did not render; it threw ${"threw" in r ? r.threw : "?"}`);
  return r.html;
};

const ABONI = aboniInput();
const PROFILE: Rpc = { data: ABONI.profile, error: null };
const HS: Rpc = { data: ABONI.hscodes.map((h) => ({ code: h.code, description: h.description, source_url: h.source_url })), error: null };

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(resolved(p));

describe("/app/suppliers/[slug] — the full record page", () => {
  it("renders the record, and is not a dialog", async () => {
    given({ profile: PROFILE, hscodes: HS, contactCounts: { data: { emails: 1, phones: 6, website: true, representatives: 1 }, error: null } });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) })));

    assert.match(out, /aria-label="Supplier record"/);
    // `dialog={false}`: a whole page is not a dialog, and there is nothing
    // behind it to close. Only the route passes this, so only a route test
    // can catch it being dropped.
    assert.doesNotMatch(out, /role="dialog"/, "the full record page announces itself as a dialog");
    assert.doesNotMatch(out, /aria-label="Close"/, "the full page draws a Close with nothing to close");
    assert.match(out, /Aboni Knitwear Ltd/);
  });

  it("the counts reach the locked card and no contact value reaches the HTML", async () => {
    // The component-level guard proves the sheet would not print a value it was
    // given. This proves the ROUTE does not hand it one — the leak the deleted
    // admin unlock would have reintroduced.
    given({
      profile: PROFILE,
      hscodes: HS,
      contactCounts: { data: { emails: 1, phones: 6, website: true, representatives: 2 }, error: null },
    });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) })));
    assert.match(out, /On file: 1 email · 6 phone numbers · a website · 2 named representatives\./);
    for (const key of ["email_primary", "contact_name", "contact_role", "phones"]) {
      assert.ok(!out.includes(key), `the route put the ${key} column in the HTML`);
    }
  });

  it("a slow read says so; it does not answer not-found", async () => {
    // A statement timeout is not a missing record. Returning 404 for a busy
    // database tells the buyer the company is not on SourceBD.
    given({ profile: { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } } });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) })));
    assert.match(out, /could not be read in time/);
    assert.match(out, /Try again/);
  });

  it("?lines=all expands the grid past six tiles", async () => {
    given({ profile: PROFILE, hscodes: HS });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const six = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) })));
    const all = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({ lines: "all" }) })));
    const tiles = (s: string) => (s.match(/\/app\/suppliers\/aboni-knitwear\/lines\/\d{4}/g) ?? []).length;
    assert.equal(tiles(six), 6, "the grid shows six tiles by default");
    assert.ok(tiles(all) > 6, `?lines=all still shows only ${tiles(all)} of the record's lines`);
    // And the six-tile view offers the way to the rest.
    assert.match(six, /All \d+ lines/);
    assert.ok(six.includes("?lines=all"), "the six-tile view has no route to the other lines");
  });
});

describe("/app/suppliers/[slug]/lines/[hs] — the line page", () => {
  const run = (hs: string) => {
    given({ profile: PROFILE, hscodes: HS });
    const Page = route("app/(app)/app/suppliers/[slug]/lines/[hs]/page.js").default;
    return outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear", hs }) }));
  };

  it("renders a 4-digit heading", async () => {
    const out = html(await run("6105"));
    assert.match(out, /aria-label="Product line"/);
    assert.match(out, /HS 6105/);
    assert.doesNotMatch(out, /role="dialog"/, "the full line page is not a dialog");
  });

  for (const bad of ["abcd", "61", "61059", "%", "6105a", ""]) {
    it(`refuses ${JSON.stringify(bad)} rather than inventing a line`, async () => {
      const r = await run(bad);
      assert.ok("threw" in r, `/lines/${bad} rendered a product sheet`);
      // NEXT_HTTP_ERROR_FALLBACK;404 in Next 15; NOT_FOUND in older digests.
      assert.match(r.threw, /NOT_FOUND|404/, `/lines/${bad} failed with ${r.threw} instead of not-found`);
    });
  }
});

describe("/app/discover?record= — the overlay over the results", () => {
  /** One real-shaped result row, so the page renders cards to click. */
  const ROW = {
    id: "8ce50581-2d84-4cc2-93aa-000000000001",
    slug: "aboni-knitwear",
    company_name: "ABONI KNITWEAR LTD.",
    entity_type: "factory",
    city: "Dhaka",
    district: "Dhaka",
    source_tags: ["BGMEA"],
    t13_source_count: 1,
    completeness_pct: 50,
    employees_total: 3166,
    established_date: "1985-01-01",
    principal_products: [],
    factory_types: [],
    rsc_progress_pct: null,
    parent_group_name: null,
    primary_address: null,
    total_count: 1,
    is_sanctioned: false,
    cert_summary: null,
    hs_codes: ["6105"],
    brand_codes: [],
    registries: [],
  };

  const discover = (sp: Record<string, string>) => {
    given({
      profile: PROFILE,
      hscodes: HS,
      discover: { data: [ROW], error: null },
      contactCounts: { data: { emails: 1, phones: 6, website: true, representatives: 1 }, error: null },
    });
    const Page = route("app/(app)/app/discover/page.js").default;
    return outcome(() => Page({ searchParams: Promise.resolve(sp) }));
  };

  it("no ?record= renders no sheet at all", async () => {
    const out = html(await discover({ q: "knit" }));
    assert.doesNotMatch(out, /aria-label="Supplier record"/);
    assert.doesNotMatch(out, /role="dialog"/);
  });

  it("?record= opens the sheet and Close returns to the same search", async () => {
    const out = html(await discover({ q: "knit", page: "2", sort: "workers" }));
    assert.doesNotMatch(out, /aria-label="Supplier record"/, "guard: this call carries no record");

    const withRecord = html(await discover({ q: "knit", page: "2", sort: "workers", record: "aboni-knitwear" }));
    assert.match(withRecord, /aria-label="Supplier record"/);
    assert.match(withRecord, /role="dialog"/);
    // The whole of the founder's sentence: the search is still there to go back
    // to. A Close that dropped `q` or `page` would lose it just as surely as a
    // full reload does.
    const close = /aria-label="Close"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*aria-label="Close"/.exec(withRecord);
    assert.ok(close, "the overlay draws no Close");
    const href = close[1] ?? close[2]!;
    assert.match(href, /q=knit/);
    assert.match(href, /page=2/);
    assert.match(href, /sort=workers/);
    assert.ok(!href.includes("record="), `Close keeps the record open: ${href}`);
  });

  it("the results behind an open record are inert", async () => {
    // `aria-modal="true"` asserts the rest of the page is unavailable. It has
    // to be true of the keyboard and the accessibility tree, not just of the
    // pointer — the failure `Stage`'s own comment records from cycle 19.
    const out = html(await discover({ q: "knit", record: "aboni-knitwear" }));
    assert.match(out, /aria-modal="true"/);
    assert.match(out, /<div inert(?:=""|\s|>)/, "the results are focusable behind a dialog that says they are not");
  });

  it("an unknown record leaves the results standing", async () => {
    given({ profile: { data: null, error: null }, hscodes: HS, discover: { data: [ROW], error: null } });
    const Page = route("app/(app)/app/discover/page.js").default;
    const out = html(await outcome(() => Page({ searchParams: Promise.resolve({ q: "knit", record: "no-such-slug" }) })));
    assert.doesNotMatch(out, /aria-label="Supplier record"/);
    assert.doesNotMatch(out, /inert/, "nothing is open, so nothing behind it is inert");
  });

  it("a line drilled into from the overlay keeps the search behind it", async () => {
    const out = html(await discover({ q: "knit", record: "aboni-knitwear", line: "6105" }));
    assert.match(out, /aria-label="Product line"/);
    assert.doesNotMatch(out, /aria-label="Supplier record"/, "two dialogs at once");
    // Back goes to the record ON THIS SEARCH, not to its full page.
    const back = /aria-label="Back to the record"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*aria-label="Back to the record"/.exec(out);
    assert.ok(back, "the line sheet draws no Back");
    const href = back[1] ?? back[2]!;
    assert.match(href, /q=knit/, `Back throws the search away: ${href}`);
    assert.match(href, /record=aboni-knitwear/);
  });

  it("the record's tiles open the line on this search, not on its own page", async () => {
    const out = html(await discover({ q: "knit", record: "aboni-knitwear" }));
    assert.ok(!out.includes("/app/suppliers/aboni-knitwear/lines/"), "a tile leaves the search");
    assert.match(out, /line=\d{4}/);
  });

  it("cards and rows open the record over these results", async () => {
    // `recordHref` is threaded from the page into the row builders; nothing
    // else passes it, so dropping it here is invisible to every other test
    // while it silently restores the full-page navigation.
    const out = html(await discover({ q: "knit" }));
    assert.ok(out.includes("record="), "no result opens the record as an overlay");
  });
});

describe("the RFQs section is the caller's own", () => {
  it("the query filters on buyer_id, not on RLS alone", async () => {
    // `public.rfqs` carries a SECOND permissive SELECT policy for a caller who
    // has claimed the supplier, so RLS alone would show other buyers' RFQs
    // under "N from your account". Hiding that behind role middleware is not a
    // control (AGENTS 7).
    given({
      profile: PROFILE,
      hscodes: HS,
      userId: "buyer-42",
      rfqs: { data: [], error: null, count: 0 },
    });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) })));

    const rfqRead = fromCalls.find((c) => c.table === "rfqs");
    assert.ok(rfqRead, "the record page never reads rfqs");
    const eqs = rfqRead.filters.filter((f) => f.op === "eq");
    assert.ok(
      eqs.some((f) => f.args[0] === "buyer_id" && f.args[1] === "buyer-42"),
      `the RFQs read is not scoped to the caller: ${JSON.stringify(rfqRead.filters)}`,
    );
    assert.ok(
      rfqRead.filters.some((f) => f.op === "contains" && f.args[0] === "target_supplier_ids"),
      "the RFQs read is not scoped to this supplier",
    );
  });

  it("the caption is the real total, not the page size", async () => {
    given({
      profile: PROFILE,
      hscodes: HS,
      userId: "buyer-42",
      rfqs: {
        data: Array.from({ length: 20 }, (_, i) => ({
          id: `r${i}`,
          product_title: `RFQ ${i}`,
          quantity: 10,
          quantity_unit: "pcs",
          ship_by: null,
          status: "open",
          created_at: TODAY.toISOString(),
        })),
        error: null,
        count: 37,
      },
    });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) })));
    assert.match(out, /37 from your account/, "a page size is being printed as a total");
    assert.doesNotMatch(out, /20 from your account/);
  });

  it("a failed read claims no count at all", async () => {
    given({ profile: PROFILE, hscodes: HS, userId: "buyer-42", rfqs: { data: null, error: { message: "boom" }, count: null } });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) })));
    assert.match(out, /Your RFQs could not be read\./);
    assert.doesNotMatch(out, /from your account/);
    assert.doesNotMatch(out, /have not sent this supplier an RFQ/);
  });
});

describe("the sanctioned record, through the route", () => {
  it("the banner is served, points at its evidence, and Send RFQ is not a link", async () => {
    const s = sanctionedInput();
    given({ profile: { data: s.profile, error: null }, hscodes: { data: [], error: null } });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "zaheen" }), searchParams: Promise.resolve({}) })));
    assert.match(out, /data-sanction-visible="true"/);
    assert.match(out, /See the matches/);
    assert.match(out, /id="sanctions"/);
    assert.ok(!out.includes('href="/app/rfqs/new'), "a sanctioned record's Send RFQ is a live link");
  });
});
