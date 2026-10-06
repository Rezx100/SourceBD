// The three record routes, at the boundary (closed-loop §14, AGENTS 16).
//
// `components/record/record.test.ts` proves the record view does
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
import { prerenderToNodeStream } from "react-dom/static";
import { after, describe, it } from "node:test";
import path from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

import { aboniInput, sanctionedInput, TODAY, zaheenSampleInput } from "@/lib/dashboard/fixtures";

// ---------------------------------------------------------------------------
// A fake `@/lib/supabase/server`, installed into the module cache before the
// routes are imported. The routes reach the database only through it.
// ---------------------------------------------------------------------------

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
const resolved = (mod: string) => require.resolve(path.join(OUT, mod));

type Rpc = { data: unknown; error: unknown };
type Answers = {
  /** A function answers each call in turn, so a test can count the reads. */
  profile?: Rpc | (() => Rpc);
  hscodes?: Rpc;
  workers?: Rpc;
  contactCounts?: Rpc;
  rfqs?: { data: unknown; error: unknown; count: number | null };
  saved?: { data: unknown };
  userId?: string | null;
  discover?: Rpc;
  facilityParent?: Rpc;
  facilityPanel?: Rpc;
  /** What `.from(table)` answers, for tables other than `rfqs`. */
  tables?: Record<string, unknown[]>;
  /** Any other function by name. */
  rpcs?: Record<string, Rpc>;
};

