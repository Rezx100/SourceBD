"use client";

// Realtime client island for /app/messages/[thread] (Spec B6).
//
// Architecture:
//   * Subscribes to Postgres-Changes INSERT events on `public.messages`
//     filtered to this thread. Supabase Realtime applies RLS under the
//     caller's JWT, so the channel will only deliver events for threads
//     the user participates in (defence in depth on top of the explicit
//     filter).
//   * The Realtime payload contains only the column-grant-visible
//     columns (id, thread_id, sender_id, body_len, created_at). The
//     encrypted `body_ciphertext` is intentionally not selectable; we
//     ignore the payload body and refetch plaintext via
//     `GET /api/v1/messages?thread_id=...` so decryption stays
//     server-side under the security-definer RPC.
//   * Composer POSTs `{ action: "send", thread_id, body }` to
//     `/api/v1/messages`; the server route forwards to
//     `thread_send_message(...)` which encrypts before insert.
//
// The conversation reads like a conversation: a separator for each day, the
// sent time on each message (`formatTime`, UTC, so server and browser agree),
// and a polite announcement when the supplier's reply arrives. The composer
// grows with the message to six rows, sends on ⌘/Ctrl+Enter, and shows its
// character count only once a message nears the limit.

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button, Kbd } from "@/components/dashboard/controls";
import { TextArea } from "@/components/dashboard/fields";
import { Icon } from "@/components/dashboard/icons";
import { Toast } from "@/components/dashboard/toast";
import { Caption } from "@/components/dashboard/type";
import { formatCount, formatDay, formatTime } from "@/lib/dashboard/facts";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

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

/** Consecutive messages grouped by the day they were sent, for one separator per day. */
export function dayGroups(messages: readonly ThreadMessage[]): { day: string; messages: ThreadMessage[] }[] {
  const out: { day: string; messages: ThreadMessage[] }[] = [];
  for (const m of messages) {
    const day = formatDay(m.created_at) ?? "Date not recorded";
    const last = out[out.length - 1];
    if (last && last.day === day) last.messages.push(m);
    else out.push({ day, messages: [m] });
  }
  return out;
}

/** The announcement for messages that arrived from the other side, or null when none did. */
export function arrivalText(arrived: number, supplierName?: string): string | null {
  if (arrived <= 0) return null;
  const who = supplierName ?? "the supplier";
  return arrived === 1 ? `New message from ${who}` : `${formatCount(arrived)} new messages from ${who}`;
}

