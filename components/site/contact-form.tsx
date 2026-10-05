"use client";

// The Contact sales form (Paper `30 Marketing · Contact sales`): name, work email, company, role, markets, pieces a
// year, and a line about what they buy. Native fields, so it posts with no script; each refusal sits under its own
// field in words, and a send that failed says where else to write. Sent, the form is replaced by one plain sentence.

import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import { Button, Checkbox, Field, Input, Select } from "@/components/kit";
import { fieldBox, fieldEdge } from "@/components/kit/classes";
import { sendContact } from "@/app/(marketing)/contact/actions";
import { CONTACT_TO, MARKETS, PIECES, ROLES, type ContactState } from "@/lib/contact";
import { cn } from "@/lib/utils";

const INITIAL: ContactState = {};
const box = "h-control-lg max-sm:h-input-touch max-sm:text-md";
const opts = (l: readonly string[]) => l.map((v) => ({ value: v, label: v }));

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContact, INITIAL);
  if (state.sent) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-line bg-surface p-6">
        <CheckCircle size={24} weight="fill" className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold text-ink">Sent to the founder.</p>
          <p className="text-md text-ink-2">We will reply to the email address you gave.</p>
        </div>
      </div>
    );
  }
  const v = state.values ?? {};
  const f = state.fields ?? {};
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.error && !state.field ? (
        <div role="alert" className="flex items-start gap-2 rounded-sm bg-danger-tint px-3 py-2.5">
          <XCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <p className="text-sm font-medium text-danger">{state.error}</p>
        </div>
      ) : null}
      <Field label="Name" error={f.name}>
        {(a) => <Input {...a} name="name" autoComplete="name" required defaultValue={v.name} className={box} />}
      </Field>
      <Field label="Work email" error={f.email}>
        {(a) => <Input {...a} name="email" type="email" autoComplete="email" required defaultValue={v.email} className={box} />}
      </Field>
      <Field label="Company" error={f.company}>
        {(a) => <Input {...a} name="company" autoComplete="organization" required defaultValue={v.company} className={box} />}
      </Field>
      <Field label="Role" error={f.role}>
        {(a) => <Select {...a} name="role" options={opts(ROLES)} placeholder="Choose one" defaultValue={v.role || undefined} invalid={Boolean(f.role)} className={box} />}
      </Field>
      <fieldset className="flex flex-col gap-1.5" aria-describedby={f.markets ? "markets-error" : undefined}>
        <legend className="mb-1.5 text-sm font-medium text-ink">Markets you sell in</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {MARKETS.map((m) => (
            <Checkbox key={m} name="markets" value={m} defaultChecked={v.markets?.includes(m)}>
              <span className="pl-2">{m}</span>
            </Checkbox>
          ))}
        </div>
        {f.markets ? (
          <p id="markets-error" className="flex items-start gap-1.5 text-sm text-danger">
            <XCircle size={16} weight="fill" className="shrink-0" aria-hidden />
            <span>{f.markets}</span>
          </p>
        ) : null}
      </fieldset>
      <Field label="Pieces you buy a year" error={f.pieces}>
        {(a) => <Select {...a} name="pieces" options={opts(PIECES)} placeholder="Choose a range" defaultValue={v.pieces || undefined} invalid={Boolean(f.pieces)} className={box} />}
      </Field>
      <Field label="What do you buy? (optional)">
        {(a) => <textarea {...a} name="message" rows={4} maxLength={2000} defaultValue={v.message} className={cn(fieldBox, fieldEdge, "min-h-24 px-2.5 py-2 text-base max-sm:text-md")} />}
      </Field>
      {/* The honeypot: out of sight and out of the tab order. A person never fills it. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-col gap-3 pt-1">
        <Button type="submit" kind="primary" size="lg" className="w-fit max-sm:h-input-touch max-sm:w-full" loading={pending} loadingLabel="Sending">
          Send to the founder
        </Button>
        <p className="text-sm text-ink-3">
          We use these details only to reply. See the{" "}
          <a href="/legal/privacy" className="font-medium text-brand underline decoration-1 [text-underline-position:from-font]">
            privacy notice
          </a>
          . Prefer email? Write to{" "}
          <a href={`mailto:${CONTACT_TO}`} className="font-medium text-brand underline decoration-1 [text-underline-position:from-font]">
            {CONTACT_TO}
          </a>
          .
        </p>
      </div>
    </form>
  );
}
