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
