// /app/messages — inbox list (Spec B6).
//
// Server component. Calls `public.thread_list()` under the caller's
// session and renders the thread inbox. Message bodies are NOT included
// in this surface — only metadata (counterpart, last_message_at, subject,
// message_count). The body lives on `/app/messages/[thread]`.

import Link from "next/link";
import { ChatCircleText } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
            Buyer
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
            Messages
          </h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/discover">Find a supplier</Link>
        </Button>
      </header>

      {error ? (
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load your inbox.
          </CardContent>
        </Card>
      ) : threads.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <ChatCircleText
              size={32}
              weight="duotone"
              className="mx-auto text-ink-tertiary"
              aria-hidden
            />
            <p className="text-sm text-ink-secondary">
              You haven&apos;t started any conversations yet.
            </p>
            <p className="text-[12px] text-ink-tertiary">
              Open a supplier profile and send the first message — your threads
              will appear here.
            </p>
            <Button asChild variant="primary" size="sm">
              <Link href="/app/discover">Browse Discover</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <ul className="m-0 flex list-none flex-col p-0">
              {threads.map((t) => (
                <li
                  key={t.id}
                  className="border-b border-hairline last:border-b-0"
                >
                  <Link
                    href={`/app/messages/${t.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-forest-tint focus:outline-none focus-visible:bg-brand-forest-tint"
                  >
                    <ChatCircleText
                      size={20}
                      weight="duotone"
                      className="text-accent-indigo"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-sm font-semibold text-ink-primary">
                          {t.supplier_name}
                        </span>
                        <Badge
                          tone={
                            t.supplier_entity_type === "factory"
                              ? "active"
                              : "neutral"
                          }
                        >
                          {entityLabel(t.supplier_entity_type)}
                        </Badge>
                      </div>
                      <p className="truncate text-[12px] text-ink-tertiary">
                        {t.subject ?? "General inquiry"} ·{" "}
                        {t.message_count.toLocaleString()}{" "}
                        {t.message_count === 1 ? "message" : "messages"}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-ink-tertiary">
                      {fmtRelative(t.last_message_at ?? t.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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
