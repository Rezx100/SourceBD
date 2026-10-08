// The v4 app frame (B3): which item is current on every /app path, the phone's
// titles and tabs, and the markup a buyer, a keyboard and a screen reader meet.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prerenderToNodeStream } from "react-dom/static";

import { KEY_WORDS, SHORTCUTS, ShortcutList } from "@/components/frame/shortcuts";

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
// After the mock, like the frame itself: a static import would load the sidebar before `usePathname` is replaced.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { badgeFigure } = require("@/components/frame/sidebar") as typeof import("@/components/frame/sidebar");

const account = { initial: "RK", name: "Rezaul Karim", email: "rk@example.invalid" };

function frame(at: string, badges: object = {}) {
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

  it("one skip link to one main, and data-shell on the root (the Spent Green Rule: ds.css turns the brand tints and link ink grey inside it)", () => {
    const html = frame("/app");
    assert.match(html, /<a href="#main-content"[^>]*>Skip to content<\/a>/);
    assert.equal((html.match(/<main [^>]*id="main-content"/g) ?? []).length, 1);
    assert.match(html, /PAGE-BODY/);
    assert.match(html, /^<div data-shell="" class="group\/shell /, "the remap in app/ds.css never runs without data-shell on the root");
    const css = readFileSync(path.join(process.cwd(), "app", "ds.css"), "utf8");
    const block = /\[data-shell\] \{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
    for (const v of ["--ds-brand-ink", "--ds-brand-tint", "--ds-brand-tint-strong", "--ds-brand-wash", "--ds-focus"]) assert.match(block, new RegExp(`${v}: var\\(--ds-(accent|ink|surface)`), v);
  });

  // Critique of 7 Oct 2026, item 2: 27 green elements on the record page, because the kit drew the solid
  // `brand` on links, rings, tab underlines, bars and ticked boxes, which no remap reaches. Inside the app
  // those take `brand-ink` (remapped to the hueless accent) and `focus` (remapped too); outside it both are
  // brand green, so the marketing site is unchanged. Solid `brand` is the primary button and the wordmark.
  it("spends solid brand green on the primary button and the wordmark only: no link, ring, tab, bar or box draws `brand`", () => {
    const retired = /\b(?:[\w[\]:-]+:)?(?:text|border|border-l|outline|ring|decoration)-brand\b(?!-)(?!\/)/g;
    const roots = ["frame", "kit", "search", "record", "patterns", "saved", "rfqs", "compliance", "messages", "orders", "settings", "headings", "onboarding"].map((d) => path.join(process.cwd(), "components", d));
    const hits: string[] = [];
    for (const root of roots) {
      for (const f of readdirSync(root).filter((f) => /\.tsx?$/.test(f) && !/\.test\.ts$/.test(f))) {
        if (f === "pane-divider.tsx") continue; // the founder's 40% green divider (6 Oct 2026), decided
        const src = readFileSync(path.join(root, f), "utf8");
        for (const [i, line] of src.split("\n").entries()) {
          if (/tracking-tight text-brand 2xl:block/.test(line)) continue; // the wordmark
          if (retired.test(line)) hits.push(`${path.basename(root)}/${f}:${i + 1}`);
          retired.lastIndex = 0;
        }
      }
    }
    assert.deepEqual(hits, [], "a solid brand class the data-shell remap cannot reach");
    assert.match(readFileSync(path.join(process.cwd(), "components", "kit", "button-class.ts"), "utf8"), /bg-brand text-brand-on/, "the primary button keeps brand green");
  });

  it("the search landing draws its own field; every other page gets the topbar's, with the query", () => {
    assert.doesNotMatch(frame("/app"), /data-search="topbar"/);
    const results = frame("/app/discover");
    assert.match(results, /<form[^>]*role="search"[^>]*action="\/app\/discover"/);
    assert.match(results, /<input[^>]*data-search="topbar"[^>]*name="q" value="knit"/);
    assert.match(results, /placeholder="Supplier, product or certificate"/);
    assert.match(results, /<input[^>]*role="combobox"[^>]*aria-autocomplete="list"[^>]*aria-expanded="false"[^>]*aria-controls=/, "the one field is a combobox over a listbox");
  });

  it("a badge is a mono figure in a pill, its words in the row's accessible name, and a dot on the phone tab", () => {
    const html = frame("/app", { compliance: { text: "2 to check", tone: "caution" } });
    assert.match(html, /Compliance<span class="sr-only">, 2 to check<\/span>/);
    // Critique of 8 Oct 2026, item 3: a count of dates that passed is caution, never danger red.
    assert.match(html, /class="hidden h-5 shrink-0 items-center rounded-md px-1\.5 font-mono text-xs font-medium tabular-nums 2xl:inline-flex bg-caution-tint text-caution">2</, "the pill is the number alone, in caution");
    assert.doesNotMatch(html, /bg-danger-tint|text-danger/, "red in the rail for a date that passed");
    assert.match(html, /rounded-full border-2 border-subtle 2xl:hidden bg-caution-icon"/, "the collapsed rail's dot follows the badge's tone");
    assert.ok(!/>2 to check</.test(html), "the words are drawn, not only read");
    assert.match(html, /aria-label="Alerts, new"/);
    assert.doesNotMatch(frame("/app", { compliance: null }), /to check|Alerts, new/, "an unread count draws nothing");
  });

  // Critique of 7 Oct 2026, item 7: "Complia… 10 to check" at 232px, the topbar's icon + "Account" placeholder, "Certificates · 4" tabs.
  it("a three-digit badge cannot clip its label: the label never truncates, the pill is the figure, the words stay for a screen reader", () => {
    const html = frame("/app", { compliance: { text: "120 to check", tone: "caution" }, messages: { text: "99+ new" } });
    assert.match(html, /Compliance<span class="sr-only">, 120 to check<\/span>/);
    assert.match(html, /tabular-nums 2xl:inline-flex bg-caution-tint text-caution">120</);
    assert.match(html, /tabular-nums 2xl:inline-flex bg-sunken text-ink-2">99\+</);
    assert.doesNotMatch(/<nav aria-label="Main menu"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "", /truncate|text-ellipsis|line-clamp/, "a label is cut in the rail");
    assert.deepEqual([badgeFigure("120 to check"), badgeFigure("99+ new"), badgeFigure("new")], ["120", "99+", "new"]);
  });

  it("the account control is the row at the sidebar's foot (photo, name, plan, a menu), and the topbar draws none", () => {
    const html = frame("/app/orders");
    const foot = /<div class="border-t border-line px-3 py-2">([\s\S]*?)<\/div><\/aside>/.exec(html)?.[1] ?? "";
    assert.ok(foot, "no account row under Products and Settings");
    assert.match(foot, /<button type="button" aria-label="Account: Rezaul Karim" title="Rezaul Karim · Public beta" data-account-row="" class="flex h-12 w-full/);
    assert.match(foot, /<span aria-hidden="true" class="[^"]*size-8[^"]*rounded-full[^"]*">RK<\/span>/, "the initials stand in for a photo");
    assert.match(foot, /<span class="text-base font-medium text-ink \[overflow-wrap:anywhere\]">Rezaul Karim<\/span><span class="text-sm text-ink-3">Public beta<\/span>/);
    const topbar = /<div class="hidden h-topbar[^"]*">[\s\S]*?<\/div><div class="sticky|<div class="hidden h-topbar[^"]*">[\s\S]*?<\/form><\/div>/.exec(html)?.[0] ?? "";
    assert.ok(!/Account/.test(topbar), "the topbar still draws an account control");
    assert.equal((html.match(/aria-label="Account: Rezaul Karim"/g) ?? []).length, 2, "the sidebar's row and the phone's button");
    // A known plan is the row's second line, as a workspace switcher draws it.
    const planned = renderToStaticMarkup(createElement(AppFrame, { account: { ...account, plan: "Free plan" } } as Parameters<typeof AppFrame>[0], "x"));
    assert.match(planned, /<span class="text-sm text-ink-3">Free plan · Public beta<\/span>/);
  });

  describe("badges that arrive after the frame (row 24)", () => {
    const withPromise = async (badges: Promise<unknown>, at = "/app") => {
      currentPath = at;
      const el = createElement(AppFrame, { account, badges } as Parameters<typeof AppFrame>[0], createElement("p", null, "PAGE-BODY"));
      const { prelude } = await prerenderToNodeStream(el);
      let out = "";
      for await (const chunk of prelude) out += String(chunk);
      return out.replace(/<!--[\s\S]*?-->/g, "");
    };

    it("the menu, the page and the tab bar are drawn without waiting; the counts fill in when the promise settles", async () => {
      // Before it settles: the shell a static render receives is the fallback, with every item and no count.
      const early = frame("/app", new Promise(() => {}));
      assert.match(early, /PAGE-BODY/);
      assert.deepEqual([...early.matchAll(/<a [^>]*title="([^"]+)"/g)].map((m) => m[1]).length, 8);
      assert.doesNotMatch(early, /to check|new<|Alerts, new/);
      // Settled: both counts are there, the same words as a plain object gives.
      const late = await withPromise(Promise.resolve({ messages: { text: "2 new" }, compliance: { text: "5 to check", tone: "caution" } }));
      assert.match(late, /Messages<span class="sr-only">, 2 new<\/span>/);
      assert.match(late, /Compliance<span class="sr-only">, 5 to check<\/span>/);
      assert.match(late, /aria-label="Alerts, new"/);
      assert.match(late, /aria-label="Messages, new"/);
    });

    it("a promise of nothing draws no badge, and no 0", async () => {
      const out = await withPromise(Promise.resolve({ messages: null, compliance: null }));
      assert.doesNotMatch(out, /to check|, new"|>0 /);
      assert.equal((out.match(/title="[^"]+"/g) ?? []).length >= 8, true);
    });
  });

  it("the phone: Paper's title, the account button, and the five tabs with the current one", () => {
    const html = frame("/app/orders");
    assert.match(html, /<span class="truncate text-xl font-semibold tracking-tight text-ink">Quotes<\/span>/);
    assert.match(html, /aria-label="Account: Rezaul Karim"/);
    const tabs = /<nav aria-label="Tabs".*?<\/nav>/.exec(html)?.[0] ?? "";
    assert.deepEqual([...tabs.matchAll(/<a [^>]*>.*?<\/svg>([^<]+)/g)].map((m) => m[1]), ["Messages", "Quotes", "Alerts", "Saved", "Search"]);
    assert.match(tabs, /<a aria-current="page"[^>]*href="\/app\/rfqs"/);
  });

  it("an unread sign-in still offers the account menu and sheet", () => {
    currentPath = "/app/messages";
    const html = renderToStaticMarkup(createElement(AppFrame, { account: null } as Parameters<typeof AppFrame>[0], "x"));
    assert.equal((html.match(/aria-label="Account: Your account"/g) ?? []).length, 2);
  });

  it("the buyer layout draws the frame once, with the signed-in account", () => {
    const layout = readFileSync(path.join(process.cwd(), "app", "(app)", "app", "layout.tsx"), "utf8");
    assert.equal((layout.match(/<AppFrame\b/g) ?? []).length, 1);
    assert.match(layout, /account=\{shell\.account\}/);
  });

  // Critique of 8 Oct 2026, item 6: no help layer. The account menu opens a sheet listing the keys the app handles.
  it("the account menu offers Keyboard shortcuts, and the sheet lists every key keys.ts handles, plus Esc, Ctrl K and Ctrl ↵", () => {
    const topbar = readFileSync(path.join(process.cwd(), "components", "frame", "topbar.tsx"), "utf8");
    assert.match(topbar, /<MenuItem onSelect=\{\(\) => setShortcuts\(true\)\}>Keyboard shortcuts<\/MenuItem>/);
    const keys = readFileSync(path.join(process.cwd(), "components", "search", "keys.ts"), "utf8");
    const handled = [...keys.matchAll(/case "([^"]+)":/g)].map((m) => KEY_WORDS[m[1]!] ?? m[1]!);
    assert.ok(handled.length >= 8, `keys.ts handles ${handled.length} keys`);
    const listed = new Set(SHORTCUTS.flatMap((s) => s.keys));
    for (const k of handled) assert.ok(listed.has(k), `the sheet does not list ${k}`);
    for (const k of ["Esc", "Ctrl K", "Ctrl ↵"]) assert.ok(listed.has(k), `the sheet does not list ${k}`);
    const html = renderToStaticMarkup(createElement(ShortcutList));
    assert.match(html, /<kbd[^>]*>↓<\/kbd>/);
    assert.match(html, /<kbd[^>]*>Ctrl K<\/kbd>/);
    assert.equal((html.match(/<kbd/g) ?? []).length, SHORTCUTS.reduce((n, s) => n + s.keys.length, 0));
  });

  it("an admin's account menu and phone sheet link to the console; nobody else's do (founder, 6 Oct 2026)", () => {
    const read = (f: string) => readFileSync(path.join(process.cwd(), "components", "frame", f), "utf8");
    assert.match(read("topbar.tsx"), /\{account\.admin \? <MenuItem href="\/admin">Admin console<\/MenuItem> : null\}/);
    assert.match(read("phone.tsx"), /\{account\.admin \? <SheetRow href="\/admin"/);
  });
});

describe("the list and the pane", () => {
  it("from 1280 the pane docks beside the list, 640 wide; closed, the list fills", () => {
    const open = renderToStaticMarkup(createElement(ListPane, { list: "LIST", listLabel: "Results", pane: "PANE", paneTitle: "Aboni Knitwear Ltd.", closeHref: "/app/discover?q=knit" }));
    assert.match(open, /<section aria-label="Results"[^>]*>LIST<\/section><div role="separator"[^>]*>.*?<\/div><section aria-label="Aboni Knitwear Ltd\."[^>]*class="hidden [^"]*w-pane[^"]*xl:flex">PANE<\/section>/);
    const shut = renderToStaticMarkup(createElement(ListPane, { list: "LIST", listLabel: "Results", closeHref: "/app/discover" }));
    assert.doesNotMatch(shut, /w-pane/);
    assert.doesNotMatch(shut, /role="separator"/, "a divider with no pane to resize");
  });

  it("the edge between the list and the docked pane is a keyboard-adjustable divider", () => {
    // Founder, 6 Oct 2026: the pane must be resizable, as Paper's frame lets it be. The divider is
    // drawn on the server at the 640 default (the buyer's own width is read after hydration).
    const open = renderToStaticMarkup(createElement(ListPane, { list: "LIST", listLabel: "Results", pane: "PANE", paneTitle: "Aboni", closeHref: "/app/discover" }));
    const sep = /<div role="separator"[^>]*>/.exec(open)?.[0] ?? "";
    for (const a of ['aria-orientation="vertical"', 'aria-controls="list-pane"', 'aria-valuenow="640"', 'aria-valuemin="480"', 'aria-label="Resize the record pane"', 'tabindex="0"', "cursor-col-resize", "xl:block"]) assert.ok(sep.includes(a), `the divider lacks ${a}: ${sep}`);
    assert.match(open, /<section aria-label="Aboni" id="list-pane"/, "the divider controls no pane");
    // Paper's divider (`02 Components` · 5 Overlays): a 1px line at rest; under the pointer, held
    // or focused, a 2px line and a 9 by 32 grip. Founder, 6 Oct 2026: "make sure the green is very
    // subtle there", so neither may be solid brand green, and nothing fills the strip.
    const inner = /<div role="separator"[^>]*>(.*?)<\/div>/.exec(open)?.[1] ?? "";
    const [rest, line, grip] = inner.match(/<span [^>]*>/g) ?? [];
    assert.match(rest ?? "", /class="[^"]*\bw-px bg-line\b/, "no 1px line at rest");
    for (const [what, el, size] of [["2px line", line, "w-0.5"], ["grip", grip, "h-8 w-[9px]"]] as const) {
      assert.ok(el?.includes(size) && / opacity-0 /.test(el), `the ${what} is missing or shows at rest: ${el}`);
      for (const on of ["group-hover:opacity-100", "group-focus-visible:opacity-100", "group-active:opacity-100"]) assert.ok(el?.includes(on), `the ${what} lacks ${on}`);
    }
    assert.doesNotMatch(sep + inner, /(bg|border|text)-brand(?![\w/-])|bg-brand-(wash|tint)/, "the divider is drawn in solid green");
    // The filters panel lies over the list: there is nothing beside it to resize.
    const over = renderToStaticMarkup(createElement(ListPane, { list: "LIST", listLabel: "Results", pane: "PANE", paneTitle: "Filters", closeHref: "/app/discover", presentation: "overlay" }));
    assert.doesNotMatch(over, /role="separator"/);
  });

  it("the pane keeps at least 480 and leaves the list at least 400 (Paper's caption)", () => {
    const { clampPaneWidth, RECORD_PANE } = require("@/components/frame/pane-divider") as typeof import("@/components/frame/pane-divider"); // eslint-disable-line @typescript-eslint/no-require-imports
    assert.deepEqual({ initial: RECORD_PANE.initial, min: RECORD_PANE.min, keep: RECORD_PANE.keep }, { initial: 640, min: 480, keep: 400 });
    assert.equal(clampPaneWidth(640, 1216), 640);
    assert.equal(clampPaneWidth(200, 1216), 480, "narrower than 480");
    assert.equal(clampPaneWidth(420, 1216), 480, "a width kept from when the pane went down to 400");
    assert.equal(clampPaneWidth(1000, 1216), 816, "into the list's 400");
    assert.equal(clampPaneWidth(700, 800), 480, "a row too narrow for both still leaves the pane 480");
    assert.equal(clampPaneWidth(Number.NaN, 1216), 640, "a stored width that is not a number");
    assert.equal(clampPaneWidth(512.6, 1216), 513);
    // Another pane brings its own limits: the RFQ page's preview.
    assert.equal(clampPaneWidth(900, 1056, { key: "k", initial: 344, min: 320, keep: 480 }), 576);
    // CSS holds the same two limits before the browser has measured the row.
    const src = readFileSync(path.join(process.cwd(), "components", "frame", "list-pane.tsx"), "utf8");
    assert.match(src, /w-pane min-w-\[480px\] max-w-\[calc\(100%-400px\)\]/);
  });

  it("there is one divider: the list's pane and the New RFQ page draw the shared one", () => {
    // Founder, 6 Oct 2026: "Reuse the same for the divider." What each draws is tested where it
    // is drawn (above, and in `components/rfqs/composer.test.ts`); this keeps a second one out.
    for (const file of [["frame", "list-pane.tsx"], ["rfqs", "composer.tsx"]]) {
      const src = readFileSync(path.join(process.cwd(), "components", ...file), "utf8");
      assert.match(src, /<PaneDivider /, `${file[1]} does not use the shared divider`);
      assert.doesNotMatch(src, /role="separator"/, `${file[1]} draws a divider of its own`);
    }
  });

  it("the filters lie over the list from 1280, 360 wide, and the list keeps its width and stays live", () => {
    // B4 fix 4 (`Filters panel open, live count`): absolute, right 0, under the topbar, a left
    // edge and the dialog shadow, over a list that is not narrowed. No scrim, so not modal.
    const out = renderToStaticMarkup(createElement(ListPane, { list: "LIST", listLabel: "Results", pane: "PANE", paneTitle: "Filters", closeHref: "/app/discover?q=knit", presentation: "overlay" }));
    assert.match(out, /^<div class="[^"]*\brelative\b[^"]*">/, "the panel has nothing to lie over");
    assert.match(out, /<section aria-label="Results" class="flex min-h-0 min-w-0 flex-1 [^"]*">LIST<\/section>/);
    const panel = /<section aria-label="Filters" class="([^"]*)">PANE<\/section>/.exec(out)?.[1] ?? "";
    for (const c of ["absolute", "inset-y-0", "right-0", "w-panel", "border-l", "shadow-dialog", "bg-surface", "hidden", "xl:flex"]) assert.ok(panel.split(" ").includes(c), `the panel lacks ${c}: ${panel}`);
    assert.doesNotMatch(panel, /\bw-pane\b/, "the filters are docked at 640");
    assert.doesNotMatch(out, /aria-modal|\sinert[\s=>]/, "a panel over live results claims to be modal");
    // Records stay docked beside the list, and the frame stays put for them.
    const docked = renderToStaticMarkup(createElement(ListPane, { list: "LIST", listLabel: "Results", pane: "PANE", paneTitle: "Aboni", closeHref: "/app/discover" }));
    assert.doesNotMatch(/<section aria-label="Aboni"[^>]*>/.exec(docked)?.[0] ?? "absolute", /w-panel|absolute/);
  });

  it("under 1280 Escape typed in a field does not close the drawer or the sheet", () => {
    // Code review, B4 fixes 3 and 4: Radix closes a dialog on any Escape, so a buyer dismissing
    // a datalist in the phone filter sheet lost the draft. The docked pane already ignored it.
    // The portals do not render statically, so the guard reads the kit's source.
    const src = readFileSync(path.join(process.cwd(), "components", "kit", "overlay.tsx"), "utf8");
    assert.match(src, /function keepEscapeInFields\(e: KeyboardEvent\) \{\s*if \(\(e\.target[^)]*\)\?\.closest\?\.\("input, textarea, select, \[contenteditable=true\]"\)\) e\.preventDefault\(\);/);
    for (const name of ["Sheet", "Drawer"]) {
      const body = src.slice(src.indexOf(`export function ${name}(`), src.indexOf("\nexport function", src.indexOf(`export function ${name}(`) + 1));
      assert.match(body, /onEscapeKeyDown=\{keepEscapeInFields\}/, `${name} closes on Escape from a field`);
    }
  });
});
