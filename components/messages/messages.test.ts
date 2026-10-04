// The v4 Messages pages (B6a): the words a buyer reads (the time on a row, the line under a name,
// "No reply yet", the tabs and the search, the strip over a conversation), what the loaders do with
// a failed read, and what the two routes put in the HTML for a filled, an empty and a failed read,
// a conversation that is not the caller's and the record beside one. Dates are fixed to 4 Oct 2026.
//
// The routes run over a fake Supabase client installed into the module cache before they load
// (the pattern in `components/orders/orders.test.ts`).

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { aboniInput } from "@/lib/dashboard/fixtures";
import type { RfqDoc } from "../rfqs/doc";
import { noReplyCount } from "./inbox";
import { InboxEmpty, InboxError, InboxRows } from "./list";
import { LAST_READ_CAP, loadInbox, readMessages, readRfq } from "./load";
import { MessageList, ThreadLive } from "./thread-live";
import {
  COUNTER_FROM,
  arrivalText,
  bubbleMeta,
  buildThreadItems,
  clock,
  counterText,
  dayGroups,
  dayLabel,
  filterItems,
  listHref,
  listWhen,
  parseQuery,
  parseShow,
  phoneStripLine,
  quoteWords,
  rfqStrip,
  threadHref,
  threadSub,
  type LastMessage,
  type ThreadMessage,
  type ThreadRow,
} from "./words";

const OUT = path.join(process.cwd(), process.env.TEST_BUILD_DIR || ".tests-build");
type Answer = { data: unknown; error: unknown };
type Handler = Answer | ((args: Record<string, unknown> | undefined) => Answer);
let rpcs: Record<string, Handler> = {};
let rpcCalls: { fn: string; args: Record<string, unknown> | undefined }[] = [];
const client = {
  rpc: async (fn: string, args?: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    const h = rpcs[fn];
    if (h === undefined) return { data: fn === "production_workers_display_batch" ? [] : null, error: { code: "PGRST202", message: `no function ${fn}` } };
    return typeof h === "function" ? h(args) : h;
  },
  auth: { getUser: async () => ({ data: { user: { id: "buyer-1" } }, error: null }) },
  from() {
    const result = () => Promise.resolve({ data: [], error: null, count: 0 });
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      contains: () => chain,
      order: () => chain,
      limit: () => result(),
      maybeSingle: () => Promise.resolve({ data: null }),
      then: (res: (v: unknown) => unknown) => result().then(res),
    };
    return chain;
  },
};
{
  const id = require.resolve(path.join(OUT, "lib/supabase/server.js"));
  require.cache[id] = { id, filename: id, loaded: true, exports: { createSupabaseServerClient: async () => client }, children: [], paths: [] } as unknown as NodeJS.Module;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports -- the stub must be installed before the route module loads.
const route = (p: string) => require(path.join(OUT, p)).default as (props?: unknown) => ReactElement | Promise<ReactElement>;

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el));
const plain = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const html = (el: ReactElement) => plain(render(el));
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

async function outcome(run: () => ReactElement | Promise<ReactElement>): Promise<{ html: string } | { threw: string }> {
  try {
    return { html: plain(render(await run())) };
  } catch (err) {
    const digest = (err as { digest?: string })?.digest;
    if (typeof digest === "string") return { threw: digest };
    throw err;
  }
}
const is404 = (o: { html: string } | { threw: string }) => "threw" in o && /404/.test(o.threw);
const given = (a: Record<string, Handler>) => {
  rpcs = a;
  rpcCalls = [];
};

const NOW = new Date("2026-10-04T12:00:00Z");
const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const T3 = "33333333-3333-4333-8333-333333333333";
const RFQ1 = "44444444-4444-4444-8444-444444444444";
const ABONI = aboniInput();

const thread = (id: string, over: Partial<ThreadRow> = {}): ThreadRow => ({
  id,
  supplier_id: "s-thermax",
  supplier_slug: "thermax-woven-dyeing",
  supplier_name: "Thermax Woven Dyeing Ltd.",
  supplier_entity_type: "factory",
  rfq_id: RFQ1,
  subject: "Men's heavyweight French terry hoodies",
  last_message_at: "2026-10-04T11:20:00Z",
  created_at: "2026-07-18T09:00:00Z",
  message_count: 4,
  ...over,
});

