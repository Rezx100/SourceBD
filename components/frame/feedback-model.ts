// "Send feedback" (the account menu's last item before Sign out), out of React so a test can run it with an
// injected `fetch` (the pattern of `components/team/transport.ts`). One note and the page it was written on go
// to `POST /api/v1/feedback`, which stores a row that `/admin/feedback` lists. A sentence the route wrote is
// shown as it is; a limit or a lapsed session gets its own words, never the route's key.

import { send, type Fetch, type Posted } from "@/components/settings/transport";

export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 4000;
export const FEEDBACK_THANKS = "Thanks, we read every one.";
const FAILED = "Could not send your feedback. Nothing was sent; try again in a moment.";

/** What is wrong with the note before it is sent, or null. */
export function feedbackProblem(message: string): string | null {
  const n = message.trim().length;
  if (n < FEEDBACK_MIN) return `Write at least ${FEEDBACK_MIN} characters so we can act on it.`;
  if (message.length > FEEDBACK_MAX) return "Keep it under 4,000 characters.";
  return null;
}

export const sendFeedback = (pagePath: string, message: string, deps: { fetch: Fetch }) =>
  send("/api/v1/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page_path: pagePath.slice(0, 500) || "/app", message: message.trim() }) }, FAILED, deps);

/** The words for a refused send. */
export function feedbackRefusal(r: Posted): string {
  if (r.status === 429) return "Too many requests in a minute. Wait a moment and send it again.";
  if (r.status === 401) return "Your session ended. Sign in again, then send your note.";
  return r.message ?? FAILED;
}

export type { Fetch };
