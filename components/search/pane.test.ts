// What fills the pane beside the results while it waits and when it has nothing to show (B11b):
// the silhouettes of a record, one of its lines and the RFQ form, and the notice for a record that
// could not be read in time, a building filed under its company, or a link with no record. The route
// tests (`app/(app)/app/record-routes.test.ts`) cover the words through the page; these cover the
// parts themselves: each silhouette is a named status region holding no text, the notice is a
// labelled region with a real link for its one next step and a Close that goes back to the search,
// and `openerFor` finds the row that opened the pane and never one inside the pane.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ComposerSkeleton, LineSkeleton, PaneFrame, PaneNotice, RecordSkeleton } from "./pane";
import { openerFor } from "./pane-focus";

const h = createElement as (type: unknown, props: object | null, ...kids: unknown[]) => ReactNode & Parameters<typeof renderToStaticMarkup>[0];
const draw = (type: unknown, props: object | null = null) => renderToStaticMarkup(h(type, props));
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const words = (s: string) => plain(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

describe("the silhouettes", () => {
  it("are named status regions that say what is loading, and hold no words of their own", () => {
    const cases: [unknown, RegExp][] = [
      [RecordSkeleton, /role="status" aria-label="Loading"/],
      [LineSkeleton, /role="status" aria-label="Loading the product line"/],
      [ComposerSkeleton, /role="status" aria-label="Loading the RFQ form"/],
    ];
    for (const [part, name] of cases) {
      const out = draw(part);
      assert.match(out, name);
      assert.equal(words(out), "", "a silhouette prints no text");
      assert.match(out, /animate-pulse motion-reduce:animate-none/, "the blocks stop pulsing under reduced motion");
    }
  });

  it("the line's silhouette is its own: a photo block and fact rows, not the record's tabs", () => {
    const line = draw(LineSkeleton);
    assert.match(line, /size-\[200px\]/);
    const record = draw(RecordSkeleton);
    assert.doesNotMatch(record, /size-\[200px\]/);
  });

  it("carry no colour of their own and no old-kit class", () => {
    for (const part of [RecordSkeleton, LineSkeleton, ComposerSkeleton]) {
      const out = draw(part);
      assert.doesNotMatch(out, /#[0-9a-fA-F]{3,8}\b|style=/);
      assert.doesNotMatch(out, /surface-sunken|data-sheet-scroll/);
    }
  });
});

describe("the pane frame", () => {
  it("names what it shows, so focus follows a change of content", () => {
    const out = renderToStaticMarkup(h(PaneFrame, { openKey: "line:aboni-knitwear:6105" }, h("p", null, "inside")));
    assert.match(out, /<div data-pane-frame="" data-open-key="line:aboni-knitwear:6105" tabindex="-1"/);
    assert.ok(out.includes("inside"));
  });
});

describe("the pane notice", () => {
  const notice = (over: object = {}) =>
    draw(PaneNotice, { title: "No record for that link", body: "It may have been unpublished.", closeHref: "/app/discover?q=knit", ...over });

  it("is a labelled region with the title as its heading, and the body in words", () => {
    const out = notice();
    assert.match(out, /<section aria-label="Supplier record" data-record-pane=""/);
    assert.match(out, /<h2 [^>]*>No record for that link<\/h2>/);
    assert.match(words(out), /It may have been unpublished\./);
    assert.match(notice({ label: "Order" }), /<section aria-label="Order"/);
  });

  it("offers its one next step as a real link, and none when there is none", () => {
    const out = notice({ action: { label: "Try again", href: "/app/discover?q=knit&record=x&line=6105" } });
    assert.match(plain(out), /<a [^>]*href="\/app\/discover\?q=knit&record=x&line=6105"[^>]*>Try again<\/a>/);
    assert.doesNotMatch(notice(), /<a [^>]*>(?!<svg)[^<]*<\/a>/, "a notice with no action draws no link but Close");
    assert.doesNotMatch(notice({ action: null }), /Try again/);
  });

  it("Close goes back to the search, and is drawn only when there is a search to go back to", () => {
    assert.match(plain(notice()), /<a [^>]*aria-label="Close"[^>]*href="\/app\/discover\?q=knit"|<a [^>]*href="\/app\/discover\?q=knit"[^>]*aria-label="Close"/);
    assert.doesNotMatch(notice({ closeHref: null }), /aria-label="Close"/);
  });

  it("is no dialog, claims no score and carries no old-kit class", () => {
    const out = notice({ action: { label: "Open the company record", href: "/app/discover?record=mother" } });
    assert.doesNotMatch(out, /role="dialog"|aria-modal/);
    assert.doesNotMatch(words(out), /\b(score|grade|rating|stars?)\b/i);
    assert.doesNotMatch(out, /surface-sunken|data-sheet-scroll|animate-sheet-in/);
  });
});

describe("openerFor: the row focus returns to when the pane closes", () => {
  const link = (href: string, inPane = false) => {
    const a = { getAttribute: (name: string) => (name === "href" ? href : null), closest: (sel: string) => (inPane && sel === "[data-record-pane]" ? {} : null) };
    return a as unknown as HTMLAnchorElement;
  };

  it("is the result row that opened this record, not a link to one of its lines", () => {
    const rows = [link("/app/discover?q=knit&record=other"), link("/app/discover?q=knit&record=aboni&line=6105"), link("/app/discover?q=knit&record=aboni")];
    assert.equal(openerFor("aboni", rows), rows[2]);
  });

  it("never picks a link inside the pane itself", () => {
    const rows = [link("/app/discover?record=aboni", true), link("/app/discover?record=aboni")];
    assert.equal(openerFor("aboni", rows), rows[1]);
  });

  it("reads `open` for the orders and RFQ lists, and is null when nothing opened it", () => {
    const rows = [link("/app/rfqs?open=r1"), link("/app/rfqs?record=r1")];
    assert.equal(openerFor("r1", rows, "open"), rows[0]);
    assert.equal(openerFor("r1", rows), rows[1]);
    assert.equal(openerFor("nobody", rows), null);
  });
});
