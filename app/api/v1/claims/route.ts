// /api/v1/claims — Supplier claim flow (Spec S1).
//
// GET  /api/v1/claims?view=mine                 → claim_list_mine
// GET  /api/v1/claims?view=admin&status=…       → claim_admin_list (admin)
// GET  /api/v1/claims?view=search&q=…           → claim_search (supplier/admin)
// POST { action:'initiate', supplier_id, proof_email, note? }
// POST { action:'verify',   token }              (anon-callable; token is creds)
// POST { action:'cancel',   id }
// POST { action:'admin_decide', id, approve, note? }   (0129: any open stage; a reason to reject)
// POST { action:'admin_resend', id }                   (0129: a fresh link, emailed again)
//
// Middleware does NOT cover `/api/*` — auth is enforced in-handler via the
// Supabase user-scoped client. Writes go through SECURITY DEFINER RPCs in
// migrations 0032 and 0129 which re-check role + ownership at the database.
//
// The verification email goes through the journaled sender (lib/email/send.ts,
// template claim_verify, refId = the claim id), so the admin claim queue can
// show whether each claim's email went out and, if not, why.

import { NextResponse } from "next/server";

import { AppOriginError, getCanonicalAppOrigin } from "@/lib/app-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmailError, sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sb = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NOTE = 2000;
const MAX_DECISION_NOTE = 1000;

type ClaimLinkPayload = {
  claim_id: string;
  verification_token: string;
  method: "domain_email" | "manual_review";
  expires_at: string;
  proof_email: string;
  supplier: { id: string; company_name: string };
};

/** The verification link for a claim, or a 500 when the site's origin is not configured. */
function verifyLink(req: Request, token: string): string | NextResponse {
  try {
    return `${getCanonicalAppOrigin(req.headers)}/supplier/claim/verify?token=${encodeURIComponent(token)}`;
  } catch (err) {
    return NextResponse.json(
      {
        error: "app_origin_unavailable",
        detail: err instanceof AppOriginError ? err.message : "Unable to build claim verification link.",
      },
      { status: 500 },
    );
  }
}

/**
 * Email the link through the journaled sender. "sent" when Resend took it; "dev" when there is no
 * API key (the journal records a failed row saying so); "failed" when the send threw.
 */
async function emailClaimLink(payload: ClaimLinkPayload, link: string): Promise<"sent" | "dev" | "failed"> {
  try {
    const result = await sendEmail({
      to: payload.proof_email,
      template: "claim_verify",
      data: {
        link,
        companyName: payload.supplier.company_name,
        proofEmail: payload.proof_email,
        autoApprove: payload.method === "domain_email",
      },
      refId: payload.claim_id,
    });
    return result.dev ? "dev" : "sent";
  } catch (err) {
    console.warn(`[claims] verification email failed: ${err instanceof EmailError ? err.message : "unknown error"}`);
    return "failed";
  }
}

/** The answer after a link was (or was not) emailed. The token itself is never in it. */
function linkResponse(payload: ClaimLinkPayload, link: string, outcome: "sent" | "dev" | "failed", extra: Record<string, unknown>) {
  // In production, a failed email send is a hard error — never expose the
  // verification token via the API response, even as a fallback.
  if (process.env.NODE_ENV === "production" && outcome !== "sent") {
    return NextResponse.json(
      {
        error: "email_send_failed",
        detail: "Verification email could not be sent. Please try again later.",
      },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    claim_id: payload.claim_id,
    method: payload.method,
    expires_at: payload.expires_at,
    email_sent: outcome === "sent",
    ...extra,
    // dev_verification_url is only included outside production to aid
    // local/preview workflows. It is never returned in production.
    ...(process.env.NODE_ENV !== "production" ? { dev_verification_url: link } : {}),
  });
}

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
  if (d.includes("not open for a decision") || d.includes("not waiting for its email")) return 409;
  if (d.includes("reason is required")) return 422;
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
    const payload = (data ?? {}) as ClaimLinkPayload;
    const link = verifyLink(req, payload.verification_token);
    if (link instanceof NextResponse) return link;
    const outcome = await emailClaimLink(payload, link);
    return linkResponse(payload, link, outcome, {});
  }

  if (action === "admin_resend") {
    const id = body.id;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a UUID" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("claim_admin_resend", { p_claim_id: id });
    if (error) {
      return NextResponse.json(
        { error: "claim_admin_resend failed", detail: error.message },
        { status: rpcStatus(error.message) },
      );
    }
    const payload = (data ?? {}) as ClaimLinkPayload;
    const link = verifyLink(req, payload.verification_token);
    if (link instanceof NextResponse) return link;
    const outcome = await emailClaimLink(payload, link);
    return linkResponse(payload, link, outcome, { resent: true });
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
        "unknown action; expected one of initiate|verify|cancel|admin_decide|admin_resend",
    },
    { status: 400 },
  );
}
