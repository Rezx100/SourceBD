"use client";

// The forms of sign-up, sign-in, the reset and the resend (Paper `20 Onboarding`). Each posts to a
// server action in `app/(auth)/actions.ts` and works with no script: the button that sends a link
// instead is the same form with its own `formAction`. An error sits under its own field, with an icon
// and words; a pair that did not match is a banner above the form, as Paper draws it.

import { CheckCircle, Info, XCircle } from "@phosphor-icons/react";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Button, Field, Input } from "@/components/kit";
import { requestPasswordReset, resendSignupEmail, signInWithMagicLink, signInWithPassword, signUp, updatePassword, verifyLoginCode } from "@/app/(auth)/actions";
import { AuthLink } from "./link";
import { RESEND_SECONDS, personalProvider, resendLabel, type AuthActionState } from "./words";

const INITIAL: AuthActionState = {};
/** Paper's auth fields are 40 tall (48 and 16px on a phone). */
const box = "h-control-lg max-sm:h-input-touch max-sm:text-md";
/** Buttons are 40 tall, 48 on a phone. */
const tall = "max-sm:h-input-touch max-sm:text-md";

function PasswordField({ label, name, autoComplete, error, help, required = true }: { label: string; name: string; autoComplete: string; error?: ReactNode; help?: ReactNode; required?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} error={error} help={help}>
      {(a) => (
        <div className="relative">
          <Input {...a} name={name} type={shown ? "text" : "password"} autoComplete={autoComplete} required={required} className={`${box} pr-16`} />
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            aria-controls={a.id}
            className="absolute right-1 top-1/2 flex h-8 -translate-y-1/2 items-center px-2.5 text-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] max-sm:h-11"
          >
            {shown ? "Hide" : "Show"}
          </button>
        </div>
      )}
    </Field>
  );
}

function Or() {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label="or">
      <span className="h-px grow bg-line" />
      <span className="text-xs text-ink-3">or</span>
      <span className="h-px grow bg-line" />
    </div>
  );
}

/** A refusal that is not under one field: the pair that did not match, a limit, a page that cannot build its link. */
function Banner({ state }: { state: AuthActionState }) {
  if (!state.error || state.field) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-sm bg-danger-tint px-3 py-2.5">
      <XCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-danger" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-danger">{state.error}</p>
        {state.kind === "wrong" && state.info ? <p className="text-sm text-ink-2">{state.info}</p> : null}
      </div>
    </div>
  );
}

function EmailField({ state, defaultValue, onChange, help }: { state: AuthActionState; defaultValue?: string; onChange?: (v: string) => void; help?: ReactNode }) {
  const err = state.field === "email" ? state.error : undefined;
  return (
    <Field label="Work email" error={err} help={help}>
      {(a) => <Input {...a} name="email" type="email" autoComplete="email" required defaultValue={defaultValue} onChange={(e) => onChange?.(e.target.value)} className={box} />}
    </Field>
  );
}

/** Sign in: email and password, or the same email and "Email me a sign-in link instead". */
export function SignInForm({ next }: { next: string }) {
  const [pw, pwAction, pwPending] = useActionState(signInWithPassword, INITIAL);
  const [link, linkAction, linkPending] = useActionState(signInWithMagicLink, INITIAL);
  // Whichever action ran last owns the message.
  const [last, setLast] = useState<"pw" | "link">("pw");
  const state = last === "link" ? link : pw;
  return (
    <form action={pwAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Banner state={state} />
      <EmailField state={state} />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        error={state.field === "password" ? state.error : undefined}
        help={<AuthLink href={`/forgot-password`}>Forgot your password?</AuthLink>}
      />
      <div className="flex flex-col gap-4 pt-1">
        <Button type="submit" kind="primary" size="lg" full className={tall} loading={pwPending} loadingLabel="Signing in" onClick={() => setLast("pw")}>
          Sign in
        </Button>
        <Or />
        <Button type="submit" formAction={linkAction} formNoValidate kind="secondary" size="lg" full className={tall} loading={linkPending} loadingLabel="Sending" onClick={() => setLast("link")}>
          Email me a sign-in link instead
        </Button>
      </div>
    </form>
  );
}

/** The email alone and "Email me a sign-in link": the way back from an expired link or a session that ended. */
export function LinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInWithMagicLink, INITIAL);
  return (
    <form action={action} noValidate className="flex w-full max-w-[420px] flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Banner state={state} />
      <EmailField state={state} />
      <div>
        <Button type="submit" kind="primary" size="lg" className={tall} loading={pending} loadingLabel="Sending">
          Email me a sign-in link
        </Button>
      </div>
    </form>
  );
}

