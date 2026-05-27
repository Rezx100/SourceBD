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

import { signUp, type AuthActionState } from "../actions";

const INITIAL: AuthActionState = {};

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, INITIAL);
  return (
    <>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardMeta>SourceBD</CardMeta>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="signup-email"
              className="text-xs font-medium text-ink-secondary"
            >
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="signup-password"
              className="text-xs font-medium text-ink-secondary"
            >
              Password (min 8 chars)
            </label>
            <input
              id="signup-password"
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-ink-secondary">
              I am a
            </legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="role"
                  value="buyer"
                  defaultChecked
                />
                Buyer
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="role" value="supplier" />
                Supplier
              </label>
            </div>
          </fieldset>
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
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="text-xs text-ink-secondary">
          Already registered?{" "}
          <Link href="/login" className="text-ink-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </>
  );
}
