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

import { aboniInput, sanctionedInput, TODAY, zaheenSampleInput } from "@/lib/dashboard/fixtures";

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
  facilityParent?: Rpc;
  /** What `.from(table)` answers, for tables other than `rfqs`. */
  tables?: Record<string, unknown[]>;
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
    if (fn === "facility_parent_slug") return answers.facilityParent ?? { data: null, error: null };
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
          : Promise.resolve({ data: answers.tables?.[table] ?? [], error: null, count: answers.tables?.[table]?.length ?? 0 });
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
    return outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear", hs }), searchParams: Promise.resolve({}) }));
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

  it("the WHOLE shell behind an open record is inert, and the dialog is not", async () => {
    // `aria-modal="true"` asserts the rest of the page is unavailable, and that
    // has to be true of the keyboard and the accessibility tree, not only the
    // pointer. Two ways this went wrong, both caught by critics:
    //
    //  * inerting only the RESULTS left the skip link, ten sidebar links, the
    //    topbar search field and the account link outside the boundary and
    //    ahead of the dialog in the tab order — ⌘K reached the search field
    //    from behind the scrim;
    //  * the sheet must NOT be inside the boundary, or the dialog declares
    //    everything else unavailable and is unavailable itself.
    const out = html(await discover({ q: "knit", record: "aboni-knitwear" }));
    assert.match(out, /aria-modal="true"/);

    const inertAt = out.search(/<div[^>]*\sinert=""/);
    assert.ok(inertAt > -1, "nothing behind the dialog is inert");
    // The shell's own chrome is inside it.
    for (const [what, needle] of [
      ["the skip link", "Skip to content"],
      // The label carries the screen name too ("Primary, Search"), so this is
      // a prefix.
      ["the primary nav", 'aria-label="Primary'],
      ["the content landmark", 'id="main-content"'],
    ] as const) {
      const at = out.indexOf(needle);
      assert.ok(at > inertAt, `${what} is outside the inert boundary, in front of a dialog that says it does not exist`);
    }
    // And the dialog itself is after the inert subtree closes, not within it.
    assert.ok(out.indexOf('role="dialog"') > inertAt, "guard: the dialog should come last");
    assert.ok(
      out.indexOf('aria-label="Supplier record"') > out.lastIndexOf("</main>"),
      "the sheet is inside the shell, so `inert` makes the dialog itself unavailable",
    );
  });

  it("no record open means nothing is inert", async () => {
    // Without this the assertion above passes on a page that is always inert.
    const out = html(await discover({ q: "knit" }));
    assert.doesNotMatch(out, /<div[^>]*\sinert=""/);
  });

  it("an unknown record says so rather than showing nothing", async () => {
    // Rendering nothing left `?record=<slug>` in the URL with no sheet and no
    // message, so a buyer who clicked a result and got silence could not tell
    // a slow read from a wrong link.
    given({ profile: { data: null, error: null }, hscodes: HS, discover: { data: [ROW], error: null } });
    const Page = route("app/(app)/app/discover/page.js").default;
    const out = html(await outcome(() => Page({ searchParams: Promise.resolve({ q: "knit", record: "no-such-slug" }) })));
    assert.match(out, /No record for that link/);
    assert.match(out, /Your search is still here behind this/);
    // The results are still rendered behind it.
    assert.match(out, /Aboni Knitwear Ltd/);
  });

  it("a slow read in the overlay offers a retry, not silence", async () => {
    given({
      profile: { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } },
      hscodes: HS,
      discover: { data: [ROW], error: null },
    });
    const Page = route("app/(app)/app/discover/page.js").default;
    const out = html(await outcome(() => Page({ searchParams: Promise.resolve({ q: "knit", record: "aboni-knitwear" }) })));
    assert.match(out, /could not be read in time/);
    assert.match(out, /Try again/);
    assert.doesNotMatch(out, /No record for that link/, "a timeout is not a missing record");
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

describe("cycle 3: the boundaries the first route tests did not reach", () => {
  const ROW = {
    id: "8ce50581-2d84-4cc2-93aa-000000000001",
    slug: "aboni-knitwear",
    company_name: "ABONI KNITWEAR LTD.",
    entity_type: "factory",
    city: "Dhaka",
    district: "Dhaka",
    source_tags: ["BGMEA", "EPB"],
    t13_source_count: 2,
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
  const fullPage = (slug: string, sp: Record<string, string> = {}) => {
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    return outcome(() => Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(sp) }));
  };
  const overlay = (sp: Record<string, string>) => {
    const Page = route("app/(app)/app/discover/page.js").default;
    return outcome(() => Page({ searchParams: Promise.resolve(sp) }));
  };

  it("a contact value filed inside an address, or sitting in the suppliers table, never reaches the full page", async () => {
    // The registers write phone numbers and e-mails into address text (25
    // published records; five print the exact gated number). The earlier test
    // used a record whose addresses are clean, so it passed with the leak live.
    const z = zaheenSampleInput();
    const phone = z.leaked.phones[0]!;
    const profile = {
      ...z.profile,
      supplier: { ...z.profile.supplier, address_raw: `Plot 5, Road 2, Dhaka Tel: ${phone}` },
      addresses: [
        { kind: "factory", address: `Plot 5, Road 2, Dhaka Tel: ${phone}`, source_code: "BGMEA", fetched_at: "2026-09-01T00:00:00Z" },
        {
          kind: "office",
          address: `House 9, Gulshan, Dhaka, Email: ${z.leaked.email_primary}, Web: ${z.leaked.website}`,
          source_code: "BKMEA",
          fetched_at: "2026-09-01T00:00:00Z",
        },
      ],
    };
    given({
      profile: { data: profile, error: null },
      hscodes: { data: [], error: null },
      contactCounts: { data: { emails: 1, phones: 1, website: true, representatives: 1 }, error: null },
      // Anything that read the gated columns directly would find them here.
      tables: {
        suppliers: [
          {
            email_primary: z.leaked.email_primary,
            phones: z.leaked.phones,
            contact_name: z.leaked.contact_name,
            contact_role: z.leaked.contact_role,
            website: z.leaked.website,
          },
        ],
      },
    });
    const out = html(await fullPage("zaheen"));
    assert.match(out, /Plot 5, Road 2, Dhaka/, "guard: the address itself should still render");
    for (const value of [phone, "1700 000000", z.leaked.email_primary, z.leaked.website, z.leaked.contact_name, z.leaked.contact_role]) {
      assert.ok(!out.includes(value), `a contact value reached the full record page: ${value}`);
    }
  });

  it("a building's slug 308s to its company's record on the full page", async () => {
    given({ profile: { data: null, error: null }, facilityParent: { data: "aboni-knitwear", error: null } });
    const r = await fullPage("aboni-knitwear-unit-2");
    assert.ok("threw" in r, "a building's slug rendered instead of redirecting");
    assert.match(r.threw, /NEXT_REDIRECT/);
    assert.match(r.threw, /;308;?/, `not a permanent redirect: ${r.threw}`);
    assert.match(r.threw, /\/app\/suppliers\/aboni-knitwear(?:;|$)/, `redirects somewhere else: ${r.threw}`);
  });

  it("a building's slug in the overlay offers its company's record, on the same search, over an inert shell", async () => {
    // The result behind the notice is a DIFFERENT company: with the mother's
    // own row in the results, its card's link satisfied this test even with
    // the notice's link deleted (cycle 4). And the search is scoped to the dialog.
    given({
      profile: { data: null, error: null },
      facilityParent: { data: "aboni-knitwear", error: null },
      discover: { data: [{ ...ROW, slug: "other-factory", company_name: "OTHER FACTORY LTD." }], error: null },
    });
    const out = html(await overlay({ q: "knit", record: "aboni-knitwear-unit-2" }));
    assert.match(out, /That is a building, not a company record/);
    const at = out.indexOf('role="dialog"');
    assert.doesNotMatch(out.slice(0, at), /record=aboni-knitwear(?:&|")/, "guard: the results must not link the mother themselves");
    const hrefs = [...out.slice(at).matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
    const open = hrefs.find((h) => /[?&]record=aboni-knitwear(?:&|$)/.test(h));
    assert.ok(open, "the notice does not link to the company's record");
    assert.match(open, /q=knit/, `the company's record leaves the search: ${open}`);
    assert.match(out, /<div[^>]*\sinert=""/, "a notice claims aria-modal while the shell behind it stays live");
  });

  it("an unknown slug's notice inerts the shell too, and claims no cause it cannot know", async () => {
    given({ profile: { data: null, error: null }, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit", record: "no-such-slug" }));
    assert.match(out, /aria-modal="true"/);
    assert.match(out, /<div[^>]*\sinert=""/);
    assert.match(out, /could not be read just now/, "a failed read is presented as certainly unpublished");
  });

  it("a result's tile sub-lines open the record over the same search, at their section", async () => {
    given({ profile: PROFILE, hscodes: HS, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit" }));
    const tiles = [...out.matchAll(/href="([^"]*#(?:products|sources|certificates))"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
    assert.ok(tiles.length > 0, "guard: the card drew no tile sub-line links");
    for (const href of tiles) {
      assert.match(href, /record=aboni-knitwear/, `a tile sub-line leaves the overlay: ${href}`);
      assert.match(href, /q=knit/, `a tile sub-line throws the search away: ${href}`);
    }
  });

  it("a sanctioned record opened over the results carries the banner above every section", async () => {
    const s = sanctionedInput();
    given({ profile: { data: s.profile, error: null }, hscodes: { data: [], error: null }, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit", record: "zaheen" }));
    const banner = out.indexOf('data-sanction-visible="true"');
    assert.ok(banner > -1, "the overlay serves a sanctioned record with no banner");
    for (const id of ["overview", "products", "certificates", "safety", "sources", "locations", "facilities", "rfqs"]) {
      const at = out.indexOf(`id="${id}"`);
      assert.ok(at > banner, `the ${id} section is missing or above the banner`);
    }
    // The results behind it carry their own (unsanctioned) Send RFQ; only the sheet is this record's.
    const sheet = out.slice(out.indexOf('aria-label="Supplier record"'));
    assert.ok(!sheet.includes('href="/app/rfqs/new'), "a sanctioned record's Send RFQ is a live link in the overlay");
  });

  it("?lines=all survives into a line and back out of it", async () => {
    given({ profile: PROFILE, hscodes: HS, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit", record: "aboni-knitwear", line: "6105", lines: "all" }));
    const back = /aria-label="Back to the record"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*aria-label="Back to the record"/.exec(out);
    assert.ok(back, "the line sheet draws no Back");
    assert.match(back[1] ?? back[2]!, /lines=all/, "Back from a line returns to six tiles, not the list the buyer came from");
  });

  for (const hs of ["0000", "9999"]) {
    it(`/lines/${hs} is not a heading, so it is not a line`, async () => {
      given({ profile: PROFILE, hscodes: HS });
      const Page = route("app/(app)/app/suppliers/[slug]/lines/[hs]/page.js").default;
      const r = await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear", hs }), searchParams: Promise.resolve({}) }));
      assert.ok("threw" in r && /NOT_FOUND|404/.test(r.threw), `/lines/${hs} rendered a product sheet`);
    });
  }

  it("a line whose EPB read failed says so; it never says the line is off the EPB page", async () => {
    given({ profile: PROFILE, hscodes: { data: null, error: { message: "boom" } } });
    const Page = route("app/(app)/app/suppliers/[slug]/lines/[hs]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear", hs: "6105" }), searchParams: Promise.resolve({}) })));
    assert.match(out, /EPB lines could not be read/);
    // Both wordings the sheet has for "not on EPB": the eyebrow's and the Exporter page row's.
    assert.doesNotMatch(out, /not on (?:this|the) record(?:&#x27;|')s EPB page/);
    assert.doesNotMatch(out, /EPB checked/);
    assert.match(out, /Exporter page[\s\S]*?Could not be read/, "the Exporter page row does not say it could not be read");
  });
});

describe("cycle 4: the boundaries cycle 4 found open", () => {
  const ROW = {
    id: "8ce50581-2d84-4cc2-93aa-000000000001",
    slug: "aboni-knitwear",
    company_name: "ABONI KNITWEAR LTD.",
    entity_type: "factory",
    city: "Dhaka",
    district: "Dhaka",
    source_tags: ["BGMEA", "EPB"],
    t13_source_count: 2,
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
  const fullPage = (slug: string, sp: Record<string, string> = {}) => {
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    return outcome(() => Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(sp) }));
  };
  const linePage = (hs: string, sp: Record<string, string> = {}) => {
    const Page = route("app/(app)/app/suppliers/[slug]/lines/[hs]/page.js").default;
    return outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear", hs }), searchParams: Promise.resolve(sp) }));
  };
  const overlay = (sp: Record<string, string>) => {
    const Page = route("app/(app)/app/discover/page.js").default;
    return outcome(() => Page({ searchParams: Promise.resolve(sp) }));
  };
  const hrefsIn = (s: string) => [...s.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));

  it("a contact value filed as a principal product never reaches the full page, the overlay or the line page", async () => {
    // Live on 25 Sep: `shanghai-deck-lace-bd` files its gated website as its
    // only principal product. Earlier tests planted contact values in
    // addresses only, and passed with this leak live.
    const profile = {
      ...ABONI.profile,
      supplier: { ...ABONI.profile.supplier, principal_products: ["shdeck.com", "Polo Shirt", "POLO SHIRT", "01711-528388"] },
    };
    given({ profile: { data: profile, error: null }, hscodes: HS, discover: { data: [ROW], error: null } });
    const pages = {
      full: html(await fullPage("aboni-knitwear")),
      overlay: html(await overlay({ q: "knit", record: "aboni-knitwear" })),
      line: html(await linePage("6105")),
    };
    for (const [where, out] of Object.entries(pages)) {
      for (const value of ["shdeck.com", "01711-528388", "528388"]) {
        assert.ok(!out.includes(value), `a contact value filed as a product reached the ${where} page: ${value}`);
      }
    }
    // What is left is the real products, as filed; the count says the same.
    const list = /data-product-list="true"[^>]*>([\s\S]*?)<\/ul>/.exec(pages.full);
    assert.ok(list, "guard: the full page draws the product list");
    assert.equal((list[1]!.match(/<li/g) ?? []).length, 2, `the product list: ${list[1]}`);
    assert.match(pages.full, /Product list<\/span><span[^>]*>2<\/span>/, "the Products stat counts a contact value as a product");
  });

  it("?lines=all rides INTO a line from the overlay, not only back out", async () => {
    given({ profile: PROFILE, hscodes: HS, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit", record: "aboni-knitwear", lines: "all" }));
    const lineLinks = hrefsIn(out.slice(out.indexOf('role="dialog"'))).filter((h) => /[?&]line=\d{4}/.test(h));
    assert.ok(lineLinks.length > 6, `guard: the expanded grid drew ${lineLinks.length} line links`);
    for (const h of lineLinks) assert.match(h, /lines=all/, `a line opened from "All lines" forgets it: ${h}`);
  });

  it("?lines=all rides into a line and back on the full page too", async () => {
    given({ profile: PROFILE, hscodes: HS });
    const out = html(await fullPage("aboni-knitwear", { lines: "all" }));
    const tiles = hrefsIn(out).filter((h) => /\/lines\/\d{4}/.test(h));
    assert.ok(tiles.length > 6, `guard: ${tiles.length} tiles`);
    for (const h of tiles) assert.match(h, /\?lines=all$/, `a tile of the expanded grid forgets it: ${h}`);
    given({ profile: PROFILE, hscodes: HS });
    assert.ok(hrefsIn(html(await linePage("6105", { lines: "all" }))).includes("/app/suppliers/aboni-knitwear?lines=all"), "Back from a line returns to six tiles");
    given({ profile: PROFILE, hscodes: HS });
    assert.ok(hrefsIn(html(await linePage("6105"))).includes("/app/suppliers/aboni-knitwear"), "Back from a line opened from six tiles");
  });

  it("a line outside the catalogue renders when the EPB read failed; four digits outside any HS chapter still do not", async () => {
    given({ profile: PROFILE, hscodes: { data: null, error: { message: "boom" } } });
    const out = html(await linePage("3923"));
    assert.match(out, /HS 3923/);
    assert.match(out, /EPB lines could not be read/);
    for (const bad of ["0000", "9999"]) {
      given({ profile: PROFILE, hscodes: { data: null, error: { message: "boom" } } });
      const r = await linePage(bad);
      assert.ok("threw" in r && /NOT_FOUND|404/.test(r.threw), `/lines/${bad} rendered while the EPB read had failed`);
    }
    // With the read working, a heading neither in the catalogue nor on the record's page is not a line.
    given({ profile: PROFILE, hscodes: HS });
    const r = await linePage("3923");
    assert.ok("threw" in r && /NOT_FOUND|404/.test(r.threw), "/lines/3923 rendered for a record that does not export it");
  });

  it("a sanctioned record's contact card does not offer an RFQ", async () => {
    const s = sanctionedInput();
    given({ profile: { data: s.profile, error: null }, hscodes: { data: [], error: null } });
    const out = html(await fullPage("zaheen"));
    const at = out.indexOf('data-locked="true"');
    assert.ok(at > -1, "guard: the contact card is drawn");
    const card = out.slice(at, at + 2000);
    assert.doesNotMatch(card, /Send an RFQ/, "the contact card offers an RFQ the record cannot take");
    assert.match(card, /RFQs cannot be sent to this supplier/);
    given({ profile: PROFILE, hscodes: HS });
    assert.match(html(await fullPage("aboni-knitwear")), /Send an RFQ from the record instead/);
  });

  it("the line sheet's price row says Not attested", async () => {
    given({ profile: PROFILE, hscodes: HS });
    const out = html(await linePage("6105"));
    assert.match(out, /Price · MOQ · lead time[\s\S]*?Not attested/);
  });

  it("an overlay record read that fails for another reason keeps the search and blames no load", async () => {
    given({ profile: { data: null, error: { code: "XX000", message: "boom" } }, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit", record: "aboni-knitwear" }));
    assert.match(out, /aria-modal="true"/, "the failure is silent");
    assert.match(out, /could not be read just now/);
    assert.doesNotMatch(out, /under load/, "a non-timeout failure is reported as the database being busy");
    assert.ok(out.includes("ABONI KNITWEAR") || out.includes("Aboni Knitwear"), "the search behind the sheet is gone");
  });
});

