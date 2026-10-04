"use client";

// The conversation and its composer (B6a, Paper `10 · Messages · thread`, `11 · thread keyboard
// up`), live. Same transport as before:
//   * Realtime INSERT events on `public.messages` for this thread. Realtime applies RLS under the
//     caller's JWT, and its payload carries no text (`body_ciphertext` is not selectable), so an
//     event only triggers a refetch of the plaintext through `GET /api/v1/messages`.
//   * The composer posts `{ action: "send", thread_id, body }` to `/api/v1/messages`.
// The supplier is on the left in a white bubble with a line, you on the right in brand tint; the
// name and the (UTC) time under each bubble and one line per day. The data has no read state, so
// nothing says "Read". A reply that arrives is announced politely. The composer grows to six rows,
// sends on Ctrl or Command + Enter and shows its count only near the limit. Attachments are not
// built: no file is stored anywhere, so there is no paperclip.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bubble, DateLine } from "@/components/patterns";
import { Button } from "@/components/kit";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { MAX_BODY, arrivalText, bubbleMeta, counterText, dayGroups, type ThreadMessage } from "./words";

/** The conversation itself: one line per day, then each message under its author and time. */
export function MessageList({ messages, supplierName, today }: { messages: readonly ThreadMessage[]; supplierName?: string; today: string }) {
  if (messages.length === 0) {
    return <p className="m-0 py-6 text-center text-base text-ink-3">No messages yet. Send the first one below.</p>;
  }
  const now = new Date(today);
  return (
    <>
      {dayGroups(messages, now).map((g, i) => (
        <div key={`${g.day}-${i}`} className="flex flex-col gap-3">
          <DateLine>{g.day}</DateLine>
          {g.messages.map((m) => {
            const meta = bubbleMeta(m, supplierName);
            return (
              <Bubble
                key={m.id}
                from={m.is_self ? "you" : "them"}
                meta={
                  <time dateTime={m.created_at} title={`${meta.time} UTC`}>
                    <span className="max-sm:hidden">{meta.full}</span>
                    <span className="sm:hidden">{meta.time}</span>
                  </time>
                }
              >
                <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</span>
              </Bubble>
            );
          })}
        </div>
      ))}
    </>
  );
}

export function ThreadLive({
  threadId,
  initialMessages,
  supplierName,
  today,
  phoneLine,
  readFailed,
}: {
  threadId: string;
  initialMessages: ThreadMessage[];
  /** Who the other side is, for the author line, the placeholder and the arrival announcement. */
  supplierName?: string;
  /** The server's "now", so a day line says "Today" the same way on the server and in the browser. */
  today: string;
  /** The phone's line over the conversation ("RFQ sent 18 Jul 2026 · 10,000 pieces · waiting for quote"). */
  phoneLine?: string | null;
  /** The newest messages could not be read: the page says so instead of drawing an empty thread. */
  readFailed?: boolean;
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
      const res = await fetch(`/api/v1/messages?thread_id=${encodeURIComponent(threadId)}&limit=200`, { cache: "no-store" });
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
      // Network blip: Realtime will retry; nothing to surface.
    }
  }, [threadId, supplierName]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`messages:thread=${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, () => {
        void refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, refetch]);

  // The toast and the announcement clear themselves, so the next arrival is announced again
  // rather than matching the text already in the region.
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

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // The composer grows with its text to six rows (`max-h`), then scrolls; it shrinks back after a send.
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
          body: JSON.stringify({ action: "send", thread_id: threadId, body: trimmed }),
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
      <div className="min-h-0 flex-1 overflow-y-auto bg-subtle max-md:min-h-[240px] max-md:overflow-visible">
        <div className="flex min-h-full flex-col gap-3 p-5 max-md:justify-end max-md:p-4">
          {phoneLine ? <p className="text-center text-sm text-ink-3 sm:hidden">{phoneLine}</p> : null}
          {readFailed ? (
            <p role="alert" className="rounded-md border border-line bg-surface px-3 py-2 text-base text-ink-2">
              The latest messages could not be read just now. Nothing has been lost. Reload in a moment.
            </p>
          ) : null}
          {/* An unread conversation is not an empty one: "No messages yet" would be a claim about it. */}
          {readFailed && messages.length === 0 ? null : <MessageList messages={messages} supplierName={supplierName} today={today} />}
          <div ref={listEndRef} />
        </div>
      </div>
      {/* A reply that lands while the buyer is reading or typing is heard, not only seen. */}
      <p role="status" aria-live="polite" className="sr-only">
        {arrival}
      </p>

      <form onSubmit={onSend} className="sticky bottom-0 flex shrink-0 flex-col gap-1.5 border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:px-2 max-md:py-2">
        <label htmlFor={composerId} className="sr-only">
          Message
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={composerId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={supplierName ? `Write to ${supplierName}` : "Write a message"}
            rows={1}
            maxLength={MAX_BODY}
            disabled={sending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${composerId}-error` : undefined}
            className={cn(
              "max-h-[9.5rem] min-h-8 flex-1 resize-none overflow-y-auto rounded-sm border border-line-strong bg-surface px-2.5 py-1.5 text-base text-ink outline-none placeholder:text-ink-3 hover:border-ink-3 disabled:bg-sunken",
              "focus:border-brand focus:[box-shadow:inset_0_0_0_1px_theme(colors.brand)] aria-[invalid=true]:border-danger",
              "max-md:min-h-12 max-md:rounded-md max-md:px-3 max-md:text-md",
            )}
          />
          <Button type="submit" kind="primary" loading={sending} loadingLabel="Sending" disabled={draft.trim().length === 0 && !sending} className="max-md:h-12 max-md:rounded-md max-md:px-4 max-md:text-md max-md:font-semibold">
            Send
          </Button>
        </div>
        {/* A phone has no hint line: the count and the error stand alone under the field. */}
        <p className={cn("flex min-h-4 flex-wrap items-center gap-x-3 px-0.5 text-xs text-ink-3 tabular-nums max-md:text-sm", !error && !counter && !sent && "max-md:hidden")}>
          {counter ? <span>{counter}</span> : null}
          {error ? (
            <span id={`${composerId}-error`} role="alert" className="text-danger">
              {error}
            </span>
          ) : null}
          <span className="max-md:hidden">Ctrl or ⌘ + Enter to send</span>
          {sent ? <span role="status">Message sent</span> : null}
        </p>
      </form>
    </div>
  );
}
