// /api/v1/messages — buyer ↔ supplier messaging (Spec B6).
//
// Endpoints:
//   POST   /api/v1/messages
//     body { action: "open",  supplier_id, rfq_id?, subject? } → { thread_id }
//     body { action: "send",  thread_id, body }                 → { message_id }
//     body { action: "send",  thread_id, body?, paths: [...] }  → { message_id } (files, 0112)
//     body { action: "read",  thread_id }                       → { ok: true }    (0112)
//   GET    /api/v1/messages?thread_id=<uuid>&before=<iso>&limit=<int>
//                                                               → { messages: [...] }
//   GET    /api/v1/messages                                     → { threads:  [...] }
//
// `(app)/app/*` middleware does NOT cover `/api/*`; this handler enforces
// buyer/admin auth in-handler via `getServerRole()`. All DB calls go
// through user-scoped RPCs so RLS + participant gating are the source of
// truth — the route is a thin gate that validates inputs and forwards.

import { NextResponse } from "next/server";

import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_BODY = 8000;
const MAX_SUBJECT = 200;
const MAX_FILES = 10;
const MAX_PATH = 400;

/** The status a database error means: 0112's codes (28000 signed out, 42501 not yours, 22023 / P0002 a bad request) or the older wording. */
function statusOf(error: { message: string; code?: string }): number {
  if (error.code === "28000" || /not authenticated/i.test(error.message)) return 401;
  if (error.code === "42501" || /not a participant/i.test(error.message)) return 403;
  if (error.code === "22023" || error.code === "P0002") return 400;
  return 500;
}

async function requireAnyAuth() {
  const role = await getServerRole();
  if (role !== "buyer" && role !== "supplier" && role !== "admin") {
    return {
      role: null,
      error: NextResponse.json({ error: "unauthorised" }, { status: 401 }),
    } as const;
  }
  return { role, error: null } as const;
}

export async function GET(req: Request) {
  const gate = await requireAnyAuth();
  if (gate.error) return gate.error;

  const supabase = await createSupabaseServerClient();
  const url = new URL(req.url);
  const threadId = url.searchParams.get("thread_id");

  if (!threadId) {
    const { data, error } = await supabase.rpc("thread_list");
    if (error) {
      return NextResponse.json(
        { error: "thread_list failed", detail: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ threads: data ?? [] });
  }

  if (!UUID_RE.test(threadId)) {
    return NextResponse.json({ error: "invalid thread_id" }, { status: 400 });
  }
  const beforeRaw = url.searchParams.get("before");
  const limitRaw = url.searchParams.get("limit");
  let before: string | null = null;
  if (beforeRaw) {
    const d = new Date(beforeRaw);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "invalid before" }, { status: 400 });
    }
    before = d.toISOString();
  }
  let limit: number | null = null;
  if (limitRaw) {
    const n = Number(limitRaw);
    if (!Number.isFinite(n) || n < 1 || n > 200) {
      return NextResponse.json({ error: "invalid limit" }, { status: 400 });
    }
    limit = Math.floor(n);
  }
  const { data, error } = await supabase.rpc("thread_messages", {
    p_thread_id: threadId,
    p_limit: limit ?? 50,
    p_before: before,
  });
  if (error) {
    const code = /not a participant/i.test(error.message) ? 403 : 500;
    return NextResponse.json(
      { error: "thread_messages failed", detail: error.message },
      { status: code },
    );
  }
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAnyAuth();
  if (gate.error) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }
  const obj = body as Record<string, unknown>;
  const action = obj.action;
  const supabase = await createSupabaseServerClient();

  if (action === "open") {
    if (gate.role !== "buyer" && gate.role !== "admin") {
      return NextResponse.json({ error: "unauthorised" }, { status: 403 });
    }
    const supplierId = obj.supplier_id;
    if (typeof supplierId !== "string" || !UUID_RE.test(supplierId)) {
      return NextResponse.json({ error: "invalid supplier_id" }, { status: 400 });
    }
    let rfqId: string | null = null;
    if (obj.rfq_id != null) {
      if (typeof obj.rfq_id !== "string" || !UUID_RE.test(obj.rfq_id)) {
        return NextResponse.json({ error: "invalid rfq_id" }, { status: 400 });
      }
      rfqId = obj.rfq_id;
    }
    let subject: string | null = null;
    if (obj.subject != null) {
      if (typeof obj.subject !== "string") {
        return NextResponse.json({ error: "invalid subject" }, { status: 400 });
      }
      const trimmed = obj.subject.trim().slice(0, MAX_SUBJECT);
      subject = trimmed.length > 0 ? trimmed : null;
    }
    const { data, error } = await supabase.rpc("thread_open", {
      p_supplier_id: supplierId,
      p_rfq_id: rfqId,
      p_subject: subject,
    });
    if (error) {
      const code = /not authenticated/i.test(error.message)
        ? 401
        : /not a buyer/i.test(error.message)
          ? 403
          : 400;
      return NextResponse.json(
        { error: "thread_open failed", detail: error.message },
        { status: code },
      );
    }
    return NextResponse.json({ thread_id: data });
  }

  if (action === "read") {
    const threadId = obj.thread_id;
    if (typeof threadId !== "string" || !UUID_RE.test(threadId)) {
      return NextResponse.json({ error: "invalid thread_id" }, { status: 400 });
    }
    const { error } = await supabase.rpc("thread_mark_read", { p_thread_id: threadId });
    if (error) {
      return NextResponse.json(
        { error: "thread_mark_read failed", detail: error.message },
        { status: statusOf(error) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "send") {
    const threadId = obj.thread_id;
    if (typeof threadId !== "string" || !UUID_RE.test(threadId)) {
      return NextResponse.json({ error: "invalid thread_id" }, { status: 400 });
    }
    if (typeof obj.body !== "string" && !(obj.body == null && obj.paths != null)) {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    const trimmed = (obj.body ?? "").toString().trim();
    if (trimmed.length > MAX_BODY) {
      return NextResponse.json(
        { error: `body exceeds ${MAX_BODY} characters` },
        { status: 400 },
      );
    }

    // Files: each path is a file this person uploaded into this conversation. The database
    // checks that again against the bucket; refusing a stranger's path here keeps it out of the call.
    if (obj.paths != null) {
      const paths = obj.paths;
      if (
        !Array.isArray(paths) ||
        paths.length > MAX_FILES ||
        !paths.every((p) => typeof p === "string" && p.length <= MAX_PATH && p.startsWith(`${threadId}/`))
      ) {
        return NextResponse.json({ error: "invalid paths" }, { status: 400 });
      }
      if (trimmed.length === 0 && paths.length === 0) {
        return NextResponse.json({ error: "body is empty" }, { status: 400 });
      }
      const { data, error } = await supabase.rpc("thread_send_message_files", {
        p_thread_id: threadId,
        p_body: trimmed,
        p_paths: paths,
      });
      if (error) {
        return NextResponse.json(
          { error: "thread_send_message_files failed", detail: error.message },
          { status: statusOf(error) },
        );
      }
      return NextResponse.json({ message_id: data });
    }

    if (trimmed.length === 0) {
      return NextResponse.json({ error: "body is empty" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("thread_send_message", {
      p_thread_id: threadId,
      p_body: trimmed,
    });
    if (error) {
      return NextResponse.json(
        { error: "thread_send_message failed", detail: error.message },
        { status: statusOf(error) },
      );
    }
    return NextResponse.json({ message_id: data });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
