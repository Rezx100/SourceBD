"use client";

// Spec M6b — Reset-password form. Same `updatePassword` server action
// as F3 (writes to the recovery session set by the magic link).

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  ArrowRight,
  Eye,
  EyeSlash,
  Lock,
} from "@phosphor-icons/react/dist/ssr";

import { AuthShell } from "@/components/auth/auth-shell";

import { updatePassword, type AuthActionState } from "../actions";

const INITIAL: AuthActionState = {};

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, INITIAL);
  const [showPw, setShowPw] = useState(false);
  return (
    <AuthShell
      brandHeadline="One new password,"
      brandHeadlineAccent="same verified workspace."
      brandSub="After you set the new password we'll log you straight back into your buyer dashboard. Saved searches, exports and team members stay intact."
      brandFooter="Encrypted in transit · session refreshed."
      topRight={
        <>
          Need help? <Link href="/login">Back to sign in</Link>
        </>
      }
    >
      <h1>Set a new password</h1>
      <p className="mkt-am-sub">
        Choose a password you don&apos;t use elsewhere — at least 8
        characters.
      </p>
      <form action={action} style={{ marginTop: 28 }}>
        <div className="mkt-field">
          <label htmlFor="reset-password">New password</label>
          <div className="inp">
            <Lock size={17} weight="bold" />
            <input
              id="reset-password"
              type={showPw ? "text" : "password"}
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              style={{
                background: "none",
                border: 0,
                cursor: "pointer",
                color: "var(--mkt-ink-400)",
                padding: 4,
                display: "grid",
                placeItems: "center",
              }}
            >
              {showPw ? <EyeSlash size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        {state.error ? <p className="mkt-err">{state.error}</p> : null}
        <button type="submit" className="mkt-btn-submit" disabled={pending}>
          {pending ? "Saving…" : <>Update password <ArrowRight size={17} /></>}
        </button>
      </form>
    </AuthShell>
  );
}
