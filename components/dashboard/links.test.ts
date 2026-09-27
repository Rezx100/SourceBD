// Every in-app link in the dashboard kit is a client navigation.
//
// This guard exists because the class recurred. Cycle 1 found that opening a
// record was a full document load, which re-ran the search and emptied the
// bulk selection (`SelectionProvider` holds it in React state keyed on the
// search, and `record` is not part of that state). The repair converted the
// two links the finding named — and left four siblings as plain anchors: the
// card's tile sub-lines, the sanction line's "Open the record", the sheet's
// product tiles, and "All N lines". Cycle 2 found all four. Cycle 3 found that
// this guard's first version allowed raw anchors per FILE, so turning "All N
// lines" back into `<a href>` inside an already-listed file passed it.
//
// A rendered-HTML test cannot catch this: `next/link` emits `<a>` in a server
// component exactly as a raw anchor does. So this reads the source, which is
// the only place the difference is visible — and it reads it per ELEMENT:
//
// - every raw `<a href={…}>` in the kit is listed below by its exact href
//   expression and how many times it occurs, with the reason it is not an
//   in-app navigation on the buyer's search;
// - every `<Button href={…}>` in a file that draws record or line links either
//   says `clientNav` or is listed the same way.
//
// A new anchor, a second copy of an allowed one, an anchor whose href hides in
// a spread, or a Button that loses `clientNav` — or says `clientNav={false}` —
// fails this until someone writes down why.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const KIT = path.join(process.cwd(), "components", "dashboard");

type Allowed = Record<string, Record<string, [count: number, reason: string]>>;

/** Raw anchors that are correct: file → exact href expression → [occurrences, reason]. */
const RAW_ANCHORS: Allowed = {
  "app-shell.tsx": {
    "{`#${mainId}`}": [1, "the skip link, a same-page fragment"],
  },
  "chips.tsx": { "{moreHref}": [1, "the '+N' chip, a same-page control"] },
  "controls.tsx": {
    "{href}": [1, "Button's own plain-anchor branch; callers in record files are checked below"],
    "{hrefFor(o.value)}": [1, "a segmented control that re-runs the search"],
  },
  "marks.tsx": { "{mark.href}": [1, "a source mark links to the register's own page, off-site"] },
  "recent-searches.tsx": { "{r.href}": [1, "a recent search re-runs the search"] },
  "results-panel.tsx": {
    "{o.href}": [1, "sort and view options, which re-run the search"],
    "{p.href}": [1, "a page number, which re-runs the search"],
  },
  "rfq-composer.tsx": { '"#"': [1, "an attachment placeholder with no destination"] },
  "rfq-list.tsx": { "{href}": [1, "the toast's link, which predates REZ-C"] },
  "search-composer.tsx": {
    "{c.removeHref}": [1, "removing a filter chip re-runs the search"],
    '"#filters"': [1, "a same-page fragment"],
    "{filtersHref}": [1, "the Ask/Filters switch re-runs the search"],
    "{askHref}": [1, "the Ask/Filters switch re-runs the search"],
  },
  "sheet.tsx": {
    '{t.href ?? "#"}': [1, "a tab is a #fragment inside the open sheet"],
    "{r.href}": [
      3,
      "a fact's link and a source row go to register pages off-site; an RFQ row opens /app/rfqs/<id>, another page, which has no search to keep",
    ],
    "{cert.documentUrl!}": [1, "the certificate document, off-site"],
    "{l.href}": [1, "an RSC report PDF, off-site"],
    "{evidenceHref}": [1, "the sanction banner's #sanctions fragment inside the open sheet"],
  },
  "supplier-sheet.tsx": { "{p.exporterHref}": [1, "the EPB exporter page on edb.epb.gov.bd, off-site"] },
};

/** Files that draw record or line links on the buyer's search: every Button href there must client-navigate unless listed. */
const RECORD_FILES = ["supplier-result-card.tsx", "results-table.tsx", "photo-tiles.tsx", "supplier-sheet.tsx", "product-sheet.tsx", "sheet.tsx"];

