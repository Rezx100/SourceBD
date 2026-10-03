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
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { buildProductSheet, buildSheet, factIcon } from "@/lib/dashboard/build-models";
import { aboniInput, sanctionedInput, sanctionedWithEvidenceInput, zaheenSampleInput } from "@/lib/dashboard/fixtures";
import { ProductSheet } from "./product-sheet";
import { FEEDBACK_ENDPOINT, feedbackBody } from "./report-problem";
import { FACT_GROUPS, SupplierSheet } from "./supplier-sheet";
import { RecordPane, certScopeRows } from "./sheet";

/** The locked card's count rows, as [label, value] pairs, in the order drawn. */
function contactRows(html: string): [string, string][] {
  const at = html.indexOf('data-contact-counts="true"');
  if (at < 0) return [];
  const dl = html.slice(at, html.indexOf("</dl>", at));
  // A kind's label now leads with its icon (an <svg>), so the label is the dt's text.
  return [...dl.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt><dd[^>]*>([^<]*)<\/dd>/g)].map((m) => [m[1]!.replace(/<[^>]*>/g, ""), m[2]!]);
}

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

    // What the buyer is told: one row per kind, the count and nothing else
    // (enterprise pass, 27 Sep 2026 — the counts became rows).
    assert.deepEqual(contactRows(html), [
      ["Email", "1 on file"],
      ["Phone", "6 on file"],
      ["Website", "on file"],
      ["Contact person", "2 on file"],
    ]);
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
    // The locked card's own element, whole: its <div>s counted to their close.
    const start = html.lastIndexOf("<div", html.indexOf('data-locked="true"'));
    let depth = 0;
    let end = start;
    for (const m of html.slice(start).matchAll(/<div\b|<\/div>/g)) {
      depth += m[0] === "</div>" ? -1 : 1;
      if (depth === 0) {
        end = start + m.index! + m[0].length;
        break;
      }
    }
    const card = html.slice(start, end);
    assert.match(card, /Contact details/, "guard: the locked card rendered");
    assert.doesNotMatch(card, /none on file|\d+ on file/, "a failed count printed a row as if it had been read");
    assert.doesNotMatch(html, /data-contact-counts/);
    // The card is still there, still locked, and still says why.
    assert.match(html, /data-locked="true"/);
    assert.match(html, /Contact details are not shown on the record\./);
    // No plan unlocks them, so nothing may offer one.
    assert.doesNotMatch(html, /paid plans|See plans|What is hidden/);
  });

  it("a record holding nothing says so on every row, never as a zero", () => {
    const html = renderToStaticMarkup(
      createElement(SupplierSheet, {
        model: buildSheet(zaheenSampleInput(), { contactCounts: { emails: 0, phones: 0, representatives: 0, website: false } }),
      }),
    );
    assert.deepEqual(contactRows(html), [
      ["Email", "none on file"],
      ["Phone", "none on file"],
      ["Website", "none on file"],
      ["Contact person", "none on file"],
    ]);
    assert.doesNotMatch(html, /\b0 on file\b/);
  });

  it("the rows name each kind once, so a count of one needs no plural", () => {
    const html = renderToStaticMarkup(
      createElement(SupplierSheet, {
        model: buildSheet(zaheenSampleInput(), { contactCounts: { emails: 1, phones: 1, representatives: 1, website: false } }),
      }),
    );
    assert.deepEqual(contactRows(html), [
      ["Email", "1 on file"],
      ["Phone", "1 on file"],
      ["Website", "none on file"],
      ["Contact person", "1 on file"],
    ]);
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
    // Document order is not enough. The sections live inside a scroll region,
    // and "every tab" means the banner is still on screen when the buyer has
    // scrolled to RFQs. That is true only while the banner is OUTSIDE that
    // region — move it one line down, inside it and above #overview, and the
    // order assertions above all still pass while the banner scrolls away on
    // seven tabs out of eight.
    const scroll = html.indexOf('data-sheet-scroll="true"');
    assert.ok(scroll > -1, "the sheet no longer has a scroll region; this guard needs rewriting");
    assert.ok(banner < scroll, "the sanction banner is inside the scroll region and scrolls out of view");
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

describe("SupplierSheet — the sanction banner's evidence", () => {
  it("names the list, the matched name, the reference and the dates, and links the entry", () => {
    // The page this sheet replaced put these on its Compliance tab, and the
    // banner's own copy pointed at them. Without them a signed-in buyer saw
    // strictly LESS than an anonymous visitor on the public profile: an
    // accusation with no receipt, on the one record where the receipt matters
    // most.
    const model = buildSheet(sanctionedWithEvidenceInput());
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model }));
    assert.equal(model.sanctions.length, 2);
    assert.match(html, /id="sanctions"/);
    assert.match(html, /See the matches/);
    assert.match(html, /uflpa/);
    assert.match(html, /UFLPA-2024-0117/);
    assert.match(html, /Matched “ZAHEEN KNITWEARS LIMITED”/);
    assert.match(html, /listed 11 Jun 2024/);
    assert.match(html, /screened 18 Sep 2026/);
    assert.ok(html.includes("https://www.dhs.gov/uflpa-entity-list#UFLPA-2024-0117"), "the entry is not linked");
    // An anchored URL opens the entry, and its link says so — "The list" over
    // a link to one entry names the wrong thing.
    assert.equal(model.sanctions.find((r) => r.href?.includes("#UFLPA-2024-0117"))?.opens, "entry");
    assert.match(html, /href="https:\/\/www\.dhs\.gov\/uflpa-entity-list#UFLPA-2024-0117"[^>]*>Entry/);
    // Without the fragment it is the list, and says that.
    const listOnly = sanctionedWithEvidenceInput();
    const listed = (listOnly.profile as { sanctions?: { source_url: string | null }[] }).sanctions!;
    listed[0]!.source_url = "https://www.dhs.gov/uflpa-entity-list";
    const listHtml = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(listOnly) }));
    assert.match(listHtml, /href="https:\/\/www\.dhs\.gov\/uflpa-entity-list"[^>]*>The list/);
    // The second row has no URL and no reference: it keeps its place and says
    // what it has, rather than being dropped or given a dead link.
    assert.match(html, /ofac_sdn/);
    assert.equal((html.match(/Matched “/g) ?? []).length, 2);
  });

  it("a flagged record with no rows says which absence it is", () => {
    // Two different absences, and the difference matters on this record: the
    // screen filed nothing, versus the read failed.
    const filedNothing = buildSheet({
      ...sanctionedInput(),
      profile: { ...sanctionedInput().profile, sanctions: [] } as never,
    });
    const notRead = buildSheet(sanctionedInput());
    assert.match(
      renderToStaticMarkup(createElement(SupplierSheet, { model: filedNothing })),
      /The screen recorded a match but filed no entry for it\./,
    );
    assert.match(
      renderToStaticMarkup(createElement(SupplierSheet, { model: notRead })),
      /The matched entries could not be read\./,
    );
  });

  it("a clean record draws no sanctions section at all", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    assert.doesNotMatch(html, /id="sanctions"/);
    assert.doesNotMatch(html, /See the matches/);
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
    // Exact, not "> 1": Aboni files 13 provenance rows across 11 registers, so
    // a broken dedup renders 13 and `> 1` stays green.
    assert.equal(model.sources.length, 11, "one row per register, not per provenance row");
    assert.equal(new Set(model.sources.map((s) => s.mark.code)).size, 11, "a register is listed twice");
    // The register's own read date, and its reference from that same read.
    const bkmea = model.sources.find((s) => s.mark.code === "BKMEA");
    assert.ok(bkmea, "BKMEA is missing from the Sources list");
    assert.equal(bkmea.readDate, "2 Aug 2026", "the row shows an older read than the register's latest");
    assert.ok(bkmea.ref, "the row shows no reference for a register that filed one");
    assert.ok(html.includes(`read ${bkmea.readDate}`), "the read date is not in the HTML");
    // The tier is the founder's words, never the database slug.
    assert.doesNotMatch(html, /tier1_gov|tier2_industry|tier3_cert|tier4_brand/);
    assert.match(html, /Government register|Industry body|Certification body/);
    // The denominator is the 14 registers that have ever produced a record,
    // not the 25 rows in `sources` — the same standard the card's chip uses,
    // because "3 of 25" claims a weighing against registers never read.
    assert.match(html, /of 14 registers read/);
    assert.doesNotMatch(html, /of 25 registers/);
    // The tab's count and the section's rows are one number.
    //
    // This compared the tab to `model.marks.length` — which IS what the tab is
    // built from, so it compared a value to itself and could never fail. It
    // never touched `model.sources`, the thing the tab is a count OF, and the
    // two came from genuinely different code paths: the tab from
    // `allSourceCodes` (tags ∪ pills ∪ certs ∪ brands ∪ provenance), the
    // section from `provenance` alone. On 69 of 10,266 published records they
    // disagreed (SQL, 25 Sep 2026 — a `source_tags` entry with no
    // `source_records` row, BGMEA in every case).
    assert.equal(model.tabs.find((t) => t.label === "Sources")?.count, String(model.sources.length));
    assert.equal(model.sourceCount, model.sources.length, "the head and the section disagree");
    // And the rows really are in the HTML, so the count is not of a list the
    // sheet never drew.
    const sourcesSection = html.slice(html.indexOf('id="sources"'));
    const escaped = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
    for (const s of model.sources) {
      assert.ok(sourcesSection.includes(escaped(s.name)), `${s.name} is counted but not rendered`);
    }
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

  describe("Facilities: the record's buildings (REZ-73's panel, founder 25 Sep)", () => {
    const building = (name: string, address: string, employees_total: number | null) => ({
      name,
      employees_total,
      addresses: [{ kind: "factory", address, source_code: "BGMEA" }],
      pills: [],
      rsc: null,
    });
    const metric = { own: null, known_sum: null, facility_count: 0, building_count: 1, unknown_count: 1 };
    const panel = (facilities: ReturnType<typeof building>[]) => ({
      facility_count: facilities.length,
      facilities,
      group: { employees_total: metric, machines_sewing: metric, production_capacity_pcs_day: metric, production_capacity_dozen_yearly: metric },
    });

    it("lists each building by name, with its address and workers, and counts them on the tab", () => {
      const model = buildSheet(aboniInput(), {
        facilities: { panel: panel([building("ABONI KNITWEAR LTD. (UNIT-2)", "Plot 12, Hemayetpur, Savar Tel: 01711528388", 450), building("Aboni Textile", "Tetuljhora, Savar", null)]) },
      });
      const html = renderToStaticMarkup(createElement(SupplierSheet, { model }));
      assert.equal(model.tabs.find((t) => t.label === "Facilities")?.count, "2");
      assert.match(html, /2 extension buildings/);
      assert.match(html, /data-facilities="true"/);
      assert.match(html, /Hemayetpur, Savar/);
      assert.match(html, /450 workers/);
      assert.match(html, /Aboni Textile/);
      // A building's address is register-filed text like any other.
      assert.ok(!html.includes("01711528388"), "a phone number filed in a building's address reached the sheet");
      assert.doesNotMatch(html, /not on this record|No extension buildings|could not be read/);
    });

    it("the Workers row points at the Facilities list rather than saying the breakdown is missing", () => {
      // A total covering the record and its buildings, with no site rows to
      // split it: the row used to say "the site breakdown is not on the
      // record" directly above a Facilities list giving each building's figure.
      const input = { ...aboniInput(), workers: { value: 2000, source: "registry", fetched_at: null } } as ReturnType<typeof aboniInput>;
      input.profile = { ...input.profile, rsc_remediation: null, supplier: { ...input.profile.supplier, employees_total: 1200 } };
      const workersNote = (m: ReturnType<typeof buildSheet>) => m.facts.find((f) => f.label === "Workers")?.note ?? "";
      const listed = buildSheet(input, { facilities: { panel: panel([building("Aboni Unit-2", "Savar", 800)]) } });
      assert.match(workersNote(listed), /under Facilities/, workersNote(listed));
      assert.doesNotMatch(workersNote(listed), /not on the record/);
      // No figures to point at: the old sentence is still the true one.
      assert.match(workersNote(buildSheet(input, { facilities: { panel: panel([building("Aboni Unit-2", "Savar", null)]) } })), /not on the record/);
    });

    it("a record with none says so; an unread panel says it could not be read, never that there are none", () => {
      const none = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput(), { facilities: { panel: panel([]) } }) }));
      assert.match(none, /No extension buildings on this record\./);
      const unread = buildSheet(aboniInput(), { facilities: { panel: null } });
      assert.equal(unread.tabs.find((t) => t.label === "Facilities")?.count, null);
      const html = renderToStaticMarkup(createElement(SupplierSheet, { model: unread }));
      assert.match(html, /The buildings could not be read\./);
      assert.doesNotMatch(html, /No extension buildings/);
    });
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
    // §3.3: Share copies the full-page URL — what it copies is asserted by
    // invoking its handler, in record-controls.test.ts.
    assert.match(overlay, /aria-label="Copy a link to this record"/);
    assert.match(overlay, /data-record-pane/);

    const full = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()), mode: "page" }));
    // A Close on a page with nothing behind it is a control that lies.
    assert.doesNotMatch(full, /aria-label="Close"/);
    assert.doesNotMatch(full, /data-record-pane/, "the full record page is drawn as the pane");
    // On the full page Share is a control, not a link to where the reader already is.
    assert.match(full, /aria-label="Copy a link to this record"/);
    assert.doesNotMatch(full, /Share this record/);
  });

  it("both render the same record: the sections and the facts do not differ", () => {
    // One component, two callers — the point of §3.3. If they ever diverge, a
    // deep link and an overlay show two different companies.
    const model = buildSheet(aboniInput());
    const overlay = renderToStaticMarkup(createElement(SupplierSheet, { model: { ...model, closeHref: "/app/discover" } }));
    const full = renderToStaticMarkup(createElement(SupplierSheet, { model, mode: "page" }));
    for (const id of SECTIONS) {
      assert.ok(overlay.includes(`id="${id}"`) && full.includes(`id="${id}"`), `${id} is missing from one of the two`);
    }
    for (const row of model.facts) {
      if (row.value === null) continue;
      const firstLine = row.value.split("\n")[0]!;
      assert.ok(overlay.includes(firstLine) === full.includes(firstLine), `"${row.label}" differs between the overlay and the full page`);
    }
  });

  it("both bars carry §3.3's more menu, and it reaches the feedback endpoint the admin queue reads", () => {
    const model = buildSheet(aboniInput());
    const overlay = renderToStaticMarkup(createElement(SupplierSheet, { model: { ...model, closeHref: "/app/discover" } }));
    const full = renderToStaticMarkup(createElement(SupplierSheet, { model, mode: "page" }));
    for (const [where, html] of [["overlay", overlay], ["full page", full]] as const) {
      // Inside the bar — before the first section — not somewhere further down.
      const bar = html.slice(0, html.indexOf('id="overview"'));
      assert.match(bar, /data-report-problem="true"/, `the ${where} bar has no more menu`);
      assert.match(bar, /<summary[^>]*aria-label="More"/, `the ${where} more menu has no accessible name`);
      assert.match(bar, /Report a problem[\s\S]*<textarea/, `the ${where} more menu has no report form`);
    }
    // The control is only worth having if something receives what it sends.
    assert.equal(FEEDBACK_ENDPOINT, "/api/v1/feedback");
    const route = readFileSync(path.join(process.cwd(), "app", "api", "v1", "feedback", "route.ts"), "utf8");
    assert.match(route, /export async function POST/);
    // …and only if it sends what the route reads: a renamed key is a 400 on
    // every report.
    const body = feedbackBody(`/app/discover?q=knit&record=aboni&x=${"y".repeat(600)}`, "  The address is wrong.  ");
    for (const key of Object.keys(body)) {
      assert.match(route, new RegExp(String.raw`\(json as \{ ${key}\?: unknown \}\)\.${key}`), `the route does not read "${key}"`);
    }
    assert.deepEqual(Object.keys(body).sort(), ["message", "page_path"]);
    assert.equal(body.page_path.length, 500, "the route refuses a page_path over 500 characters");
    assert.equal(body.message, "The address is wrong.");
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

  it("the sheet carries no width of its own: the pane or the page decides", () => {
    // It used to be an 880px column, and a phone is 320px. Now the sheet
    // fills whatever holds it — `RecordPane` beside the results from lg, the
    // whole content region below — and the pane's width is a share of the
    // region between two stops, never a fixed number.
    // A plain `w-` on any element: a `max-w` caps a measure, it forces nothing.
    assert.doesNotMatch(html(), /(?:^|[\s"])w-\[\d+px\]/);
    const pane = renderToStaticMarkup(createElement(RecordPane, null, "x"));
    // Half the region since 29 Sep 2026: at 55% a 1280 display left the
    // supplier column 132px and names broke mid-word.
    assert.match(pane, /lg:w-\[clamp\(480px,50%,760px\)\]/, "the pane's width is not a share of the region between two stops");
    assert.doesNotMatch(pane, /(?:^|[\s"])w-\[/, "a fixed width below lg would crush a phone");
  });

  // The review of 27 Sep 2026: opening order B beside the list while order A's
  // editor was open kept A's typed values under B's id, and the composer kept
  // A's targets under rfq=B. What the pane shows is keyed by what it is.
  it("the pane remounts its content when it shows something else", () => {
    const el = RecordPane({ openKey: "order:b", children: "x" }) as unknown as { props: { children: unknown[] } };
    const keyed = el.props.children.filter((c) => c && typeof c === "object" && "key" in (c as object)) as { key: string | null }[];
    assert.ok(
      keyed.some((c) => c.key === "order:b"),
      "RecordPane draws its children without a key: a client component inside keeps the last item's state",
    );
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
    // The caption once read "own product; a a photo" (#238 review, 4 Oct).
    assert.match(html, /own product;\s+a photo from the supplier replaces it/);
    assert.doesNotMatch(html, /\b(a|the) \1\b/);
  });
});

describe("the facts read in three levels, with an icon on every fact (founder, 29 Sep 2026)", () => {
  it("every label the Overview groups has an icon, and the model carries it", () => {
    for (const g of FACT_GROUPS) for (const label of g.labels) assert.ok(factIcon(label, "factory"), `"${label}" has no icon`);
    assert.equal(factIcon("Type", "factory"), "factory");
    assert.equal(factIcon("Type", "buying_house"), "buying-house");
    assert.equal(factIcon("Type", "unknown"), "company");
    const sheet = buildSheet(aboniInput());
    const grouped = new Set(FACT_GROUPS.flatMap((g) => g.labels));
    for (const f of sheet.facts.filter((x) => grouped.has(x.label))) assert.ok(f.icon, `${f.label} reached the view without its icon`);
    // Every fact on the head's facts line that says what it is carries its icon too.
    for (const m of sheet.meta.filter((x) => !x.quiet)) assert.ok(m.icon, `the head's "${m.text}" has no icon`);
  });

  it("group headings are sentence case, labels muted with a grey icon, the facts a buyer reads first in medium", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
    for (const title of ["Company", "Location", "Workforce and capacity", "Registrations"]) {
      assert.match(html, new RegExp(`<h2 class="m-0 text-sm font-semibold text-ink-strong">${title}</h2>`), `${title} is not a sentence-case heading`);
    }
    assert.doesNotMatch(html, /uppercase[^"]*">(?:Company|Location|Workforce and capacity|Registrations)</, "a group heading is a mono eyebrow again");
    // The label: its icon takes the label's ink-muted, a class of its own none
    // (no hue since 29 Sep 2026; the value beside it is the darker ink).
    assert.match(html, /<span class="inline-flex[^"]*text-ink-muted[^"]*"><svg[^>]*class="shrink-0"[^>]*>(?:(?!<\/svg>)[\s\S])*<\/svg>Registered name<\/span>/);
    assert.doesNotMatch(html, /<svg[^>]*class="[^"]*\btext-accent\b/, "a fact's icon takes the state colour again");
    // Lead values in medium; a value's note in the quieter caption style.
    assert.match(html, /text-ink-strong \[overflow-wrap:anywhere\] font-medium[^"]*">ABONI KNITWEAR LTD\./);
    assert.doesNotMatch(html, /<span class="inline-flex[^"]*"><svg[^>]*text-(?:positive|caution|danger|brand)/, "a fact's icon takes a status or brand colour");
  });
});

describe("Certificates: one line each, the scope one click away (founder's review, 29 Sep 2026)", () => {
  const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(aboniInput()) }));
  const section = html.slice(html.indexOf('id="certificates"'), html.indexOf('id="safety"'));

  it("a row per certificate with its state and its document, and the caption is the count alone", () => {
    const rows = section.match(/<li [^>]*data-cert="/g) ?? [];
    assert.equal(rows.length, buildSheet(aboniInput()).certs.length, "not one row per certificate");
    assert.match(section, /4 on file</);
    assert.doesNotMatch(section, /4 on file · /, "the caption names the schemes the rows already name");
    assert.match(section, /Valid to 12 May 2027/);
    assert.match(section, /aria-label="Open the GOTS certificate GOTS-31587"/);
    assert.match(section, /<summary[^>]*>Scope<span class="sr-only"> of GOTS GOTS-31587<\/span>/, "two Scope toggles a screen reader cannot tell apart");
    assert.doesNotMatch(section, /rounded-md border border-line-subtle bg-surface px-4 py-3\.5/, "a certificate is a card again");
  });

  it("the scope is inside a closed disclosure, and nothing in it is dropped but a repeat of the name", () => {
    assert.match(section, /<details class="group\/scope[^"]*"><summary[^>]*>Scope/);
    assert.doesNotMatch(section, /<details[^>]*\bopen\b[^>]*class="group\/scope/, "the scope opens by default");
    assert.match(section, /Operations<\/dt>/, "GOTS' operations went missing");
  });

  it("a scope that only repeats the certificate's name is left out; one that says more stays", () => {
    assert.deepEqual(certScopeRows({ scheme: "OEKO-TEX Standard 100", scope: "OEKO-TEX STANDARD 100" }), []);
    assert.deepEqual(certScopeRows({ scheme: "WRAP Gold", scope: "Gold" }), []);
    assert.deepEqual(certScopeRows({ scheme: "OEKO-TEX STeP", scope: "OEKO-TEX STeP" }), []);
    assert.deepEqual(certScopeRows({ scheme: "WRAP Gold", scope: "Gold | Industries: Apparel" }), [{ label: "Industries", value: "Apparel" }]);
    assert.deepEqual(certScopeRows({ scheme: "GOTS", scope: "Operations: Dyeing, Knitting | Products: Men's apparel" }), [
      { label: "Operations", value: "Dyeing, Knitting" },
      { label: "Products", value: "Men's apparel" },
    ]);
    assert.deepEqual(certScopeRows({ scheme: "OEKO-TEX Standard 100", scope: "OEKO-TEX STANDARD 100, Class I" }), [{ label: "Scope", value: "OEKO-TEX STANDARD 100, Class I" }]);
    // A labelled part is a field of its own, whatever its words.
    assert.deepEqual(certScopeRows({ scheme: "OEKO-TEX Standard 100", scope: "Products: 100" }), [{ label: "Products", value: "100" }]);
  });
});

describe("a reason that was only a hover title is a tap away (founder's leftovers, 29 Sep 2026)", () => {
  it("an empty figure's dash and a checked-but-empty fact's magnifier open their reason on a tap", () => {
    const html = renderToStaticMarkup(createElement(SupplierSheet, { model: buildSheet(zaheenSampleInput()) }));
    const reasons = [...html.matchAll(/<details name="sb-menu" class="group\/why[^"]*"><summary aria-label="([^"]+)" title="([^"]+)"[^>]*>[\s\S]*?<\/summary><span role="note"[^>]*>([^<]+)<\/span><\/details>/g)];
    assert.ok(reasons.length > 0, "no tappable reason on a record with empty facts");
    for (const [, label, title, note] of reasons) {
      assert.ok(label!.length > 0);
      assert.equal(title, note, `the hover and the tap say different things: ${label}`);
    }
    assert.ok(reasons.some(([, label]) => /^What was checked for /.test(label!)), "the magnifier is still hover-only");
    assert.doesNotMatch(html, /<span title="Not on file · /, "a reason is a bare hover title again");
  });
});
