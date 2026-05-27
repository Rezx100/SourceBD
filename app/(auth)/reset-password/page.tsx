"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";

import { updatePassword, type AuthActionState } from "../actions";

const INITIAL: AuthActionState = {};

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, INITIAL);
  return (
    <>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardMeta>SourceBD</CardMeta>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="reset-password"
              className="text-xs font-medium text-ink-secondary"
            >
              New password (min 8 chars)
            </label>
            <input
              id="reset-password"
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
            />
          </div>
          {state.error ? (
            <p className="text-xs text-sem-red">{state.error}</p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={pending}
          >
            {pending ? "Saving…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </>
  );
}
