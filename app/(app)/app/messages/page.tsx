// /app/messages — inbox list (Spec B6), FE-SITEWIDE Phase C3.
//
// Server component. Calls `public.thread_list()` under the caller's
// session and renders the thread inbox using `.proto-card` shell + the
// `.proto-nav-item`-style row pattern. Message bodies are NOT included
// in this surface — only metadata. Bodies live on `/app/messages/[thread]`.

import Link from "next/link";
import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";

import { DataList, EmptyState, PageHeader, Pill } from "@/components/ui/page-kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Thread = {
  id: string;
  buyer_id: string;
  supplier_id: string;
  supplier_slug: string;
  supplier_name: string;
  supplier_entity_type: string;
  rfq_id: string | null;
  subject: string | null;
  last_message_at: string | null;
  updated_at: string;
  created_at: string;
  message_count: number;
};

export default async function MessagesPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("thread_list");
  const threads: Thread[] = error || data == null ? [] : (data as Thread[]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        kicker="Buyer"
        title="Messages"
        description="Your conversations with verified suppliers."
        actions={
          <Link
            href="/app/discover"
            className="inline-flex items-center rounded-pill border border-hairline-strong bg-surface-l1 px-4 py-2 text-sm font-semibold text-ink-primary transition-colors hover:bg-brand-forest-tint"
          >
            Find a supplier
          </Link>
        }
      />

      {error ? (
        <div className="rounded-card border border-sem-red/30 bg-sem-red-soft p-4 text-sm text-sem-red">
          Could not load your inbox.
        </div>
      ) : threads.length === 0 ? (
        <EmptyState
          icon={<ChatCircleText size={26} weight="duotone" aria-hidden />}
          title="No conversations yet"
          description="Open a supplier profile and send the first message — your threads will appear here."
          action={
            <Link
              href="/app/discover"
              className="inline-flex items-center rounded-pill bg-brand-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-mid"
            >
              Browse Discover
            </Link>
          }
        />
      ) : (
        <DataList>
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                href={`/app/messages/${t.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-hover ease-smooth hover:bg-brand-forest-tint"
              >
                <ChatCircleText
                  size={18}
                  weight="duotone"
                  className="shrink-0 text-brand-forest"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-sm font-semibold text-ink-primary">
                      {t.supplier_name}
                    </span>
                    <Pill tone="neutral">{entityLabel(t.supplier_entity_type)}</Pill>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-ink-tertiary">
                    {t.subject ?? "General inquiry"} ·{" "}
                    {t.message_count.toLocaleString()}{" "}
                    {t.message_count === 1 ? "message" : "messages"}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-tertiary">
                  {fmtRelative(t.last_message_at ?? t.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </DataList>
      )}
    </div>
  );
}

function entityLabel(et: string) {
  if (et === "factory") return "Factory";
  if (et === "buying_house") return "Buying house";
  return "Supplier";
}

function fmtRelative(iso: string) {
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
