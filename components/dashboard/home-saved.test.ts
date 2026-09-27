// Boundary tests for the rebuilt Home (/app) and Saved (/app/saved): the HTML
// a buyer's browser receives for the empty, error and real-content states.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { BuyerHome, homeCaption, type HomeModel } from "./buyer-home";
import { SavedList, savedHref, type SavedListRow } from "./saved-list";

const EMPTY_HOME: HomeModel = { saved_count: 0, recent_saved: [], alerts: [], recent_activity: [] };

const home = (doc: HomeModel, failed = false) =>
  renderToStaticMarkup(createElement(BuyerHome, { doc, failed, openRfqs: 3, activeOrders: 1 }));

const ROW: SavedListRow = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "aboni-knitwear-ltd",
  company_name: "ABONI KNITWEAR LTD",
  entity_type: "factory",
  city: "Savar",
  district: "Dhaka",
  source_tags: ["BGMEA", "RSC"],
  employees_total: 3314,
  saved_at: "2026-09-20T10:00:00Z",
};

const saved = (over: Partial<Parameters<typeof SavedList>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(SavedList, { rows: [ROW], total: 1, page: 1, pageSize: 24, sort: "recent", failed: false, ...over }),
  );

describe("Home", () => {
  it("states the counts as words, not tiles", () => {
    assert.equal(homeCaption(12, 3, 1), "12 saved · 3 open RFQs · 1 active order");
    assert.equal(homeCaption(1, 1, 0), "1 saved · 1 open RFQ · 0 active orders");
    const html = home(EMPTY_HOME);
    assert.match(html, /<h1[^>]*>Home<\/h1>/);
    assert.equal(html.match(/<h1/g)?.length, 1, "one h1");
    assert.doesNotMatch(html, /%|score|grade/i, "no percentage or score on the home page");
  });

  it("teaches when there is nothing yet", () => {
    const html = home(EMPTY_HOME);
    assert.match(html, /No certificates expiring/);
    assert.match(html, /No saved suppliers yet/);
    assert.match(html, /No activity yet/);
    assert.doesNotMatch(html, /role="alert"/);
  });

  it("an expiring certificate names the supplier, the certificate and the date, with a caution badge", () => {
    const html = home({
      ...EMPTY_HOME,
      alerts: [
        { kind: "cert_expiring", supplier_id: "s1", supplier_slug: "aboni", company_name: "ABONI KNITWEAR LTD", cert_kind: "oeko_tex", expires_on: "2026-10-12" },
      ],
    });
    assert.match(html, /href="\/app\/suppliers\/aboni"[^>]*>Aboni Knitwear Ltd<\/a>/);
    assert.match(html, /OEKO-TEX expires 12 Oct 2026/);
    assert.match(html, /bg-caution-tint[^"]*"[^>]*>.*Expiring<\/span>/);
  });

  it("a saved row links to its record and a failed read says so", () => {
    const html = home({ ...EMPTY_HOME, saved_count: 1, recent_saved: [{ ...ROW, source_tags: ["BGMEA"] }] });
    assert.match(html, /href="\/app\/suppliers\/aboni-knitwear-ltd"/);
    assert.match(html, /Factory · Savar, Dhaka/);
    // The unsave control the old Home had on each saved row.
    assert.match(html, /aria-pressed="true"/);
    // A failed read renders the alert and nothing that claims to know.
    assert.match(home(EMPTY_HOME, true), /role="alert"[^>]*>.*Could not load your home page/);
  });
});

describe("Saved", () => {
  it("draws a row with its type, place, workers and saved date", () => {
    const html = saved();
    assert.match(html, /<h1[^>]*>Saved<\/h1>/);
    assert.match(html, /1 saved supplier · only you can see this list/);
    assert.match(html, /Factory · Savar, Dhaka/);
    assert.match(html, /3,314/);
    assert.match(html, /20 Sep 2026/);
    assert.match(html, /1–1 of 1/);
    assert.match(html, /aria-label="Saved"/, "the unsave control is on the row");
  });

  it("an empty list teaches where saving happens", () => {
    const html = saved({ rows: [], total: 0 });
    assert.match(html, /No saved suppliers yet/);
    assert.match(html, /Save a supplier from search or from its record/);
    assert.doesNotMatch(html, /<table/);
  });

  it("a failed read is an error note, not an empty list", () => {
    const html = saved({ rows: [], total: 0, failed: true });
    assert.match(html, /role="alert"[^>]*>.*Could not load your saved suppliers/);
    assert.doesNotMatch(html, /No saved suppliers yet/);
  });

  it("keeps the sort and page parameters", () => {
    assert.equal(savedHref("recent", 1), "/app/saved");
    assert.equal(savedHref("name", 3), "/app/saved?sort=name&page=3");
    const html = saved({ total: 50, page: 2, sort: "name" });
    assert.match(html, /25–25 of 50/);
    assert.match(html, /href="\/app\/saved\?sort=name"/);
    assert.match(html, /href="\/app\/saved\?sort=name&amp;page=3"/);
  });
});

describe("Home after a failed read", () => {
  it("says it could not read, and claims no all-clear", () => {
    // "No certificates expiring" and "0 saved" under the error were a false
    // all-clear (review of the rebuild, 27 Sep).
    const html = home(EMPTY_HOME, true);
    assert.match(html, /Could not load your home page/);
    assert.doesNotMatch(html, /No certificates expiring|No saved suppliers yet|0 saved/);
  });
});