const DOCUMENT_BUTTONS: Allowed = {
  "supplier-result-card.tsx": {
    "{card.sanctioned ? undefined : (card.rfqHref ?? undefined)}": [1, "Send RFQ opens the composer, another page"],
  },
  "results-table.tsx": { "{r.sanctioned ? undefined : (r.rfqHref ?? undefined)}": [1, "Send RFQ opens the composer, another page"] },
  "product-sheet.tsx": {
    "{model.sanctioned ? undefined : (model.rfqHref ?? undefined)}": [1, "Send RFQ for this line opens the composer, another page"],
    "{`/app/discover?hs=${model.hs}`}": [1, "Exporters of HS is a new search, which replaces the one behind the sheet"],
  },
  "sheet.tsx": { "{sanctioned ? undefined : (rfqHref ?? undefined)}": [1, "the action bar's Send RFQ opens the composer, another page"] },
};

function kitFiles(): string[] {
  return readdirSync(KIT).filter((f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.includes(".test."));
}

/** Each `<tag …>` opening element, whole, however many lines and braces it spans. */
function elements(src: string, tag: string): string[] {
  const out: string[] = [];
  const open = new RegExp(`<${tag}(?=[\\s>])`, "g");
  for (let m = open.exec(src); m; m = open.exec(src)) {
    let depth = 0;
    let quote: string | null = null;
    let i = m.index + tag.length + 1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (depth === 0 && c === '"') quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

/** The `href=` expression exactly as written: `{…}` with its braces balanced, or `"…"`. */
function hrefOf(element: string): string | null {
  const at = element.search(/\shref=/);
  // An element that spreads props (`<a {...{ href }}>`) may carry an href this
  // cannot see, so it is reported as `{...}` and must be listed like any other.
  if (at < 0) return /\{\s*\.\.\./.test(element) ? "{...}" : null;
  const start = at + 6;
  if (element[start] === '"') return element.slice(start, element.indexOf('"', start + 1) + 1);
  let depth = 0;
  for (let i = start; i < element.length; i++) {
    if (element[i] === "{") depth++;
    else if (element[i] === "}" && --depth === 0) return element.slice(start, i + 1);
  }
  return null;
}

/**
 * A Button navigates on the client only when it says `clientNav` outright or
 * `clientNav={true}`. `clientNav={false}` — or any expression — renders the
 * plain anchor, and cycle 4 showed the guard counting it as client-side.
 */
function clientNavigates(element: string): boolean {
  return /\sclientNav(?:=\{true\})?(?=[\s/>])/.test(element);
}

function tally(hrefs: (string | null)[]): Map<string, number> {
  const n = new Map<string, number>();
  for (const h of hrefs) if (h) n.set(h, (n.get(h) ?? 0) + 1);
  return n;
}

function unlisted(file: string, found: Map<string, number>, allowed: Allowed): string[] {
  const out: string[] = [];
  for (const [href, count] of found) {
    const entry = allowed[file]?.[href];
    if (!entry) out.push(`${file}: href=${href}`);
    else if (count > entry[0]) out.push(`${file}: href=${href} appears ${count} times, ${entry[0]} allowed`);
  }
  return out;
}

describe("the dashboard kit's in-app links are client navigations", () => {
  it("every raw <a href> is listed, by its href, with the reason it is not an in-app navigation", () => {
    const offenders = kitFiles().flatMap((file) => {
      const src = readFileSync(path.join(KIT, file), "utf8");
      return unlisted(file, tally(elements(src, "a").map(hrefOf)), RAW_ANCHORS);
    });
    assert.deepEqual(
      offenders,
      [],
      `these raw anchors are not in RAW_ANCHORS. If the link goes off-site, add it with the reason. If it is an ` +
        `in-app route, use next/link with prefetch={false} — a plain anchor reloads the page and empties the bulk selection:\n  ` +
        offenders.join("\n  "),
    );
  });

  it("in the record and line files, every Button with an href client-navigates or is listed", () => {
    const offenders = RECORD_FILES.flatMap((file) => {
      const src = readFileSync(path.join(KIT, file), "utf8");
      const plain = elements(src, "Button").filter((el) => !clientNavigates(el));
      return unlisted(file, tally(plain.map(hrefOf)), DOCUMENT_BUTTONS);
    });
    assert.deepEqual(offenders, [], `add clientNav, or list the Button in DOCUMENT_BUTTONS with the reason:\n  ${offenders.join("\n  ")}`);
  });

  it("neither list has a stale entry", () => {
    // An entry with nothing behind it is a licence nobody is using, and the
    // next anchor written that way would inherit it silently.
    const stale: string[] = [];
    for (const [allowed, tag, plainOnly] of [
      [RAW_ANCHORS, "a", false],
      [DOCUMENT_BUTTONS, "Button", true],
    ] as const) {
      for (const [file, hrefs] of Object.entries(allowed)) {
        const src = readFileSync(path.join(KIT, file), "utf8");
        const els = elements(src, tag).filter((el) => !plainOnly || !clientNavigates(el));
        const found = tally(els.map(hrefOf));
        for (const [href, [count]] of Object.entries(hrefs)) {
          if ((found.get(href) ?? 0) !== count) stale.push(`${file}: href=${href} expected ${count}, found ${found.get(href) ?? 0}`);
        }
      }
    }
    assert.deepEqual(stale, [], `update these entries:\n  ${stale.join("\n  ")}`);
  });

  it("the parser sees what it must: a raw anchor or a lost clientNav in a record file is caught", () => {
    // The guard is only as good as `elements` and `hrefOf`. Two of the real
    // regressions, as source, must both be flagged.
    const allLines = `<a href={p.allLinesHref} className="x">All {p.lines} lines</a>`;
    assert.deepEqual(unlisted("supplier-sheet.tsx", tally(elements(allLines, "a").map(hrefOf)), RAW_ANCHORS), [
      "supplier-sheet.tsx: href={p.allLinesHref}",
    ]);
    const close = `<Button variant="ghost" icon aria-label="Close" href={model.closeHref} scroll={false}>\n  <Icon name="x" />\n</Button>`;
    const plain = elements(close, "Button").filter((el) => !clientNavigates(el));
    assert.deepEqual(unlisted("supplier-sheet.tsx", tally(plain.map(hrefOf)), DOCUMENT_BUTTONS), ["supplier-sheet.tsx: href={model.closeHref}"]);
    // Saying clientNav is not enough: it has to be on. Both of these render the plain anchor.
    for (const off of ["clientNav={false}", "clientNav={overlay}"]) {
      const el = `<Button variant="ghost" icon aria-label="Close" href={model.closeHref} ${off} scroll={false}>x</Button>`;
      const found = elements(el, "Button").filter((e) => !clientNavigates(e));
      assert.deepEqual(unlisted("supplier-sheet.tsx", tally(found.map(hrefOf)), DOCUMENT_BUTTONS), ["supplier-sheet.tsx: href={model.closeHref}"], off);
    }
    for (const on of ["clientNav", "clientNav={true}"]) {
      const el = `<Button href={model.closeHref} ${on} scroll={false}>x</Button>`;
      assert.equal(clientNavigates(elements(el, "Button")[0]!), true, on);
    }
    // An href hidden in a spread is still an anchor to account for.
    const spread = `<a {...{ href: p.allLinesHref }} className="x">All</a>`;
    assert.deepEqual(unlisted("supplier-sheet.tsx", tally(elements(spread, "a").map(hrefOf)), RAW_ANCHORS), ["supplier-sheet.tsx: href={...}"]);
  });

  it("a link into a sheet section keeps Next's scroll, or it never reaches the section", () => {
    // The tile sub-lines end in #certificates / #products / #sources, and in
    // Next's router `scroll={false}` also drops the hash jump
    // (router-reducer/handle-mutable: `hashFragment: shouldScroll ? … : null`).
    const card = readFileSync(path.join(KIT, "supplier-result-card.tsx"), "utf8");
    const tileLinks = elements(card, "Link").filter((el) => hrefOf(el) === "{tile.href}");
    assert.equal(tileLinks.length, 1, "the tile sub-line link moved; this guard needs rewriting");
    assert.doesNotMatch(tileLinks[0]!, /scroll=\{false\}/, "the tile sub-line link opens the sheet without reaching its #section");
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
