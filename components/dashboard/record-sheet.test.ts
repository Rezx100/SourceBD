// REZ-C — the company profile (supplier record sheet and product line), at the
// boundary (closed-loop §14, AGENTS 16).
//
// Every assertion here is on the HTML a browser receives, built through
// `buildSheet` / `buildProductSheet` from the same production fixtures the
// /dev/ds gallery renders. The hand-off's three non-optional boundary tests
// are the first three describes; the third one's other half — that
// `rfq_create` itself refuses a sanctioned target — cannot be asserted from
// Node, and lives in `etl/tests/test_rfq_create_sanctioned_sql.py`, which runs
// the real function against the real database inside a rolled-back
// transaction.

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { buildProductSheet, buildSheet } from "@/lib/dashboard/build-models";
import { aboniInput, sanctionedInput, zaheenSampleInput } from "@/lib/dashboard/fixtures";
import { ProductSheet } from "./product-sheet";
import { SupplierSheet } from "./supplier-sheet";

/** Every section the sheet renders, in the order a buyer scrolls them. */
const SECTIONS = ["overview", "products", "certificates", "safety", "sources", "locations", "facilities", "rfqs"] as const;

describe("SupplierSheet — the locked contact card (REZ-C §4.3)", () => {
  const COUNTS = { emails: 1, phones: 6, representatives: 2, website: true };

  it("renders the counts and not one character of any contact value", () => {
    // `zaheenSampleInput` carries real-shaped contact fields on the supplier
    // object precisely so this can be proven. `supplier_contact_counts` (0105)
    // returns counts only, and nothing downstream has a slot for a value — so
    // even a payload that started carrying them cannot put one on the page.
    const input = zaheenSampleInput();
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input, { contactCounts: COUNTS }) }));

    // What the buyer is told.
    assert.match(html, /On file: 1 email · 6 phone numbers · a website · 2 named representatives\./);
    assert.match(html, /data-contact-counts="true"/);
    assert.match(html, /data-locked="true"/);

    // What never reaches them.
    const leaks: [string, string][] = [
      ["email_primary", input.leaked.email_primary],
      ["contact_name", input.leaked.contact_name],
      ["contact_role", input.leaked.contact_role],
      ["website", input.leaked.website],
      ...input.leaked.phones.map((p): [string, string] => ["phones", p]),
    ];
    for (const [field, value] of leaks) {
      assert.ok(!html.includes(value), `the ${field} value reached the record sheet's HTML`);
    }
    // The bare column names would mean the payload was spread onto the page.
    for (const key of ["email_primary", "contact_name", "contact_role", "phones"]) {
      assert.ok(!html.includes(key), `the raw column name ${key} is in the record sheet's HTML`);
    }
  });

  it("a failed count claims nothing: no kinds, no zeros", () => {
    // `fetchContactCounts` returns null when the read fails. Falling back to
    // zeros would print "No contact detail on this record yet" over a record
    // that may hold six phone numbers — a claim the failed read cannot make.
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(zaheenSampleInput(), { contactCounts: null }) }));
    assert.doesNotMatch(html, /On file:/);
    assert.doesNotMatch(html, /No contact detail/);
    assert.doesNotMatch(html, /data-contact-counts/);
    // The card is still there, still locked, and still says why.
    assert.match(html, /data-locked="true"/);
    assert.match(html, /Contact details are shown on paid plans\./);
  });

  it("a record holding nothing says so, rather than listing kinds it does not have", () => {
    const html = renderToStaticMarkup(
      createElement(SupplierSheet, {
        model: buildSheet(zaheenSampleInput(), { contactCounts: { emails: 0, phones: 0, representatives: 0, website: false } }),
      }),
    );
    assert.match(html, /No contact detail on this record yet\./);
    assert.doesNotMatch(html, /0 emails|0 phone numbers|0 named representatives/);
  });

  it("one of each is singular", () => {
    const html = renderToStaticMarkup(
      createElement(SupplierSheet, {
        model: buildSheet(zaheenSampleInput(), { contactCounts: { emails: 1, phones: 1, representatives: 1, website: false } }),
      }),
    );
    assert.match(html, /On file: 1 email · 1 phone number · 1 named representative\./);
    assert.doesNotMatch(html, /1 emails|1 phone numbers|1 named representatives/);
  });
});

