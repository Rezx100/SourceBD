// The buyer pages rebuilt in the enterprise pass (27 Sep 2026), at the ROUTE
// boundary: the HS headings page, Settings, and the old plan
// address. Component tests cannot see what a route passes its components —
// which record it reads, which Close it wires, which row it marks — so these
// import the route modules, run them over a fake Supabase client, and assert
// the HTML a browser receives (AGENTS 16; the pattern is record-routes.test.ts).
//
// What it does NOT cover: the real database. The client is a stub, so these
// say what the routes do with a given payload, not that the RPCs return one.

import assert from "node:assert/strict";
import { type ReactElement } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { after, describe, it } from "node:test";
import path from "node:path";

import { aboniInput } from "@/lib/dashboard/fixtures";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
const resolved = (mod: string) => require.resolve(path.join(OUT, mod));

type Rpc = { data: unknown; error: unknown };
type Answers = Partial<Record<string, Rpc>>;

/** One stub, installed once, reading a mutable `answers` (a route captures its client module on first require). */
let answers: Answers = {};
let rpcCalls: { fn: string; args: Record<string, unknown> | undefined }[] = [];

const ABONI = aboniInput();
const RECORD: Answers = {
  buyer_supplier_profile: { data: ABONI.profile, error: null },
  supplier_epb_hscodes: { data: ABONI.hscodes.map((h) => ({ code: h.code, description: h.description, source_url: h.source_url })), error: null },
  supplier_contact_counts: { data: { emails: 1, phones: 6, website: true, representatives: 1 }, error: null },
};

function fakeClient() {
  return {
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return answers[fn] ?? { data: fn === "production_workers_display_batch" ? [] : null, error: null };
    },
    auth: { getUser: async () => ({ data: { user: { id: "buyer-1" } } }) },
    from() {
      const result = () => Promise.resolve({ data: [], error: null, count: 0 });
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        contains: () => chain,
        order: () => chain,
        limit: () => result(),
        maybeSingle: () => Promise.resolve({ data: null }),
        then: (res: (v: unknown) => unknown) => result().then(res),
      };
      return chain;
    },
  };
}

{
  // `next/navigation`'s client hooks need a mounted App Router; the server
  // halves (`notFound`, `redirect`) keep their real behaviour.
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
      usePathname: () => "/app",
      useParams: () => ({}),
    },
  } as unknown as NodeJS.Module;
  const client = fakeClient();
  const id = resolved("lib/supabase/server.js");
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: { createSupabaseServerClient: async () => client },
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;
}

after(() => {
  delete require.cache[resolved("lib/supabase/server.js")];
});

function given(a: Answers): void {
  rpcCalls = [];
  answers = a;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(resolved(p));

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

async function render(run: () => Promise<ReactElement>): Promise<string> {
  return renderStreamed(await run());
}

/** What a reader sees: the markup with its tags removed. */
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------

describe("/app/headings — the HS catalogue at its new address", () => {
  const Headings = () => route("app/(app)/app/headings/page.js").default;

  it("never prints the code twice: a heading without a buyer label takes the catalogue's heading, else the code alone", async () => {
    given({
      hs_catalogue: {
        data: [
          { hs: "6109", heading: null, exporter_count: 1763 },
          { hs: "6302", heading: null, exporter_count: 54 },
          { hs: "9999", heading: null, exporter_count: 2 },
        ],
        error: null,
      },
    });
    const out = await render(() => Headings()({ searchParams: Promise.resolve({}) }));
    const seen = text(out);
    assert.match(out, /<h1[^>]*>HS headings<\/h1>/);
    assert.match(seen, /6109 T-shirts/);
    assert.match(seen, /6302 Bed linen, table linen, toilet linen and kitchen linen/);
    assert.doesNotMatch(seen, /HS 6302|HS 9999|9999 HS/);
    assert.match(out, /href="\/app\/discover\?hs=6302"/);
    assert.match(out, /placeholder="Search headings"/);
    assert.match(out, /action="\/app\/headings"/);
    assert.match(seen, /exporter counts leave out sanctioned suppliers/);
    assert.match(out, /role="region" aria-label="HS headings"/, "the kit table");
  });

  it("a failed read says so and draws no empty table", async () => {
    given({ hs_catalogue: { data: null, error: { message: "boom" } } });
    const out = await render(() => Headings()({ searchParams: Promise.resolve({}) }));
    assert.match(out, /Exporter counts could not be read/);
    assert.match(out, /role="alert"/);
    assert.doesNotMatch(out, /<table/);
  });
});

// ---------------------------------------------------------------------------

describe("Settings — the old plan address", () => {
  it("the old plan address answers a real 308 to Subscription", async () => {
    const res = route("app/(app)/app/settings/plan/route.js").GET() as Response;
    assert.equal(res.status, 308);
    assert.match(res.headers.get("location") ?? "", /\/app\/settings\/subscription$/);
  });
});

// ---------------------------------------------------------------------------

describe("/app/compliance — the certificate row a compliance link names", () => {
  it("the row the link names exists on the record", async () => {
    given({ ...RECORD });
    const out = await render(() =>
      route("app/(app)/app/suppliers/[slug]/page.js").default({ params: Promise.resolve({ slug: "aboni-knitwear" }), searchParams: Promise.resolve({}) }),
    );
    // On the Overview ("Needs a look" holds the expired and expiring ones the hub lists) and on the Certificates tab.
    assert.match(out, /<li [^>]*id="cert-wrap-7865"[^>]*class="[^"]*target:bg-brand-tint|<li id="cert-wrap-7865" class="[^"]*target:bg-brand-tint/);
  });
});
