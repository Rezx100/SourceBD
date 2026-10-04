// The words of Messages (B6a, Paper `10 · Messages`, `11 · Messages`): one row of the list, the
// line under a name, the times, the tabs, the search, and the strip of the RFQ above a
// conversation. Everything is worked out from what `thread_list`, `thread_messages` and `rfq_get`
// return, so nothing here can say more than they hold: there is no read state in the data, so a row
// is never "unread", and a message is never "Read". Times are UTC, as they were, so the server and
// the browser agree. Pure.

import { formatCount, formatDay } from "@/lib/dashboard/facts";
import { priceWords, quantityWords } from "@/components/rfqs/words";
import type { RfqDoc } from "@/components/rfqs/doc";

/** One conversation as `thread_list` returns it (the buyer's side: the other side is the supplier). */
export type ThreadRow = {
  id: string;
  supplier_id: string;
  supplier_slug: string;
  supplier_name: string;
  supplier_entity_type: string;
  rfq_id: string | null;
  subject: string | null;
  last_message_at: string | null;
  created_at: string;
  message_count: number;
};

/** The newest message of a conversation, read with `thread_messages(p_limit: 1)`. */
export type LastMessage = { body: string; is_self: boolean; created_at: string };

export type ThreadMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  created_at: string;
  body: string;
  is_self: boolean;
};

export const MAX_BODY = 8000;
/** The counter stays out of the way until a message is this long. */
export const COUNTER_FROM = 7000;

/** "7,250 / 8,000" once a draft passes `COUNTER_FROM` characters; nothing before. */
export function counterText(length: number): string | null {
  return length > COUNTER_FROM ? `${formatCount(length)} / ${formatCount(MAX_BODY)}` : null;
}

