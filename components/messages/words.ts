// The words of Messages (B6a, Paper `10 · Messages`, `11 · Messages`): one row of the list, the
// line under a name, the times, the tabs, the search, and the strip of the RFQ above a
// conversation. Everything is worked out from what `thread_list`, `thread_messages` and `rfq_get`
// return, so nothing here can say more than they hold: a row is "unread" only when `thread_list`
// says so (`unread_count`, migration 0112) and a message is "Read" only when `thread_messages` says
// so; a database without 0112 returns neither, and then neither is said. Times are UTC, as they
// were, so the server and the browser agree. Pure.

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
  /**
   * Migration 0112's keys. Optional on purpose: a database that has not had 0112 applied returns
   * none of them, and then nothing here may say "unread", "no reply" or print a last line.
   */
  unread_count?: number;
  has_reply?: boolean;
  /** The newest message's first 140 characters; "" when it was only files. */
  last_body?: string | null;
  last_is_self?: boolean;
};

/** One file on a message, as `thread_messages` returns it. */
export type Attachment = { id: string; path: string; file_name: string; mime_type: string | null; size_bytes: number | null };

export type ThreadMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  created_at: string;
  body: string;
  is_self: boolean;
  /** Yours, and the other side has read up to it (0112). */
  read?: boolean;
  attachments?: Attachment[];
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

/** "PDF · 2.1 MB" under a file's name: the kind from its type, else from its extension; the size in 1,000s, as a file manager reads. */
export function fileDetail(a: Pick<Attachment, "file_name" | "mime_type" | "size_bytes">): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(a.file_name)?.[1]?.toUpperCase();
  const kinds: [RegExp, string][] = [
    [/pdf/, "PDF"],
    [/jpeg/, "JPG"],
    [/png/, "PNG"],
    [/webp/, "WebP"],
    [/spreadsheetml|ms-excel/, "Excel"],
    [/wordprocessingml|msword/, "Word"],
    [/csv/, "CSV"],
  ];
  const kind = kinds.find(([re]) => re.test(a.mime_type ?? ""))?.[1] ?? ext ?? "File";
  const n = a.size_bytes;
  if (typeof n !== "number" || !(n >= 0)) return kind;
  const size = n < 1000 ? `${n} B` : n < 1_000_000 ? `${Math.round(n / 1000)} KB` : `${(n / 1_000_000).toFixed(1)} MB`;
  return `${kind} · ${size}`;
}

/** Under a bubble: "Thermax Woven Dyeing Ltd. · 10:12" on a desktop, "You · 11:05"; a phone prints only the time. */
export function bubbleMeta(m: Pick<ThreadMessage, "is_self" | "created_at">, supplierName: string | undefined): { full: string; time: string } {
  const time = clock(m.created_at) ?? "";
  return { full: [m.is_self ? "You" : (supplierName ?? "Supplier"), time].filter(Boolean).join(" · "), time };
}

/* ------------------------------------------------------------------ the list */

export type ShowTab = "all" | "unread" | "noreply";

/** `?show=` as the page reads it: anything but "unread" or "noreply" is the whole list. */
export function parseShow(raw: string | string[] | null | undefined): ShowTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "noreply" || v === "unread" ? v : "all";
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
  /** The newest message, "You: ..." when it is yours, "Sent a file" for files alone; null when the data has no line, "No messages yet" when there are none. */
  line: string | null;
  /** "RFQ · Men's heavyweight French terry hoodies". */
  sub: string;
  /** The supplier has never written: nothing of theirs to answer, and no reply to yours. */
  noReply: boolean;
  /** The other side wrote something this person has not read, and this is not the conversation that is open. */
  unread: boolean;
  slug: string;
};

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** "RFQ · title" for a conversation about an RFQ, else its subject. */
export function threadSub(t: Pick<ThreadRow, "rfq_id" | "subject">): string {
  const subject = t.subject ? oneLine(t.subject) : "";
  if (t.rfq_id) return subject ? `RFQ · ${subject}` : "RFQ";
  return subject || "Conversation";
}

/** The line under a name, from `thread_list`'s own `last_body`: no read per conversation. */
function lastLine(t: ThreadRow, count: number): string | null {
  if (count === 0) return "No messages yet";
  if (typeof t.last_body !== "string") return null;
  return `${t.last_is_self ? "You: " : ""}${oneLine(t.last_body) || "Sent a file"}`;
}

/** `currentId` is the conversation that is open: it is being read, so it is not drawn unread. */
export function buildThreadItems(rows: readonly ThreadRow[], now: Date, currentId: string | null = null): ThreadItem[] {
  return rows.map((t) => {
    const count = Number(t.message_count) || 0;
    const at = t.last_message_at ?? t.created_at;
    return {
      id: t.id,
      name: t.supplier_name,
      when: listWhen(at, now),
      at: listWhen(at, now) ? at : null,
      line: lastLine(t, count),
      sub: threadSub(t),
      noReply: count > 0 && t.has_reply === false,
      unread: t.id !== currentId && (Number(t.unread_count) || 0) > 0,
      slug: t.supplier_slug,
    };
  });
}

/** Both tabs need 0112's keys on every row; a tab over rows that lack them would be a claim about data not read. */
export function tabsKnown(rows: readonly ThreadRow[]): boolean {
  return rows.every((t) => typeof t.unread_count === "number" && typeof t.has_reply === "boolean");
}

/** The list after the tab and the search: a search matches the supplier's name or the RFQ's title. */
export function filterItems(items: readonly ThreadItem[], s: ListState): ThreadItem[] {
  const q = s.q.toLowerCase();
  const onTab = (i: ThreadItem) => (s.show === "unread" ? i.unread : s.show === "noreply" ? i.noReply : true);
  return items.filter((i) => onTab(i) && (!q || i.name.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)));
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

/* ------------------------------------------------------------------- files */

/** What the `message-files` bucket takes (0112): 25 MB a file, these types, ten to a message. */
export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/csv",
];

/** Why a file cannot be attached, in words for the composer; null when it can. The bucket checks again. */
export function fileProblem(f: { name: string; type: string; size: number }): string | null {
  if (!FILE_TYPES.includes(f.type)) return `${f.name} is not a PDF, picture, Excel, Word or CSV file.`;
  if (f.size > MAX_FILE_BYTES) return `${f.name} is over 25 MB.`;
  if (f.size === 0) return `${f.name} is empty.`;
  return null;
}

/** `<thread>/<you>/<random>/<file name>`, the only shape the bucket's policy and `thread_send_message_files` accept. */
export function uploadPath(threadId: string, userId: string, random: string, fileName: string): string {
  const name = fileName.replace(/[^A-Za-z0-9._ ()-]+/g, "_").replace(/^\.+/, "").slice(-120) || "file";
  return `${threadId}/${userId}/${random}/${name}`;
}
