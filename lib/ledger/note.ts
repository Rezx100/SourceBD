// A read written to the activity record (migration 0134): a search run, a record opened, an RFQ or order
// viewed, a file or an export downloaded. Writes come from database triggers; reads cannot, so the code
// that serves the data says so here, through `ledger_note`, which takes only these kinds and writes the
// entry as the signed-in caller. Fire and forget: a note never slows or fails the page or the route that
// makes it, and a database without 0134 yet simply refuses it.

export const NOTE_KINDS = [
  "search.run",
  "supplier.viewed",
  "supplier.line_viewed",
  "contact.revealed",
  "export.downloaded",
  "file.downloaded",
  "rfq.viewed",
  "order.viewed",
] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export type NoteClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase client's rpc answers a thenable builder; any fake answers whatever it likes.
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

export type Note = {
  targetTable?: string | null;
  targetId?: string | null;
  content?: Record<string, unknown>;
  supplierId?: string | null;
  threadId?: string | null;
  rfqId?: string | null;
  orderId?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidOrNull = (v: string | null | undefined): string | null => (typeof v === "string" && UUID_RE.test(v) ? v : null);

/** The arguments `ledger_note` is sent for a note: pure, so it is tested without a client. */
export function noteArgs(kind: NoteKind, note: Note = {}): Record<string, unknown> {
  return {
    p_kind: kind,
    p_target_table: note.targetTable ?? null,
    p_target_id: uuidOrNull(note.targetId),
    p_content: note.content ?? {},
    p_supplier: uuidOrNull(note.supplierId),
    p_thread: uuidOrNull(note.threadId),
    p_rfq: uuidOrNull(note.rfqId),
    p_order: uuidOrNull(note.orderId),
  };
}

/** Writes the note as the signed-in caller. Resolves whatever happens; never throws, never rejects. */
export async function noteActivity(client: NoteClient | null | undefined, kind: NoteKind, note: Note = {}): Promise<void> {
  if (!client) return;
  try {
    await Promise.resolve(client.rpc("ledger_note", noteArgs(kind, note)));
  } catch {
    // The page or route that made the note is not its purpose; the record is best effort here.
  }
}