describe("SupplierSheet — a sanctioned record (REZ-C §3.3, spec §2)", () => {
  it("the banner precedes every tab's section in the one document the sheet renders", () => {
    // Spec §2: the warning cannot be hidden by layout. The sheet renders every
    // section into one document, and the banner sits above all of them, so
    // whichever tab the buyer lands on it is on screen. Asserting the sections
    // are all present is what makes this a statement about every tab rather
    // than about the first one.
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(sanctionedInput()) }));
    assert.match(html, /data-sanction-visible="true"/);
    assert.match(html, /role="alert"/);
    assert.match(html, /RFQs cannot be sent to this supplier/);
    const banner = html.indexOf('data-sanction-visible="true"');
    for (const id of SECTIONS) {
      const at = html.indexOf(`id="${id}"`);
      assert.ok(at > -1, `the ${id} section is missing, so the banner does not cover its tab`);
      assert.ok(banner < at, `the banner comes after the ${id} section`);
    }
  });

  it("Send RFQ is disabled and carries no href — on the sheet and on the line sheet", () => {
    // Hiding UI is never a security control (agent-brief), and it is not one
    // here: `rfq_create` validates every target with
    // `is_published = true and is_sanctioned = false` and refuses the whole
    // call otherwise. This asserts the UI half; the SQL half is pinned by
    // `etl/tests/test_rfq_create_sanctioned_sql.py` against the real function.
    const sheet = renderToStaticMarkup(
      createElement(SupplierSheet, { model: buildSheet(sanctionedInput(), { rfqHref: "/app/rfqs/new?supplier=x" }) }),
    );
    assert.match(sheet, /Send RFQ/);
    assert.ok(!sheet.includes('href="/app/rfqs/new?supplier=x"'), "a sanctioned record's Send RFQ is a live link");
    assert.match(sheet, /<button[^>]*disabled=""/);

    const line = renderToStaticMarkup(
      createElement(ProductSheet, {
        model: buildProductSheet(sanctionedInput(), "6105", { rfqHref: "/app/rfqs/new?supplier=x&hs=6105" }),
      }),
    );
    assert.match(line, /data-sanction-visible="true"/);
    assert.match(line, /Send RFQ for this line/);
    assert.ok(!line.includes("/app/rfqs/new?supplier=x"), "a sanctioned record's line Send RFQ is a live link");
  });

  it("an unsanctioned record's Send RFQ IS the link, so the disabled state is not simply the default", () => {
    // Without this, the test above would pass on a control that is never a
    // link for anybody — proving nothing about the sanction.
    const html = renderToStaticMarkup(
      createElement(SupplierSheet, { model: buildSheet(aboniInput(), { rfqHref: "/app/rfqs/new?supplier=abc" }) }),
    );
    assert.ok(html.includes('href="/app/rfqs/new?supplier=abc"'), "Send RFQ is not a link on a record that can receive one");
    assert.doesNotMatch(html, /data-sanction-visible/);
  });
});

