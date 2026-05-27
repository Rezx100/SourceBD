"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";

import { requestPasswordReset, type AuthActionState } from "../actions";

const INITIAL: AuthActionState = {};

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    INITIAL,
  );
  return (
    <>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardMeta>SourceBD</CardMeta>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="forgot-email"
              className="text-xs font-medium text-ink-secondary"
            >
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
            />
          </div>
          {state.error ? (
            <p className="text-xs text-sem-red">{state.error}</p>
          ) : null}
          {state.info ? (
            <p className="text-xs text-sem-green">{state.info}</p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={pending}
          >
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <p className="text-xs text-ink-secondary">
          <Link href="/login" className="text-ink-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </>
  );
}