/** Every `.from(...)` call the routes make, so a test can assert the filters. */
type FromCall = { table: string; filters: { op: string; args: unknown[] }[]; select?: string };
let fromCalls: FromCall[] = [];
/** Every `.rpc(fn, args)` call, so a test can assert what the routes SEND, not only what they do with the answer. */
let rpcCalls: { fn: string; args: Record<string, unknown> | undefined }[] = [];
/** How many times `auth.getUser()` asked who is signed in: a round trip each. */
let authCalls = 0;
/** How many times the buyer layout read its shell (stubbed below). */
let shellLoads = 0;
/** What `usePathname()` answers — the path the client-side navigation reads. */
let currentPath = "/app/discover";

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
    if (fn === "buyer_supplier_profile") return (typeof answers.profile === "function" ? answers.profile() : answers.profile) ?? { data: null, error: null };
    if (fn === "supplier_epb_hscodes") return answers.hscodes ?? { data: [], error: null };
    if (fn === "supplier_contact_counts") return answers.contactCounts ?? { data: null, error: null };
    if (fn === "production_workers_display_batch") return answers.workers ?? { data: [], error: null };
    if (fn === "discover_suppliers") return answers.discover ?? { data: [], error: null };
    if (fn === "supplier_epb_hscodes_batch") return { data: [], error: null };
    if (fn === "facility_parent_slug") return answers.facilityParent ?? { data: null, error: null };
    if (fn === "buyer_supplier_facility_panel") return answers.facilityPanel ?? { data: null, error: null };
    return answers.rpcs?.[fn] ?? { data: null, error: null };
  };
  return {
    rpc: async (fn: string, args?: Record<string, unknown>) => (rpcCalls.push({ fn, args }), rpc(fn)),
    auth: { getUser: async () => (authCalls++, { data: { user: answers.userId === null ? null : { id: answers.userId ?? "buyer-1" } } }) },
    from(table: string) {
      const call: FromCall = { table, filters: [] };
      fromCalls.push(call);
      const result = () =>
        table === "rfqs"
          ? Promise.resolve(answers.rfqs ?? { data: [], error: null, count: 0 })
          : Promise.resolve({ data: answers.tables?.[table] ?? [], error: null, count: answers.tables?.[table]?.length ?? 0 });
      const chain = {
        select: (cols?: string, _opts?: unknown) => ((call.select = cols), chain),
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
  rpcCalls = [];
  authCalls = 0;
  shellLoads = 0;
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
      usePathname: () => currentPath,
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
        // The real shell reads who is signed in and the profile's name and
        // photo (`load-buyer-shell.test.ts`); these routes are not what that is
        // about, so it is stubbed with an unread account and nothing more.
        loadBuyerShell: async () => {
          shellLoads++;
          return { userId: "buyer-1", account: null };
        },
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

/**
 * The page as a browser receives it once every streamed part has arrived.
 * The search and Saved stream the record into its pane (28 Sep 2026), and
 * `renderToStaticMarkup` stops at a `Suspense` boundary's fallback; React's
 * static prerender waits for the content. Its hydration comments are dropped
 * so the markup reads as `renderToStaticMarkup`'s did. A `notFound()` or
 * `redirect()` thrown inside a boundary is rethrown, as it would be at the top.
 */
async function renderStreamed(el: ReactElement): Promise<string> {
  const errors: unknown[] = [];
  const { prelude } = await prerenderToNodeStream(el, { onError: (err: unknown) => void errors.push(err) });
  let out = "";
  for await (const chunk of prelude) out += String(chunk);
  const thrown = errors.find((e) => typeof (e as { digest?: unknown })?.digest === "string") ?? errors[0];
  if (thrown) throw thrown;
  return out.replace(/<!--[\s\S]*?-->/g, "");
}

/** `notFound()` and `redirect()` throw; this names which one a route reached. */
async function outcome(run: () => Promise<ReactElement>): Promise<{ html: string } | { threw: string }> {
  try {
    return { html: await renderStreamed(await run()) };
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

/** Every file under `dir`. */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => (statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name)) : [path.join(dir, name)]));

describe("/app/suppliers/[slug] — the full record page", () => {
  it("renders the record, and is not a dialog", async () => {
    given({ profile: PROFILE, hscodes: HS, contactCounts: { data: { emails: 1, phones: 6, website: true, representatives: 1 }, error: null } });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) })));

    assert.match(out, /aria-label="Supplier record"/);
    // The shell is the layout's now, so the page draws none of it.
    assert.doesNotMatch(out, /<aside\b(?![^>]*aria-label="Contact and sources")|data-plan=/, "the record page draws a shell inside the layout's");
    // `mode="page"`: a whole page is not the pane beside the results, and
    // there is nothing behind it to close. Only the route passes this, so only
    // a route test can catch it being dropped.
    assert.match(out, /data-record="page"/, "the full record page is not drawn as a page");
    assert.doesNotMatch(out, /data-record="pane"|data-record-pane/, "the full record page is drawn as the pane");
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
    // The contact block names every kind the register holds, as counts with their nouns. Paper's
    // board draws the first two only; the founder asked for all four (4 Oct 2026).
    const card = out.slice(out.indexOf('aria-label="Contact"'));
    assert.match(card.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "), /Contact .*Email 1 on file · Phone 6 on file · Website on file · Contact person 2 on file .*Contact details are locked\. Send an RFQ and the supplier replies here\./);
    // A count that could not be read claims nothing: no "none on file".
    given({ profile: PROFILE, hscodes: HS, contactCounts: { data: null, error: { message: "boom" } } });
    const unread = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) })));
    assert.doesNotMatch(unread, /No email or phone on file|on file · locked/);
    assert.match(unread, /Contact details are locked\./);
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
    assert.match(out, /href="\/app\/suppliers\/aboni-knitwear"[^>]*>Try again/, "Try again goes somewhere else");
    // "Try again" on the expanded grid retries the expanded grid.
    given({ profile: { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } } });
    const all = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({ lines: "all" }) })));
    assert.match(all, /href="\/app\/suppliers\/aboni-knitwear\?lines=all"[^>]*>Try again/, "Try again drops ?lines=all");
    // Inside the page's frame (`Page`): the layout draws the shell, so the
    // state owes only the content region — and must not draw a second shell.
    // (Cycle 5 was the opposite failure, a bare state with no navigation at
    // all, back when every page drew its own shell.)
    assert.match(out, /^<div class="mx-auto flex w-full max-w-/, "the slow-read state is not inside the page frame");
    assert.doesNotMatch(out, /<main\b|<aside\b|href="#main-content"/, "the slow-read state draws a shell inside the layout's");
  });

  it("?lines=all expands the grid past six tiles", async () => {
    given({ profile: PROFILE, hscodes: HS });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const six = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({ tab: "products" }) })));
    const all = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({ tab: "products", lines: "all" }) })));
    const tiles = (s: string) => (s.match(/\/app\/suppliers\/aboni-knitwear\/lines\/\d{4}/g) ?? []).length;
    assert.equal(tiles(six), 6, "the grid shows six tiles by default");
    assert.ok(tiles(all) > 6, `?lines=all still shows only ${tiles(all)} of the record's lines`);
    // And the six-tile view offers the way to the rest.
    assert.match(six, /All \d+ lines/);
    assert.ok(six.includes("lines=all"), "the six-tile view has no route to the other lines");
    // It is the Products tab, expanded, so the tab is not lost on the way.
    assert.match(six.replace(/&amp;/g, "&"), /href="\/app\/suppliers\/aboni-knitwear\?tab=products&lines=all"/);
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
    assert.doesNotMatch(out, /data-record-pane/, "the full line page is drawn as the pane");
  });

  it("draws the line on the v4 kit: its heading is the page's h1, Back is the record's Products tab, and the exporters are counted", async () => {
    const out = html(await run("6105"));
    assert.match(out, /<h1 [^>]*>Men&#x27;s or boys&#x27; shirts, knitted or crocheted<\/h1>/);
    assert.match(out, /<a [^>]*aria-label="Back to the record"[^>]*href="\/app\/suppliers\/aboni-knitwear\?tab=products"/);
    assert.match(out, /href="\/app\/discover\?hs=6105"[^>]*>Exporters of 6105<span [^>]*>· 1,634<\/span>/);
    assert.match(out, /<a [^>]*href="\/app\/rfqs\/new\?supplier=[^"&]+&amp;hs=6105"[^>]*>Send RFQ for this line<\/a>/);
    assert.doesNotMatch(out, /data-sheet-scroll|animate-sheet-in|bg-surface-sunken|text-ink-(?:muted|subtle)/, "a class of the old kit");
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

  it("the selection's provider survives a failed search re-run under an open record", async () => {
    // `?record=` is a search param, so opening a record re-runs the search.
    // When that failed, the error panel replaced the results AND the provider,
    // so the buyer's bulk selection was gone even after Close (cycle 11). The
    // same provider, same key, now wraps every outcome; unread rows are null.
    const Page = route("app/(app)/app/discover/page.js").default;
    const tree = async (discoverAnswer: Rpc, sp: Record<string, string> = { q: "knit", record: "aboni-knitwear" }) => {
      given({ profile: PROFILE, hscodes: HS, discover: discoverAnswer });
      return (await Page({ searchParams: Promise.resolve(sp) })) as ReactElement;
    };
    const providers = (n: unknown): { key: unknown; pageIds: unknown }[] => {
      if (!n || typeof n !== "object") return [];
      if (Array.isArray(n)) return n.flatMap(providers);
      const el = n as { type?: { name?: string }; key?: unknown; props?: Record<string, unknown> };
      const own = el.type?.name === "SelectionProvider" ? [{ key: el.key, pageIds: el.props?.pageIds }] : [];
      return [...own, ...Object.values(el.props ?? {}).flatMap(providers)];
    };
    const ok = providers(await tree({ data: [ROW], error: null }));
    const failed = providers(await tree({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }));
    assert.equal(ok.length, 1, "guard: one provider around the results");
    assert.equal(failed.length, 1, "a failed search re-run unmounted the selection's provider");
    assert.equal(failed[0]!.key, ok[0]!.key, "a different key remounts the provider and empties the selection");
    assert.equal(failed[0]!.pageIds, null, "an unread page is passed as no rows, which prunes the selection");
    // Opening a record, a line or the whole grid keeps the SAME provider as the
    // search alone: a key that carried `record` would remount it on every card
    // click and empty the selection (cycle 12: both renders above had a record).
    const closed = providers(await tree({ data: [ROW], error: null }, { q: "knit" }));
    for (const sp of <Record<string, string>[]>[
      { q: "knit", record: "aboni-knitwear" },
      { q: "knit", record: "aboni-knitwear", lines: "all" },
      { q: "knit", record: "aboni-knitwear", line: "6105" },
    ]) {
      const open = providers(await tree({ data: [ROW], error: null }, sp));
      assert.equal(open[0]?.key, closed[0]!.key, `opening ${JSON.stringify(sp)} remounts the selection's provider`);
    }
    // …and a new search, sort or page IS a new provider: its selection starts
    // empty (selection.tsx). A missing or constant key kept one across them.
    assert.ok(closed[0]!.key, "the selection's provider has no key");
    for (const sp of <Record<string, string>[]>[{ q: "denim" }, { q: "knit", sort: "name" }, { q: "knit", page: "2" }]) {
      const other = providers(await tree({ data: [ROW], error: null }, sp));
      assert.notEqual(other[0]?.key, closed[0]!.key, `${JSON.stringify(sp)} kept the previous search's selection`);
    }
  });

  it("no ?record= renders no sheet at all", async () => {
    const out = html(await discover({ q: "knit" }));
    assert.doesNotMatch(out, /aria-label="Supplier record"/);
    assert.doesNotMatch(out, /data-record-pane|role="dialog"/);
  });

  it("?record= opens the sheet and Close returns to the same search", async () => {
    const out = html(await discover({ q: "knit", page: "2", sort: "workers" }));
    assert.doesNotMatch(out, /aria-label="Supplier record"/, "guard: this call carries no record");

    const withRecord = html(await discover({ q: "knit", page: "2", sort: "workers", record: "aboni-knitwear" }));
    assert.match(withRecord, /aria-label="Supplier record"/);
    assert.match(withRecord, /data-record="pane"/);
    assert.doesNotMatch(withRecord, /role="dialog"/, "the record beside the results is not a dialog");
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

  it("an open record sits BESIDE the results, both live: nothing is inert, nothing claims to be modal", async () => {
    // The founder's one-viewport frame (27 Sep 2026), v4's `ListPane` (B3): the record is a
    // pane on the right of the list from 1280, and under it a drawer over a scrim. Either
    // way the list is drawn first and stays live: the record used to be a dialog over a
    // scrim with the whole shell `inert` behind it; a pane beside live results can claim
    // neither, and a stray `aria-modal` or `inert` here would tell a screen reader the
    // results it can see are gone.
    const out = html(await discover({ q: "knit", record: "aboni-knitwear" }));
    const list = out.indexOf('aria-label="Results"');
    assert.ok(list > -1, "the results are not drawn beside the open record");
    // The results are still drawn in it: the buyer's search is not torn down.
    assert.ok(out.indexOf("Aboni Knitwear Ltd") > list, "the results are not rendered beside the open record");
    // The pane comes after the results, on their right.
    const pane = out.indexOf('data-record="pane"');
    assert.ok(pane > list, "the record pane is not beside the results");
    assert.match(out, /<section aria-label="Supplier"/, "the pane is a region of its own");
    assert.doesNotMatch(out, /aria-modal/, "a pane beside live results claims to be modal");
    assert.doesNotMatch(out, /<[a-z]+\b[^>]*\sinert(?:=""|\s|>)/, "something is inert beside an open record");
  });

  it("no record open means the results stand alone, at every width", async () => {
    // Without this the assertion above passes on a page that always draws a pane.
    const out = html(await discover({ q: "knit" }));
    assert.doesNotMatch(out, /data-record-pane|data-pane-frame/);
    assert.match(out, /aria-label="Results"/);
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
    // Try again retries the same view: the expanded grid and the open line
    // (the full page's Try again kept ?lines=all a cycle before this did).
    const again = (h: string) => /href="([^"]*)"[^>]*>Try again/.exec(h)?.[1]?.replace(/&amp;/g, "&") ?? "";
    assert.match(again(out), /record=aboni-knitwear/);
    const all = html(await outcome(() => Page({ searchParams: Promise.resolve({ q: "knit", record: "aboni-knitwear", lines: "all", line: "6105" }) })));
    assert.match(again(all), /lines=all/, "Try again drops the expanded grid");
    assert.match(again(all), /line=6105/, "Try again drops the open line");
    assert.match(again(all), /q=knit/, "Try again drops the search");
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
    const out = html(await discover({ q: "knit", record: "aboni-knitwear", tab: "products" }));
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

// ---------------------------------------------------------------------------
// The panes on the search URL (enterprise pass, 27 Sep 2026): the composer
// (`?rfq=`), the filter set (`?filters=1`), save-search (`?save=1`), the sent
// toast (`?sent=`) and the row density (`?d=`). Each is a parameter of the
// same search, so each is a route behaviour an outside caller observes.
// ---------------------------------------------------------------------------

describe("/app/discover — the panes beside the results", () => {
  const ABONI_ID = "8ce50581-2d84-4cc2-93aa-000000000001";
  const SANCTIONED_ID = "9d1e0000-0000-4000-8000-000000000002";
  const UNPUBLISHED_ID = "7f2e0000-0000-4000-8000-000000000003";
  const SENT_ID = "5e17a000-0000-4000-8000-000000000004";
  /** What `suppliers` holds, contact columns included — the fake answers every column, so only the route can keep them off the page. */
  const CONTACT = { email_primary: "sales@aboni.example", phones: ["+8801711000000"], contact_name: "Md. Karim Uddin", contact_role: "Merchandising manager" };
  const SUPPLIERS = [
    { id: ABONI_ID, slug: "aboni-knitwear", company_name: "ABONI KNITWEAR LTD.", entity_type: "factory", city: "Dhaka", district: "Dhaka", source_tags: ["BGMEA", "EPB"], is_published: true, is_sanctioned: false, ...CONTACT },
    { id: SANCTIONED_ID, slug: "sanctioned-knit", company_name: "SANCTIONED KNIT LTD.", entity_type: "factory", city: null, district: null, source_tags: ["BGMEA"], is_published: true, is_sanctioned: true, ...CONTACT },
    { id: UNPUBLISHED_ID, slug: "hidden-knit", company_name: "HIDDEN KNIT LTD.", entity_type: "factory", city: null, district: null, source_tags: ["BGMEA"], is_published: false, is_sanctioned: false, ...CONTACT },
  ];
  const ROW = {
    id: ABONI_ID,
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
  const search = (sp: Record<string, string>) => {
    given({ profile: PROFILE, hscodes: HS, discover: { data: [ROW], error: null }, tables: { suppliers: SUPPLIERS } });
    const Page = route("app/(app)/app/discover/page.js").default;
    return outcome(() => Page({ searchParams: Promise.resolve(sp) }));
  };
  const hrefOf = (html: string, label: RegExp) => {
    const m = new RegExp(`aria-label="${label.source}"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*aria-label="${label.source}"`).exec(html);
    return (m?.[1] ?? m?.[2] ?? "").replace(/&amp;/g, "&");
  };
  const sendButton = (html: string) => /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(html)?.[0] ?? "";

  it("?rfq=<id> opens the composer in the pane beside the results, naming the target and none of its contact details", async () => {
    const out = html(await search({ q: "knit", rfq: ABONI_ID }));
    assert.match(out, /<section data-record-pane="" aria-label="New RFQ"/);
    const pane = out.search(/<section data-record-pane="" aria-label="New RFQ"/);
    const column = out.indexOf('aria-label="Results"');
    assert.ok(column > -1 && column < pane, "the results do not stand beside the composer");
    assert.ok(out.indexOf("Aboni Knitwear Ltd") > column, "the results are not drawn beside the composer");
    assert.match(out.slice(pane), /1 supplier · you can add up to 50[\s\S]*Aboni Knitwear Ltd/);
    // The suppliers row carries contact columns; none reaches the page.
    for (const v of [CONTACT.email_primary, CONTACT.contact_name, CONTACT.contact_role, ...CONTACT.phones]) {
      assert.ok(!out.includes(v), `a contact value reached the composer: ${v}`);
    }
    for (const key of ["email_primary", "contact_name", "contact_role", "phones"]) assert.ok(!out.includes(key), `the ${key} column reached the HTML`);
    // And the route does not ask for them.
    const read = fromCalls.find((c) => c.table === "suppliers");
    assert.ok(read, "the composer's targets were not read from suppliers");
    assert.doesNotMatch(read!.select ?? "", /email|phone|contact/, `the route selects a contact column: ${read!.select}`);
    assert.deepEqual(read!.filters.find((f) => f.op === "in")?.args, ["id", [ABONI_ID]]);
    // Close is the same search, without the composer.
    const close = hrefOf(out.slice(pane), /Close/);
    assert.match(close, /q=knit/);
    assert.doesNotMatch(close, /rfq=/);
    assert.doesNotMatch(out, /role="dialog"|aria-modal/);
  });

  it("?rfq= with a sanctioned target draws the banner and withholds Send", async () => {
    const out = html(await search({ q: "knit", rfq: SANCTIONED_ID }));
    assert.match(out, /role="alert"[^>]*class="[^"]*bg-sanction/);
    assert.match(out, /Sanctioned Knit Ltd/);
    assert.match(out, /RFQs cannot be sent to a sanctioned supplier/);
    assert.match(sendButton(out), /\sdisabled=""/, "Send is live for a sanctioned target");
  });

  it("an unpublished id in rfq= is dropped, not drawn as a target the server would refuse", async () => {
    const both = html(await search({ q: "knit", rfq: `${UNPUBLISHED_ID},${ABONI_ID}` }));
    assert.doesNotMatch(both, /Hidden Knit/i);
    assert.match(both, /1 supplier · you can add up to 50[\s\S]*Aboni Knitwear Ltd/);
    const only = html(await search({ q: "knit", rfq: UNPUBLISHED_ID }));
    assert.doesNotMatch(only, /Hidden Knit/i);
    assert.match(only, /No supplier yet\./);
    assert.match(sendButton(only), /\sdisabled=""/);
    // Not an id at all: no composer.
    const junk = html(await search({ q: "knit", rfq: "not-an-id" }));
    assert.doesNotMatch(junk, /aria-label="New RFQ"/);
  });

  it("?record=…&rfq=… gives the composer a Record back link, and Close returns to the record", async () => {
    const out = html(await search({ q: "knit", record: "aboni-knitwear", rfq: ABONI_ID }));
    assert.match(out, /aria-label="New RFQ"/);
    assert.doesNotMatch(out, /aria-label="Supplier record"/, "the record and the composer in one pane");
    // The link whose words are "Record" (a client link carries its pending mark after them).
    const back =
      [...out.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
        .find((m) => m[2]!.replace(/<[^>]+>/g, "").trim() === "Record")?.[1]
        ?.match(/href="([^"]+)"/)?.[1]
        ?.replace(/&amp;/g, "&") ?? "";
    assert.match(back, /record=aboni-knitwear/);
    assert.match(back, /q=knit/);
    assert.doesNotMatch(back, /rfq=/);
    assert.match(hrefOf(out.slice(out.search(/aria-label="New RFQ"/)), /Close/), /record=aboni-knitwear/);
    // The record behind the composer is not read while the composer is open.
    assert.ok(!rpcCalls.some((c) => c.fn === "buyer_supplier_profile"), "the route read the record under the composer");
    // Its row stays marked in the results.
    assert.match(out, /<a\b[^>]*aria-current="true"/);
  });

  it("?filters=1 opens the filter pane with the search's own filters set, its count on the button and its chips removable", async () => {
    const out = html(await search({ q: "knit", reg: "BGMEA", cert: "gots:valid" }));
    assert.doesNotMatch(out, /aria-label="Filters"/, "guard: no pane without the parameter");
    const pane = html(await search({ q: "knit", reg: "BGMEA", cert: "gots:valid", filters: "1" }));
    assert.match(pane, /<form aria-label="Filters"/);
    // B4 fix 4: the panel lies over the full-width results (their own bar and table, not the
    // narrow list a docked pane leaves), and with the results live it claims no modality.
    assert.match(pane, /<section aria-label="Filters" class="[^"]*\babsolute\b[^"]*\bw-panel\b[^"]*">/);
    assert.ok(pane.indexOf('aria-label="Results"') < pane.indexOf('aria-label="Filters"'), "the results are not drawn under the panel");
    assert.match(pane, /<table\b/, "the results were narrowed to the pane's list under the filters");
    assert.doesNotMatch(pane, /aria-modal|<[a-z]+\b[^>]*\sinert(?:=""|\s|>)/, "a panel over live results claims to be modal");
    // The panel draws its own title and close at 1280 and over.
    assert.match(pane, /<h2[^>]*>Filters<\/h2>/);
    // The draft starts as the address: a register and a certificate ticked, its status chosen.
    assert.match(pane, /<input\b(?=[^>]*\sname="reg")(?=[^>]*\svalue="BGMEA")(?=[^>]*\schecked="")[^>]*>/);
    assert.match(pane, /<input\b(?=[^>]*\sname="cert")(?=[^>]*\svalue="gots")(?=[^>]*\schecked="")[^>]*>/);
    assert.match(pane, /<input\b(?=[^>]*\sname="cert_state")(?=[^>]*\svalue="valid")(?=[^>]*\schecked="")[^>]*>/);
    // The button is the live count of the search the pane is open over (the fake finds one).
    assert.match(pane, />Show 1 supplier</);
    // A chip's × is the same search without that filter and with the pane still open; Close is the search alone.
    const remove = hrefOf(pane, /Remove Certificate: GOTS · valid/);
    assert.match(remove, /q=knit/);
    assert.match(remove, /reg=BGMEA/);
    assert.match(remove, /filters=1/);
    assert.doesNotMatch(remove, /cert=/);
    assert.doesNotMatch(hrefOf(pane, /Close/), /filters=/);
    // Sanctioned suppliers are held back by default, in words, with the way to lift it.
    assert.match(pane, /Hiding sanctioned suppliers/);
    const show = [...pane.matchAll(/<a\b([^>]*)>Show them<\/a>/g)].map((m) => /href="([^"]*)"/.exec(m[1]!)?.[1]?.replace(/&amp;/g, "&") ?? "");
    assert.ok(show.some((h) => /sanctioned=1/.test(h) && /filters=1/.test(h)), `no Show them link keeps the pane: ${show.join(" ")}`);
  });

  it("the pane's count is read for a signed-in buyer only, and not for an address that is not a search's", async () => {
    const { countSuppliers } = route("components/search/filter-actions.js") as typeof import("@/components/search/filter-actions");
    // Signed out: no profile role, so nothing is read.
    given({ saved: { data: null }, discover: { data: [{ total_count: 71 }], error: null } });
    assert.equal(await countSuppliers("q=knit"), null);
    assert.equal(rpcCalls.filter((c) => c.fn === "discover_suppliers").length, 0, "a signed-out caller reached the search");
    // A buyer, but a string no search's address is.
    given({ saved: { data: { role: "buyer" } }, discover: { data: [{ total_count: 71 }], error: null } });
    assert.equal(await countSuppliers("q=" + "x".repeat(2000)), null);
    assert.equal(rpcCalls.filter((c) => c.fn === "discover_suppliers").length, 0, "an oversized query reached the search");
  });

  it("?save=1 opens the save-search popover under the bar with the form, named after the search, over the live results", async () => {
    const out = html(await search({ q: "knit", save: "1", page: "2" }));
    assert.match(out, /<section role="dialog" aria-label="Save this search" aria-modal="false"/);
    assert.match(out, /<input\b(?=[^>]*\sname="name")(?=[^>]*\svalue="[^"]+")[^>]*>/);
    assert.match(out, /Save search/);
    assert.match(out, /Cancel/);
    // The fake database answers the `alert_weekly` probe (0113 is applied), so the switch is offered, off until chosen.
    assert.match(out, /<input\b(?=[^>]*\srole="switch")(?![^>]*\schecked="")[^>]*>/);
    assert.match(out, /Tell me about new matches/);
    assert.match(out, /One email on Monday, only when something new matches/);
    assert.doesNotMatch(out, /data-record-pane=""[^>]*aria-label="Save this search"/, "it is not a pane any more");
    assert.match(out, /<table\b/, "the results are still the full table beside it");
    // The composer wins over the other panes; one pane at a time.
    const both = html(await search({ q: "knit", save: "1", rfq: ABONI_ID }));
    assert.match(both, /aria-label="New RFQ"/);
    assert.doesNotMatch(both, /aria-label="Save this search"/);
  });

  it("?sent=<id> says the RFQ went, with a link to it; anything else says nothing", async () => {
    const out = html(await search({ q: "knit", sent: SENT_ID }));
    assert.match(out, /RFQ sent/);
    assert.match(out, new RegExp(`href="/app/rfqs/${SENT_ID}"[^>]*>Open the RFQ<`));
    assert.doesNotMatch(html(await search({ q: "knit", sent: "not-an-id" })), /RFQ sent/);
    assert.doesNotMatch(html(await search({ q: "knit" })), /RFQ sent/);
  });

  it("the table is the only list: no cards (D-7), and an old ?view=cards or ?d= link still opens the same table", async () => {
    for (const sp of <Record<string, string>[]>[{ q: "knit" }, { q: "knit", view: "cards" }, { q: "knit", d: "compact" }]) {
      const out = html(await search(sp));
      assert.match(out, /data-row="result"/, JSON.stringify(sp));
      assert.doesNotMatch(out, /<article\b/, `a result card came back for ${JSON.stringify(sp)}`);
    }
    // Each row is a link to its record, over this search; a phone's row is the record's page.
    const out = html(await search({ q: "knit" }));
    assert.match(out, /href="\/app\/discover\?q=knit&amp;record=aboni-knitwear"/);
    assert.match(out, /href="\/app\/suppliers\/aboni-knitwear\?back=%2Fapp%2Fdiscover%3Fq%3Dknit"/);
  });

  it("opening and closing a record keeps the search: every pane link and Close are the same search, with nothing else on it", async () => {
    const out = html(await search({ q: "knit", sort: "workers", record: "aboni-knitwear" }));
    assert.match(hrefOf(out, /Close/), /q=knit/);
    assert.match(hrefOf(out, /Close/), /sort=workers/);
    const opens = [...out.matchAll(/href="([^"]*record=[^"]*)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
    assert.ok(opens.length > 0, "guard: the rows link to their records");
    for (const href of opens) {
      assert.match(href, /q=knit/, `a record link throws the search away: ${href}`);
      assert.match(href, /sort=workers/, `a record link drops the sort: ${href}`);
    }
  });
});

describe("/app/rfqs/new — the composer as a page", () => {
  const ABONI_ID = "8ce50581-2d84-4cc2-93aa-000000000001";
  const SANCTIONED_ID = "9d1e0000-0000-4000-8000-000000000002";
  const UNPUBLISHED_ID = "7f2e0000-0000-4000-8000-000000000003";
  const SUPPLIERS = [
    { id: ABONI_ID, slug: "aboni-knitwear", company_name: "ABONI KNITWEAR LTD.", entity_type: "factory", city: "Dhaka", district: "Dhaka", source_tags: ["BGMEA"], is_published: true, is_sanctioned: false, email_primary: "sales@aboni.example" },
    { id: SANCTIONED_ID, slug: "sanctioned-knit", company_name: "SANCTIONED KNIT LTD.", entity_type: "factory", city: null, district: null, source_tags: ["BGMEA"], is_published: true, is_sanctioned: true },
    { id: UNPUBLISHED_ID, slug: "hidden-knit", company_name: "HIDDEN KNIT LTD.", entity_type: "factory", city: null, district: null, source_tags: ["BGMEA"], is_published: false, is_sanctioned: false },
  ];
  /** The fake answers `.in("id", …)` with every row it holds, so a case that is about which rows come back passes its own. */
  const newRfq = (sp: Record<string, string>, suppliers: unknown[] = SUPPLIERS) => {
    given({ tables: { suppliers } });
    const Page = route("app/(app)/app/rfqs/new/page.js").default;
    return outcome(() => Page({ searchParams: Promise.resolve(sp) }));
  };

  it("?supplier=<id> draws the page-mode composer for that supplier, closing to its record", async () => {
    const out = html(await newRfq({ supplier: ABONI_ID }));
    assert.match(out, /^<section aria-label="New RFQ"/, "the page is not the composer");
    assert.doesNotMatch(out, /data-record-pane|role="dialog"|aria-modal/, "a page is neither a pane nor a dialog");
    assert.match(out, /1 supplier · you can add up to 50[\s\S]*Aboni Knitwear Ltd/);
    assert.ok(!out.includes("sales@aboni.example"), "a contact value reached the page");
    // The page's way out is its back link, named for where it goes.
    assert.match(out, /href="\/app\/suppliers\/aboni-knitwear"[^>]*>(?:<svg[\s\S]*?<\/svg>)?Back to Aboni Knitwear Ltd/);
    assert.doesNotMatch(out, /<main\b|<nav aria-label="Primary"/, "the page draws a shell inside the layout's");
    // `&hs=` prefills the line the buyer came from.
    const line = html(await newRfq({ supplier: ABONI_ID, hs: "6105" }));
    assert.match(line, /value="HS 6105 · [^"]+"/);
  });

  it("a saved draft whose suppliers have all left still opens, with its own words and no targets", async () => {
    const DRAFT_ID = "5a5a5a5a-0000-4000-8000-00000000d001";
    given({
      tables: { suppliers: SUPPLIERS.filter((x) => x.id === UNPUBLISHED_ID) },
      rpcs: {
        rfq_draft_get: {
          data: { id: DRAFT_ID, payload: { product_title: "Denim jackets, 12 oz", quantity: 800, quantity_unit: "pcs" }, target_supplier_ids: [UNPUBLISHED_ID], product_id: null },
          error: null,
        },
      },
    });
    const Page = route("app/(app)/app/rfqs/new/page.js").default;
    const out = await outcome(() => Page({ searchParams: Promise.resolve({ draft: DRAFT_ID }) }));
    assert.ok("html" in out, `the buyer's own draft did not open: ${JSON.stringify(out)}`);
    assert.match(out.html, /value="Denim jackets, 12 oz"/);
    assert.doesNotMatch(out.html, /HIDDEN KNIT/i, "an unpublished supplier was drawn as a target");
  });

  it("a sanctioned supplier is drawn with the banner and no live Send", async () => {
    const out = html(await newRfq({ supplier: SANCTIONED_ID }));
    assert.match(out, /role="alert"/);
    assert.match(out, /RFQs cannot be sent to a sanctioned supplier/);
    assert.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(out)?.[0] ?? "", /\sdisabled=""/);
  });

  it("no supplier opens an empty composer that says how to add some; only unpublished suppliers is not found", async () => {
    // "New RFQ" on the RFQ list lands here with nobody chosen: that is not a bad link.
    for (const sp of [{}, { supplier: "not-an-id" }] as Record<string, string>[]) {
      const out = await newRfq(sp);
      assert.ok("html" in out, `an empty composer redirected or threw: ${JSON.stringify(out)}`);
      const page = html(out);
      assert.match(page, /No supplier yet\./);
      assert.match(page, />Add suppliers</);
      assert.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?Send RFQ/.exec(page)?.[0] ?? "", /\sdisabled=""/);
    }
    const hidden = await newRfq({ supplier: UNPUBLISHED_ID }, SUPPLIERS.filter((s) => s.id === UNPUBLISHED_ID));
    assert.ok("threw" in hidden && /404|NOT_FOUND/.test(hidden.threw), `an unpublished supplier is drawn: ${JSON.stringify(hidden)}`);
  });
});

describe("/supplier/rfqs/[id] — what the buyer wrote reaches the supplier", () => {
  it("the supplier's RFQ page shows the buyer's message and every question", async () => {
    const RFQ_ID = "6b6b6b6b-0000-4000-8000-00000000f001";
    given({
      rpcs: {
        rfq_get: {
          data: {
            id: RFQ_ID, product_title: "Men's cotton trousers", product_description: "Twill, 260 gsm", quantity: 4500, quantity_unit: "pcs",
            target_unit_price: null, currency: "USD", ship_to_country: null, ship_by: null, status: "open", accepted_quote_id: null,
            message: "Hello, we would like a quotation for the trousers below.",
            questions: ["Unit price at this quantity, FOB Chattogram", "Minimum order quantity per colour"],
            created_at: "2026-09-10T10:00:00Z", updated_at: "2026-09-10T10:00:00Z", viewer_role: "supplier",
            targets: [], quotes: [], thread_id: null,
          },
          error: null,
        },
        rfq_list: { data: [], error: null },
      },
    });
    const Page = route("app/(app)/(old-shell)/supplier/rfqs/[id]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ id: RFQ_ID }) })));
    assert.match(out, /Hello, we would like a quotation for the trousers below\./, "the supplier never sees the buyer's message");
    assert.match(out, /<li>Unit price at this quantity, FOB Chattogram<\/li>/);
    assert.match(out, /<li>Minimum order quantity per colour<\/li>/);
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
    assert.match(out, /Your RFQs · 37/, "a page size is being printed as a total");
    assert.doesNotMatch(out, /Your RFQs · 20/);
  });

  it("a failed read claims no count at all", async () => {
    given({ profile: PROFILE, hscodes: HS, userId: "buyer-42", rfqs: { data: null, error: { message: "boom" }, count: null } });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) })));
    assert.match(out, /Your RFQs could not be read\./);
    assert.doesNotMatch(out, /Your RFQs · \d/);
    assert.doesNotMatch(out, /have not sent this supplier an RFQ/);
  });
});

describe("the sanctioned record, through the route", () => {
  it("the banner is served, points at its evidence, and Send RFQ is not a link", async () => {
    const s = sanctionedInput();
    given({ profile: { data: s.profile, error: null }, hscodes: { data: [], error: null } });
    const Page = route("app/(app)/app/suppliers/[slug]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "zaheen" }), searchParams: Promise.resolve({}) })));
    // The band is the first thing on the record, in words; Send RFQ is replaced by the refusal, not greyed.
    assert.match(out, /role="alert"[^>]*class="[^"]*bg-sanction/);
    assert.match(out.replace(/&#x27;/g, "'"), /You can't send this supplier an RFQ\./);
    // Its evidence is on the Overview, where the banner's claim is read.
    assert.match(out, /id="sanctions"/);
    assert.match(out, /Sanctions matches/);
    assert.ok(!out.includes('href="/app/rfqs/new'), "a sanctioned record's Send RFQ is a live link");
    assert.doesNotMatch(out, />Send RFQ</, "the button is greyed, not replaced");
  });

  it("its line page serves the banner too, and Send RFQ for the line is not a link", async () => {
    // Only the component test covered the line sheet (cycles 8–12 carried it).
    const s = sanctionedInput();
    given({ profile: { data: s.profile, error: null }, hscodes: HS });
    const Page = route("app/(app)/app/suppliers/[slug]/lines/[hs]/page.js").default;
    const out = html(await outcome(() => Page({ params: Promise.resolve({ slug: "zaheen", hs: "6105" }), searchParams: Promise.resolve({}) })));
    assert.match(out, /aria-label="Product line"/, "guard: the line page rendered");
    assert.match(out, /role="alert"[^>]*class="[^"]*bg-sanction/, "the line page of a sanctioned record has no banner");
    assert.match(out.replace(/&#x27;/g, "'"), /You can't send this supplier an RFQ\./, "the line page of a sanctioned record does not refuse in words");
    assert.ok(!out.includes('href="/app/rfqs/new'), "a sanctioned record's line has a live Send RFQ");
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
    // The address is the Sites tab's now (RC-09), so the guard reads both tabs: a contact value
    // filed inside an address must reach neither.
    const overview = html(await fullPage("zaheen"));
    const sites = html(await fullPage("zaheen", { tab: "sites" }));
    const out = overview + sites;
    assert.match(sites, /Plot 5, Road 2, Dhaka/, "guard: the address itself should still render");
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
    const at = out.indexOf("data-record-pane");
    assert.ok(at > -1, "the notice is not drawn in the record pane");
    assert.doesNotMatch(out.slice(0, at), /record=aboni-knitwear(?:&|")/, "guard: the results must not link the mother themselves");
    const hrefs = [...out.slice(at).matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
    const open = hrefs.find((h) => /[?&]record=aboni-knitwear(?:&|$)/.test(h));
    assert.ok(open, "the notice does not link to the company's record");
    assert.match(open, /q=knit/, `the company's record leaves the search: ${open}`);
    assert.doesNotMatch(out, /aria-modal|\sinert\b/, "a notice beside live results claims to be modal");
  });

  it("an unknown slug's notice takes the pane too, and claims no cause it cannot know", async () => {
    given({ profile: { data: null, error: null }, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit", record: "no-such-slug" }));
    assert.match(out, /data-record-pane/);
    assert.doesNotMatch(out, /aria-modal|\sinert\b/);
    assert.match(out, /could not be read just now/, "a failed read is presented as certainly unpublished");
  });

  it("beside an open record the table gives way to the narrow list with the record's row marked, and comes back when it closes", async () => {
    // Master and detail (Paper `03 Patterns` · supplier list row): the list keeps only what
    // finds the next item: name, type and place, the first certificate problem, the sources.
    given({ profile: PROFILE, hscodes: HS, discover: { data: [ROW], error: null } });
    const open = html(await overlay({ q: "knit", record: "aboni-knitwear" }));
    const results = open.slice(0, open.indexOf('data-record="pane"'));
    assert.match(results, /<a\b[^>]*aria-current="true"[^>]*href="[^"]*record=aboni-knitwear|<a\b[^>]*href="[^"]*record=aboni-knitwear[^>]*aria-current="true"/, "the record's row is not marked in the list beside it");
    assert.match(results, /2 sources/, "not the narrow list");
    assert.doesNotMatch(results, /<table\b/, "the wide table squeezed beside the record");
    assert.doesNotMatch(results, /<article\b/, "a card squeezed beside the record");
    given({ profile: PROFILE, hscodes: HS, discover: { data: [ROW], error: null } });
    const closed = html(await overlay({ q: "knit" }));
    assert.match(closed, /<table\b/, "closing the record did not bring the table back");
    assert.match(closed, /data-row="result"/);
  });

  it("a sanctioned record opened over the results carries the banner above every section", async () => {
    const s = sanctionedInput();
    given({ profile: { data: s.profile, error: null }, hscodes: { data: [], error: null }, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit", record: "zaheen" }));
    const record = out.indexOf('aria-label="Supplier record"');
    const banner = out.indexOf('role="alert"', record);
    assert.ok(banner > -1, "the overlay serves a sanctioned record with no banner");
    // The band is above the header, the summary, the tabs and the panel.
    for (const [what, at] of [["header", out.indexOf("<h2", banner)], ["summary", out.indexOf('aria-label="Summary"', banner)], ["tabs", out.indexOf('aria-label="Record sections"', banner)], ["evidence", out.indexOf('id="sanctions"', banner)]] as const) {
      assert.ok(at > banner, `the ${what} is missing or above the banner`);
    }
    assert.match(out.slice(out.indexOf('aria-label="Summary"', banner)), /On the [^<]*(?:list|List)/, "the summary cell does not say which list");
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
    // Scoped to the row: the next row ("Exporting since") ends it. Unscoped,
    // the "Other lines" row's own "Could not be read" satisfied this (cycle 5).
    const row = /Exporter page([\s\S]*?)Exporting since/.exec(out);
    assert.ok(row, "guard: the Exporter page row is drawn");
    assert.match(row[1]!, /Could not be read/, "the Exporter page row does not say it could not be read");
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
      supplier: { ...ABONI.profile.supplier, principal_products: ["shdeck.com", "Polo Shirt", "POLO SHIRT", "01711-528388", "Knit T-shirt 61091000"] },
    };
    given({ profile: { data: profile, error: null }, hscodes: HS, discover: { data: [ROW], error: null } });
    const pages = {
      full: html(await fullPage("aboni-knitwear", { tab: "products" })),
      overlay: html(await overlay({ q: "knit", record: "aboni-knitwear", tab: "products" })),
      overview: html(await fullPage("aboni-knitwear")),
      line: html(await linePage("6105")),
    };
    for (const [where, out] of Object.entries(pages)) {
      for (const value of ["shdeck.com", "01711-528388", "528388"]) {
        assert.ok(!out.includes(value), `a contact value filed as a product reached the ${where} page: ${value}`);
      }
    }
    // What is left is the real products, once each: "POLO SHIRT" is "Polo
    // Shirt" (founder, 25 Sep), and an HS code in a product name is not a
    // phone number. The count says the same.
    const list = /data-product-list="true"[^>]*>([\s\S]*?)<\/ul>/.exec(pages.full);
    assert.ok(list, "guard: the full page draws the product list");
    assert.equal((list[1]!.match(/<li/g) ?? []).length, 2, `the product list: ${list[1]}`);
    assert.match(list[1]!, /Knit T-shirt 61091000/, "an HS code in a product name was cut as a phone number");
    assert.match(pages.full, /Products as filed · 2/, "the Products tab counts a contact value or a case variant as a product");
  });

  it("?lines=all rides INTO a line from the overlay, not only back out", async () => {
    given({ profile: PROFILE, hscodes: HS, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit", record: "aboni-knitwear", lines: "all", tab: "products" }));
    const lineLinks = hrefsIn(out.slice(out.indexOf('data-record="pane"'))).filter((h) => /[?&]line=\d{4}/.test(h));
    assert.ok(lineLinks.length > 6, `guard: the expanded grid drew ${lineLinks.length} line links`);
    for (const h of lineLinks) assert.match(h, /lines=all/, `a line opened from "All lines" forgets it: ${h}`);
  });

  it("?lines=all rides into a line and back on the full page too", async () => {
    given({ profile: PROFILE, hscodes: HS });
    const out = html(await fullPage("aboni-knitwear", { lines: "all", tab: "products" }));
    const tiles = hrefsIn(out).filter((h) => /\/lines\/\d{4}/.test(h));
    assert.ok(tiles.length > 6, `guard: ${tiles.length} tiles`);
    for (const h of tiles) assert.match(h, /\?lines=all$/, `a tile of the expanded grid forgets it: ${h}`);
    // Back from a line is the record's Products tab, expanded or not.
    given({ profile: PROFILE, hscodes: HS });
    assert.ok(hrefsIn(html(await linePage("6105", { lines: "all" }))).includes("/app/suppliers/aboni-knitwear?tab=products&lines=all"), "Back from a line returns to six tiles");
    given({ profile: PROFILE, hscodes: HS });
    assert.ok(hrefsIn(html(await linePage("6105"))).includes("/app/suppliers/aboni-knitwear?tab=products"), "Back from a line opened from six tiles");
  });

  it("a line outside the catalogue, after a failed EPB read, goes to the record — no 404, no invented line", async () => {
    // Whether 3923, 7700 or 0199 is one of the record's lines is unknown while
    // its EPB page is unread. A 404 says it is not; a sheet (with a live Send
    // RFQ) says it is. The record says what is true: the lines could not be read.
    for (const hs of ["3923", "7700", "0199", "0000"]) {
      given({ profile: PROFILE, hscodes: { data: null, error: { message: "boom" } } });
      const r = await linePage(hs);
      assert.ok("threw" in r, `/lines/${hs} rendered a sheet while the EPB read had failed`);
      assert.match(r.threw, /NEXT_REDIRECT/, `/lines/${hs}: ${r.threw}`);
      assert.match(r.threw, /\/app\/suppliers\/aboni-knitwear\?tab=products(?:;|$)/, `/lines/${hs} goes somewhere else: ${r.threw}`);
    }
    given({ profile: PROFILE, hscodes: { data: null, error: { message: "boom" } } });
    const all = await linePage("3923", { lines: "all" });
    assert.ok("threw" in all && /\/app\/suppliers\/aboni-knitwear\?tab=products&lines=all/.test(all.threw), "the expanded grid is lost on the way back");
    // A catalogue heading still renders, and says the lines could not be read.
    given({ profile: PROFILE, hscodes: { data: null, error: { message: "boom" } } });
    assert.match(html(await linePage("6105")), /EPB lines could not be read/);
    // With the read working, a heading neither in the catalogue nor on the record's page is not a line.
    given({ profile: PROFILE, hscodes: HS });
    const r = await linePage("3923");
    assert.ok("threw" in r && /NOT_FOUND|404/.test(r.threw), "/lines/3923 rendered for a record that does not export it");
  });

  it("a sanctioned record's contact card does not offer an RFQ", async () => {
    const s = sanctionedInput();
    given({ profile: { data: s.profile, error: null }, hscodes: { data: [], error: null } });
    const out = html(await fullPage("zaheen"));
    const at = out.indexOf('aria-label="Contact"');
    assert.ok(at > -1, "guard: the contact card is drawn");
    // The contact column says what is locked and nothing that sends: the refusal is in the header and the band.
    const everything = out.replace(/&#x27;/g, "'");
    assert.match(everything, /You can't send this supplier an RFQ\./);
    assert.ok(!out.includes('href="/app/rfqs/new'), "the record offers an RFQ it cannot take");
    given({ profile: PROFILE, hscodes: HS });
    assert.match(html(await fullPage("aboni-knitwear")), /href="\/app\/rfqs\/new\?supplier=[^"]*"[^>]*>Send RFQ</);
  });

  it("the line sheet's price row says Not attested", async () => {
    given({ profile: PROFILE, hscodes: HS });
    const out = html(await linePage("6105"));
    assert.match(out, /Price · MOQ · lead time[\s\S]*?Not attested/);
  });

  it("an overlay record read that fails for another reason keeps the search and blames no load", async () => {
    // A payload the builder cannot read makes `loadRecordSheet` THROW — an
    // error that is not a timeout, reaching the overlay's own catch. (An RPC
    // error does not: the loader turns it into "no record" before that, which
    // is why cycle 4's version of this test never reached the branch it named.)
    given({ profile: { data: { supplier: null }, error: null }, hscodes: HS, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit", record: "aboni-knitwear" }));
    assert.match(out, /data-record-pane/, "the failure is silent");
    assert.match(out, /could not be read just now/);
    assert.doesNotMatch(out, /under load/, "a non-timeout failure is reported as the database being busy");
    assert.ok(out.includes("ABONI KNITWEAR") || out.includes("Aboni Knitwear"), "the search behind the sheet is gone");
  });

  it("an overlay line that cannot be checked, or is not one, goes back to the record on the same search", async () => {
    // As the full line page does. It used to show the record with the dead
    // `line=` still in the URL and nothing to say why (cycle 6).
    for (const [hs, hscodes] of [["3923", { data: null, error: { message: "boom" } }], ["0000", HS]] as const) {
      given({ profile: PROFILE, hscodes, discover: { data: [ROW], error: null } });
      const r = await overlay({ q: "knit", record: "aboni-knitwear", line: hs, lines: "all" });
      assert.ok("threw" in r, `&line=${hs} rendered`);
      assert.match(r.threw, /NEXT_REDIRECT/);
      const to = /;([^;]*\/app\/discover[^;]*);/.exec(r.threw)?.[1] ?? r.threw;
      assert.match(to, /record=aboni-knitwear/, `&line=${hs} lost the record: ${to}`);
      assert.match(to, /q=knit/, `&line=${hs} lost the search: ${to}`);
      assert.match(to, /lines=all/, `&line=${hs} lost the expanded grid: ${to}`);
      assert.doesNotMatch(to, /[?&]line=/, `&line=${hs} kept the dead line: ${to}`);
    }
    // A line reads the record ONCE (founder's video, 29 Sep 2026: the pane read
    // the whole record sheet as well, the profile twice, so a line took as
    // long as two records). A timed-out read is then the record's slowness,
    // said with a retry of the same line, as the record says its own.
    let reads = 0;
    given({
      profile: () => (reads++, { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }),
      hscodes: HS,
      discover: { data: [ROW], error: null },
    });
    const slow = html(await overlay({ q: "knit", record: "aboni-knitwear", line: "6105" }));
    assert.equal(reads, 1, "a line read the profile more than once");
    assert.match(slow, /could not be read in time/);
    assert.match(/href="([^"]*)"[^>]*>Try again/.exec(slow)?.[1]?.replace(/&amp;/g, "&") ?? "", /line=6105/, "Try again dropped the line");
  });

  it("a line reads the profile once, and none of the record sheet's own reads", async () => {
    given({ profile: PROFILE, hscodes: HS, discover: { data: [ROW], error: null } });
    const out = html(await overlay({ q: "knit", record: "aboni-knitwear", line: "6105" }));
    assert.match(out, /aria-label="Product line"/);
    assert.equal(rpcCalls.filter((c) => c.fn === "buyer_supplier_profile").length, 1, "the line read the profile twice");
    for (const fn of ["supplier_contact_counts", "buyer_supplier_facility_panel"]) {
      assert.ok(!rpcCalls.some((c) => c.fn === fn), `a line read the record sheet's ${fn}, which it never draws`);
    }
    assert.ok(!fromCalls.some((c) => c.table === "rfqs"), "a line read the record's RFQs, which it never draws");
  });

  it("the overlay names what it shows, so focus follows a change of content", async () => {
    // `DialogFocus` re-runs on this key; it renders nothing, so the key is
    // asserted where the frame writes it. Record, one of its lines, and the
    // expanded grid are three different contents in the same frame.
    const keyOf = async (sp: Record<string, string>) => {
      given({ profile: PROFILE, hscodes: HS, discover: { data: [ROW], error: null } });
      return /data-open-key="([^"]*)"/.exec(html(await overlay(sp)))?.[1];
    };
    const keys = [
      await keyOf({ q: "knit", record: "aboni-knitwear" }),
      await keyOf({ q: "knit", record: "aboni-knitwear", line: "6105" }),
      await keyOf({ q: "knit", record: "aboni-knitwear", lines: "all" }),
    ];
    assert.ok(keys.every(Boolean), `a frame carries no key: ${keys.join(" | ")}`);
    assert.equal(new Set(keys).size, 3, `two contents share a key: ${keys.join(" | ")}`);
    given({ profile: { data: null, error: null }, facilityParent: { data: "aboni-knitwear", error: null }, discover: { data: [ROW], error: null } });
    const notice = /data-open-key="([^"]*)"/.exec(html(await overlay({ q: "knit", record: "aboni-knitwear-unit-2" })))?.[1];
    assert.ok(notice && !keys.includes(notice), `the building notice shares a key with a record: ${notice}`);
  });

  it("the full page lists the record's buildings from the facility panel", async () => {
    const metric = { own: 16934, known_sum: 23189, facility_count: 2, building_count: 3, unknown_count: 0 };
    const panel = {
      facility_count: 2,
      facilities: [
        { name: "LIBERTY KNITWEAR LTD. (UNIT-2)", employees_total: 3120, addresses: [{ kind: "factory", address: "Plot 4, Konabari, Gazipur", source_code: "BGMEA" }], pills: [], rsc: null },
        { name: "Liberty Fashion Wears", employees_total: null, addresses: [], pills: [], rsc: null },
      ],
      group: { employees_total: metric, machines_sewing: metric, production_capacity_pcs_day: metric, production_capacity_dozen_yearly: metric },
    };
    given({ profile: PROFILE, hscodes: HS, facilityPanel: { data: panel, error: null } });
    const out = html(await fullPage("aboni-knitwear", { tab: "sites" }));
    assert.match(out, /Extension buildings · 2/);
    assert.match(out, /Konabari, Gazipur/);
    assert.match(out, /3,120 workers/);
    assert.match(out, /Liberty Fashion Wears/);
    assert.doesNotMatch(out, /not on this record|No extension buildings/);
    given({ profile: PROFILE, hscodes: HS, facilityPanel: { data: null, error: { message: "boom" } } });
    assert.match(html(await fullPage("aboni-knitwear", { tab: "sites" })), /The buildings could not be read\./);
  });

  it("the Overview shows every capacity figure a register filed, the EPZ zone and the split", async () => {
    const supplier = {
      ...ABONI.profile.supplier,
      production_capacity_pcs_day: 25000,
      production_capacity_dozen_yearly: 600000,
      bepza_zone: "Dhaka EPZ",
      employees_total: 1000,
      employees_female: 620,
      employees_male: 380,
    };
    given({ profile: { data: { ...ABONI.profile, supplier, rsc_remediation: null }, error: null }, hscodes: HS });
    const out = html(await fullPage("aboni-knitwear"));
    assert.match(out, /25,000 pcs\/day · 600,000 dozen\/year/, "one of the two filed capacity figures is dropped");
    assert.match(out, /Dhaka EPZ/);
    assert.match(out, /620 women · 380 men/);

    // One half filed: the other is the total less it, and the row says so (the capacity tab's rule).
    given({ profile: { data: { ...ABONI.profile, supplier: { ...supplier, employees_male: null }, rsc_remediation: null }, error: null }, hscodes: HS });
    assert.match(html(await fullPage("aboni-knitwear")), /620 women · 380 men \(men by subtraction\)/);
    // A half larger than the total is not a split.
    given({ profile: { data: { ...ABONI.profile, supplier: { ...supplier, employees_male: null, employees_female: 1500 }, rsc_remediation: null }, error: null }, hscodes: HS });
    assert.doesNotMatch(html(await fullPage("aboni-knitwear")), /women ·/);
    // …nor one equal to it: "0 women" is not filed, it is a subtraction that
    // found nothing (71 live records file one half equal to the total).
    given({ profile: { data: { ...ABONI.profile, supplier: { ...supplier, employees_female: null, employees_male: 1000 }, rsc_remediation: null }, error: null }, hscodes: HS });
    assert.doesNotMatch(html(await fullPage("aboni-knitwear")), /women ·/);
    // Men filed, women not, below the total. 70 of those 71 file only men, but
    // every one files it EQUAL to the total, so live no record reaches this
    // branch today (25 Sep); it is pinned for the day one does.
    given({ profile: { data: { ...ABONI.profile, supplier: { ...supplier, employees_female: null, employees_male: 380 }, rsc_remediation: null }, error: null }, hscodes: HS });
    assert.match(html(await fullPage("aboni-knitwear")), /620 women · 380 men \(women by subtraction\)/);

    // The figure shown sums its buildings (production_workers_display_batch):
    // the record's own halves do not split it. jk-fabrics, live 25 Sep: 44
    // filed, all men, 1,604 shown — "1,560 women" was the building's headcount.
    const family = (value: number) => ({ data: { [supplier.id]: { value, source: "registry", sites: 2 } }, error: null });
    given({
      profile: { data: { ...ABONI.profile, supplier: { ...supplier, employees_total: 44, employees_male: 44, employees_female: null }, rsc_remediation: null }, error: null },
      hscodes: HS,
      workers: family(1604),
    });
    const jk = html(await fullPage("aboni-knitwear"));
    assert.match(jk, /1,604/, "guard: the family figure is the one shown");
    assert.doesNotMatch(jk, /women ·/, "a building's workforce shown as one sex");
    // Both halves adding up to the record's own total, under a family figure
    // within 10% of it (epic-garments: 1,370 + 1,000 of 2,370, 2,626 shown).
    given({
      profile: { data: { ...ABONI.profile, supplier: { ...supplier, employees_total: 2370, employees_female: 1370, employees_male: 1000 }, rsc_remediation: null }, error: null },
      hscodes: HS,
      workers: family(2626),
    });
    const epic = html(await fullPage("aboni-knitwear"));
    assert.match(epic, /2,626/, "guard: the family figure is the one shown");
    assert.doesNotMatch(epic, /women ·/, "the record's own split shown under its family's total");
    // …nor a SMALLER figure shown (ab-apparels: 2,850 filed, 577 shown), even
    // with halves that add up to it within 10%.
    given({
      profile: { data: { ...ABONI.profile, supplier: { ...supplier, employees_total: 2850, employees_female: 330, employees_male: 250 }, rsc_remediation: null }, error: null },
      hscodes: HS,
      workers: family(577),
    });
    const small = html(await fullPage("aboni-knitwear"));
    assert.match(small, /577/, "guard: the smaller figure is the one shown");
    assert.doesNotMatch(small, /women ·/, "the record's own split shown against a smaller figure");
    // Both halves filed, against the record's own total, but 30% short of it.
    given({ profile: { data: { ...ABONI.profile, supplier: { ...supplier, employees_female: 400, employees_male: 300 }, rsc_remediation: null }, error: null }, hscodes: HS });
    assert.doesNotMatch(html(await fullPage("aboni-knitwear")), /women ·/, "halves 30% short of the total shown as its split");
    // …15% short (inside 75–90%)…
    given({ profile: { data: { ...ABONI.profile, supplier: { ...supplier, employees_female: 500, employees_male: 350 }, rsc_remediation: null }, error: null }, hscodes: HS });
    assert.doesNotMatch(html(await fullPage("aboni-knitwear")), /women ·/, "halves 15% short of the total shown as its split");
    // …and OVER it: scandex-textile-industries files 82 workers, 1,833 women and 82 men.
    given({ profile: { data: { ...ABONI.profile, supplier: { ...supplier, employees_total: 82, employees_female: 1833, employees_male: 82 }, rsc_remediation: null }, error: null }, hscodes: HS });
    assert.doesNotMatch(html(await fullPage("aboni-knitwear")), /women ·/, "halves 22 times the total shown as its split");
  });
});


describe("cycle 6: what the routes send, and the branches cycle 6 found untested", () => {
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

  it("every record RPC is called with the record's slug, under the parameter name the SQL declares", async () => {
    // Every fake client threw the arguments away, so `{ slug }` in place of
    // `{ p_slug: slug }` passed everything — and against PostgREST it is an
    // error on every read, rendered as "could not be read" on every record.
    given({ profile: PROFILE, hscodes: HS });
    html(await fullPage("aboni-knitwear"));
    const bySlug = ["buyer_supplier_profile", "supplier_epb_hscodes", "supplier_contact_counts", "buyer_supplier_facility_panel"];
    for (const fn of bySlug) {
      const calls = rpcCalls.filter((c) => c.fn === fn);
      assert.ok(calls.length > 0, `${fn} was never called`);
      for (const c of calls) assert.deepEqual(c.args, { p_slug: "aboni-knitwear" }, `${fn} was sent ${JSON.stringify(c.args)}`);
    }
  });

  it("a slow line read goes to the record, not a 404 — keeping ?lines=all", async () => {
    const slow = { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
    given({ profile: slow, hscodes: HS });
    const plain = await linePage("6105");
    assert.ok("threw" in plain && /NEXT_REDIRECT/.test(plain.threw), `a slow read on a line answered ${"threw" in plain ? plain.threw : "a page"}`);
    assert.match(plain.threw, /\/app\/suppliers\/aboni-knitwear\?tab=products(?:;|$)/);
    given({ profile: slow, hscodes: HS });
    const all = await linePage("6105", { lines: "all" });
    assert.ok("threw" in all && /\/app\/suppliers\/aboni-knitwear\?tab=products&lines=all/.test(all.threw), "the expanded grid is lost on a slow read");
  });

  it("Locations never says 'no address' under a Factory address the Overview shows", async () => {
    // 77 published records hold an address and no register address row; three
    // more hold only a row the stripper empties (a name and a role). The
    // section said "No address on any register…" beside the address (cycle 9).
    const raw = "2-B/1, Darus Salam Road, Mirpur, Dhaka";
    for (const addresses of [[], [{ kind: "factory", address: "Mohd. Abid Hossain Belal, Proprietor", source_code: "BGMEA" }]]) {
      given({ profile: { data: { ...ABONI.profile, addresses, supplier: { ...ABONI.profile.supplier, address_raw: raw } }, error: null }, hscodes: HS });
      const overview = html(await fullPage("aboni-knitwear"));
      // RC-09: the address is the Sites tab's. The Overview does not print it a second time, in the
      // register's own capitals, while the Sites tab shows it once.
      assert.doesNotMatch(overview, /Darus Salam Road/, "the Overview repeats the address the Sites tab shows");
      const out = html(await fullPage("aboni-knitwear", { tab: "sites" }));
      assert.doesNotMatch(out, /No address on any register/, `Locations denies the address shown (${addresses.length} rows)`);
      const section = /id="locations"[\s\S]*?<\/section>/.exec(out)?.[0] ?? "";
      assert.match(section, /2-B\/1, Darus Salam Road/, "the Locations section does not list the address");
      assert.match(section, /Factory/, "the fallback row lost its kind");
      assert.doesNotMatch(section, /Abid Hossain/, "a name reached the Locations section");
    }
    // A FAILED address read says so; it does not list the record's own text as if read.
    const unread: Partial<typeof ABONI.profile> = { ...ABONI.profile };
    delete unread.addresses;
    given({ profile: { data: { ...unread, supplier: { ...ABONI.profile.supplier, address_raw: raw } }, error: null }, hscodes: HS });
    const failed = /id="locations"[\s\S]*?<\/section>/.exec(html(await fullPage("aboni-knitwear", { tab: "sites" })))?.[0] ?? "";
    assert.match(failed, /The addresses could not be read\./);
    assert.doesNotMatch(failed, /Darus Salam Road/, "an unread address list shown as a location");
    // With no site to show, the Overview keeps the record's own address rather than say nothing.
    assert.match(html(await fullPage("aboni-knitwear")), /Darus Salam Road/, "the Overview lost its only address");
    // …and with no address at all, it still says so.
    given({ profile: { data: { ...ABONI.profile, addresses: [], supplier: { ...ABONI.profile.supplier, address_raw: null } }, error: null }, hscodes: HS });
    assert.match(html(await fullPage("aboni-knitwear", { tab: "sites" })), /No address on any register/);
  });

  it("the women/men split is withheld when it cannot be true", async () => {
    const base = { ...ABONI.profile.supplier, employees_total: 1000, employees_female: 620, employees_male: 380 };
    const page = async (supplier: object, extra: object = {}) => {
      given({ profile: { data: { ...ABONI.profile, supplier, rsc_remediation: null, ...extra }, error: null }, hscodes: HS });
      return html(await fullPage("aboni-knitwear"));
    };
    assert.match(await page(base), /620 women · 380 men/, "guard: the split shows when it adds up");
    // Halves that do not add up to the figure shown (outside 10%).
    assert.doesNotMatch(await page({ ...base, employees_total: 3000 }), /women ·/, "a split shown against a total it contradicts");
    // No halves at all.
    assert.doesNotMatch(await page({ ...base, employees_female: 0, employees_male: 0 }), /women ·/);
    // An RSC figure: the registers' split is not a split of RSC's number.
    const filed = ABONI.profile.rsc_remediation;
    const rsc = [{ ...((Array.isArray(filed) ? filed[0] : filed) ?? {}), workers_count: 1000, building_name: undefined }];
    assert.doesNotMatch(await page(base, { rsc_remediation: rsc }), /620 women · 380 men/, "the registers' split is shown against an RSC total");
  });

  it("a building's notice and that same slug's record are different contents, so focus moves between them", async () => {
    given({ profile: { data: null, error: null }, facilityParent: { data: "aboni-knitwear", error: null }, discover: { data: [ROW], error: null } });
    const notice = /data-open-key="([^"]*)"/.exec(html(await overlay({ q: "knit", record: "aboni-knitwear" })))?.[1];
    given({ profile: PROFILE, hscodes: HS, discover: { data: [ROW], error: null } });
    const record = /data-open-key="([^"]*)"/.exec(html(await overlay({ q: "knit", record: "aboni-knitwear" })))?.[1];
    assert.ok(notice && record, `guard: ${notice} / ${record}`);
    assert.notEqual(notice, record, "a notice and the record it becomes share a key");
  });

  it("a building with several addresses shows its first filed one", async () => {
    const metric = { own: null, known_sum: null, facility_count: 1, building_count: 2, unknown_count: 1 };
    const panel = {
      facility_count: 1,
      facilities: [
        {
          name: "ABONI KNITWEAR LTD. (UNIT-2)",
          employees_total: 450,
          addresses: [
            { kind: "factory", address: "Plot 12, Hemayetpur, Savar", source_code: "BGMEA" },
            { kind: "mailing", address: "House 9, Gulshan-2, Dhaka", source_code: "BKMEA" },
          ],
          pills: [],
          rsc: null,
        },
      ],
      group: { employees_total: metric, machines_sewing: metric, production_capacity_pcs_day: metric, production_capacity_dozen_yearly: metric },
    };
    given({ profile: PROFILE, hscodes: HS, facilityPanel: { data: panel, error: null } });
    const out = html(await fullPage("aboni-knitwear", { tab: "sites" }));
    const list = /data-facilities="true"[^>]*>([\s\S]*?)<\/ul>/.exec(out)?.[1] ?? "";
    assert.match(list, /Hemayetpur, Savar/);
    assert.doesNotMatch(list, /Gulshan-2/, "a later address is shown in place of the first");
  });

  /**
   * A page's placeholder inside every `layout.tsx` Next draws around it, as
   * the layouts render it, with every read going through the stub. The root
   * layout is left out: it loads the fonts, which need Next's compiler, and
   * reads nothing.
   */
  const inLayouts = async (page: string) => {
    given({ userId: "buyer-1" });
    const layouts: string[] = [];
    for (let dir = path.posix.dirname(page); dir !== "app"; dir = path.posix.dirname(dir)) {
      if (existsSync(path.join(process.cwd(), dir, "layout.tsx"))) layouts.push(`${dir}/layout.js`);
    }
    // Innermost first, so each layout wraps what the one inside it drew.
    let tree: ReactElement = createElement("p", null, "PAGE-BODY");
    for (const layout of layouts) tree = await route(layout).default({ children: tree });
    return { layouts, out: html(await outcome(async () => tree)) };
  };
  /** Every read the stub saw since `given`, one label each. */
  const readsSeen = () =>
    [
      ...Array.from({ length: authCalls }, () => "auth.getUser"),
      ...rpcCalls.map((c) => `rpc ${c.fn}`),
      ...fromCalls.map((c) => `from ${c.table} ${c.select ?? ""}`.trim()),
    ].sort();

  it("an /app page's layouts make none of the older shell's reads", async () => {
    // 29 Sep 2026: the `(app)` group's layout asked who is signed in, read
    // the role, counted the published suppliers and read the settings and a
    // dashboard on every full load of an /app page — six calls from Amsterdam
    // to the database in California, three of them one after another — and
    // then drew nothing around it. That layout is `(old-shell)`'s now.
    const app = await inLayouts("app/(app)/app/suppliers/[slug]/page.tsx");
    assert.ok(app.layouts.includes("app/(app)/app/layout.js"), `guard: the buyer layout was not found (${app.layouts.join(", ")})`);
    assert.match(app.out, /PAGE-BODY/);
    const appReads = readsSeen();
    // The buyer shell once (its sign-in and settings reads are stubbed here and counted in
    // `load-buyer-shell.test.ts`), the Compliance badge's two lists (B6c: the hub's own
    // count; a slow or failed read draws no badge) and Messages' unread total (row 24: both
    // started by the layout and not awaited, so the frame never waits on them), the "last active" stamp
    // (gap 4: `profile_touch`, fire and forget) and the getting-started card's first read (B8c: the
    // profile's state; this account has not been through the first-run steps, so the card reads no
    // more: the saved and RFQ counts, the settings and the team are pinned in `first-session.test.ts`).
    // The card reads inside a Suspense, beside the page, and none of it is the older shell's: the
    // product tour that used to read the profile is gone. Nothing else.
    assert.equal(shellLoads, 1, "the buyer layout did not read its shell exactly once");
    assert.deepEqual(
      appReads,
      [
        "from profiles onboarding_state",
        "rpc compliance_expired_certs",
        "rpc compliance_expiring_certs",
        "rpc profile_touch",
        "rpc thread_unread_total",
      ],
      `the layouts around an /app page read more: ${appReads.join("; ")}`,
    );

    // Not vacuous: through the same stub, the portals' reads show up where
    // their layout is drawn (B10a: who is signed in, the role, the settings;
    // the published-supplier count and the buyer dashboard it used to read
    // are gone with the old shell).
    currentPath = "/supplier/rfqs";
    try {
      await inLayouts("app/(app)/(old-shell)/supplier/rfqs/[id]/page.tsx");
    } finally {
      currentPath = "/app/discover";
    }
    const oldReads = readsSeen();
    for (const read of ["rpc settings_get", "from profiles role"]) {
      assert.ok(oldReads.includes(read), `the stub no longer sees the portal layout's ${read}: ${oldReads.join("; ")}`);
    }
    assert.ok(!oldReads.includes("from suppliers id"), "the portal layout counts the published suppliers again");

    // Which pages that shell wraps is the file tree's to say: every page of
    // the supplier portal and admin, and no /app page.
    const pages = walk(path.join(process.cwd(), "app", "(app)"))
      .filter((f) => path.basename(f) === "page.tsx")
      .map((f) => path.relative(process.cwd(), f).split(path.sep).join("/"));
    for (const file of pages) {
      const url = "/" + file.split("/").slice(1, -1).filter((seg) => !/^\(.*\)$/.test(seg)).join("/");
      const inOldShell = file.startsWith("app/(app)/(old-shell)/");
      assert.equal(inOldShell, /^\/(?:admin|supplier)(?:\/|$)/.test(url), `${url} is ${inOldShell ? "" : "not "}inside the older shell's layout (${file})`);
    }
    assert.ok(pages.some((f) => f.startsWith("app/(app)/(old-shell)/admin/")), "guard: the admin pages were not found");
  });

  it("the portal layout draws the portal frame around the supplier portal", async () => {
    // Its own boundary: the skip link and the one main landmark, rendered — not its
    // source text read. The menu marks the page `usePathname` names.
    currentPath = "/supplier/rfqs";
    try {
      const { out: portal } = await inLayouts("app/(app)/(old-shell)/supplier/rfqs/[id]/page.tsx");
      assert.match(portal, /href="#main-content"/, "the portal frame lost its skip link");
      assert.equal((portal.match(/<main[^>]*>/g) ?? []).filter((m) => m.includes('id="main-content"')).length, 1, "the portal frame has no main landmark");
      assert.match(portal, /PAGE-BODY/);
      // The supplier's own menu, the account menu, and a main the skip link can focus.
      assert.match(portal, /aria-label="Supplier portal menu"/, "the portal frame lost its menu");
      assert.match(portal, /RFQs received/, "the supplier menu lost RFQs received");
      assert.match(portal, /aria-label="Account:/, "the portal frame lost its account menu");
      assert.match(portal, /<main[^>]*tabindex="-1"/i, "the skip link's target cannot take focus");
    } finally {
      currentPath = "/app/discover";
    }
  });

  it("no loading boundary sits above the record or the line page: their 404 and 308 must be status codes, not streamed 200s", () => {
    // A `loading.tsx` is a Suspense boundary. With one above the record page
    // the shell streams first, the response is committed as 200, and every
    // `notFound()` and `permanentRedirect()` the page then throws becomes a
    // client-side 404 or redirect behind a 200 — a section-level
    // `app/(app)/app/loading.tsx` shipped on 27 Sep 2026 and CI's HTTP-boundary
    // guard (`scripts/test-profile-http-boundary.mjs`) caught exactly that.
    // Only an outside caller sees the status; this pins the cause.
    const under = ["", "suppliers", "suppliers/[slug]", "suppliers/[slug]/lines", "suppliers/[slug]/lines/[hs]"];
    for (const dir of under) {
      const file = path.join(process.cwd(), "app", "(app)", "app", dir, "loading.tsx");
      assert.ok(!existsSync(file), `${dir || "app/(app)/app"}/loading.tsx puts the record page behind a Suspense boundary`);
    }
    for (const file of ["app/loading.tsx", "app/(app)/loading.tsx"]) {
      assert.ok(!existsSync(path.join(process.cwd(), file)), `${file} puts every buyer page behind a Suspense boundary`);
    }
  });

  it("no loading state sits above any page that answers notFound, redirect or permanentRedirect", () => {
    // 27 Sep 2026: the list pages keep their skeletons inside `(list)` route
    // groups, which cover the list and nothing under it, so the detail and
    // `new` pages beside them answer a real 404 or redirect. The guard is the
    // rule, not a count: every page named below, and every page anywhere
    // under /app that calls `notFound()` or `permanentRedirect()` outside
    // the list-and-pane pages, has no `loading.tsx` between it and the root.
    const appDir = path.join(process.cwd(), "app", "(app)", "app");
    /** A page's route: its directory under /app with route groups dropped. */
    const routeOf = (file: string) =>
      path
        .relative(appDir, path.dirname(file))
        .split(path.sep)
        .filter((seg) => seg && !/^\(.*\)$/.test(seg))
        .join("/");
    const pages = walk(appDir).filter((f) => path.basename(f) === "page.tsx");
    const NAMED = ["orders/[id]", "orders/new", "rfqs/[id]", "rfqs/new", "products/[id]", "suppliers/[slug]", "suppliers/[slug]/lines/[hs]", "messages/[thread]"];
    // No page is exempt now: the inbox's list moved into `messages/(list)` in B6a (4 Oct 2026),
    // so a conversation that is not the caller's answers a real 404.
    const LIST_AND_PANE = new Set<string>();
    const checked = pages.filter((f) => {
      const r = routeOf(f);
      if (NAMED.includes(r)) return true;
      if (LIST_AND_PANE.has(r)) return false;
      return /\b(?:notFound|permanentRedirect)\(/.test(readFileSync(f, "utf8"));
    });
    for (const named of NAMED) {
      const page = pages.find((f) => routeOf(f) === named);
      if (page) assert.match(readFileSync(page, "utf8"), /\b(?:notFound|redirect|permanentRedirect)\(/, `${named} answers no status any more; drop it from this list`);
    }
    assert.ok(checked.length >= 5, `guard: the status-answering pages were not found (${checked.map(routeOf).join(", ")})`);
    for (const page of checked) {
      for (let dir = path.dirname(page); dir.startsWith(path.join(process.cwd(), "app")); dir = path.dirname(dir)) {
        const loading = path.join(dir, "loading.tsx");
        assert.ok(
          !existsSync(loading),
          `${path.relative(process.cwd(), loading)} sits above /app/${routeOf(page)}, so its 404 or redirect streams behind a 200`,
        );
      }
    }
  });

  it("a kit route's loading state draws only the content region — the layout's shell is already on screen", async () => {
    // Rendered, not read: cycle 7 replaced KitLoading's body with its children
    // and every source-reading check still passed. Since 27 Sep the layout
    // draws the shell once and keeps it across navigations, so a loading
    // state that drew a sidebar, a skip link or a main landmark of its own
    // would put a second of each inside the layout's for as long as the page
    // took — and a plan it does not know.
    // Every /app route is the kit's, so every /app loading state is
    // governed by this.
    const kitLoading = walk(path.join(process.cwd(), "app", "(app)", "app"))
      .filter((f) => path.basename(f) === "loading.tsx")
      .map((f) => path.relative(process.cwd(), f).split(path.sep).join("/"));
    // Counted from the disk, not pinned: the list pages' skeletons moved into
    // `(list)` groups on 27 Sep 2026, and the detail pages lost theirs.
    assert.ok(kitLoading.length > 0, "the /app loading states were not found");
    // And they are the kit's frame. The search's is the table's own silhouette
    // (`ResultsSkeleton`, B4), so the results replace it in place; Saved's and the saved
    // searches' is Saved's own (`SavedSkeleton`, B6b), Products' is `ProductsSkeleton` (B7a).
    for (const dir of ["discover", "saved", "products/(list)", "searches"]) {
      const loading = readFileSync(path.join(process.cwd(), "app", "(app)", "app", ...dir.split("/"), "loading.tsx"), "utf8");
      assert.match(loading, /<KitLoading\b|<ResultsColumn\b|<ResultsSkeleton\b|<SavedSkeleton\b|<ProductsSkeleton\b/, `/app/${dir}'s loading state has no frame`);
    }
    for (const file of kitLoading) {
      const out = renderToStaticMarkup(createElement(route(file.replace(/\.tsx$/, ".js")).default));
      assert.doesNotMatch(out, /href="#main-content"|<main\b|<aside\b|aria-label="Account and settings"/, `${file}: a second shell inside the layout's`);
      assert.doesNotMatch(out, /data-plan=/, `${file}: a plan the loading state does not know`);
      // And it is the page frame with a skeleton inside, not an empty region.
      assert.match(out, /role="status" aria-busy="true"/, `${file}: no skeleton in the content region`);
    }
  });
});
