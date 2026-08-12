// /api/v1/admin/queue/decide — review-queue release.
// Approve/release executes the classified buyer-facing mutation.
// Specialized queues keep their own endpoints:
// - cert_doc_review: /api/v1/admin/certifications/decide
// - sanctions_hit: /api/v1/admin/sanctions/decide

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { queueDecideFromRequest } from "../../../../../../lib/admin/queue-decide-decision";
import { getServerRole } from "../../../../../../lib/auth";
import { createSupabaseServerClient } from "../../../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const role = await getServerRole();
  const response = await queueDecideFromRequest(req, role, async (args) => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_queue_decide", args);
    return { data, error };
  });

  if (response.status === 200) {
    revalidatePath("/admin");
    revalidatePath("/admin/queue");
    revalidatePath("/discover");
    revalidatePath("/app/discover");
  }
  return new NextResponse(response.body, {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}
