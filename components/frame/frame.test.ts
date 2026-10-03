// The v4 app frame (B3): which item is current on every /app path, the phone's
// titles and tabs, and the markup a buyer, a keyboard and a screen reader meet.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let currentPath = "/app";
{
  // The client hooks need a mounted App Router; only they are replaced.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
      useSearchParams: () => new URLSearchParams("q=knit"),
      usePathname: () => currentPath,
    },
  } as unknown as NodeJS.Module;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppFrame, ListPane } = require("@/components/frame") as typeof import("@/components/frame");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nav = require("@/lib/frame-nav") as typeof import("@/lib/frame-nav");

const account = { initial: "RK", name: "Rezaul Karim", email: "rk@example.invalid" };

function frame(at: string, badges = {}) {
  currentPath = at;
  return renderToStaticMarkup(createElement(AppFrame, { account, badges } as Parameters<typeof AppFrame>[0], createElement("p", null, "PAGE-BODY")));
}

describe("which item a path belongs to", () => {
  const cases: [string, string | null, boolean][] = [
    ["/app", "search", true],
    ["/app/discover", "search", false],
    ["/app/suppliers/ar-fashion", "search", false],
    ["/app/saved", "saved", true],
    ["/app/searches/new", "saved", false],
    ["/app/rfqs/12", "rfqs", false],
    ["/app/orders", "orders", true],
    ["/app/compliance/expiry", "compliance", false],
    ["/app/headings/6105", "products", false],
    ["/app/settings/profile/", "settings", false],
    ["/app/nowhere", null, false],
  ];
  for (const [p, key, exact] of cases) {
    it(p, () => assert.deepEqual(nav.frameMatch(p), { key, exact }));
  }
  it("orders sit under the Quotes tab; Products and Settings have none", () => {
    assert.equal(nav.phoneTab("/app/orders/9"), "rfqs");
    assert.equal(nav.phoneTab("/app/products"), null);
    assert.equal(nav.phoneTab("/app/discover"), "search");
  });
  it("the phone titles are Paper's", () => {
    assert.equal(nav.phoneTitle("/app/compliance"), "Alerts");
    assert.equal(nav.phoneTitle("/app/compliance/uflpa"), "UFLPA checks");
    assert.equal(nav.phoneTitle("/app/rfqs/new"), "New RFQ");
    assert.equal(nav.phoneTitle("/app/rfqs/42"), "Quotes");
    assert.equal(nav.phoneTitle("/app/settings/profile"), "Settings");
    assert.equal(nav.phoneTitle("/elsewhere"), null);
  });
});

describe("the frame a buyer receives", () => {
  it("the sidebar, in Paper's order, marks the page and the section", () => {
    const html = frame("/app/saved");
    const labels = [...html.matchAll(/<a [^>]*title="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(labels, ["Search", "Saved", "Messages", "RFQs and quotes", "Orders", "Compliance", "Products", "Settings"]);
    assert.match(html, /<a aria-current="page" title="Saved" class="[^"]*bg-brand-tint[^"]*" href="\/app\/saved"/);
    assert.match(frame("/app/rfqs/12"), /<a aria-current="true" title="RFQs and quotes"/);
  });

  it("one skip link to one main, and no data-shell (B0: it turns v4's brand tint grey)", () => {
    const html = frame("/app");
    assert.match(html, /<a href="#main-content"[^>]*>Skip to content<\/a>/);
    assert.equal((html.match(/<main [^>]*id="main-content"/g) ?? []).length, 1);
    assert.match(html, /PAGE-BODY/);
    assert.doesNotMatch(html, /data-shell/);
  });

  it("the search landing draws its own field; every other page gets the topbar's, with the query", () => {
    assert.doesNotMatch(frame("/app"), /data-search="topbar"/);
    const results = frame("/app/discover");
    assert.match(results, /<form[^>]*role="search"[^>]*action="\/app\/discover"/);
    assert.match(results, /<input[^>]*data-search="topbar"[^>]*name="q" value="knit"/);
    assert.match(results, /placeholder="Supplier, product or certificate"/);
  });

  it("a badge reads as words beside the name, and as a dot on the phone tab", () => {
    const html = frame("/app", { compliance: { text: "2 to check", tone: "danger" } });
    assert.match(html, /Compliance<span class="sr-only">, 2 to check<\/span>/);
    assert.match(html, /class="hidden text-xs font-semibold 2xl:inline text-danger">2 to check</);
    assert.match(html, /aria-label="Alerts, new"/);
    assert.doesNotMatch(frame("/app", { compliance: null }), /to check|Alerts, new/, "an unread count draws nothing");
  });

  it("the phone: Paper's title, the account button, and the five tabs with the current one", () => {
    const html = frame("/app/orders");
    assert.match(html, /<span class="truncate text-xl font-semibold tracking-tight text-ink">Quotes<\/span>/);
    assert.match(html, /aria-label="Account: Rezaul Karim"/);
    const tabs = /<nav aria-label="Tabs".*?<\/nav>/.exec(html)?.[0] ?? "";
    assert.deepEqual([...tabs.matchAll(/<a [^>]*>.*?<\/svg>([^<]+)/g)].map((m) => m[1]), ["Messages", "Quotes", "Alerts", "Saved", "Search"]);
    assert.match(tabs, /<a aria-current="page"[^>]*href="\/app\/rfqs"/);
  });

  it("the buyer layout draws the frame once, with the signed-in account", () => {
    const layout = readFileSync(path.join(process.cwd(), "app", "(app)", "app", "layout.tsx"), "utf8");
    assert.equal((layout.match(/<AppFrame\b/g) ?? []).length, 1);
    assert.match(layout, /account=\{shell\.sidebar\.account \?\? null\}/);
  });
});

describe("the list and the pane", () => {
  it("from 1280 the pane docks beside the list, 640 wide; closed, the list fills", () => {
    const open = renderToStaticMarkup(createElement(ListPane, { list: "LIST", listLabel: "Results", pane: "PANE", paneTitle: "Aboni Knitwear Ltd.", closeHref: "/app/discover?q=knit" }));
    assert.match(open, /<section aria-label="Results"[^>]*>LIST<\/section><section aria-label="Aboni Knitwear Ltd\."[^>]*class="hidden [^"]*w-pane[^"]*xl:flex">PANE<\/section>/);
    const shut = renderToStaticMarkup(createElement(ListPane, { list: "LIST", listLabel: "Results", closeHref: "/app/discover" }));
    assert.doesNotMatch(shut, /w-pane/);
  });
});