describe("SupplierSheet — the four sections REZ-C adds", () => {
  it("every tab points at a section that exists; none is an inert placeholder", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    // Before REZ-C, Sources / Locations / Facilities / RFQs were `href: null`
    // and rendered `href="#" aria-disabled="true"`.
    assert.doesNotMatch(html, /aria-disabled="true"[^>]*>\s*(?:Sources|Locations|Facilities|RFQs)/);
    for (const [label, frag] of [
      ["Sources", "#sources"],
      ["Locations", "#locations"],
      ["Facilities", "#facilities"],
      ["RFQs", "#rfqs"],
    ] as const) {
      assert.ok(html.includes(`href="${frag}"`), `the ${label} tab still points nowhere`);
      assert.ok(html.includes(`id="${frag.slice(1)}"`), `${label} has a tab but no section`);
    }
  });

  it("Sources names each register, its tier in words, and the date it was read", () => {
    const model = buildSheet(aboniInput());
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model }));
    assert.ok(model.sources.length > 1, "the 11-source record built fewer than two source rows");
    // The tier is the founder's words, never the database slug.
    assert.doesNotMatch(html, /tier1_gov|tier2_industry|tier3_cert|tier4_brand/);
    assert.match(html, /Government register|Industry body|Certification body/);
    // The denominator is the 14 registers that have ever produced a record,
    // not the 25 rows in `sources` — the same standard the card's chip uses,
    // because "3 of 25" claims a weighing against registers never read.
    assert.match(html, /of 14 registers read/);
    assert.doesNotMatch(html, /of 25 registers/);
    // The tab's count and the section's rows are one number.
    assert.equal(
      model.tabs.find((t) => t.label === "Sources")?.count,
      String(model.marks.length),
    );
  });

  it("Locations shows premises, not address rows, and keeps the other spellings", () => {
    const model = buildSheet(aboniInput());
    const rows = model.locations;
    assert.ok(rows.length > 0, "the 11-source record built no location rows");
    // The registers write one place several ways. The section must show the
    // matcher's premises, and the tab must claim that same number: a section
    // listing more rows than its tab claims is two answers to one question.
    assert.equal(model.tabs.find((t) => t.label === "Locations")?.count, String(rows.length));
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model }));
    for (const r of rows) {
      const firstLine = r.address.split("\n")[0]!;
      assert.ok(html.includes(firstLine), `the premises "${firstLine}" is missing from the HTML`);
    }
    // A merged spelling is named under its premises, never silently dropped.
    const merged = rows.find((r) => r.alsoRecordedAs.length > 0);
    if (merged) {
      assert.match(html, /Also recorded as:/);
      assert.ok(html.includes(merged.alsoRecordedAs[0]!.split("\n")[0]!), "a merged spelling is not shown anywhere");
    }
  });

  it("Facilities says what is absent, never that the company has no buildings", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    // REZ-73's roll-up is not landed. "No extension buildings" would be a
    // claim about the company; "not on this record yet" is a claim about us.
    assert.match(html, /Extension buildings are not on this record yet\./);
    assert.doesNotMatch(html, /No extension buildings|has no buildings/);
  });

  it("RFQs: an unread list has no count and does not say the buyer has none", () => {
    const model = buildSheet(aboniInput(), { rfqs: { count: null, rows: [], error: true } });
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model }));
    assert.equal(model.tabs.find((t) => t.label === "RFQs")?.count, null);
    assert.match(html, /Your RFQs could not be read\./);
    assert.doesNotMatch(html, /have not sent this supplier an RFQ/);
  });

  it("RFQs: a read that found none says so, and a row links to its RFQ", () => {
    const none = renderToStaticMarkup(
      createElement(SupplierSheet, { model: buildSheet(aboniInput(), { rfqs: { count: 0, rows: [] } }) }),
    );
    assert.match(none, /You have not sent this supplier an RFQ yet\./);

    const model = buildSheet(aboniInput(), {
      rfqs: {
        count: 1,
        rows: [
          {
            id: "8f2b",
            title: "Knitted polo shirts",
            quantity: "12,000 pcs",
            status: { tone: "type", label: "Open" },
            sent: "18 Sep 2026",
            shipBy: "12 Dec 2026",
            href: "/app/rfqs/8f2b",
          },
        ],
      },
    });
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model }));
    assert.equal(model.tabs.find((t) => t.label === "RFQs")?.count, "1");
    assert.match(html, /href="\/app\/rfqs\/8f2b"/);
    assert.match(html, /Knitted polo shirts/);
    // The read carries no thread and no reply, so it may not say one is awaited.
    assert.doesNotMatch(html, /awaiting reply/i);
  });
});

describe("SupplierSheet — the worker figure (REZ-114, carried through REZ-C)", () => {
  it("shows the reconciled figure, not the record's own employees_total", () => {
    // The page this sheet replaced called `resolveProfileWorkers` by name, and
    // `lib/rez114-surface-wiring.test.ts` grepped for it. REZ-C routes the same
    // figure through `production_workers_display_batch` →
    // `fillRecordWorkers` → `workersFact`, so the grep alone would have gone
    // green over a page showing the wrong number. This asserts the number.
    //
    // Aboni files `employees_total: 3314`; the batch reports 3,166 from RSC.
    // 3,166 is what a buyer must read.
    const input = aboniInput();
    assert.equal(input.profile.supplier.employees_total, 3314, "the fixture no longer sets up the disagreement this guards");
    assert.equal(input.workers?.value, 3166);
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input) }));
    assert.match(html, /3,166/);
    assert.ok(!html.includes("3,314"), "the record's own employees_total reached the sheet");
  });

  it("a failed batch read falls back to the payload's own sites, still not employees_total", () => {
    // `fillRecordWorkersSafely` absorbs a failed batch call, so this is a real
    // state, and the record's own `employees_total` must not be what fills the
    // gap: `buyer_supplier_profile` carries the RSC rows for this record's
    // sites, and their sum is the honest figure. For Aboni that sum is the
    // same 3,166 the batch reports — which is the point: the filed 3,314 is
    // not what a buyer reads on either path.
    const input = aboniInput();
    input.workers = null;
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(input) }));
    assert.match(html, /3,166/, "a failed batch read left the Workers row empty");
    assert.ok(!html.includes("3,314"), "the record's own employees_total filled the gap");
    // And it says what it covers, rather than presenting a partial sum as the whole.
    assert.match(html, /across 2 sites/);
  });
});

