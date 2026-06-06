"use client";

// Spec M6b — Login form.
//
// Uses the same Supabase server actions as the previous F3
// implementation (`signInWithPassword`, `signInWithMagicLink` in
// `app/(auth)/actions.ts`) — only the chrome changes. The split-pane
// `AuthShell` is mounted here so the form panel can read `next` from
// the page props and pass it as a hidden input on every form.

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  ArrowRight,
  Envelope,
  Eye,
  EyeSlash,
  Lock,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";

import { AuthShell } from "@/components/auth/auth-shell";

import {
  signInWithMagicLink,
  signInWithPassword,
  type AuthActionState,
} from "../actions";

const INITIAL: AuthActionState = {};

export function LoginForm({ next }: { next: string }) {
  const [pwState, pwAction, pwPending] = useActionState(
    signInWithPassword,
    INITIAL,
  );
  const [magicState, magicAction, magicPending] = useActionState(
    signInWithMagicLink,
    INITIAL,
  );
  const [showPw, setShowPw] = useState(false);

  return (
    <AuthShell
      brandHeadline="Vet suppliers with"
      brandHeadlineAccent="receipts on every claim."
      brandSub="Sign in to search the verified register, open any factory's provenance trail and export the evidence your compliance team needs."
      brandFooter="Trusted by sourcing & compliance teams in the UK, US & EU."
      proofTitle="Cotton Club (BD) Ltd"
      proofSubtitle="Knit composite · Gazipur"
      topRight={
        <>
          New to SourceBD?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`}>
            Create an account
          </Link>
        </>
      }
    >
      <h1>Welcome back</h1>
      <p className="mkt-am-sub">Sign in to your workspace.</p>

      <form action={pwAction} style={{ marginTop: 28 }}>
        <input type="hidden" name="next" value={next} />
        <div className="mkt-field">
          <label htmlFor="login-email">Work email</label>
          <div className="inp">
            <Envelope size={17} weight="bold" />
            <input
              id="login-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </div>
        </div>
        <div className="mkt-field">
          <label htmlFor="login-password">Password</label>
          <div className="inp">
            <Lock size={17} weight="bold" />
            <input
              id="login-password"
              type={showPw ? "text" : "password"}
              name="password"
              required
              autoComplete="current-password"
              minLength={8}
              placeholder="••••••••"
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
        {pwState.error ? <p className="mkt-err">{pwState.error}</p> : null}
        <div className="mkt-form-row">
          <label className="mkt-remember">
            <input type="checkbox" defaultChecked />
            <span className="box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            Keep me signed in
          </label>
          <Link
            className="mkt-forgot"
            href={`/forgot-password${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}
          >
            Forgot password?
          </Link>
        </div>
        <button type="submit" className="mkt-btn-submit" disabled={pwPending}>
          {pwPending ? "Signing in…" : <>Sign in <ArrowRight size={17} /></>}
        </button>
      </form>

      <div className="mkt-divider">or sign in with a magic link</div>

      <form action={magicAction}>
        <input type="hidden" name="next" value={next} />
        <div className="mkt-field">
          <label htmlFor="magic-email">Email for sign-in link</label>
          <div className="inp">
            <Envelope size={17} weight="bold" />
            <input
              id="magic-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </div>
        </div>
        {magicState.error ? <p className="mkt-err">{magicState.error}</p> : null}
        {magicState.info ? <p className="mkt-info">{magicState.info}</p> : null}
        <button type="submit" className="mkt-btn-secondary" disabled={magicPending}>
          {magicPending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>

      <p className="mkt-switch">
        New to SourceBD?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`}>
          Create an account
        </Link>
      </p>
      <p className="mkt-legal" style={{ marginTop: 16 }}>
        <ShieldCheck size={13} weight="fill" style={{ verticalAlign: "-2px", marginRight: 4 }} />
        Sessions are encrypted in transit. SourceBD is a neutral
        public-record index — not a marketplace, broker or rating agency.
      </p>
    </AuthShell>
  );
}
