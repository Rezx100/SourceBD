// /app/messages — inbox list (Spec B6), FE-SITEWIDE Phase C3.
//
// Server component. Calls `public.thread_list()` under the caller's
// session and renders the thread inbox using `.proto-card` shell + the
// `.proto-nav-item`-style row pattern. Message bodies are NOT included
// in this surface — only metadata. Bodies live on `/app/messages/[thread]`.

import Link from "next/link";
import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";

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
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-tertiary">
            Buyer
          </p>
          <h1 className="font-display text-3xl font-light tracking-tight text-ink-primary">
            Messages
          </h1>
        </div>
        <Link href="/app/discover" className="btn-proto">
          Find a supplier
        </Link>
      </header>

      {error ? (
        <div className="proto-card text-sm text-sem-red">
          Could not load your inbox.
        </div>
      ) : threads.length === 0 ? (
        <div className="proto-card space-y-3 text-center">
          <ChatCircleText
            size={32}
            weight="duotone"
            className="mx-auto text-ink-tertiary"
            aria-hidden
          />
          <p className="affiliation-disclaimer">
            You haven&apos;t started any conversations yet.
          </p>
          <p className="affiliation-disclaimer">
            Open a supplier profile and send the first message — your threads
            will appear here.
          </p>
          <Link href="/app/discover" className="btn-proto primary inline-flex">
            Browse Discover
          </Link>
        </div>
      ) : (
        <nav aria-label="Threads" className="proto-card p-0">
          <ul className="m-0 flex list-none flex-col p-0">
            {threads.map((t) => (
              <li key={t.id} className="border-b border-hairline last:border-b-0">
                <Link
                  href={`/app/messages/${t.id}`}
                  className="proto-nav-item !rounded-none !px-5 !py-3"
                >
                  <ChatCircleText
                    size={18}
                    weight="duotone"
                    className="shrink-0 text-brand-forest"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-sm font-medium text-ink-primary">
                        {t.supplier_name}
                      </span>
                      <span className="chip">{entityLabel(t.supplier_entity_type)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-ink-tertiary">
                      {t.subject ?? "General inquiry"} ·{" "}
                      {t.message_count.toLocaleString()}{" "}
                      {t.message_count === 1 ? "message" : "messages"}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-tertiary">
                    {fmtRelative(t.last_message_at ?? t.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
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