describe("SupplierSheet — overlay and full page are one component (REZ-C §3.3)", () => {
  it("the overlay closes back to the search; the full page draws no Close at all", () => {
    const overlay = renderToStaticMarkup(
      createElement(SupplierSheet, {
        model: buildSheet(aboniInput(), { closeHref: "/app/discover?q=knit", fullHref: "/app/suppliers/aboni-knitwear-ltd" }),
      }),
    );
    // Close is a plain link back to the search the sheet sits over, so the
    // results survive with no JavaScript and no re-run.
    assert.ok(overlay.includes('href="/app/discover?q=knit"'), "Close does not return to the search");
    assert.match(overlay, /aria-label="Close"/);
    assert.ok(overlay.includes('href="/app/suppliers/aboni-knitwear-ltd"'), "the overlay offers no way to the full page");
    assert.match(overlay, /Open full page/);
    assert.match(overlay, /role="dialog"/);

    const full = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()), dialog: false }));
    // A Close on a page with nothing behind it is a control that lies.
    assert.doesNotMatch(full, /aria-label="Close"/);
    assert.doesNotMatch(full, /role="dialog"/, "the full record page is not a dialog");
    assert.match(full, /Share/);
  });

  it("both render the same record: the sections and the facts do not differ", () => {
    // One component, two callers — the point of §3.3. If they ever diverge, a
    // deep link and an overlay show two different companies.
    const model = buildSheet(aboniInput());
    const overlay = renderToStaticMarkup(createElement(SupplierSheet, { model: { ...model, closeHref: "/app/discover" } }));
    const full = renderToStaticMarkup(createElement(SupplierSheet, { model, dialog: false }));
    for (const id of SECTIONS) {
      assert.ok(overlay.includes(`id="${id}"`) && full.includes(`id="${id}"`), `${id} is missing from one of the two`);
    }
    for (const row of model.facts) {
      if (row.value === null) continue;
      const firstLine = row.value.split("\n")[0]!;
      assert.ok(overlay.includes(firstLine) === full.includes(firstLine), `"${row.label}" differs between the overlay and the full page`);
    }
  });

  it("each product tile opens that line's sheet", () => {
    const model = buildSheet(aboniInput());
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model }));
    assert.ok(model.products.tiles.length > 0, "the 11-source record built no product tiles");
    for (const tile of model.products.tiles) {
      assert.ok(
        html.includes(`href="/app/suppliers/${model.slug}/lines/${tile.hs}"`),
        `the HS ${tile.hs} tile does not open its line`,
      );
    }
  });
});

describe("SupplierSheet — it is a page now, so a phone is a real width", () => {
  // Measured with Playwright at 320 / 375 / 768 / 1280 on 25 Sep 2026: no
  // horizontal page scroll and nothing outside the sheet at any of them. These
  // pin the classes that result, because the measurement does not run in CI.
  const html = () => renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));

  it("the facts rows stack below sm", () => {
    // Side by side on a 375px screen, a 150px label plus the trailing
    // "source pending" caption left the value about 75px, and
    // `[overflow-wrap:anywhere]` broke "ABONI KNITWEAR LTD." one character
    // per line.
    const out = html();
    assert.match(out, /flex min-h-fact-row flex-col[^"]*sm:flex-row/);
    assert.match(out, /w-full shrink-0[^"]*sm:w-\[150px\]/);
    assert.ok(!out.includes('class="w-[150px] shrink-0'), "the label is a fixed 150px at every width again");
  });

  it("the tab strip scrolls sideways and a keyboard can reach it", () => {
    // Eight tabs is ~640px of nav in an 880px sheet that is 320px on a phone.
    const out = html();
    assert.match(out, /<nav aria-label="Record sections" tabindex="0"[^>]*overflow-x-auto/);
  });

  it("the action bar wraps rather than pushing its caption off the sheet", () => {
    assert.match(html(), /glass flex shrink-0 flex-wrap items-center/);
  });

  it("the sheet never forces its 880px onto a narrower screen", () => {
    assert.match(html(), /w-\[880px\] max-w-full/);
  });
});

describe("ProductSheet — the line's own controls (REZ-C §3.4)", () => {
  it("Back returns to the record, and Other exporters runs that search", () => {
    const html = renderToStaticMarkup(
      createElement(ProductSheet, {
        model: buildProductSheet(aboniInput(), "6105", {
          backHref: "/app/suppliers/aboni",
          rfqHref: "/app/rfqs/new?supplier=abc&hs=6105",
        }),
      }),
    );
    assert.ok(html.includes('href="/app/suppliers/aboni"'), "Back does not return to the record");
    assert.ok(html.includes('href="/app/discover?hs=6105"'), "Other exporters goes nowhere");
    assert.ok(html.includes("/app/rfqs/new?supplier=abc&amp;hs=6105"), "Send RFQ for this line is not a link");
  });

  it("the photo is labelled as illustrative, never as the supplier's own product", () => {
    const html = renderToStaticMarkup(
      createElement(ProductSheet, { model: buildProductSheet(aboniInput(), "6105") }),
    );
    assert.match(html, /Not the supplier&#x27;s own product/);
  });
});
