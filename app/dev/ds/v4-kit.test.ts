// The kit of Paper's `02 Components` (B1): what each primitive renders as a buyer,
// a keyboard and a screen reader meet it, and the rules the boards drew into it, held
// as guards so a later page cannot quietly break them.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookmarkSimple, Bell, ChatCircleText, MagnifyingGlass, Receipt } from "@phosphor-icons/react";

import { Button, buttonClass, Checkbox, Field, IconButton, Input, RefusedBar, Switch, TabBar, TabLink, Table, Td, Th, Tr, SelectCell } from "@/components/kit";
import { V4Kit } from "./v4-kit";

type FieldArgs = Parameters<Parameters<typeof Field>[0]["children"]>[0];

const html = renderToStaticMarkup(createElement(V4Kit));
// Props typed per component demand `children`; `createElement` takes them as arguments (the lint rule).
const h = createElement as (type: unknown, props: object | null, ...kids: unknown[]) => Parameters<typeof renderToStaticMarkup>[0];
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

test("every board of 02 Components has its section in /dev/ds, and the 100-character name is whole", () => {
  for (const title of ["Buttons", "Inputs", "Chips, tabs, segmented", "Table", "Overlays", "Empty, error, skeleton", "Phone"]) {
    assert.ok(html.includes(`data-kit="${title}"`), `${title} is missing`);
  }
  assert.ok(html.includes("Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) &amp; (Building - Security, ETP and Fire Pump)"));
});

test("a button in every kind has all six states, and loading says what it is doing and is announced busy", () => {
  for (const doing of ["Sending", "Saving", "Clearing", "Cancelling"]) assert.ok(html.includes(`${doing}</button>`), doing);
  assert.equal((html.match(/aria-busy="true"/g) ?? []).length, 4);
  assert.ok((html.match(/ disabled=""/g) ?? []).length >= 5, "each kind has a disabled cell");
  const loading = render(h(Button, { kind: "primary", loading: true, loadingLabel: "Sending" }, "Send RFQ"));
  assert.match(loading, /aria-busy="true"/);
  assert.ok(!loading.includes("Send RFQ") && loading.includes("Sending"), "the label is replaced, not added to");
  assert.ok(!/ disabled=""/.test(loading), "a loading button keeps keyboard focus: it is busy, not disabled");
  assert.match(loading, /animate-spin motion-reduce:animate-none/);
});

test("sizes are Paper's: 32, 40 and 48 for text, 24, 32, 44 and 48 for icons; focus is a 2px brand ring", () => {
  assert.match(buttonClass({ size: "md" }), /\bh-control\b/);
  assert.match(buttonClass({ size: "lg" }), /\bh-control-lg\b/);
  assert.match(buttonClass({ size: "touch" }), /\bh-input-touch\b/);
  for (const [n, c] of [[24, "size-6"], [32, "size-8"], [44, "size-11"], [48, "size-12"]] as const) {
    const el = render(createElement(IconButton, { icon: BookmarkSimple, label: "Save", size: n }));
    assert.match(el, new RegExp(`\\b${c}\\b`), `${n}`);
    assert.match(el, /aria-label="Save"/);
  }
  assert.match(buttonClass(), /focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/);
});

test("disabled is a colour, never an opacity; the link has no box", () => {
  for (const kind of ["primary", "secondary", "danger"] as const) assert.match(buttonClass({ kind }), /disabled:bg-sunken disabled:text-disabled/);
  assert.match(buttonClass({ kind: "quiet" }), /disabled:text-disabled/);
  assert.match(buttonClass({ kind: "link" }), /underline/);
  assert.ok(!/opacity/.test(buttonClass({ kind: "primary" })));
});

test("a field's label, help and error are tied to its control, and an error carries words and a glyph", () => {
  const control = (a: FieldArgs) => createElement(Input, { ...a, name: "hs" });
  const ok = render(h(Field, { label: "HS code", help: "Separate several with commas." }, control));
  const id = ok.match(/<label for="([^"]+)"/)?.[1];
  assert.ok(id && ok.includes(`id="${id}"`), "the label points at the input");
  assert.ok(ok.includes(`aria-describedby="${id}-help"`) && ok.includes(`id="${id}-help"`));
  const bad = render(h(Field, { label: "HS code", error: "Use numbers only, e.g. 6105." }, control));
  const bid = bad.match(/<label for="([^"]+)"/)?.[1];
  assert.ok(bad.includes(`aria-describedby="${bid}-error"`) && bad.includes('aria-invalid="true"'));
  assert.ok(bad.includes("Use numbers only, e.g. 6105.") && /<svg/.test(bad), "words and an icon, not colour alone");
});

