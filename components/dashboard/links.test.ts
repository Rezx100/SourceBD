// Every in-app link in the dashboard kit is a client navigation.
//
// This guard exists because the class recurred. Cycle 1 found that opening a
// record was a full document load, which re-ran the search and emptied the
// bulk selection (`SelectionProvider` holds it in React state keyed on the
// search, and `record` is not part of that state). The repair converted the
// two links the finding named — and left four siblings as plain anchors: the
// card's tile sub-lines, the sanction line's "Open the record", the sheet's
// product tiles, and "All N lines". Cycle 2 found all four.
//
// A rendered-HTML test cannot catch this: `next/link` emits `<a>` in a server
// component exactly as a raw anchor does. So this reads the source, which is
// the only place the difference is visible.
//
// The rule: no raw `<a href=` in `components/dashboard/*` unless the file is
// listed below with the reason its anchor points off-site. Adding a raw anchor
// to the kit fails this until someone writes down why it is not an in-app
// navigation.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const KIT = path.join(process.cwd(), "components", "dashboard");

/**
 * Raw anchors that are correct, each with the reason.
 *
 * Every one of these goes somewhere Next's router cannot take you: an external
 * register, a file download, or a fragment on the page you are already on.
 */
const ALLOWED: Record<string, string> = {
  "sheet.tsx":
    "register pages, certificate documents, the five RSC report PDFs and a watchlist entry — all off-site — plus #fragment links inside the open sheet",
  "marks.tsx": "a source mark links to the register's own page, off-site",
  "supplier-sheet.tsx": "the EPB exporter page on edb.epb.gov.bd, off-site",
  "controls.tsx": "Button's own plain-anchor branch, which is the default and the one the CSV export needs",
  "results-panel.tsx": "sort, view and export controls; the export is an API download and the others re-run the search",
  "search-composer.tsx": "filter chips and the Ask/Filters switch, which re-run the search",
  "app-shell.tsx": "the skip link is a same-page fragment; the sidebar and account links are the shell's own and predate REZ-C",
  "rfq-composer.tsx": "attachment downloads",
  "rfq-list.tsx": "the toast's link, which predates REZ-C",
  "recent-searches.tsx": "a recent search re-runs the search",
  "chips.tsx": "the '+N' chip is a same-page control",
};

function kitFiles(): string[] {
  return readdirSync(KIT).filter((f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.includes(".test."));
}

describe("the dashboard kit's in-app links are client navigations", () => {
  it("no file grows a raw <a href> without a written reason", () => {
    const offenders: string[] = [];
    for (const file of kitFiles()) {
      const src = readFileSync(path.join(KIT, file), "utf8");
      // `<a ` followed by anything up to `href`, on one JSX element.
      const raw = [...src.matchAll(/<a\b[^>]*href=/g)];
      if (raw.length === 0) continue;
      if (!(file in ALLOWED)) offenders.push(`${file} (${raw.length} raw anchor${raw.length === 1 ? "" : "s"})`);
    }
    assert.deepEqual(
      offenders,
      [],
      `these kit files render a raw <a href> and are not in the allow-list. If the link goes off-site, ` +
        `add it to ALLOWED with the reason. If it is an in-app route, use next/link with ` +
        `prefetch={false} scroll={false} — a plain anchor reloads the page and empties the bulk selection:\n  ` +
        offenders.join("\n  "),
    );
  });

  it("the allow-list has no stale entries", () => {
    // An entry that no longer has an anchor behind it is a licence nobody is
    // using, and the next raw anchor in that file would inherit it silently.
    const stale: string[] = [];
    for (const file of Object.keys(ALLOWED)) {
      const src = readFileSync(path.join(KIT, file), "utf8");
      if (!/<a\b[^>]*href=/.test(src)) stale.push(file);
    }
    assert.deepEqual(stale, [], `remove these from ALLOWED — they no longer render a raw anchor:\n  ${stale.join("\n  ")}`);
  });

  it("the files that carry record and line links client-navigate", () => {
    // Named explicitly, because this is where the defect kept coming back.
    // Each renders a link whose href is a route on the buyer's own search, so
    // each must use `next/link` directly or go through `Button clientNav`.
    for (const [file, what] of [
      ["supplier-result-card.tsx", "the name, Open record, the tile sub-lines and the sanction line"],
      ["results-table.tsx", "the name and Open"],
      ["photo-tiles.tsx", "each product tile, which opens the HS line"],
      ["supplier-sheet.tsx", "the bar's Close and Open full page, and All N lines"],
      ["product-sheet.tsx", "Back to the record and Close"],
    ] as const) {
      const src = readFileSync(path.join(KIT, file), "utf8");
      const clientNavigates = /from "next\/link"/.test(src) || src.includes("clientNav");
      assert.ok(clientNavigates, `${file} carries ${what} and neither imports next/link nor uses Button's clientNav`);
    }
  });

  it("every next/link in the kit opts out of prefetch", () => {
    // A results page draws up to 100 record links and each record sheet costs
    // six RPC round trips, so the default would fire hundreds of profile reads
    // nobody asked for.
    const missing: string[] = [];
    for (const file of kitFiles()) {
      const src = readFileSync(path.join(KIT, file), "utf8");
      // `[\s\S]` so a multi-line element is one match. `prefetch={prefetch}`
      // in `Button` is the prop whose own default is false.
      for (const m of src.matchAll(/<Link\b[\s\S]*?>/g)) {
        if (!/prefetch=\{(?:false|prefetch)\}/.test(m[0])) {
          missing.push(`${file}: ${m[0].replace(/\s+/g, " ").slice(0, 90)}`);
        }
      }
    }
    assert.deepEqual(missing, [], `these <Link>s prefetch:\n  ${missing.join("\n  ")}`);
  });

  it("Button's client navigation is opt-in, and the export stays a download", () => {
    const controls = readFileSync(path.join(KIT, "controls.tsx"), "utf8");
    assert.match(controls, /clientNav = false/, "clientNav must default to false: the CSV export must not client-navigate");
    assert.match(controls, /<Link href=\{href\}/, "Button no longer has a next/link branch");
    assert.match(controls, /<a href=\{href\}/, "Button no longer has a plain-anchor branch");
  });
});
