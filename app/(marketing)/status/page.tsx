// Public status page (B9f restyle of Phase 7 P2): the `public_status()` read, drawn by `components/site/status.tsx`.

import type { Metadata } from "next";
import { StatusView, type StatusDoc } from "@/components/site/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const metadata: Metadata = {
  title: "Platform status — SourceBD",
  description: "Live freshness signals for the SourceBD verified supplier index: data refresh, compliance mirrors, and sanctions screening.",
  alternates: { canonical: `${SITE_URL}/status` },
};

export default async function StatusPage() {
  let doc: StatusDoc | null = null;
  let error: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error: rpcError } = await supabase.rpc("public_status");
    if (rpcError || !data) {
      error = rpcError?.message ?? "Status unavailable";
    } else {
      doc = data as StatusDoc;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Status unavailable";
  }

  return <StatusView doc={doc} error={error} />;
}
