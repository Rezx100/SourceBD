"use client";

// Invite people (Paper `Invite people dialog`, `Invite sheet`): the addresses as chips in one field, the
// role as three cards, "They get an email with a link. It expires in 7 days." and Send N invites. A
// dialog on a desktop, a bottom sheet on a phone. An address the route could not invite (already on the
// team, asked a moment ago, yours, or an invite whose email failed) is named and stays in the field; the
// ones that went out are said once and leave it.

import { X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Dialog, Field, Radio, Sheet } from "@/components/kit";
import { fieldBox } from "@/components/kit/classes";
import { useIsPhone } from "@/components/kit/use-phone";
import { browserFetch } from "@/components/settings/transport";
import { cn } from "@/lib/utils";
import { INVITE_NOTE, MAX_INVITES, ROLES, addEmails, inviteSummary, resultsOf, sendLabel, type TeamRole } from "./model";
import { inviteEmails } from "./transport";

const CARDS = ROLES.filter((r) => r.key !== "owner");

export function InviteDialog({ onClose, onSent }: { onClose: () => void; onSent: (words: string | null) => void }) {
  const router = useRouter();
  const phone = useIsPhone();
  const input = useRef<HTMLInputElement>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<TeamRole>("editor");
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [sentWords, setSentWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // What a press of Send would invite: the chips and a valid address still being typed.
  const pending = addEmails(chips, draft);
  const count = pending.list.length;

  /** Move what is typed into chips. Until `final`, the last word may still be half typed and stays in the field. */
  const commit = (text: string, final: boolean) => {
    const ends = /[\s,;]$/.test(text);
    const words = text.split(/[\s,;]+/).filter(Boolean);
    const tail = final || ends ? "" : (words.pop() ?? "");
    const { list, bad } = addEmails(chips, words.join(" "));
    setChips(list);
    setDraft([...bad, tail].filter(Boolean).join(" "));
    setError(bad.length ? `${bad[0]} is not an email address.` : null);
  };

  const send = async () => {
    if (busy) return;
    if (pending.bad.length) return setError(`${pending.bad[0]} is not an email address.`);
    if (count === 0) return setError("Add at least one email address.");
    if (count > MAX_INVITES) return setError(`You can invite up to ${MAX_INVITES} people at a time.`);
    setBusy(true);
    setError(null);
    const r = await inviteEmails(pending.list, role, { fetch: browserFetch });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    const summary = inviteSummary(resultsOf(r.json));
    if (summary.problems.length === 0) return onSent(summary.sentWords);
    // Some went out, some did not: keep what did not, and say both.
    setChips(summary.problems.map((p) => p.email));
    setDraft("");
    setProblems(summary.problems.map((p) => p.words));
    setSentWords(summary.sentWords);
    if (summary.sent > 0) router.refresh();
  };

  const field = (
    <Field label="Emails" error={error} help={chips.length + (draft ? 1 : 0) > MAX_INVITES ? `Up to ${MAX_INVITES} at a time.` : undefined}>
      {(a) => (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the box only hands a click to the real input inside it.
        <div
          onClick={() => input.current?.focus()}
          className={cn(fieldBox, "flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1 focus-within:border-brand focus-within:[box-shadow:inset_0_0_0_1px_theme(colors.brand)]", phone && "min-h-12 rounded-md px-3", error && "border-danger")}
        >
          {chips.map((e) => (
            <span key={e} className="flex h-6 items-center gap-1 rounded-sm bg-sunken pl-2 pr-1 text-sm text-ink">
              <span className="[overflow-wrap:anywhere]">{e}</span>
              <button type="button" aria-label={`Remove ${e}`} onClick={() => setChips((c) => c.filter((x) => x !== e))} className="flex size-4 items-center justify-center rounded-sm text-ink-2 hover:text-ink">
                <X size={14} aria-hidden />
              </button>
            </span>
          ))}
          <input
            ref={input}
            {...a}
            type="text"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={draft}
            placeholder={chips.length ? "" : "e.g. name@company.com, one or more"}
            onChange={(e) => (/[\s,;]/.test(e.target.value) ? commit(e.target.value, false) : setDraft(e.target.value))}
            onBlur={() => draft.trim() && commit(draft, true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft.trim()) commit(draft, true);
              } else if (e.key === "Backspace" && !draft && chips.length) setChips((c) => c.slice(0, -1));
            }}
            className={cn("min-w-[8rem] flex-1 bg-transparent outline-none placeholder:text-ink-3", phone ? "text-md" : "text-base")}
          />
        </div>
      )}
    </Field>
  );

  const cards = (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={cn("pb-1.5 font-medium text-ink", phone ? "text-base" : "text-sm")}>Role</legend>
      <div className={cn("flex flex-col", phone ? "rounded-md border border-line" : "gap-1.5")}>
        {CARDS.map((c) => {
          const on = role === c.key;
          return (
            <Radio
              key={c.key}
              size={phone ? "touch" : "md"}
              name="invite-role"
              value={c.key}
              checked={on}
              onChange={() => setRole(c.key as TeamRole)}
              className={cn(
                "items-start [&>input]:mt-[3px]",
                phone ? "min-h-14 px-3 py-2.5 last:border-b-0" : "w-full rounded-md border px-3 py-2.5",
                on ? "bg-brand-wash" : "",
                !phone && (on ? "border-brand" : "border-line"),
              )}
            >
              <span className="flex flex-col">
                <span className={cn("font-medium text-ink", phone ? "text-md leading-[22px]" : "text-base")}>{c.label}</span>
                <span className={cn("text-ink-3", phone ? "text-sm" : "text-xs")}>{c.line}</span>
              </span>
            </Radio>
          );
        })}
      </div>
    </fieldset>
  );

  const body = (
    <div className="flex flex-col gap-4">
      {field}
      {cards}
      <p className={cn("text-ink-2", phone ? "text-base" : "text-sm")}>{INVITE_NOTE}</p>
      {sentWords || problems.length ? (
        <div role="status" className="flex flex-col gap-1 text-sm text-ink-2">
          {sentWords ? <p>{sentWords}</p> : null}
          {problems.map((p) => (
            <p key={p} className="text-danger">
              {p}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );

  const open = (v: boolean) => !v && !busy && onClose();
  if (phone)
    return (
      <Sheet
        open
        onOpenChange={open}
        title="Invite people"
        footer={
          <>
            <Button kind="secondary" size="touch" onClick={onClose}>
              Cancel
            </Button>
            <Button kind="primary" size="touch" className="flex-1" loading={busy} loadingLabel="Sending" disabled={count === 0} onClick={send}>
              {sendLabel(count)}
            </Button>
          </>
        }
      >
        {body}
      </Sheet>
    );
  return (
    <Dialog
      open
      onOpenChange={open}
      title="Invite people"
      footer={
        <>
          <Button kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button kind="primary" loading={busy} loadingLabel="Sending" disabled={count === 0} onClick={send}>
            {sendLabel(count)}
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}
