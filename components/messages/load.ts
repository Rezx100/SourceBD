// What the Messages pages read, so the list and the conversation agree on how a failed read is told
// apart from a conversation that is not yours and from an empty inbox. The same RPCs as before
// (`thread_list`, `thread_messages`, `rfq_get`); the newest message of each conversation is one
// `thread_messages` call with a limit of 1, because `thread_list` carries no text. No new RPC,
// policy or migration.

import type { RfqDoc } from "@/components/rfqs/doc";
import type { LastMessage, ThreadMessage, ThreadRow } from "./words";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

/** The conversations whose newest message is read for the list: the most recent ones. */
export const LAST_READ_CAP = 30;

async function soft<T>(run: () => PromiseLike<{ data: unknown; error: unknown }>, pick: (d: unknown) => T, fallback: T): Promise<T> {
  try {
    const r = await run();
    return r.error ? fallback : pick(r.data);
  } catch {
    return fallback;
  }
}

export type InboxData = {
  /** Null when `thread_list` failed: no count and no empty state may stand in for it. */
  rows: ThreadRow[] | null;
  /** The newest message of each conversation that could be read. */
  last: Record<string, LastMessage>;
  /**
   * Every conversation with messages has its newest one in `last`. Only then can "No reply yet"
   * be counted: a count over some of the conversations would be a claim about all of them.
   */
  lastComplete: boolean;
};

export function normaliseThread(r: Record<string, unknown>): ThreadRow {
  return { ...(r as unknown as ThreadRow), message_count: Number(r.message_count) || 0 };
}

export async function loadInbox(supabase: Client): Promise<InboxData> {
  const list = await supabase.rpc("thread_list");
  const rows = list.error || !Array.isArray(list.data) ? null : (list.data as Record<string, unknown>[]).map(normaliseThread);
  if (!rows) return { rows: null, last: {}, lastComplete: false };
  const withMessages = rows.filter((t) => t.message_count > 0);
  const reads = await Promise.all(
    withMessages.slice(0, LAST_READ_CAP).map(async (t) => {
      const m = await soft<ThreadMessage | null>(
        () => supabase.rpc("thread_messages", { p_thread_id: t.id, p_limit: 1 }),
        (d) => (Array.isArray(d) && d.length > 0 ? (d[d.length - 1] as ThreadMessage) : null),
        null,
      );
      return [t.id, m] as const;
    }),
  );
  const last: Record<string, LastMessage> = {};
  for (const [id, m] of reads) if (m && typeof m.body === "string") last[id] = { body: m.body, is_self: Boolean(m.is_self), created_at: m.created_at };
  return { rows, last, lastComplete: withMessages.every((t) => last[t.id] !== undefined) };
}

export type ThreadRead = { kind: "ok"; messages: ThreadMessage[] } | { kind: "denied" } | { kind: "error" };

/** The conversation's newest 50 messages. "Not a participant" is the one answer that means it is not this buyer's. */
export async function readMessages(supabase: Client, threadId: string): Promise<ThreadRead> {
  try {
    const res = await supabase.rpc("thread_messages", { p_thread_id: threadId, p_limit: 50 });
    if (res.error) return /not a participant/i.test(String(res.error.message ?? "")) ? { kind: "denied" } : { kind: "error" };
    return Array.isArray(res.data) ? { kind: "ok", messages: res.data as ThreadMessage[] } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/** The RFQ a conversation is about, for the strip over it; null when it cannot be read (the strip is then left out). */
export async function readRfq(supabase: Client, rfqId: string | null): Promise<RfqDoc | null> {
  if (!rfqId) return null;
  return soft<RfqDoc | null>(
    () => supabase.rpc("rfq_get", { p_id: rfqId }),
    (d) => (d && typeof d === "object" && !Array.isArray(d) && Array.isArray((d as RfqDoc).quotes) ? (d as RfqDoc) : null),
    null,
  );
}
