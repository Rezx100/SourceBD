// What the Messages pages read, so the list and the conversation agree on how a failed read is told
// apart from a conversation that is not yours and from an empty inbox. The same RPCs as before
// (`thread_list`, `thread_messages`, `rfq_get`). Since migration 0112 `thread_list` carries the
// newest line, the unread count and whether the other side has written, so the list is one call and
// not one more per conversation.

import type { RfqDoc } from "@/components/rfqs/doc";
import type { ThreadMessage, ThreadRow } from "./words";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

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
};

export function normaliseThread(r: Record<string, unknown>): ThreadRow {
  return { ...(r as unknown as ThreadRow), message_count: Number(r.message_count) || 0 };
}

export async function loadInbox(supabase: Client): Promise<InboxData> {
  const list = await supabase.rpc("thread_list");
  return { rows: list.error || !Array.isArray(list.data) ? null : (list.data as Record<string, unknown>[]).map(normaliseThread) };
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
