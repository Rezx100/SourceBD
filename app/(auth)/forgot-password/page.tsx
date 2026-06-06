"use client";

// Spec M6b — Forgot-password form. Same `requestPasswordReset`
// server action as F3.

import Link from "next/link";
import { useActionState } from "react";

import { ArrowRight, Envelope } from "@phosphor-icons/react/dist/ssr";

import { AuthShell } from "@/components/auth/auth-shell";

import { requestPasswordReset, type AuthActionState } from "../actions";

const INITIAL: AuthActionState = {};

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    INITIAL,
  );
  return (
    <AuthShell
      brandHeadline="Reset your access,"
      brandHeadlineAccent="not the receipts."
      brandSub="We email a single-use link to the address on file. Your saved searches, exported provenance trails and workspace settings stay intact."
      brandFooter="Reset links expire after 60 minutes."
      topRight={
        <>
          Remembered it? <Link href="/login">Sign in</Link>
        </>
      }
    >
      <h1>Reset password</h1>
      <p className="mkt-am-sub">
        Enter the email you used to sign up — we&apos;ll send a single-use
        reset link.
      </p>
      <form action={action} style={{ marginTop: 28 }}>
        <div className="mkt-field">
          <label htmlFor="forgot-email">Work email</label>
          <div className="inp">
            <Envelope size={17} weight="bold" />
            <input
              id="forgot-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </div>
        </div>
        {state.error ? <p className="mkt-err">{state.error}</p> : null}
        {state.info ? <p className="mkt-info">{state.info}</p> : null}
        <button type="submit" className="mkt-btn-submit" disabled={pending}>
          {pending ? "Sending…" : <>Send reset link <ArrowRight size={17} /></>}
        </button>
      </form>
      <p className="mkt-switch">
        <Link href="/login">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
