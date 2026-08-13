/** HTTP allow-list for POST /api/v1/admin/queue/decide. Approve is not accepted. */

export const QUEUE_DECIDE_DECISIONS = ["release", "reject", "escalate"] as const;

export type QueueDecideDecision = (typeof QUEUE_DECIDE_DECISIONS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseQueueDecideDecision(
  raw: string,
): QueueDecideDecision | null {
  const d = raw.trim().toLowerCase();
  return (QUEUE_DECIDE_DECISIONS as readonly string[]).includes(d)
    ? (d as QueueDecideDecision)
    : null;
}

export function queueDecideRequestError(
  queueId: string,
  decision: string,
): { status: 400; error: string } | null {
  if (!UUID_RE.test(queueId)) {
    return { status: 400, error: "queue_id must be a UUID" };
  }
  if (parseQueueDecideDecision(decision) === null) {
    return { status: 400, error: "decision must be release|reject|escalate" };
  }
  return null;
}

export type QueueDecideRpc = (args: {
  p_queue_id: string;
  p_decision: string;
  p_note: string | null;
}) => Promise<{ data: unknown; error: { message: string } | null }>;

/** Observable POST /api/v1/admin/queue/decide contract (status + RPC). */
export async function executeQueueDecide(opts: {
  role: string | null;
  body: unknown;
  rpc: QueueDecideRpc;
}): Promise<{ status: number; json: unknown }> {
  if (opts.role !== "admin") {
    return { status: 403, json: { error: "admin only" } };
  }
  if (opts.body === null || typeof opts.body !== "object") {
    return { status: 400, json: { error: "invalid json" } };
  }
  const body = opts.body as {
    queue_id?: unknown;
    decision?: unknown;
    note?: unknown;
  };
  const queueId = typeof body.queue_id === "string" ? body.queue_id : "";
  const decision = typeof body.decision === "string" ? body.decision : "";
  const note = typeof body.note === "string" ? body.note : null;
  const bad = queueDecideRequestError(queueId, decision);
  if (bad) {
    return { status: bad.status, json: { error: bad.error } };
  }
  const { data, error } = await opts.rpc({
    p_queue_id: queueId,
    p_decision: decision,
    p_note: note,
  });
  if (error) {
    const m = error.message.toLowerCase();
    const code = m.includes("admin only")
      ? 403
      : m.includes("not found")
        ? 404
        : m.includes("already decided")
          ? 409
          : 400;
    return {
      status: code,
      json: { error: "admin_queue_decide failed", detail: error.message },
    };
  }
  return { status: 200, json: data };
}

/** HTTP Request → Response for POST /api/v1/admin/queue/decide. */
export async function queueDecideFromRequest(
  req: Request,
  role: string | null,
  rpc: QueueDecideRpc,
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const result = await executeQueueDecide({ role, body, rpc });
  return Response.json(result.json, { status: result.status });
}
