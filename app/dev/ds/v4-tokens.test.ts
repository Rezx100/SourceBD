// /dev/ds shows SourceBD v4's values (B0's "done when"), asserted on what the
// section renders rather than on the token file it reads.

import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { containers, screens, spacing, v4CertAliases, v4Colors } from "@/lib/design/tokens";
import { V4Tokens } from "./v4-tokens";

const html = renderToStaticMarkup(createElement(V4Tokens));

test("every v4 colour is shown under Paper's name with Paper's value, drawn from its own variable", () => {
  for (const [name, hex] of Object.entries(v4Colors)) {
    assert.ok(html.includes(`>${name}</span>`), `${name} is not shown`);
    assert.ok(html.includes(hex), `${name}'s ${hex} is not shown`);
  }
  for (const [alias, target] of Object.entries(v4CertAliases)) assert.ok(html.includes(`= ${target}`) && html.includes(`>${alias}</span>`), alias);
  assert.ok(html.includes("ink at 40%"), "the scrim is not shown as ink at 40%");
  assert.match(html, /background-color:rgb\(var\(--ds-ink-3\) \/ 1\)/);
  assert.match(html, /background-color:rgb\(var\(--ds-scrim\) \/ 0\.4\)/);
});

test("the type scale, spacing, containers and breakpoints are shown with their values", () => {
  for (const [key, size] of [["sm", "13px / 18px"], ["md", "16px / 24px"], ["display-1", "72px"]] as const) {
    assert.ok(html.includes(`text-${key} · ${size}`), `text-${key}`);
    assert.match(html, new RegExp(`class="text-${key} `), `text-${key} is not drawn in its own class`);
  }
  for (const map of [spacing, containers, screens]) {
    for (const [k, v] of Object.entries(map)) assert.ok(html.includes(`${k} ${v}`), `${k} ${v}`);
  }
});
