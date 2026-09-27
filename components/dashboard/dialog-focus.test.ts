// Where focus goes back to when an overlaid record closes.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { openerFor } from "./dialog-focus";

/** Just enough of an anchor for `openerFor`. */
function link(href: string, inDialog = false): HTMLAnchorElement {
  return { getAttribute: () => href, closest: () => (inDialog ? {} : null) } as unknown as HTMLAnchorElement;
}

describe("DialogFocus — focus returns to the result that opened the record", () => {
  it("picks the result's own record link, exactly, outside the dialog", () => {
    const own = link("/app/discover?q=knit&record=aboni-knitwear");
    const got = openerFor("aboni-knitwear", [
      link("/app/discover?q=knit&record=aboni-knitwear", true), // the sheet's own links
      link("/app/discover?q=knit&record=aboni-knitwear-2"), // a longer slug
      link("/app/discover?q=knit&record=aboni-knitwear&line=6105"), // a line, not the record
      own,
    ]);
    assert.equal(got, own);
  });

  it("finds nothing rather than something wrong", () => {
    assert.equal(openerFor("aboni-knitwear", [link("/app/discover?q=knit"), link("https://edb.epb.gov.bd/x")]), null);
  });

  it("every record pane with somewhere to close to carries it", () => {
    // `DialogFocus` renders nothing, so no HTML test can see it is mounted.
    const sheet = readFileSync(path.join(process.cwd(), "components", "dashboard", "sheet.tsx"), "utf8");
    assert.match(sheet, /\{closeHref \? <DialogFocus closeHref=\{closeHref\} openKey=\{openKey\} \/> : null\}/);
    // And every pane names what it shows, or focus stays put when it changes.
    const discover = readFileSync(path.join(process.cwd(), "app", "(app)", "app", "discover", "page.tsx"), "utf8");
    const frames = discover.match(/<RecordPane\b[^>]*>/g) ?? [];
    assert.ok(frames.length >= 2 && frames.every((f) => /openKey=\{/.test(f)), frames.join(" | "));
    assert.match(sheet, /data-record-pane=""[^>]*tabIndex=\{-1\}/, "the pane cannot take focus by script");
  });
});