const ROWS: ThreadRow[] = [
  thread(T1),
  thread(T2, { supplier_name: "Quattro Fashion Limited", supplier_id: "s-quattro", supplier_slug: "quattro-fashion", rfq_id: null, subject: "T-shirt", last_message_at: "2026-10-03T16:00:00Z", message_count: 2 }),
  thread(T3, { supplier_name: "Aboni Knitwear Ltd.", supplier_id: "s-aboni", supplier_slug: "aboni-knitwear", subject: "French terry hoodies", last_message_at: "2026-09-26T08:00:00Z", message_count: 1 }),
];
const LAST: Record<string, LastMessage> = {
  [T1]: { body: "Thank you. We will send the quote by Monday.", is_self: false, created_at: "2026-10-04T11:20:00Z" },
  [T2]: { body: "We can make the T-shirts. Our MOQ is 500 pieces per colour.", is_self: false, created_at: "2026-10-03T16:00:00Z" },
  [T3]: { body: "Can you confirm the fabric mill?", is_self: true, created_at: "2026-09-26T08:00:00Z" },
};
const items = () => buildThreadItems(ROWS, LAST, NOW);

describe("the list's words", () => {
  it("a row's time is the time today, Yesterday, else the day", () => {
    assert.equal(listWhen("2026-10-04T11:20:00Z", NOW), "11:20");
    assert.equal(listWhen("2026-10-03T23:59:00Z", NOW), "Yesterday");
    assert.equal(listWhen("2026-09-26T08:00:00Z", NOW), "26 Sep 2026");
    assert.equal(listWhen(null, NOW), null);
    assert.equal(listWhen("nonsense", NOW), null);
    assert.equal(clock("2026-10-04T09:05:00Z"), "09:05");
  });

  it("the line under a name: the supplier's words as they are, yours after 'You:', and 'No messages yet' when there are none", () => {
    const [a, b, c] = items();
    assert.equal(a!.line, "Thank you. We will send the quote by Monday.");
    assert.equal(c!.line, "You: Can you confirm the fabric mill?");
    assert.equal(b!.sub, "T-shirt", "a conversation with no RFQ says its subject");
    assert.equal(a!.sub, "RFQ · Men's heavyweight French terry hoodies");
    const none = buildThreadItems([thread(T1, { message_count: 0, last_message_at: null })], {}, NOW)[0]!;
    assert.equal(none.line, "No messages yet");
    assert.equal(none.noReply, false);
  });

  it("'No reply yet' is a conversation whose newest message is yours, and nothing is ever unread", () => {
    assert.deepEqual(items().map((i) => i.noReply), [false, false, true]);
    assert.equal(noReplyCount(items(), true), 1);
    assert.equal(noReplyCount(items(), false), null, "a count over some of the conversations would be a claim about all of them");
    // A conversation whose newest message was not read has no line and is not 'No reply yet'.
    const unread = buildThreadItems([thread(T1, { message_count: 3 })], {}, NOW)[0]!;
    assert.equal(unread.line, null);
    assert.equal(unread.noReply, false);
    assert.ok(!("unread" in unread));
  });

  it("the subject of an RFQ thread is 'RFQ · title'; with no title it is 'RFQ'; with neither, 'Conversation'", () => {
    assert.equal(threadSub({ rfq_id: RFQ1, subject: "  Hoodies\n420gsm " }), "RFQ · Hoodies 420gsm");
    assert.equal(threadSub({ rfq_id: RFQ1, subject: null }), "RFQ");
    assert.equal(threadSub({ rfq_id: null, subject: null }), "Conversation");
  });

  it("the tab and the search narrow the list; a search matches a name or an RFQ title, ignoring case", () => {
    assert.equal(filterItems(items(), { show: "all", q: "" }).length, 3);
    assert.deepEqual(filterItems(items(), { show: "noreply", q: "" }).map((i) => i.id), [T3]);
    assert.deepEqual(filterItems(items(), { show: "all", q: "QUATTRO" }).map((i) => i.id), [T2]);
    assert.deepEqual(filterItems(items(), { show: "all", q: "hoodies" }).map((i) => i.id), [T1, T3]);
    assert.deepEqual(filterItems(items(), { show: "noreply", q: "hoodies" }).map((i) => i.id), [T3]);
    assert.deepEqual(filterItems(items(), { show: "all", q: "zzz" }), []);
  });

  it("the tab and the search are read from the address, and kept in every link", () => {
    assert.equal(parseShow("noreply"), "noreply");
    assert.equal(parseShow("bogus"), "all");
    assert.equal(parseShow(["noreply"]), "noreply");
    assert.equal(parseShow(undefined), "all");
    assert.equal(parseQuery("  quattro "), "quattro");
    assert.equal(parseQuery("x".repeat(200)).length, 80);
    assert.equal(listHref({ show: "all", q: "" }), "/app/messages");
    assert.equal(listHref({ show: "noreply", q: "a b" }), "/app/messages?show=noreply&q=a+b");
    assert.equal(threadHref(T1), `/app/messages/${T1}`);
    assert.equal(threadHref(T1, { show: "noreply", q: "" }, "thermax"), `/app/messages/${T1}?show=noreply&record=thermax`);
    assert.equal(threadHref(T1, { show: "all", q: "" }, "a b&c"), `/app/messages/${T1}?record=a+b%26c`);
  });
});

