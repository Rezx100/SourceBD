"use client";

// Realtime client island for /supplier/messages/[thread] (Spec S3).
//
// Identical realtime/composer plumbing as the buyer-side island — the
// thread_send_message RPC is participant-symmetric (B6) and the
// /api/v1/messages route accepts supplier callers for action:send
// (loosened in S3); only `is_self` (set by the RPC against auth.uid())
// distinguishes outgoing from incoming.

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

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
}: {
  threadId: string;
  initialMessages: ThreadMessage[];
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Card className="flex min-h-[320px] flex-1 flex-col">
        <CardContent className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-ink-tertiary">
              No messages yet. Send the first one below.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.is_self
                      ? "flex flex-col items-end"
                      : "flex flex-col items-start"
                  }
                >
                  <div
                    className={
                      m.is_self
                        ? "max-w-[80%] rounded-card border border-accent-indigo bg-accent-indigo px-3 py-2 text-[13px] text-ink-on-accent"
                        : "max-w-[80%] rounded-card border border-hairline bg-surface-l1 px-3 py-2 text-[13px] text-ink-primary"
                    }
                  >
                    <p className="m-0 whitespace-pre-wrap break-words">
                      {m.body}
                    </p>
                  </div>
                  <span className="mt-1 font-mono text-[10px] text-ink-tertiary">
                    {fmtTime(m.created_at)}
                  </span>
                </li>
              ))}
              <div ref={listEndRef} />
            </ul>
          )}
        </CardContent>
      </Card>

      <form
        onSubmit={onSend}
        className="rounded-card border border-hairline bg-surface-l1 p-3 shadow-l1"
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
          className="block w-full resize-y rounded-md border border-hairline bg-white px-3 py-2 font-sans text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:border-accent-indigo focus:outline-none focus:ring-1 focus:ring-accent-indigo disabled:opacity-50"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-ink-tertiary">
            {draft.trim().length}/{MAX_BODY}
            {error ? (
              <span className="ml-2 text-sem-red">· {error}</span>
            ) : null}
          </span>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={sending || draft.trim().length === 0}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
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
