"use client";

// Login form — light Magic UI rebuild.
//
// Uses the same Supabase server actions as before
// (`signInWithPassword`, `signInWithMagicLink` in
// `app/(auth)/actions.ts`) — only the chrome changes. The split-pane
// `AuthShell` is mounted here so the form panel can read `next` from
// the page props and pass it as a hidden input on every form.

import Link from "next/link";
import { useActionState } from "react";

import { ArrowRight, Envelope, Lock, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

import { AuthShell, AuthHeading } from "@/components/auth/auth-shell";
import {
  AuthAlert,
  PasswordField,
  SecondaryButton,
  SubmitButton,
  TextField,
} from "@/components/auth/auth-fields";

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
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="font-medium text-[#1f4d3a] hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <AuthHeading title="Welcome back" subtitle="Sign in to your workspace." />

      <form action={pwAction} className="mt-7 space-y-4">
        <input type="hidden" name="next" value={next} />
        <TextField
          label="Work email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          icon={<Envelope size={17} weight="bold" />}
        />
        <PasswordField
          label="Password"
          name="password"
          required
          minLength={8}
          autoComplete="current-password"
          placeholder="••••••••"
          icon={<Lock size={17} weight="bold" />}
        />
        {pwState.error ? <AuthAlert tone="error">{pwState.error}</AuthAlert> : null}

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              defaultChecked
              className="size-4 rounded border-neutral-300 text-[#1f4d3a] accent-[#1f4d3a]"
            />
            Keep me signed in
          </label>
          <Link
            href={`/forgot-password${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-sm font-medium text-[#1f4d3a] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <SubmitButton pending={pwPending} pendingLabel="Signing in…">
          Sign in <ArrowRight size={17} weight="bold" />
        </SubmitButton>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        or sign in with a magic link
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <form action={magicAction} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <TextField
          label="Email for sign-in link"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          icon={<Envelope size={17} weight="bold" />}
        />
        {magicState.error ? <AuthAlert tone="error">{magicState.error}</AuthAlert> : null}
        {magicState.info ? <AuthAlert tone="info">{magicState.info}</AuthAlert> : null}
        <SecondaryButton pending={magicPending} pendingLabel="Sending…">
          Email me a sign-in link
        </SecondaryButton>
      </form>

      <p className="mt-8 flex items-start gap-1.5 text-xs leading-relaxed text-neutral-400">
        <ShieldCheck size={14} weight="fill" className="mt-px shrink-0" />
        Sessions are encrypted in transit. SourceBD is a neutral public-record
        index — not a marketplace, broker or rating agency.
      </p>
    </AuthShell>
  );
}
