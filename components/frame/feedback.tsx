"use client";

// Send feedback: one text box, the page the buyer is on attached, Send. A dialog on a desktop, a bottom sheet on a
// phone (Send 48 tall). Opened from the account menu and the phone's account sheet, nowhere else: no floating
// button over the content. On success it says "Thanks, we read every one."; on failure the real words stay in the
// field's error line and the note stays in the box.

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button, Dialog, Field, Sheet } from "@/components/kit";
import { fieldBox, fieldEdge } from "@/components/kit/classes";
import { useIsPhone } from "@/components/kit/use-phone";
import { browserFetch } from "@/components/settings/transport";
import { cn } from "@/lib/utils";
import { FEEDBACK_MAX, FEEDBACK_THANKS, feedbackProblem, feedbackRefusal, sendFeedback } from "./feedback-model";

/** The dialog's body: the box and its words, or the thanks. Drawn on its own by the proof harness. */
export function FeedbackBody({ phone, path, message, onMessage, error, done }: { phone: boolean; path: string; message: string; onMessage: (v: string) => void; error: string | null; done: boolean }) {
  if (done)
    return (
      <p role="status" className={cn("text-ink", phone ? "text-md" : "text-base")}>
        {FEEDBACK_THANKS}
      </p>
    );
  return (
    <Field label="What happened, or what would help?" error={error} help={`We attach the page you are on (${path}). Up to ${FEEDBACK_MAX.toLocaleString("en-GB")} characters.`}>
      {(a) => (
        <textarea
          {...a}
          name="message"
          rows={5}
          maxLength={FEEDBACK_MAX}
          value={message}
          onChange={(e) => onMessage(e.target.value)}
          className={cn(fieldBox, fieldEdge, "block w-full px-2.5 py-1.5", phone ? "min-h-32 text-md" : "min-h-24 text-base")}
        />
      )}
    </Field>
  );
}

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const phone = useIsPhone();
  const path = usePathname() ?? "/app";
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (busy) return;
    const problem = feedbackProblem(message);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const r = await sendFeedback(path, message, { fetch: browserFetch });
    setBusy(false);
    if (!r.ok) return setError(feedbackRefusal(r));
    setDone(true);
  };

  const body = <FeedbackBody phone={phone} path={path} message={message} onMessage={setMessage} error={error} done={done} />;

  const open = (v: boolean) => !v && !busy && onClose();
  const size = phone ? "touch" : "md";
  const footer = done ? (
    <Button kind="primary" size={size} className={phone ? "flex-1" : undefined} onClick={onClose}>
      Close
    </Button>
  ) : (
    <>
      <Button kind="secondary" size={size} onClick={onClose}>
        Cancel
      </Button>
      <Button kind="primary" size={size} className={phone ? "flex-1" : undefined} loading={busy} loadingLabel="Sending" onClick={send}>
        Send
      </Button>
    </>
  );

  if (phone)
    return (
      <Sheet open onOpenChange={open} title="Send feedback" footer={footer}>
        {body}
      </Sheet>
    );
  return (
    <Dialog open onOpenChange={open} title="Send feedback" footer={footer}>
      {body}
    </Dialog>
  );
}
