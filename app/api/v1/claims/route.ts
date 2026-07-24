// /api/v1/claims — Supplier claim flow (Spec S1).
//
// GET  /api/v1/claims?view=mine                 → claim_list_mine
// GET  /api/v1/claims?view=admin&status=…       → claim_admin_list (admin)
// GET  /api/v1/claims?view=search&q=…           → claim_search (supplier/admin)
// POST { action:'initiate', supplier_id, proof_email, note? }
// POST { action:'verify',   token }              (anon-callable; token is creds)
// POST { action:'cancel',   id }
// POST { action:'admin_decide', id, approve, note? }
//
// Middleware does NOT cover `/api/*` — auth is enforced in-handler via the
// Supabase user-scoped client. Writes go through SECURITY DEFINER RPCs in
// migration 0032 which re-check role + ownership at the database.

import { NextResponse } from "next/server";

import { AppOriginError, getCanonicalAppOrigin } from "@/lib/app-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sb = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NOTE = 2000;
const MAX_DECISION_NOTE = 1000;

async function requireAuth(): Promise<
  { supabase: Sb; userId: string } | NextResponse
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return { supabase, userId: user.id };
}

function rpcStatus(detail: string): number {
  const d = detail.toLowerCase();
  if (d.includes("not authenticated")) return 401;
  if (d.includes("not an admin") || d.includes("not a supplier")) return 403;
  if (d.includes("not found")) return 404;
  if (d.includes("already claimed")) return 409;
  if (d.includes("within the last hour")) return 429;
  return 400;
}

// ---------- GET --------------------------------------------------------------

export async function GET(req: Request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const { supabase } = gate;

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "mine";

  if (view === "mine") {
    const { data, error } = await supabase.rpc("claim_list_mine");
    if (error) {
      return NextResponse.json(
        { error: "claim_list_mine failed", detail: error.message },
        { status: rpcStatus(error.message) },
      );
    }
    return NextResponse.json({ claims: data });
  }

  if (view === "admin") {
    const status = url.searchParams.get("status") ?? "email_verified";
    const { data, error } = await supabase.rpc("claim_admin_list", {
      p_status: status,
    });
    if (error) {
      return NextResponse.json(
        { error: "claim_admin_list failed", detail: error.message },
        { status: rpcStatus(error.message) },
      );
    }
    return NextResponse.json({ claims: data });
  }

  if (view === "search") {
    const q = url.searchParams.get("q") ?? "";
    const { data, error } = await supabase.rpc("claim_search", { p_q: q });
    if (error) {
      return NextResponse.json(
        { error: "claim_search failed", detail: error.message },
        { status: rpcStatus(error.message) },
      );
    }
    return NextResponse.json({ search: data });
  }

  return NextResponse.json(
    { error: "unknown view; expected mine|admin|search" },
    { status: 400 },
  );
}

