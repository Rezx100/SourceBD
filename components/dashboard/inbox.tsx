// The buyer's inbox in the dashboard kit: the thread list beside the open
// conversation. Server components; the conversation body and composer are the
// thread page's client island (`thread-realtime.tsx`).
//
// `thread_list` carries metadata only — no message bodies, no read state — so
// a row shows the subject and the message count, never a preview or an unread
// dot it cannot back.

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./chips";
import { Button } from "./controls";
import { Icon } from "./icons";
import { EmptyState, ErrorNote } from "./page";
import { Caption } from "./type";

export type InboxThread = {
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

export const INBOX_EMPTY_TITLE = "No conversations yet";
/** Each RFQ opens one thread per supplier on it (`rfq_create`), so that is how the inbox fills. */
export const INBOX_EMPTY_COPY =
  "Every RFQ you send opens a conversation with each supplier on it. Their answers arrive here.";
export const INBOX_ERROR_COPY = "Your inbox could not be read just now. Nothing has been lost — try again in a moment.";

export function entityLabel(et: string): string {
  if (et === "factory") return "Factory";
  if (et === "buying_house") return "Buying house";
  return "Supplier";
}

export function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const delta = Date.now() - t;
  const day = 86_400_000;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < day) return `${Math.floor(delta / 3_600_000)}h ago`;
  if (delta < 30 * day) return `${Math.floor(delta / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * The two-pane inbox. With no `currentId` it is the list page: the right pane
 * says "Pick a conversation" on desktop and is absent on a phone. With one, the
 * list hides on a phone (the conversation carries a Back link) and `children`
 * is the conversation.
 */
export function Inbox({
  threads,
  error,
  currentId,
  children,
}: {
  threads: readonly InboxThread[];
  error: boolean;
  currentId?: string;
  children?: ReactNode;
}) {
  if (error && !currentId) return <ErrorNote>{INBOX_ERROR_COPY}</ErrorNote>;
  if (threads.length === 0 && !currentId) {
    return (
      <div className="rounded-md border border-line-subtle bg-surface">
        <EmptyState
          art="messages"
          title={INBOX_EMPTY_TITLE}
          action={
            <Button variant="primary" href="/app/rfqs/new" clientNav>
              <Icon name="plus" /> New RFQ
            </Button>
          }
        >
          {INBOX_EMPTY_COPY}
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="flex flex-col rounded-md border border-line-subtle bg-surface lg:grid lg:h-[calc(100dvh-11rem)] lg:min-h-[480px] lg:grid-cols-[300px_minmax(0,1fr)]">
      <nav
        aria-label="Conversations"
        className={cn("min-h-0 border-line-subtle lg:overflow-y-auto lg:border-r", currentId && "hidden lg:block")}
      >
        <ul className="m-0 list-none p-0">
          {threads.map((t) => (
            <ThreadRow key={t.id} thread={t} current={t.id === currentId} />
          ))}
        </ul>
      </nav>
      {currentId ? (
        <div className="flex min-h-0 min-w-0 flex-col">{children}</div>
      ) : (
        <div className="hidden min-h-0 flex-col items-center justify-center gap-2 px-6 text-center lg:flex">
          <span aria-hidden className="grid size-9 place-items-center rounded-md bg-surface-sunken text-ink-muted">
            <Icon name="chat" />
          </span>
          <p className="m-0 text-base font-semibold text-ink-strong">Pick a conversation</p>
          <p className="m-0 text-sm text-ink-muted">Choose a supplier on the left to read and reply.</p>
        </div>
      )}
    </div>
  );
}

function ThreadRow({ thread: t, current }: { thread: InboxThread; current: boolean }) {
  const count = Number(t.message_count) || 0;
  return (
    <li className="border-b border-line-subtle">
      <Link
        href={`/app/messages/${t.id}`}
        prefetch={false}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex flex-col gap-0.5 px-4 py-3 transition-colors duration-fast hover:bg-surface-sunken",
          current && "bg-surface-sunken",
        )}
      >
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 text-sm font-medium text-ink-strong [overflow-wrap:anywhere]">{t.supplier_name}</span>
          <Caption className="shrink-0 tabular-nums">{fmtRelative(t.last_message_at ?? t.created_at)}</Caption>
        </span>
        <span className="truncate text-sm text-ink-muted">
          {t.subject ?? "General inquiry"} · {count.toLocaleString()} {count === 1 ? "message" : "messages"}
        </span>
      </Link>
    </li>
  );
}

/** The open conversation's header: who, what about, and the way to the record and the RFQ. */
export function ConversationHeader({ thread }: { thread: InboxThread }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line-subtle px-4 py-3 sm:px-5">
      <Link
        href="/app/messages"
        prefetch={false}
        className="inline-flex items-center gap-1 self-start text-sm font-medium text-brand-ink lg:hidden"
      >
        <Icon name="chev-l" /> Back to messages
      </Link>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="m-0 text-title font-semibold text-ink-strong [overflow-wrap:anywhere]">{thread.supplier_name}</h2>
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="type">{entityLabel(thread.supplier_entity_type)}</Badge>
            <Caption className="text-sm text-ink-muted">{thread.subject ?? "General inquiry"}</Caption>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href={`/app/suppliers/${thread.supplier_slug}`} clientNav>
            Supplier record
          </Button>
          {thread.rfq_id ? (
            <Button href={`/app/rfqs/${thread.rfq_id}`} clientNav>
              View RFQ
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
