// The public supplier record (B9g): the buyer record's own model drawn for a visitor. One page with every section in
// the first HTML, Contact locked behind a sign-up that comes back to this record, a sanctioned record refused in
// words, and nothing that reads the URL (the page is static) or reaches the buyer's app without a sign-in.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PUBLIC_NOTICE, PublicRecord } from "@/components/record/public-record";
import { TABS } from "@/components/record/words";
import { buildSheet } from "@/lib/dashboard/build-models";
import { TODAY, aboniInput, arFashionInput, sanctionedInput } from "@/lib/dashboard/fixtures";

const h = createElement as (type: unknown, props: object | null, ...kids: unknown[]) => ReactNode & Parameters<typeof renderToStaticMarkup>[0];
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (s: string) => plain(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");

const publicModel = (input = aboniInput()) =>
  buildSheet(input, { contactCounts: null, supplierId: null, saved: false, rfqHref: null, closeHref: null, lineHref: (hs) => `/signup?next=${encodeURIComponent(`/app/suppliers/x/lines/${hs}`)}` });
const draw = (input = aboniInput()) => {
  const model = publicModel(input);
  return { model, out: renderToStaticMarkup(h(PublicRecord, { model, today: TODAY })) };
};

describe("the public record", () => {
  it("is one page: the name, the summary, and all six sections in the first HTML", () => {
    const { model, out } = draw();
    assert.equal((out.match(/<h1\b/g) ?? []).length, 1);
    assert.ok(text(out).includes(model.name));
    assert.match(out, /<dl aria-label="Summary"/);
    for (const t of TABS) assert.match(out, new RegExp(`<section id="${t.id}"`), t.id);
    const nav = /<nav aria-label="Record sections"[\s\S]*?<\/nav>/.exec(out)?.[0] ?? "";
    assert.equal((nav.match(/<a\b/g) ?? []).length, TABS.length);
    for (const t of TABS) assert.ok(nav.includes(`href="#${t.id}"`), t.id);
  });

  it("holds nothing that reads the URL: no tab or site query, no link into the buyer's app", () => {
    const { out } = draw();
    assert.doesNotMatch(plain(out), /\?tab=|[?&]record=/);
    assert.doesNotMatch(out, /href="\/app/);
  });

  it("locks Contact and sends Save and Send RFQ to a sign-up that comes back to this record", () => {
    const { model, out } = draw();
    const next = encodeURIComponent(`/suppliers/${model.slug}`);
    assert.match(text(out), /Contact details are locked\. Sign up free and send an RFQ; the supplier replies in SourceBD\./);
    const signUps = [...plain(out).matchAll(/href="(\/signup\?next=[^"]+)"/g)].map((m) => m[1]!);
    assert.ok(signUps.filter((u) => u === `/signup?next=${next}`).length >= 3, "Save, the header button and the Contact box");
    assert.match(text(out), /Sign up to contact/);
  });

  it("carries no contact value and no score", () => {
    const { out } = draw();
    assert.doesNotMatch(out, /mailto:|tel:|@[a-z0-9-]+\.[a-z]{2,}/i);
    assert.doesNotMatch(text(out), /\b(score|rating|stars?|grade)\b/i);
  });

  it("a sanctioned record keeps the solid band and the refusal in words, and offers no sign-up to contact", () => {
    const { out } = draw(sanctionedInput());
    assert.match(out, /role="alert"|data-sanction|sanction/i);
    assert.doesNotMatch(text(out), /Sign up to contact/);
    assert.match(text(out), /RFQ/);
  });

  it("a record with no certificates says so in words and still draws every section", () => {
    const { out } = draw(arFashionInput());
    for (const t of TABS) assert.match(out, new RegExp(`<section id="${t.id}"`), t.id);
  });

  it("names the authorities' notice, pointing at Sources and not at a tab", () => {
    const { out } = draw();
    assert.ok(text(out).includes(text(PUBLIC_NOTICE)));
    assert.doesNotMatch(PUBLIC_NOTICE, /Provenance tab/);
  });
});