// ---------- POST -------------------------------------------------------------

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  // `verify` is callable without an authenticated session — the token is
  // the credential. All other actions require auth.
  if (action !== "verify") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    }
  }

  if (action === "initiate") {
    const supplierId = body.supplier_id;
    const proofEmail = body.proof_email;
    const note = body.note;
    if (typeof supplierId !== "string" || !UUID_RE.test(supplierId)) {
      return NextResponse.json(
        { error: "supplier_id must be a UUID" },
        { status: 400 },
      );
    }
    if (typeof proofEmail !== "string" || !EMAIL_RE.test(proofEmail.trim())) {
      return NextResponse.json(
        { error: "proof_email must be a valid email" },
        { status: 400 },
      );
    }
    if (note !== undefined && note !== null) {
      if (typeof note !== "string") {
        return NextResponse.json(
          { error: "note must be a string" },
          { status: 400 },
        );
      }
      if (note.length > MAX_NOTE) {
        return NextResponse.json(
          { error: `note must be ${MAX_NOTE} chars or fewer` },
          { status: 400 },
        );
      }
    }
    const { data, error } = await supabase.rpc("claim_initiate", {
      p_supplier_id: supplierId,
      p_proof_email: proofEmail.trim().toLowerCase(),
      p_note: typeof note === "string" ? note : null,
    });
    if (error) {
      return NextResponse.json(
        { error: "claim_initiate failed", detail: error.message },
        { status: rpcStatus(error.message) },
      );
    }
    const payload = (data ?? {}) as {
      claim_id: string;
      verification_token: string;
      method: "domain_email" | "manual_review";
      expires_at: string;
      proof_email: string;
      supplier: { id: string; company_name: string };
    };
    let verifyUrl: string;
    try {
      verifyUrl = `${getCanonicalAppOrigin(req.headers)}/supplier/claim/verify?token=${encodeURIComponent(
        payload.verification_token,
      )}`;
    } catch (err) {
      return NextResponse.json(
        {
          error: "app_origin_unavailable",
          detail:
            err instanceof AppOriginError
              ? err.message
              : "Unable to build claim verification link.",
        },
        { status: 500 },
      );
    }

    const subject = `Confirm ownership of ${payload.supplier.company_name} on SourceBD`;
    const text = [
      `Hi,`,
      ``,
      `You requested to claim "${payload.supplier.company_name}" on SourceBD.`,
      `To finish, confirm you control ${payload.proof_email} by clicking the link below.`,
      `The link expires in 24 hours.`,
      ``,
      verifyUrl,
      ``,
      payload.method === "domain_email"
        ? `Because your email matches the supplier's published domain, the claim will be activated automatically after you click.`
        : `After verification, an admin will review your claim and notify you of the decision.`,
      ``,
      `If you did not request this, ignore this email.`,
      ``,
      `— SourceBD`,
    ].join("\n");

    const sendResult = await sendTransactionalEmail({
      to: payload.proof_email,
      subject,
      text,
    });

    // In production, a failed email send is a hard error — never expose the
    // verification token via the API response, even as a fallback.
    if (process.env.NODE_ENV === "production" && !sendResult.sent) {
      return NextResponse.json(
        {
          error: "email_send_failed",
          detail:
            "Verification email could not be sent. Please try again later.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      claim_id: payload.claim_id,
      method: payload.method,
      expires_at: payload.expires_at,
      email_sent: sendResult.sent,
      // dev_verification_url is only included outside production to aid
      // local/preview workflows. It is never returned in production.
      ...(process.env.NODE_ENV !== "production"
        ? { dev_verification_url: verifyUrl }
        : {}),
    });
  }

  if (action === "verify") {
    const token = body.token;
    if (typeof token !== "string" || token.length < 8) {
      return NextResponse.json(
        { error: "token is required" },
        { status: 400 },
      );
    }
    const { data, error } = await supabase.rpc("claim_verify_email", {
      p_token: token,
    });
    if (error) {
      return NextResponse.json(
        { error: "claim_verify_email failed", detail: error.message },
        { status: rpcStatus(error.message) },
      );
    }
    const result = (data ?? {}) as {
      ok?: boolean;
      outcome?: string;
      claim_id?: string;
      method?: string;
      status?: string;
    };
    if (!result.ok) {
      const code =
        result.outcome === "supplier_taken"
          ? 409
          : result.outcome === "expired" || result.outcome === "invalid"
          ? 400
          : 400;
      return NextResponse.json(
        { ok: false, ...result, error: result.outcome ?? "verification_failed" },
        { status: code },
      );
    }
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "cancel") {
    const id = body.id;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "id must be a UUID" },
        { status: 400 },
      );
    }
    const { error } = await supabase.rpc("claim_cancel", { p_id: id });
    if (error) {
      return NextResponse.json(
        { error: "claim_cancel failed", detail: error.message },
        { status: rpcStatus(error.message) },
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "admin_decide") {
    const id = body.id;
    const approve = body.approve;
    const note = body.note;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "id must be a UUID" },
        { status: 400 },
      );
    }
    if (typeof approve !== "boolean") {
      return NextResponse.json(
        { error: "approve must be boolean" },
        { status: 400 },
      );
    }
    if (note !== undefined && note !== null) {
      if (typeof note !== "string") {
        return NextResponse.json(
          { error: "note must be a string" },
          { status: 400 },
        );
      }
      if (note.length > MAX_DECISION_NOTE) {
        return NextResponse.json(
          { error: `note must be ${MAX_DECISION_NOTE} chars or fewer` },
          { status: 400 },
        );
      }
    }
    const { data, error } = await supabase.rpc("claim_admin_decide", {
      p_claim_id: id,
      p_approve: approve,
      p_note: typeof note === "string" ? note : null,
    });
    if (error) {
      return NextResponse.json(
        { error: "claim_admin_decide failed", detail: error.message },
        { status: rpcStatus(error.message) },
      );
    }
    return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
  }

  return NextResponse.json(
    {
      error:
        "unknown action; expected one of initiate|verify|cancel|admin_decide",
    },
    { status: 400 },
  );
}