describe("the rows as drawn", () => {
  const state = { show: "all" as const, q: "" };

  it("each row links to its conversation, marks the open one, and says 'No reply yet' with a clock", () => {
    const out = html(createElement(InboxRows, { items: items(), state, currentId: T1 }));
    assert.match(out, new RegExp(`href="/app/messages/${T1}"[^>]*aria-current="page"|aria-current="page"[^>]*href="/app/messages/${T1}"`));
    assert.equal(out.match(/aria-current="page"/g)?.length, 1);
    assert.match(text(out), /Thermax Woven Dyeing Ltd\. 11:20 Thank you\. We will send the quote by Monday\. RFQ · Men's heavyweight French terry hoodies/);
    assert.match(text(out), /No reply yet · RFQ · French terry hoodies/);
    assert.match(text(out), /Quattro Fashion Limited Yesterday|Quattro Fashion Limited \d+ \w+ 2026/);
    assert.doesNotMatch(out, /Unread|unread|Sample messages/);
    assert.match(out, /<time dateTime="2026-10-04T11:20:00Z" title="UTC"[^>]*>11:20<\/time>/, "the list's times are UTC and say so");
  });

  it("the list's tab and search ride along in every row's link", () => {
    const out = html(createElement(InboxRows, { items: items(), state: { show: "noreply", q: "hoodies" }, currentId: null }));
    assert.match(out, new RegExp(`href="/app/messages/${T1}\\?show=noreply&q=hoodies"`));
  });

  it("the empty state says how the inbox fills; the failed one never says 'no conversations'", () => {
    const empty = html(createElement(InboxEmpty));
    assert.match(text(empty), /Talk to suppliers here, with their record beside you\./);
    assert.match(text(empty), /Supplier replies land here\./, "the phone's words are in the page too");
    assert.match(empty, /href="\/app"[^>]*>Search suppliers/);
    assert.match(empty, /href="\/app\/rfqs\/new"/);
    const err = html(createElement(InboxError, { retryHref: "/app/messages" }));
    assert.match(err, /role="alert"/);
    assert.match(text(err), /We couldn't load your conversations\. Nothing has been lost\. Your messages are safe\./);
    assert.match(err, /href="\/app\/messages"[^>]*>Try again/);
    assert.doesNotMatch(err, /No conversations|Talk to suppliers/);
  });
});

describe("the conversation's words", () => {
  const m = (id: string, created_at: string, is_self = false): ThreadMessage => ({ id, thread_id: T1, sender_id: "u", created_at, body: `Body ${id}`, is_self });

  it("a day line per day, 'Today' for today", () => {
    const msgs = [m("a", "2026-10-03T14:30:00Z"), m("b", "2026-10-04T08:00:00Z", true), m("c", "2026-10-04T09:00:00Z")];
    assert.equal(dayLabel("2026-10-04T08:00:00Z", NOW), "Today · 4 Oct 2026");
    assert.equal(dayLabel("2026-10-03T08:00:00Z", NOW), "3 Oct 2026");
    assert.deepEqual(dayGroups(msgs, NOW).map((g) => [g.day, g.messages.map((x) => x.id)]), [
      ["3 Oct 2026", ["a"]],
      ["Today · 4 Oct 2026", ["b", "c"]],
    ]);
  });

  it("under a bubble: the name and the UTC time, 'You' for yours, never 'Read'", () => {
    assert.deepEqual(bubbleMeta(m("a", "2026-10-04T10:12:00Z"), "Thermax Woven Dyeing Ltd."), { full: "Thermax Woven Dyeing Ltd. · 10:12", time: "10:12" });
    assert.equal(bubbleMeta(m("b", "2026-10-04T11:05:00Z", true), "Thermax").full, "You · 11:05");
    const out = html(createElement(MessageList, { messages: [m("a", "2026-10-04T10:12:00Z"), m("b", "2026-10-04T11:05:00Z", true)], supplierName: "Thermax", today: NOW.toISOString() }));
    assert.match(out, /<time dateTime="2026-10-04T10:12:00Z" title="10:12 UTC">/);
    assert.match(text(out), /Today · 4 Oct 2026/);
    assert.match(text(out), /Body a Thermax · 10:12 10:12/, "a desktop name and time, then the phone's time");
    assert.doesNotMatch(out, /Read/);
    assert.match(out, /items-end self-end/, "your bubble is on the right");
  });

  it("an empty conversation invites the first message", () => {
    assert.match(html(createElement(MessageList, { messages: [], today: NOW.toISOString() })), /No messages yet\. Send the first one below\./);
  });

  it("an arriving reply is announced, naming the supplier; the counter waits for 7,000 characters", () => {
    assert.equal(arrivalText(0, "Aboni"), null);
    assert.equal(arrivalText(1, "Aboni Knitwear Limited"), "New message from Aboni Knitwear Limited");
    assert.equal(arrivalText(3, "Aboni"), "3 new messages from Aboni");
    assert.equal(COUNTER_FROM, 7000);
    assert.equal(counterText(7000), null);
    assert.equal(counterText(7001), "7,001 / 8,000");
  });
});

describe("the live conversation", () => {
  const live = (over: Record<string, unknown> = {}) =>
    html(createElement(ThreadLive as never, { threadId: T1, initialMessages: [], supplierName: "Aboni", today: NOW.toISOString(), ...over }));

  it("a reply that lands is heard: the polite live region is in the page before anything arrives", () => {
    assert.match(live(), /<p role="status" aria-live="polite" class="sr-only"><\/p>/);
  });

  it("the composer is one row that grows to six, labelled, with its send hint, and sends on Ctrl or Command + Enter", () => {
    const out = live();
    assert.match(out, /<label[^>]*>Message<\/label>/);
    assert.match(out, /<textarea[^>]*rows="1"[^>]*class="[^"]*max-h-\[9\.5rem\][^"]*resize-none/);
    assert.match(out, /placeholder="Write to Aboni"/);
    assert.match(text(out), /Ctrl or ⌘ \+ Enter to send/);
    assert.doesNotMatch(out, /\/ 8,000/, "a counter on an empty draft");
  });

  it("a failed first read says so and is not 'No messages yet'; a read that worked says neither", () => {
    const failed = live({ readFailed: true });
    assert.match(failed, /role="alert"/);
    assert.match(text(failed), /The latest messages could not be read just now\./);
    assert.doesNotMatch(failed, /No messages yet/);
    assert.doesNotMatch(live(), /could not be read/);
  });

  it("on a phone the RFQ line is the way to the RFQ", () => {
    const out = live({ phoneLine: "RFQ sent 18 Jul 2026 · 10,000 pieces · waiting for quote", phoneHref: `/app/rfqs?open=${RFQ1}` });
    assert.match(out, new RegExp(`href="/app/rfqs\\?open=${RFQ1}"[^>]*>RFQ sent 18 Jul 2026`));
    assert.match(live({ phoneLine: "RFQ sent" }), /<p class="text-center text-sm text-ink-3 sm:hidden">RFQ sent<\/p>/);
  });
});

describe("the strip over a conversation", () => {
  const rfq = (over: Partial<RfqDoc> = {}): RfqDoc => ({
    id: RFQ1,
    product_title: "Men's heavyweight French terry hoodies, 420gsm",
    product_description: null,
    quantity: 10000,
    quantity_unit: "pcs",
    target_unit_price: 8.9,
    currency: "USD",
    ship_to_country: "United Kingdom",
    ship_by: "2026-10-15",
    status: "open",
    accepted_quote_id: null,
    created_at: "2026-07-18T09:00:00Z",
    updated_at: "2026-07-18T09:00:00Z",
    viewer_role: "buyer",
    targets: [],
    quotes: [],
    thread_id: T1,
    ...over,
  });
  const quote = (over: Partial<RfqDoc["quotes"][number]> = {}): RfqDoc["quotes"][number] => ({
    id: "q1",
    supplier_id: "s-thermax",
    supplier_slug: "thermax-woven-dyeing",
    supplier_name: "Thermax Woven Dyeing Ltd.",
    supplier_entity_type: "factory",
    unit_price: 8.55,
    currency: "USD",
    lead_time_days: 45,
    moq: null,
    valid_until: null,
    notes: null,
    status: "submitted",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...over,
  });

  it("four facts: when it was sent, how many, the ship-by date and what this supplier said", () => {
    const s = rfqStrip(rfq(), "s-thermax")!;
    assert.deepEqual(s.cells, [
      { label: "RFQ sent", value: "18 Jul 2026" },
      { label: "Quantity", value: "10,000 pieces" },
      { label: "Ship by", value: "15 Oct 2026" },
      { label: "Quote", value: "Waiting for quote" },
    ]);
    assert.equal(s.rfqId, RFQ1);
    assert.equal(phoneStripLine(s), "RFQ sent 18 Jul 2026 · 10,000 pieces · waiting for quote");
    assert.equal(rfqStrip(null, "s-thermax"), null);
    assert.equal(rfqStrip(rfq({ ship_by: null }), "s-thermax")!.cells[2]!.value, "Not set");
  });

  it("the quote cell speaks for this supplier only: a price, accepted, withdrawn, not accepted, or none", () => {
    assert.equal(quoteWords(rfq({ quotes: [quote()] }), "s-thermax"), "US$8.55 per piece");
    assert.equal(quoteWords(rfq({ quotes: [quote({ status: "accepted" })] }), "s-thermax"), "Accepted · US$8.55 per piece");
    assert.equal(quoteWords(rfq({ quotes: [quote({ status: "withdrawn" })] }), "s-thermax"), "Quote withdrawn");
    assert.equal(quoteWords(rfq({ quotes: [quote({ status: "rejected" })] }), "s-thermax"), "Quote not accepted");
    assert.equal(quoteWords(rfq({ quotes: [quote({ supplier_id: "someone-else" })] }), "s-thermax"), "Waiting for quote", "another supplier's quote is not this one's");
    assert.equal(quoteWords(rfq({ status: "closed" }), "s-thermax"), "No quote");
    const newest = [quote({ id: "old", status: "withdrawn", created_at: "2026-08-01T00:00:00Z" }), quote({ id: "new", unit_price: 8.2, created_at: "2026-09-10T00:00:00Z" })];
    assert.equal(quoteWords(rfq({ quotes: newest }), "s-thermax"), "US$8.20 per piece");
  });
});

describe("the loaders", () => {
  it("each conversation with messages has its newest message read, and 'No reply yet' can be counted", async () => {
    given({
      thread_list: { data: ROWS, error: null },
      thread_messages: (a) => ({ data: [{ id: "m", thread_id: String(a?.p_thread_id), sender_id: "u", created_at: LAST[String(a?.p_thread_id)]!.created_at, body: LAST[String(a?.p_thread_id)]!.body, is_self: LAST[String(a?.p_thread_id)]!.is_self }], error: null }),
    });
    const inbox = await loadInbox(client);
    assert.equal(inbox.rows?.length, 3);
    assert.equal(inbox.lastComplete, true);
    assert.deepEqual(inbox.last[T3], { body: "Can you confirm the fabric mill?", is_self: true, created_at: "2026-09-26T08:00:00Z" });
    assert.ok(rpcCalls.filter((c) => c.fn === "thread_messages").every((c) => c.args?.p_limit === 1));
  });

  it("a conversation with no messages is not read; a failed read leaves the count unknown, not zero", async () => {
    given({
      thread_list: { data: [thread(T1, { message_count: 0 }), ...ROWS.slice(1)], error: null },
      thread_messages: (a) => (a?.p_thread_id === T3 ? { data: null, error: { message: "boom" } } : { data: [{ id: "m", thread_id: T2, sender_id: "u", created_at: "2026-10-03T16:00:00Z", body: "Hello", is_self: false }], error: null }),
    });
    const inbox = await loadInbox(client);
    assert.equal(rpcCalls.filter((c) => c.fn === "thread_messages").length, 2, "only conversations with messages are read");
    assert.equal(inbox.last[T3], undefined);
    assert.equal(inbox.lastComplete, false);
  });

  it("only the newest conversations are read, and the count is then unknown", async () => {
    const many = Array.from({ length: LAST_READ_CAP + 5 }, (_, i) => thread(`aaaaaaaa-0000-4000-8000-${String(i).padStart(12, "0")}`, { message_count: 1 }));
    given({ thread_list: { data: many, error: null }, thread_messages: { data: [{ id: "m", thread_id: "x", sender_id: "u", created_at: "2026-10-03T16:00:00Z", body: "Hi", is_self: true }], error: null } });
    const inbox = await loadInbox(client);
    assert.equal(rpcCalls.filter((c) => c.fn === "thread_messages").length, LAST_READ_CAP);
    assert.equal(inbox.lastComplete, false);
  });

  it("a failed thread_list is null rows, never an empty list", async () => {
    given({ thread_list: { data: null, error: { message: "down" } } });
    assert.equal((await loadInbox(client)).rows, null);
    given({ thread_list: { data: { not: "an array" }, error: null } });
    assert.equal((await loadInbox(client)).rows, null);
  });

  it("'not a participant' is denied; any other failure is an error; the RFQ read is soft", async () => {
    given({ thread_messages: { data: null, error: { message: "not a participant of this thread" } } });
    assert.deepEqual(await readMessages(client, T1), { kind: "denied" });
    given({ thread_messages: { data: null, error: { message: "statement timeout" } } });
    assert.deepEqual(await readMessages(client, T1), { kind: "error" });
    given({ thread_messages: { data: [], error: null } });
    assert.deepEqual(await readMessages(client, T1), { kind: "ok", messages: [] });
    given({ rfq_get: { data: null, error: { message: "x" } } });
    assert.equal(await readRfq(client, RFQ1), null);
    assert.equal(await readRfq(client, null), null);
  });
});

const RECORD = {
  buyer_supplier_profile: { data: ABONI.profile, error: null },
  supplier_epb_hscodes: { data: ABONI.hscodes.map((h) => ({ code: h.code, description: h.description, source_url: h.source_url })), error: null },
  supplier_contact_counts: { data: { emails: 1, phones: 6, website: true, representatives: 1 }, error: null },
};
const MSGS: ThreadMessage[] = [
  { id: "m1", thread_id: T3, sender_id: "s", created_at: "2026-09-12T14:30:00Z", body: "Our price is 3.20 USD FOB.", is_self: false },
  { id: "m2", thread_id: T3, sender_id: "b", created_at: "2026-09-13T08:00:00Z", body: "Thank you, sending samples.", is_self: true },
];
const RFQ_DOC: RfqDoc = {
  id: RFQ1,
  product_title: "French terry hoodies",
  product_description: null,
  quantity: 10000,
  quantity_unit: "pcs",
  target_unit_price: null,
  currency: "USD",
  ship_to_country: null,
  ship_by: "2026-10-15",
  status: "open",
  accepted_quote_id: null,
  created_at: "2026-07-18T09:00:00Z",
  updated_at: "2026-07-18T09:00:00Z",
  viewer_role: "buyer",
  targets: [],
  quotes: [],
  thread_id: T3,
};
const ABONI_THREAD = { ...ROWS[2]!, supplier_id: ABONI.profile.supplier.id };
const lastOf = (a: Record<string, unknown> | undefined): Answer => {
  const id = String(a?.p_thread_id);
  return a?.p_limit === 1 ? { data: id === T3 ? [MSGS[1]] : [{ id: "z", thread_id: id, sender_id: "s", created_at: LAST[id]?.created_at ?? "2026-10-03T16:00:00Z", body: LAST[id]?.body ?? "Hello", is_self: LAST[id]?.is_self ?? false }], error: null } : { data: MSGS, error: null };
};
const params = (thread: string) => ({ params: Promise.resolve({ thread }) });

describe("/app/messages", () => {
  const List = () => route("app/(app)/app/messages/(list)/page.js");
  const page = (sp: Record<string, string> = {}) => outcome(() => List()({ searchParams: Promise.resolve(sp) }) as Promise<ReactElement>);

  it("lists the conversations with their newest line, 'No reply yet' and the two tabs, and no row is unread", async () => {
    given({ thread_list: { data: ROWS, error: null }, thread_messages: lastOf });
    const out = (await page()) as { html: string };
    assert.match(text(out.html), /Messages All · 3 No reply yet · \d/);
    assert.match(text(out.html), /Thermax Woven Dyeing Ltd\./);
    assert.match(text(out.html), /Pick a conversation/);
    assert.match(out.html, new RegExp(`href="/app/messages/${T1}"`));
    assert.doesNotMatch(out.html, /Unread|Sample messages|<aside/);
    assert.match(out.html, /role="search"/);
  });

  it("?show=noreply keeps only the conversations waiting on a reply; ?q= matches names; nothing matching says so", async () => {
    given({ thread_list: { data: ROWS, error: null }, thread_messages: lastOf });
    const noreply = (await page({ show: "noreply" })) as { html: string };
    assert.match(noreply.html, /Aboni Knitwear Ltd\./);
    assert.doesNotMatch(noreply.html, /Quattro Fashion Limited/);
    assert.match(text(noreply.html), /1 conversation shown of 3/);
    const found = (await page({ q: "quattro" })) as { html: string };
    assert.match(found.html, /Quattro Fashion Limited/);
    assert.doesNotMatch(found.html, /Thermax Woven Dyeing Ltd\./);
    const none = (await page({ q: "zzzz" })) as { html: string };
    assert.match(none.html, /No conversation matches that/);
    assert.match(none.html, /href="\/app\/messages"[^>]*>Show all conversations/);
  });

  it("with the newest messages unread the 'No reply yet' tab is left out, and ?show=noreply shows the whole list", async () => {
    given({ thread_list: { data: ROWS, error: null }, thread_messages: { data: null, error: { message: "boom" } } });
    const out = (await page({ show: "noreply" })) as { html: string };
    assert.doesNotMatch(out.html, /No reply yet/);
    assert.match(out.html, /Quattro Fashion Limited/);
    assert.match(out.html, /Thermax Woven Dyeing Ltd\./);
  });

  it("no conversations at all is the teaching state", async () => {
    given({ thread_list: { data: [], error: null } });
    const out = (await page()) as { html: string };
    assert.match(text(out.html), /Talk to suppliers here, with their record beside you\./);
    assert.doesNotMatch(out.html, /Pick a conversation/);
  });

  it("a failed read is an error where the list was and never 'no conversations'", async () => {
    given({ thread_list: { data: null, error: { message: "down" } } });
    const out = (await page()) as { html: string };
    assert.match(out.html, /role="alert"/);
    assert.match(text(out.html), /We couldn't load your conversations\./);
    assert.doesNotMatch(out.html, /Talk to suppliers here/);
  });
});

describe("/app/messages/[thread]", () => {
  const Thread = () => route("app/(app)/app/messages/[thread]/page.js");
  const page = (thread: string, sp: Record<string, string> = {}) => outcome(() => Thread()({ ...params(thread), searchParams: Promise.resolve(sp) }) as Promise<ReactElement>);
  const base = (over: Record<string, Handler> = {}) =>
    given({ thread_list: { data: [ROWS[0]!, ROWS[1]!, ABONI_THREAD], error: null }, thread_messages: lastOf, rfq_get: { data: RFQ_DOC, error: null }, ...RECORD, ...over });

  it("draws the conversation beside the list: the name, the RFQ strip, a day line per day, the composer, and no record read", async () => {
    base();
    const out = (await page(T3)) as { html: string };
    assert.match(out.html, /data-detail=""/, "a phone hides its bars");
    assert.match(out.html, /<h1[^>]*>Aboni Knitwear Ltd\.<\/h1>/);
    assert.match(text(out.html), /RFQ sent 18 Jul 2026 Quantity 10,000 pieces Ship by 15 Oct 2026 Quote Waiting for quote View RFQ/);
    assert.match(out.html, new RegExp(`href="/app/rfqs\\?open=${RFQ1}"`));
    assert.match(out.html, /Our price is 3\.20 USD FOB\./);
    assert.deepEqual([...out.html.matchAll(/role="separator"[^>]*>[\s\S]*?<span class="text-xs font-medium text-ink-3">([^<]*)</g)].map((m) => m[1]), ["12 Sep 2026", "13 Sep 2026"]);
    assert.match(out.html, /<textarea[^>]*placeholder="Write to Aboni Knitwear Ltd\."/);
    assert.match(out.html, new RegExp(`href="/app/messages/${T3}"[^>]*aria-current="page"|aria-current="page"[^>]*href="/app/messages/${T3}"`));
    assert.doesNotMatch(out.html, /data-record-column/);
    assert.equal(out.html.match(/<h1\b/g)?.length, 1, "the conversation has the page's one h1; the list's title is an h2");
    assert.match(out.html, /<h2[^>]*>Messages<\/h2>/);
    assert.ok(!rpcCalls.some((c) => c.fn === "buyer_supplier_profile"), "a record was read with nothing open");
    assert.match(out.html, /Ctrl or ⌘ \+ Enter to send/);
  });

  it("the list's tab and search are kept in the Back link and the record link", async () => {
    base();
    const out = (await page(T3, { show: "noreply", q: "aboni" })) as { html: string };
    assert.match(out.html, /href="\/app\/messages\?show=noreply&q=aboni"[^>]*aria-label="Back to messages"|aria-label="Back to messages"[^>]*href="\/app\/messages\?show=noreply&q=aboni"/);
    assert.match(out.html, new RegExp(`href="/app/messages/${T3}\\?show=noreply&q=aboni&record=aboni-knitwear"`));
  });

  it("?record= draws the record in a column beside the conversation; Hide record and Close return to the thread; no contact value is in the page", async () => {
    base();
    const out = (await page(T3, { record: "aboni-knitwear" })) as { html: string };
    assert.match(out.html, /data-record-column=""/);
    assert.match(out.html, /Aboni Knitwear Ltd/, "the record's name");
    assert.match(out.html, /Our price is 3\.20 USD FOB\./, "the conversation is still on the page");
    assert.ok(out.html.indexOf("Our price is") < out.html.indexOf("data-record-column"), "the record sits after (to the right of) the conversation");
    assert.match(out.html, /Hide record/);
    assert.match(out.html, new RegExp(`href="/app/messages/${T3}"[^>]*>Hide record`));
    assert.match(out.html, new RegExp(`href="/app/messages/${T3}"[^>]*aria-label="Close record"|aria-label="Close record"[^>]*href="/app/messages/${T3}"`));
    assert.match(text(out.html), /Your RFQ in this conversation French terry hoodies 10,000 pieces · ship by 15 Oct 2026 · sent 18 Jul 2026 Waiting for quote View RFQ/);
    assert.match(text(out.html), /Email 1 on file · Phone 6 on file · Website on file · Contact person 1 on file · locked/);
    assert.match(out.html, /href="\/app\/suppliers\/aboni-knitwear/, "Open full record");
    assert.equal(rpcCalls.find((c) => c.fn === "buyer_supplier_profile")?.args?.p_slug, "aboni-knitwear");
    for (const key of ["email_primary", "phones", "contact_name", "contact_role"]) assert.ok(!out.html.includes(key), `${key} reached the HTML`);
  });

  it("a record that cannot be found says so beside a conversation that still works; a slow one says that", async () => {
    base({ buyer_supplier_profile: { data: null, error: null } });
    const none = (await page(T3, { record: "aboni-knitwear" })) as { html: string };
    assert.match(none.html, /No record for that link/);
    assert.match(none.html, /Thank you, sending samples\./);
    base({ buyer_supplier_profile: { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } } });
    const slow = (await page(T3, { record: "aboni-knitwear" })) as { html: string };
    assert.match(slow.html, /This record could not be read in time/);
    assert.match(slow.html, new RegExp(`href="/app/messages/${T3}\\?record=aboni-knitwear"[^>]*>Try again`));
  });

  it("another company's record is not opened beside this conversation", async () => {
    base();
    const out = (await page(T3, { record: "some-other-company" })) as { html: string };
    assert.match(out.html, /No record for that link/);
    assert.ok(!rpcCalls.some((c) => c.fn === "buyer_supplier_profile"), "a record was read that is not this supplier's");
  });

  it("without the RFQ the strip is left out and View RFQ stays; a thread with no RFQ has neither", async () => {
    base({ rfq_get: { data: null, error: { message: "x" } } });
    const out = (await page(T3)) as { html: string };
    assert.doesNotMatch(out.html, /RFQ sent/);
    assert.match(out.html, new RegExp(`href="/app/rfqs\\?open=${RFQ1}"[^>]*>View RFQ`));
    given({ thread_list: { data: [{ ...ABONI_THREAD, rfq_id: null }], error: null }, thread_messages: lastOf });
    const plainThread = (await page(T3)) as { html: string };
    assert.doesNotMatch(plainThread.html, /View RFQ/);
    assert.ok(!rpcCalls.some((c) => c.fn === "rfq_get"));
  });

  it("a conversation that is not the caller's, one that is not in the list, and a bad id are a 404", async () => {
    base({ thread_messages: { data: null, error: { message: "not a participant of this thread" } } });
    assert.ok(is404(await page(T3)), "denied");
    base();
    assert.ok(is404(await page("99999999-9999-4999-8999-999999999999")), "not in the list");
    assert.ok(is404(await page("not-a-uuid")), "not an id");
    assert.ok(!existsSync(path.join(process.cwd(), "app/(app)/app/messages/loading.tsx")), "a loading state above the thread would stream its 404 behind a 200");
    assert.ok(!existsSync(path.join(process.cwd(), "app/(app)/app/messages/[thread]/loading.tsx")));
  });

  it("a failed read is not a 404: a failed list says so and a failed message read never says 'No messages yet'", async () => {
    base({ thread_list: { data: null, error: { message: "down" } } });
    const noList = await page(T3);
    assert.ok("html" in noList, "a failed list answered a status");
    assert.match((noList as { html: string }).html, /We couldn't load this conversation\./);
    assert.match((noList as { html: string }).html, /We couldn't load your conversations\./);
    base({ thread_messages: (a) => (a?.p_limit === 1 ? lastOf(a) : { data: null, error: { message: "statement timeout" } }) });
    const failed = (await page(T3)) as { html: string };
    assert.match(text(failed.html), /The latest messages could not be read just now\./);
    assert.doesNotMatch(failed.html, /No messages yet/);
    assert.match(failed.html, /<textarea/, "the composer still works");
  });
});
