"use client";

// Signup form — light Magic UI rebuild.
//
// Uses the existing `signUp` server action in `app/(auth)/actions.ts`.

import Link from "next/link";
import { useActionState } from "react";

import { ArrowRight, Envelope, Lock, User, UsersThree } from "@phosphor-icons/react/dist/ssr";

import { AuthShell, AuthHeading } from "@/components/auth/auth-shell";
import {
  AuthAlert,
  PasswordField,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/auth/auth-fields";

import { signUp, type AuthActionState } from "../actions";

const INITIAL: AuthActionState = {};

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, INITIAL);

  return (
    <AuthShell
      brandHeadline="The verified record,"
      brandHeadlineAccent="in minutes."
      brandSub="Create a free workspace and start searching the indexed Bangladesh garment register — every supplier checked against the official record."
      brandFooter="Free to search the public register · no card required."
      topRight={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#1f4d3a] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <AuthHeading
        title="Create your account"
        subtitle="Free to search the register. No card required."
      />

      <form action={action} className="mt-7 space-y-4">
        <TextField
          label="Full name"
          name="full_name"
          type="text"
          autoComplete="name"
          placeholder="Ada Rahman"
          icon={<User size={17} weight="bold" />}
        />
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
          autoComplete="new-password"
          placeholder="Create a password"
          icon={<Lock size={17} weight="bold" />}
          hint="At least 8 characters, with a number and a symbol."
        />
        <SelectField
          label="I am a"
          name="role"
          defaultValue="buyer"
          icon={<UsersThree size={17} weight="bold" />}
        >
          <option value="buyer">Buyer · brand / importer / sourcing team</option>
          <option value="supplier">Supplier · factory / buying house</option>
        </SelectField>

        {state.error ? <AuthAlert tone="error">{state.error}</AuthAlert> : null}
        {state.info ? <AuthAlert tone="info">{state.info}</AuthAlert> : null}

        <SubmitButton pending={pending} pendingLabel="Creating…">
          Create account <ArrowRight size={17} weight="bold" />
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#1f4d3a] hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-6 text-xs leading-relaxed text-neutral-400">
        By creating an account you agree to SourceBD&apos;s{" "}
        <Link href="/legal/terms" className="text-neutral-500 underline-offset-2 hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="text-neutral-500 underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        . SourceBD is a neutral public-record index — not a marketplace, broker
        or rating agency.
      </p>
    </AuthShell>
  );
}