test("ticks and switches are native controls with the right roles; some-selected is announced mixed", () => {
  assert.match(render(createElement(Checkbox, { mixed: true }, "Select all 25 on this page")), /type="checkbox"[^>]*aria-checked="mixed"/);
  assert.match(render(createElement(Switch, { "aria-label": "Alerts" })), /type="checkbox"[^>]*role="switch"/);
  assert.match(render(createElement(Switch, { size: "touch" }, "Saved suppliers")), /w-\[52px\]/);
});

test("a table is a real table: sort and selection are announced, numbers sit right, names wrap", () => {
  const t = render(
    createElement(
      Table,
      null,
      createElement("thead", null, createElement("tr", null, createElement(Th, { sort: "desc", href: "/s", align: "right" }, "Sources"), createElement(Th, { sort: "none", href: "/w" }, "Workers"), createElement(Th, null, "Type"))),
      createElement("tbody", null, createElement(Tr, { selected: true }, createElement(SelectCell, { label: "Select Aboni Knitwear Ltd." }), createElement(Td, { align: "right" }, "11"))),
    ),
  );
  assert.ok(t.startsWith("<table"));
  assert.match(t, /aria-sort="descending"/);
  assert.match(t, /aria-sort="none"/);
  assert.ok(!t.includes('aria-sort="ascending"'));
  assert.match(t, /<tr aria-selected="true"/);
  assert.match(t, /aria-label="Select Aboni Knitwear Ltd\."/);
  assert.match(t, /text-right/);
  assert.match(t, /\bh-row-head\b/);
  assert.match(t, /\bh-row\b/);
});

test("the phone tab bar is Messages, Quotes, Alerts, Saved, Search; Alerts is named new; the current one is marked", () => {
  const tabs = [
    { href: "/m", label: "Messages", icon: ChatCircleText, current: true },
    { href: "/q", label: "Quotes", icon: Receipt },
    { href: "/a", label: "Alerts", icon: Bell, isNew: true },
    { href: "/s", label: "Saved", icon: BookmarkSimple },
    { href: "/x", label: "Search", icon: MagnifyingGlass },
  ];
  const bar = render(createElement(TabBar, { items: tabs }));
  assert.deepEqual([...bar.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]), ["/m", "/q", "/a", "/s", "/x"]);
  assert.equal((bar.match(/aria-current="page"/g) ?? []).length, 1);
  assert.equal((bar.match(/aria-label="Alerts, new"/g) ?? []).length, 1);
  assert.match(bar, /\bh-tabbar\b/);
  assert.match(render(h(TabLink, { href: "/c", current: true }, "Overview")), /aria-current="page"/);
});

test("a sanctioned supplier's bar has no button to press: the action is replaced, not greyed", () => {
  const bar = render(createElement(RefusedBar, null, "You can't send this supplier an RFQ.")).replace("&#x27;", "'");
  assert.ok(bar.includes("You can't send this supplier an RFQ.") && !bar.includes("<button") && !bar.includes("<a "));
});

// The kit's own rules, read from its source: nothing in it may break them.
const dir = join(process.cwd(), "components", "kit");
const sources = readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => [f, readFileSync(join(dir, f), "utf8")] as const);

test("the kit has no typed colour, no opacity for disabled, no cut-off text, no text under 12px", () => {
  assert.ok(sources.length >= 10, "the kit's files were found");
  for (const [file, src] of sources) {
    const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(code), `${file}: a typed hex colour`);
    assert.ok(!/\bdisabled:opacity|aria-disabled:opacity/.test(code), `${file}: disabled by opacity`);
    assert.ok(!/\btruncate\b|text-ellipsis|line-clamp|overflow-ellipsis/.test(code), `${file}: text cut off with an ellipsis`);
    assert.ok(!/text-\[(?:[0-9]|1[01])px\]/.test(code), `${file}: text under 12px`);
  }
});

test("the kit does not import the old kits it replaces (the ui and dashboard directories)", () => {
  for (const [file, src] of sources) assert.ok(!/from "@\/components\/(ui|dashboard)/.test(src), `${file} imports the old kit`);
});
