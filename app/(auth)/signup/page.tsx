"use client";

// Spec M6b — Signup form.
//
// Uses the existing `signUp` server action in `app/(auth)/actions.ts`.
// Role selector compressed into a small dropdown per M6 JC #11.

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  ArrowRight,
  Envelope,
  Eye,
  EyeSlash,
  Lock,
  User,
} from "@phosphor-icons/react/dist/ssr";

import { AuthShell } from "@/components/auth/auth-shell";

import { signUp, type AuthActionState } from "../actions";

const INITIAL: AuthActionState = {};

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, INITIAL);
  const [showPw, setShowPw] = useState(false);

  return (
    <AuthShell
      brandHeadline="The verified record,"
      brandHeadlineAccent="in minutes."
      brandSub="Create a free workspace and start searching the indexed Bangladesh garment register — every supplier checked against the official record."
      brandFooter="Free to search the public register · no card required."
      topRight={
        <>
          Already have an account? <Link href="/login">Sign in</Link>
        </>
      }
    >
      <h1>Create your account</h1>
      <p className="mkt-am-sub">Free to search the register. No card required.</p>

      <form action={action} style={{ marginTop: 28 }}>
        <div className="mkt-field">
          <label htmlFor="signup-name">Full name</label>
          <div className="inp">
            <User size={17} weight="bold" />
            <input
              id="signup-name"
              type="text"
              name="full_name"
              placeholder="Ada Rahman"
              autoComplete="name"
            />
          </div>
        </div>
        <div className="mkt-field">
          <label htmlFor="signup-email">Work email</label>
          <div className="inp">
            <Envelope size={17} weight="bold" />
            <input
              id="signup-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </div>
        </div>
        <div className="mkt-field">
          <label htmlFor="signup-password">Password</label>
          <div className="inp">
            <Lock size={17} weight="bold" />
            <input
              id="signup-password"
              type={showPw ? "text" : "password"}
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Create a password"
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
          <p className="hint">At least 8 characters, with a number and a symbol.</p>
        </div>
        <div className="mkt-field">
          <label htmlFor="signup-role">I am a</label>
          <div className="inp">
            <select id="signup-role" name="role" defaultValue="buyer">
              <option value="buyer">Buyer · brand / importer / sourcing team</option>
              <option value="supplier">Supplier · factory / buying house</option>
            </select>
          </div>
        </div>

        {state.error ? <p className="mkt-err">{state.error}</p> : null}
        {state.info ? <p className="mkt-info">{state.info}</p> : null}

        <button type="submit" className="mkt-btn-submit" disabled={pending}>
          {pending ? "Creating…" : <>Create account <ArrowRight size={17} /></>}
        </button>
      </form>

      <p className="mkt-switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
      <p className="mkt-legal">
        By creating an account you agree to SourceBD&apos;s{" "}
        <Link href="/legal/terms">Terms</Link> and{" "}
        <Link href="/legal/privacy">Privacy Policy</Link>. SourceBD is a
        neutral public-record index — not a marketplace, broker or rating
        agency.
      </p>
    </AuthShell>
  );
}
