"use client";

// Login form — email/password sign-in plus magic link option.
// Both branches dispatch to server actions in `app/(auth)/actions.ts`
// which talk to Supabase Auth.

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";

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
    <>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardMeta>SourceBD</CardMeta>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={pwAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-1">
            <label
              htmlFor="login-email"
              className="text-xs font-medium text-ink-secondary"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="login-password"
              className="text-xs font-medium text-ink-secondary"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              name="password"
              required
              autoComplete="current-password"
              minLength={8}
              className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
            />
          </div>
          {pwState.error ? (
            <p className="text-xs text-sem-red">{pwState.error}</p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={pwPending}
          >
            {pwPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-[10px] font-mono uppercase tracking-wide text-ink-tertiary">
            or
          </span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        <form action={magicAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-1">
            <label
              htmlFor="magic-email"
              className="text-xs font-medium text-ink-secondary"
            >
              Email for magic link
            </label>
            <input
              id="magic-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
            />
          </div>
          {magicState.error ? (
            <p className="text-xs text-sem-red">{magicState.error}</p>
          ) : null}
          {magicState.info ? (
            <p className="text-xs text-sem-green">{magicState.info}</p>
          ) : null}
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={magicPending}
          >
            {magicPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>

        <div className="flex justify-between pt-2 text-xs text-ink-secondary">
          <Link href="/forgot-password" className="hover:text-ink-primary">
            Forgot password?
          </Link>
          <Link href="/signup" className="hover:text-ink-primary">
            Create an account
          </Link>
        </div>
      </CardContent>
    </>
  );
}
