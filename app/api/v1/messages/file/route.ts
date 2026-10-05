// GET /api/v1/messages/file?thread_id=<uuid>&path=<object path> (gap row 9, migration 0112)
//
// A file on a message opens through here: the route signs a one-minute link for it under the
// caller's own session and redirects to it. The bucket's policy lets a participant read every file
// of their conversations and nobody else, so a path that is not theirs signs nothing and answers
// 404. The path must also sit in the conversation named in the address, so a link cannot be used
// to reach another conversation's folder by changing one half of it.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const role = await getServerRole();
  if (role !== "buyer" && role !== "supplier" && role !== "admin") {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const url = new URL(req.url);
  const threadId = url.searchParams.get("thread_id");
  const path = url.searchParams.get("path");
  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json({ error: "invalid thread_id" }, { status: 400 });
  }
  if (!path || path.length > 400 || !path.startsWith(`${threadId}/`) || path.split("/").some((s) => s === "" || s === "..")) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from("message-files").createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
