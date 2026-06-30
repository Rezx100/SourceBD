"use client";

// Forgot-password form — light Magic UI rebuild. Same
// `requestPasswordReset` server action as before.

import Link from "next/link";
import { useActionState } from "react";

import { ArrowLeft, ArrowRight, Envelope } from "@phosphor-icons/react/dist/ssr";

import { AuthShell, AuthHeading } from "@/components/auth/auth-shell";
import { AuthAlert, SubmitButton, TextField } from "@/components/auth/auth-fields";

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
      brandHeadlineAccent="not the verified evidence."
      brandSub="We email a single-use link to the address on file. Your saved searches, exported provenance trails and workspace settings stay intact."
      brandFooter="Reset links expire after 60 minutes."
      topRight={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-[#1f4d3a] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <AuthHeading
        title="Reset password"
        subtitle="Enter the email you used to sign up — we'll send a single-use reset link."
      />

      <form action={action} className="mt-7 space-y-4">
        <TextField
          label="Work email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          icon={<Envelope size={17} weight="bold" />}
        />
        {state.error ? <AuthAlert tone="error">{state.error}</AuthAlert> : null}
        {state.info ? <AuthAlert tone="info">{state.info}</AuthAlert> : null}
        <SubmitButton pending={pending} pendingLabel="Sending…">
          Send reset link <ArrowRight size={17} weight="bold" />
        </SubmitButton>
      </form>

      <p className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft size={15} weight="bold" /> Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
