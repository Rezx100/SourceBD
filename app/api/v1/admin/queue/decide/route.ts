// /api/v1/admin/queue/decide — review-queue release.
// Approve/release executes the classified buyer-facing mutation.
// Specialized queues keep their own endpoints:
// - cert_doc_review: /api/v1/admin/certifications/decide
// - sanctions_hit: /api/v1/admin/sanctions/decide

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { executeQueueDecide } from "@/lib/admin/queue-decide-decision";
import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const role = await getServerRole();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const result = await executeQueueDecide({
    role,
    body,
    rpc: async (args) => {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.rpc("admin_queue_decide", args);
      return { data, error };
    },
  });

  if (result.status === 200) {
    revalidatePath("/admin");
    revalidatePath("/admin/queue");
    revalidatePath("/discover");
    revalidatePath("/app/discover");
  }
  return NextResponse.json(result.json, { status: result.status });
}
