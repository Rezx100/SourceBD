"use client";

// Reset-password form — light Magic UI rebuild. Same `updatePassword`
// server action as before (writes to the recovery session set by the
// magic link).

import Link from "next/link";
import { useActionState } from "react";

import { ArrowRight, Lock } from "@phosphor-icons/react/dist/ssr";

import { AuthShell, AuthHeading } from "@/components/auth/auth-shell";
import { AuthAlert, PasswordField, SubmitButton } from "@/components/auth/auth-fields";

import { updatePassword, type AuthActionState } from "../actions";

const INITIAL: AuthActionState = {};

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, INITIAL);
  return (
    <AuthShell
      brandHeadline="One new password,"
      brandHeadlineAccent="same verified workspace."
      brandSub="After you set the new password we'll log you straight back into your buyer dashboard. Saved searches, exports and team members stay intact."
      brandFooter="Encrypted in transit · session refreshed."
      topRight={
        <>
          Need help?{" "}
          <Link href="/login" className="font-medium text-[#1f4d3a] hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <AuthHeading
        title="Set a new password"
        subtitle="Choose a password you don't use elsewhere — at least 8 characters."
      />

      <form action={action} className="mt-7 space-y-4">
        <PasswordField
          label="New password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          icon={<Lock size={17} weight="bold" />}
        />
        {state.error ? <AuthAlert tone="error">{state.error}</AuthAlert> : null}
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Update password <ArrowRight size={17} weight="bold" />
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
