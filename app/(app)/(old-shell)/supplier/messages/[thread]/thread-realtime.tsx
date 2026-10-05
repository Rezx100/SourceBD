"use client";

// Realtime client island for /supplier/messages/[thread] (Spec S3).
//
// Identical realtime/composer plumbing as the buyer-side island — the
// thread_send_message RPC is participant-symmetric (B6) and the
// /api/v1/messages route accepts supplier callers for action:send
// (loosened in S3); only `is_self` (set by the RPC against auth.uid())
// distinguishes outgoing from incoming.

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/kit";
import { Bubble, DateLine } from "@/components/patterns";
import { bubbleMeta, dayGroups } from "@/components/messages/words";
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
  today,
}: {
  threadId: string;
  initialMessages: ThreadMessage[];
  /** The server's "now", so a day line says "Today" the same way on the server and in the browser. */
  today: string;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        await refetch();
      } catch {
        setError("Network error.");
      } finally {
        setSending(false);
      }
    },
    [draft, sending, threadId, refetch],
  );


  const now = new Date(today);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[322px] flex-1 overflow-y-auto bg-subtle">
        <div className="flex min-h-full flex-col gap-3 p-5 max-md:p-4">
          {messages.length === 0 ? (
            <p className="m-0 py-6 text-center text-base text-ink-3">
              No messages yet. Send the first one below.
            </p>
          ) : (
            dayGroups(messages, now).map((g, i) => (
              <div key={`${g.day}-${i}`} className="flex flex-col gap-3">
                <DateLine>{g.day}</DateLine>
                {g.messages.map((m) => {
                  const meta = bubbleMeta(m, "Buyer");
                  return (
                    <Bubble
                      key={m.id}
                      from={m.is_self ? "you" : "them"}
                      meta={
                        <time dateTime={m.created_at} title={`${meta.time} UTC`}>
                          {meta.full}
                        </time>
                      }
                    >
                      <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {m.body}
                      </span>
                    </Bubble>
                  );
                })}
              </div>
            ))
          )}
          <div ref={listEndRef} />
        </div>
      </div>

      <form
        onSubmit={onSend}
        className="flex shrink-0 flex-col gap-1.5 border-t border-line bg-surface px-5 py-3 max-md:px-3"
      >
        <label htmlFor="thread-composer" className="sr-only">
          Message
        </label>
        <textarea
          id="thread-composer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          rows={3}
          maxLength={MAX_BODY}
          disabled={sending}
          aria-invalid={error ? true : undefined}
          className={cn(
            "block max-h-[9.5rem] min-h-8 w-full resize-y rounded-sm border border-line-strong bg-surface px-2.5 py-1.5 text-base text-ink outline-none placeholder:text-ink-3 hover:border-ink-3 disabled:bg-sunken",
            "focus:border-brand focus:[box-shadow:inset_0_0_0_1px_theme(colors.brand)] aria-[invalid=true]:border-danger",
          )}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 flex flex-wrap items-center gap-x-3 text-xs text-ink-3 tabular-nums">
            <span>
              {draft.trim().length}/{MAX_BODY}
            </span>
            {error ? (
              <span role="alert" className="text-danger">
                {error}
              </span>
            ) : null}
          </p>
          <Button
            type="submit"
            kind="primary"
            loading={sending}
            loadingLabel="Sending…"
            disabled={draft.trim().length === 0 && !sending}
          >
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}