/** The conversation itself: a separator per day, then each message with its author and time. */
export function MessageList({ messages, supplierName }: { messages: readonly ThreadMessage[]; supplierName?: string }) {
  if (messages.length === 0) {
    return <p className="m-0 px-3 py-8 text-sm text-ink-muted">No messages yet. Send the first one below.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {dayGroups(messages).map((g, i) => (
        <div key={`${g.day}-${i}`} className="flex flex-col gap-1">
          <h3 className="m-0 flex items-center gap-3 px-3 py-1 text-xs font-medium text-ink-subtle before:h-px before:flex-1 before:bg-line-subtle after:h-px after:flex-1 after:bg-line-subtle">
            {g.day}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {g.messages.map((m) => (
              <li key={m.id} className={cn("flex flex-col gap-1 rounded-md px-3 py-2.5", m.is_self && "bg-surface-sunken")}>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-ink-strong [overflow-wrap:anywhere]">
                    {m.is_self ? "You" : supplierName ?? "Supplier"}
                  </span>
                  <Caption className="tabular-nums">
                    <time dateTime={m.created_at}>{formatTime(m.created_at) ?? ""}</time>
                  </Caption>
                </span>
                <p className="m-0 whitespace-pre-wrap text-base text-ink [overflow-wrap:anywhere]">{m.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ThreadRealtime({
  threadId,
  initialMessages,
  supplierName,
}: {
  threadId: string;
  initialMessages: ThreadMessage[];
  /** Who the other side is, for the author line and the arrival announcement. */
  supplierName?: string;
}) {
  const composerId = useId();
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [arrival, setArrival] = useState("");
  const seen = useRef(new Set(initialMessages.map((m) => m.id)));
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/messages?thread_id=${encodeURIComponent(threadId)}&limit=200`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as { messages?: ThreadMessage[] };
      if (Array.isArray(json.messages)) {
        const fresh = json.messages.filter((m) => !seen.current.has(m.id));
        for (const m of fresh) seen.current.add(m.id);
        const said = arrivalText(fresh.filter((m) => !m.is_self).length, supplierName);
        if (said) setArrival(said);
        setMessages(json.messages);
      }
    } catch {
      // Network blip — Realtime will retry; nothing to surface.
    }
  }, [threadId, supplierName]);

  // Realtime subscription
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`messages:thread=${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          void refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, refetch]);

  // The "Message sent" toast and the arrival announcement clear themselves,
  // so the next arrival is announced again rather than matching the text
  // already in the region.
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(false), 2500);
    return () => clearTimeout(t);
  }, [sent]);
  useEffect(() => {
    if (!arrival) return;
    const t = setTimeout(() => setArrival(""), 5000);
    return () => clearTimeout(t);
  }, [arrival]);

  // Auto-scroll on new messages
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // The composer grows with its text; `max-h` stops it at six rows, after
  // which it scrolls. Re-measured on every change, so it shrinks back after a
  // send clears it.
  useEffect(() => {
    const el = document.getElementById(composerId);
    if (!(el instanceof HTMLTextAreaElement)) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [draft, composerId]);

  const onSend = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = draft.trim();
      if (trimmed.length === 0 || sending) return;
      if (trimmed.length > MAX_BODY) {
        setError(`Message exceeds ${formatCount(MAX_BODY)} characters.`);
        return;
      }
      setSending(true);
      setError(null);
      try {
        const res = await fetch("/api/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "send",
            thread_id: threadId,
            body: trimmed,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? "Send failed.");
          return;
        }
        setDraft("");
        setSent(true);
        await refetch();
      } catch {
        setError("Network error.");
      } finally {
        setSending(false);
      }
    },
    [draft, sending, threadId, refetch],
  );

  const counter = counterText(draft.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[240px] flex-1 px-2 py-3 sm:px-3 lg:min-h-0 lg:overflow-y-auto">
        <MessageList messages={messages} supplierName={supplierName} />
        <div ref={listEndRef} />
      </div>
      {/* A reply that lands while the buyer is reading or typing is heard, not only seen. */}
      <p role="status" aria-live="polite" className="sr-only">
        {arrival}
      </p>

      <form
        onSubmit={onSend}
        className="sticky bottom-0 flex flex-col gap-2 border-t border-line-subtle bg-surface px-4 py-3 sm:px-5 lg:static"
      >
        <label htmlFor={composerId} className="sr-only">
          Message
        </label>
        <TextArea
          id={composerId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Write a message…"
          rows={2}
          maxLength={MAX_BODY}
          disabled={sending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${composerId}-error` : undefined}
          className="max-h-[9.5rem] resize-none overflow-y-auto"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Caption className="flex flex-wrap items-center gap-2 tabular-nums">
            {counter ? <span>{counter}</span> : null}
            {error ? (
              <span id={`${composerId}-error`} role="alert" className="text-danger-ink">
                {error}
              </span>
            ) : null}
          </Caption>
          <span className="flex items-center gap-3">
            <Caption className="hidden sm:inline">
              <Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> to send
            </Caption>
            <Button type="submit" variant="primary" disabled={sending || draft.trim().length === 0}>
              <Icon name="send" /> {sending ? "Sending…" : "Send"}
            </Button>
          </span>
        </div>
      </form>
      {sent ? <Toast text="Message sent" href={null} className="fixed z-toast" /> : null}
    </div>
  );
}
