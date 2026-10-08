// The keyboard on the result rows (DESIGN.md, Ledger Grid; the critique of 7 Oct 2026, item 8):
// ↑ ↓ and j k move between rows, and with a record open beside the list they change the open
// record so Enter is not needed; r opens the RFQ composer for the row and s saves it, both shown in
// the row's ⋯ menu; the pane never steals focus from a row the arrows are moving. Beside a pane the
// list bar keeps Save search and Add filter as icons with their names.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ACTION_SELECTOR, ROW_SELECTOR, keyFollow, onRowKey } from "@/components/search/keys";
import { PaneListToolbar } from "@/components/search/toolbar";
import { EMPTY_STATE } from "@/lib/discover-v32-state";

type Fake = { tagName: string; focused: boolean; clicked: string[]; focus(): void; parentElement: { querySelectorAll(): Fake[]; getAttribute(name: string): string | null }; querySelector(sel: string): { click(): void } };

const make = (n: number, follow = false, tagName = "TR"): Fake[] => {
  const list: Fake[] = [];
  const parent = { querySelectorAll: () => list, getAttribute: (name: string) => (name === "data-follow" && follow ? "record" : null) };
  for (let i = 0; i < n; i++) {
    const r: Fake = {
      tagName,
      focused: false,
      clicked: [],
      focus() {
        this.focused = true;
      },
      parentElement: parent,
      querySelector(sel) {
        return { click: () => r.clicked.push(sel) };
      },
    };
    list.push(r);
  }
  return list;
};
const press = (key: string, target: unknown) => {
  let prevented = false;
  onRowKey({ key, target, metaKey: false, ctrlKey: false, altKey: false, preventDefault: () => (prevented = true) });
  return prevented;
};
const h = createElement as (type: unknown, props: object | null, ...kids: unknown[]) => ReactNode & Parameters<typeof renderToStaticMarkup>[0];

describe("the four keys", () => {
  it("↓ j ↑ k move focus between rows and open nothing while no record is open", () => {
    const [a, b, c] = make(3) as [Fake, Fake, Fake];
    assert.equal(press("ArrowDown", a), true);
    assert.ok(b.focused && !c.focused);
    press("j", b);
    assert.ok(c.focused);
    press("k", c);
    press("ArrowUp", b);
    assert.ok(a.focused);
    assert.deepEqual([a.clicked, b.clicked, c.clicked], [[], [], []], "nothing opened: the arrows only moved focus");
    assert.equal(keyFollow.pending, false);
  });

  it("r opens the RFQ composer for the row and s saves it, through the row's own hidden controls", () => {
    const [a] = make(1) as [Fake];
    assert.equal(press("r", a), true);
    assert.equal(press("s", a), true);
    assert.deepEqual(a.clicked, [ACTION_SELECTOR.rfq, ACTION_SELECTOR.save]);
    assert.deepEqual(ACTION_SELECTOR, { rfq: '[data-action="rfq"]', save: '[data-action="save"]' });
  });

  it("with a record open the arrows change the open record: the next row is focused and its record link clicked, and the pane is told not to take focus", () => {
    const [a, b, c] = make(3, true) as [Fake, Fake, Fake];
    keyFollow.pending = false;
    press("ArrowDown", a);
    assert.ok(b.focused);
    assert.deepEqual(b.clicked, ['a[data-open="record"]']);
    assert.equal(keyFollow.pending, true, "PaneFocus reads this and leaves focus on the row");
    keyFollow.pending = false;
    press("k", b);
    assert.deepEqual(a.clicked, ['a[data-open="record"]']);
    // At the end of the list nothing opens and nothing is pending.
    keyFollow.pending = false;
    press("j", c);
    assert.deepEqual(c.clicked, []);
    assert.equal(keyFollow.pending, false);
    // A table row and a pane list's item alike (critique of 8 Oct 2026, round 3, item 2).
    assert.equal(ROW_SELECTOR, '[data-row="result"]');
  });

  it("the pane's focus helper honours the flag, and the table marks its body when a record is open", () => {
    const focus = readFileSync(path.join(process.cwd(), "components", "search", "pane-focus.tsx"), "utf8");
    assert.match(focus, /if \(keyFollow\.pending\) \{\s*keyFollow\.pending = false;/);
    // When ↑↓ change the open record nothing else announces it: a polite live region says "Showing <name>" (critique of 8 Oct 2026, item 7).
    assert.match(focus, /setSaid\(`Showing \$\{name\}`\)/);
    assert.match(focus, /<span role="status" aria-live="polite" className="sr-only">/);
    const table = readFileSync(path.join(process.cwd(), "components", "search", "table.tsx"), "utf8");
    assert.match(table, /<tbody onKeyDown=\{onRowKey\} data-follow=\{currentSlug != null \? "record" : undefined\}>/);
    // The ⋯ menu shows the two keys, and the row keeps the two actions for the keyboard.
    assert.match(table, /<MenuItem hint="S" onSelect=/);
    assert.match(table, /<MenuItem hint="R" href=/);
    assert.match(table, /data-action="save" tabIndex=\{-1\} aria-hidden/);
    assert.match(table, /data-action="rfq" tabIndex=\{-1\} aria-hidden/);
  });
});

describe("the list bar beside a pane", () => {
  it("keeps Save search and Add filter as icons with their names, and Sort", () => {
    const out = renderToStaticMarkup(h(PaneListToolbar, { state: EMPTY_STATE, title: "knit · 4,645 suppliers", hrefFor: () => "#", filtersHref: "/app/discover?q=knit&filters=1", saveHref: "/app/discover?q=knit&save=1" }));
    assert.match(out, /<a aria-label="Save search" title="Save search" class="[^"]*" href="\/app\/discover\?q=knit&amp;save=1">/);
    assert.match(out, /<a aria-label="Add filter" title="Add filter" class="[^"]*" href="\/app\/discover\?q=knit&amp;filters=1">/);
    assert.match(out, /Sort/);
    // With filters on, the icon carries the count, and the name says it.
    const on = renderToStaticMarkup(h(PaneListToolbar, { state: { ...EMPTY_STATE, district: ["Gazipur"], type: ["factory"] }, title: "t", hrefFor: () => "#", filtersHref: "#" }));
    assert.match(on, /aria-label="Add filter · 2 on"/);
    assert.match(on, /font-mono text-xs tabular-nums text-ink-2">2</);
    assert.doesNotMatch(on, /Save search/, "no save href, no Save search");
  });
});

describe("the pane list keeps the keys (critique of 8 Oct 2026, round 3, item 2)", () => {
  it("an li[data-row=result] moves, opens, ticks and acts like a table row", () => {
    const [a, b] = make(2, true, "LI") as [Fake, Fake];
    keyFollow.pending = false;
    press("j", a);
    assert.ok(b.focused);
    assert.deepEqual(b.clicked, ['a[data-open="record"]']);
    keyFollow.pending = false;
    press(" ", a);
    press("r", a);
    press("s", a);
    assert.deepEqual(a.clicked, ['input[type="checkbox"]:not(:disabled)', ACTION_SELECTOR.rfq, ACTION_SELECTOR.save]);
    // Any other element is still not a row.
    const [d] = make(1, false, "DIV") as [Fake];
    assert.equal(press("j", d), false);
  });
});