/** Sign up. The terms are accepted in words, not a ticked box; a supplier signs up with a password only. */
export function SignUpForm({ role, next }: { role: "buyer" | "supplier"; next: string }) {
  const [up, upAction, upPending] = useActionState(signUp, INITIAL);
  const [link, linkAction, linkPending] = useActionState(signInWithMagicLink, INITIAL);
  const [last, setLast] = useState<"up" | "link">("up");
  const [email, setEmail] = useState("");
  const state = last === "link" ? link : up;
  const provider = personalProvider(email);
  const exists = state.kind === "exists" && state.field === "email";
  return (
    <form action={upAction} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="next" value={next} />
      <Banner state={state} />
      <div className="flex flex-col gap-2">
        <EmailField state={state} onChange={setEmail} />
        {exists ? (
          <p className="flex gap-4 text-base">
            <AuthLink href="/login">Sign in</AuthLink>
            <AuthLink href="/forgot-password">Reset password</AuthLink>
          </p>
        ) : null}
        {provider && !state.field ? (
          <div className="flex items-start gap-2 rounded-sm bg-info-tint px-3 py-2.5">
            <Info size={16} weight="fill" className="mt-0.5 shrink-0 text-info" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-ink">{`A ${provider} address works.`}</p>
              <p className="text-sm text-ink-2">With a work email, teammates at your company can find your workspace.</p>
            </div>
          </div>
        ) : null}
      </div>
      <PasswordField label="Password" name="password" autoComplete="new-password" error={state.field === "password" ? state.error : undefined} help="At least 8 characters" />
      <div className="flex flex-col gap-4 pt-1">
        <Button type="submit" kind="primary" size="lg" full className={tall} loading={upPending} loadingLabel="Creating" onClick={() => setLast("up")}>
          Create account
        </Button>
        {role === "buyer" ? (
          <>
            <Or />
            <Button type="submit" formAction={linkAction} formNoValidate kind="secondary" size="lg" full className={tall} loading={linkPending} loadingLabel="Sending" onClick={() => setLast("link")}>
              Email me a sign-in link instead
            </Button>
          </>
        ) : null}
        <p className="text-sm text-ink-3">
          By creating an account you agree to the <AuthLink href="/legal/terms">Terms</AuthLink> and the <AuthLink href="/legal/privacy">Privacy notice</AuthLink>.
        </p>
      </div>
    </form>
  );
}

/** The second step of signing in: six digits from the authenticator app. */
export function CodeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(verifyLoginCode, INITIAL);
  return (
    <form action={action} noValidate className="flex flex-col gap-8">
      <input type="hidden" name="next" value={next} />
      <Banner state={state} />
      <Field label="Code" error={state.field === "code" ? state.error : undefined} help="The 6 digits your authenticator app shows now.">
        {(a) => <Input {...a} name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={7} autoFocus className={`font-mono tracking-widest ${box}`} />}
      </Field>
      <Button type="submit" kind="primary" size="lg" full className={tall} loading={pending} loadingLabel="Checking">
        Continue
      </Button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, INITIAL);
  return (
    <form action={action} noValidate className="flex flex-col gap-8">
      <Banner state={state} />
      <EmailField state={state} />
      <Button type="submit" kind="primary" size="lg" full className={tall} loading={pending} loadingLabel="Sending">
        Email me a reset link
      </Button>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, INITIAL);
  return (
    <form action={action} noValidate className="flex flex-col gap-8">
      <Banner state={state} />
      <PasswordField label="New password" name="password" autoComplete="new-password" error={state.field === "password" ? state.error : undefined} help="At least 8 characters" />
      <Button type="submit" kind="primary" size="lg" full className={tall} loading={pending} loadingLabel="Saving">
        Save and sign in
      </Button>
    </form>
  );
}

/** "No email yet? Check spam, or resend in 0:42": the timer runs from the page's load and from each resend. */
export function ResendLine() {
  const [state, action, pending] = useActionState(async () => resendSignupEmail(), INITIAL);
  const [left, setLeft] = useState(RESEND_SECONDS);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  useEffect(() => {
    if (state.info) setLeft(RESEND_SECONDS);
  }, [state]);
  return (
    <form action={action} className="flex flex-col gap-2.5">
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-base text-ink-3">
        <span>No email yet? Check spam, or</span>
        {left > 0 ? (
          <span>{resendLabel(left).toLowerCase()}</span>
        ) : (
          <button type="submit" disabled={pending} className="font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] max-sm:min-h-11">
            {pending ? "sending" : "resend the email"}
          </button>
        )}
      </p>
      {state.info ? (
        <p role="status" className="flex items-center gap-2 rounded-sm bg-ink px-3 py-2.5 text-sm text-surface">
          <CheckCircle size={16} weight="fill" className="shrink-0" aria-hidden />
          {state.info}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <XCircle size={16} weight="fill" className="shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