/** The announcement for messages that arrived from the other side, or null when none did. */
export function arrivalText(arrived: number, supplierName?: string): string | null {
  if (arrived <= 0) return null;
  const who = supplierName ?? "the supplier";
  return arrived === 1 ? `New message from ${who}` : `${formatCount(arrived)} new messages from ${who}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "11:20", the UTC time of day; null when it is not a date. */
export function clock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const dayKey = (iso: string): string | null => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
};

/** The list's time: the time of day today, "Yesterday", else the day: "11:20", "Yesterday", "26 Sep 2026". */
export function listWhen(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null;
  const k = dayKey(iso);
  if (k === null) return null;
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  if (k === today) return clock(iso);
  if (k === yesterday) return "Yesterday";
  return formatDay(iso);
}

/** The conversation's day line: "Today · 3 Oct 2026", else "2 Oct 2026". */
export function dayLabel(iso: string, now: Date): string {
  const day = formatDay(iso) ?? "Date not recorded";
  return dayKey(iso) === now.toISOString().slice(0, 10) ? `Today · ${day}` : day;
}

/** Consecutive messages grouped by the day they were sent, for one line per day. */
export function dayGroups(messages: readonly ThreadMessage[], now: Date): { day: string; messages: ThreadMessage[] }[] {
  const out: { day: string; messages: ThreadMessage[] }[] = [];
  for (const m of messages) {
    const day = dayLabel(m.created_at, now);
    const last = out[out.length - 1];
    if (last && last.day === day) last.messages.push(m);
    else out.push({ day, messages: [m] });
  }
  return out;
}

/** Under a bubble: "Thermax Woven Dyeing Ltd. · 10:12" on a desktop, "You · 11:05"; a phone prints only the time. */
export function bubbleMeta(m: Pick<ThreadMessage, "is_self" | "created_at">, supplierName: string | undefined): { full: string; time: string } {
  const time = clock(m.created_at) ?? "";
  return { full: [m.is_self ? "You" : (supplierName ?? "Supplier"), time].filter(Boolean).join(" · "), time };
}

/* ------------------------------------------------------------------ the list */

export type ShowTab = "all" | "noreply";

/** `?show=` as the page reads it: anything but "noreply" is the whole list. */
export function parseShow(raw: string | string[] | null | undefined): ShowTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "noreply" ? "noreply" : "all";
}

export type ListState = { show: ShowTab; q: string };

/** `?q=` as the page reads it: trimmed, and at most 80 characters. */
export function parseQuery(raw: string | string[] | null | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? "").trim().slice(0, 80);
}

const params = (s: ListState, extra: Record<string, string | null> = {}): string => {
  const p = new URLSearchParams();
  if (s.show !== "all") p.set("show", s.show);
  if (s.q) p.set("q", s.q);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
};

/** The list on its own, with the tab and the search kept. */
export const listHref = (s: ListState): string => `/app/messages${params(s)}`;

/** A conversation, with the list's tab and search kept and, optionally, the record beside it. */
export const threadHref = (id: string, s: ListState = { show: "all", q: "" }, record: string | null = null): string => `/app/messages/${id}${params(s, { record })}`;

export type ThreadItem = {
  id: string;
  name: string;
  /** "11:20", "Yesterday", "26 Sep 2026"; null when the conversation has no date at all. */
  when: string | null;
  /** The moment `when` is of, for its `<time>`: the times are UTC. */
  at: string | null;
  /** The newest message, "You: ..." when it is yours; null when it was not read, "No messages yet" when there are none. */
  line: string | null;
  /** "RFQ · Men's heavyweight French terry hoodies". */
  sub: string;
  /** The newest message is yours: the supplier has not answered it. */
  noReply: boolean;
  slug: string;
};

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** "RFQ · title" for a conversation about an RFQ, else its subject. */
export function threadSub(t: Pick<ThreadRow, "rfq_id" | "subject">): string {
  const subject = t.subject ? oneLine(t.subject) : "";
  if (t.rfq_id) return subject ? `RFQ · ${subject}` : "RFQ";
  return subject || "Conversation";
}

export function buildThreadItems(rows: readonly ThreadRow[], last: Readonly<Record<string, LastMessage | undefined>>, now: Date): ThreadItem[] {
  return rows.map((t) => {
    const m = last[t.id];
    const count = Number(t.message_count) || 0;
    const at = m?.created_at ?? t.last_message_at ?? t.created_at;
    return {
      id: t.id,
      name: t.supplier_name,
      when: listWhen(at, now),
      at: listWhen(at, now) ? at : null,
      line: m ? `${m.is_self ? "You: " : ""}${oneLine(m.body)}` : count === 0 ? "No messages yet" : null,
      sub: threadSub(t),
      noReply: m?.is_self === true,
      slug: t.supplier_slug,
    };
  });
}

/** The list after the tab and the search: a search matches the supplier's name or the RFQ's title. */
export function filterItems(items: readonly ThreadItem[], s: ListState): ThreadItem[] {
  const q = s.q.toLowerCase();
  return items.filter((i) => (s.show === "all" || i.noReply) && (!q || i.name.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)));
}

/** "3 conversations", for the list's caption and the tab. */
export const conversationsWords = (n: number) => `${formatCount(n)} ${n === 1 ? "conversation" : "conversations"}`;

/* ------------------------------------------------------- the RFQ over a thread */

export type RfqStrip = { cells: { label: string; value: string }[]; rfqId: string };

/** What this supplier has said about the RFQ in money: waiting, a price, accepted, or why not. */
export function quoteWords(rfq: Pick<RfqDoc, "status" | "quotes" | "quantity_unit">, supplierId: string): string {
  const mine = [...rfq.quotes.filter((q) => q.supplier_id === supplierId)].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const live = mine.find((q) => q.status === "accepted") ?? mine.find((q) => q.status === "submitted");
  if (live) return `${live.status === "accepted" ? "Accepted · " : ""}${priceWords(live.unit_price, live.currency, rfq.quantity_unit)}`;
  if (mine.length > 0) return mine[0]!.status === "rejected" ? "Quote not accepted" : "Quote withdrawn";
  return rfq.status === "open" ? "Waiting for quote" : "No quote";
}

/** The four facts over a conversation and the RFQ's id for "View RFQ"; null when the RFQ was not read. */
export function rfqStrip(rfq: RfqDoc | null, supplierId: string): RfqStrip | null {
  if (!rfq) return null;
  return {
    rfqId: rfq.id,
    cells: [
      { label: "RFQ sent", value: formatDay(rfq.created_at) ?? "Date not recorded" },
      { label: "Quantity", value: quantityWords(rfq.quantity, rfq.quantity_unit) },
      { label: "Ship by", value: rfq.ship_by ? (formatDay(rfq.ship_by) ?? "Not set") : "Not set" },
      { label: "Quote", value: quoteWords(rfq, supplierId) },
    ],
  };
}

/** The phone's line over the conversation: "RFQ sent 18 Jul 2026 · 10,000 pieces · waiting for quote". */
export function phoneStripLine(s: RfqStrip): string {
  const [sent, qty, , quote] = s.cells;
  return [`RFQ sent ${sent!.value}`, qty!.value, quote!.value.charAt(0).toLowerCase() + quote!.value.slice(1)].join(" · ");
}
