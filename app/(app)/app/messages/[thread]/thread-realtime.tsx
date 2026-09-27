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

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/dashboard/controls";
import { TextArea } from "@/components/dashboard/fields";
import { Icon } from "@/components/dashboard/icons";
import { Toast } from "@/components/dashboard/toast";
import { Caption } from "@/components/dashboard/type";
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

const MAX_BODY = 8000;

export function ThreadRealtime({
  threadId,
  initialMessages,
  supplierName,
}: {
  threadId: string;
  initialMessages: ThreadMessage[];
  /** Who the other side is, for the author line. */
  supplierName?: string;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
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
        setMessages(json.messages);
      }
    } catch {
      // Network blip — Realtime will retry; nothing to surface.
    }
  }, [threadId]);

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

  // The "Message sent" toast clears itself.
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(false), 2500);
    return () => clearTimeout(t);
  }, [sent]);

  // Auto-scroll on new messages
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const onSend = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = draft.trim();
      if (trimmed.length === 0 || sending) return;
      if (trimmed.length > MAX_BODY) {
        setError(`Message exceeds ${MAX_BODY} characters.`);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[240px] flex-1 px-2 py-3 sm:px-3 lg:min-h-0 lg:overflow-y-auto">
        {messages.length === 0 ? (
          <p className="m-0 px-3 py-8 text-sm text-ink-muted">
            No messages yet. Send the first one below.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn("flex flex-col gap-1 rounded-md px-3 py-2.5", m.is_self && "bg-surface-sunken")}
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-ink-strong [overflow-wrap:anywhere]">
                    {m.is_self ? "You" : supplierName ?? "Supplier"}
                  </span>
                  <Caption className="tabular-nums">
                    <time dateTime={m.created_at}>{fmtTime(m.created_at)}</time>
                  </Caption>
                </span>
                <p className="m-0 whitespace-pre-wrap text-base text-ink [overflow-wrap:anywhere]">
                  {m.body}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div ref={listEndRef} />
      </div>

      <form
        onSubmit={onSend}
        className="sticky bottom-0 flex flex-col gap-2 border-t border-line-subtle bg-surface px-4 py-3 sm:px-5 lg:static"
      >
        <label htmlFor="thread-composer" className="sr-only">
          Message
        </label>
        <TextArea
          id="thread-composer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          rows={3}
          maxLength={MAX_BODY}
          disabled={sending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "thread-composer-error" : undefined}
          className="resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <Caption className="tabular-nums">
            {draft.trim().length}/{MAX_BODY}
            {error ? (
              <span id="thread-composer-error" role="alert" className="ml-2 text-danger-ink">
                {error}
              </span>
            ) : null}
          </Caption>
          <Button
            type="submit"
            variant="primary"
            disabled={sending || draft.trim().length === 0}
          >
            <Icon name="send" /> {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
      {sent ? <Toast text="Message sent" href={null} className="fixed z-[60]" /> : null}
    </div>
  );
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
