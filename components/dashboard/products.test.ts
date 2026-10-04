// The supplier picker, and buyer copy that must not over-claim. The Products list is tested in
// `components/products/products.test.ts`, the editor in `components/products/editor.test.ts`.

import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import type { TierRank } from "@/lib/design/tokens";
import { AffiliationNote } from "./sheet";
import { PICKER_TABS, SupplierPicker, targetFromSuggestion } from "./supplier-picker";

const html = (el: ReactElement) => renderToStaticMarkup(el);
/** The opening tag of the button whose text ends with `label`. */
const buttonTag = (out: string, label: string) => {
  const i = out.indexOf(`${label}</button>`);
  assert.ok(i >= 0, `no ${label} button`);
  const start = out.lastIndexOf("<button", i);
  return out.slice(start, out.indexOf(">", start) + 1);
};

describe("the supplier picker", () => {
  const t = (slug: string, tier: TierRank = 2) => ({ ...targetFromSuggestion({ label: slug, sublabel: "Gazipur", slug }), id: `id-${slug}`, tier });

  it("draws three tabs, Saved first, and a Confirm that needs a pick", () => {
    const out = html(createElement(SupplierPicker, { onConfirm() {}, onClose() {} }));
    assert.equal(out.match(/role="tab"/g)?.length, 3);
    for (const tab of PICKER_TABS) assert.ok(out.includes(`>${tab.label}</button>`), `no ${tab.label} tab`);
    assert.match(out, /aria-selected="true"[^>]*>Saved suppliers</);
    assert.match(out, /0 selected/);
    assert.match(buttonTag(out, " Confirm"), /disabled=""/);
  });

  it("counts what is already chosen", () => {
    const out = html(createElement(SupplierPicker, { onConfirm() {}, onClose() {}, selected: [t("aboni-knitwear"), t("zaheen-knitwear")] }));
    assert.match(out, /2 selected/);
    assert.doesNotMatch(buttonTag(out, " Confirm"), /disabled=""/);
  });

  it("a typeahead company becomes a target with no id and no marks — the caller resolves the id", () => {
    const target = targetFromSuggestion({ label: "ABONI KNITWEAR LTD", sublabel: "Savar, Dhaka", slug: "aboni-knitwear" });
    assert.equal(target.id, "");
    assert.equal(target.slug, "aboni-knitwear");
    assert.equal(target.name, "Aboni Knitwear Ltd");
    assert.equal(target.initials, "AK");
    assert.deepEqual(target.marks, []);
    assert.equal(target.sanctioned, false);
  });
});

describe("buyer copy that must not over-claim (T-04, T-09)", () => {
  it("the affiliation note does not promise every fact is traced while some say 'Source pending'", () => {
    assert.doesNotMatch(html(createElement(AffiliationNote)), /traces to/);
  });
});
