// Spec H4 — password_reset email.
//
// Note: production password resets are sent by Supabase Auth's built-in
// `resetPasswordForEmail` flow (see `app/(auth)/actions.ts` ->
// requestPasswordReset). This React template is the source of truth for
// the HTML body to paste into the Supabase Auth dashboard email-template
// editor; the variables `{{ .ConfirmationURL }}` and `{{ .Email }}` are
// expanded by Supabase at send time.
//
// The same component is also wired through the H4 sender so we can fire
// a custom reset email from a server action if we ever move off Supabase
// Auth's default mailer.

import * as React from "react";
import { Button, Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";

export type PasswordResetData = {
  resetUrl: string;
  email: string;
};

export const passwordResetSubject = (_: PasswordResetData) =>
  "Reset your SourceBD password";

export function PasswordReset({ data }: { data: PasswordResetData }) {
  return (
    <EmailLayout
      preview="Use this link to set a new SourceBD password."
      heading="Reset your password"
    >
      <Text style={emailStyles.paragraph}>
        We received a request to reset the password for{" "}
        <strong>{data.email}</strong>. Click the button below to choose a new
        one. The link expires in 1 hour.
      </Text>
      <Button href={data.resetUrl} style={emailStyles.button}>
        Set a new password
      </Button>
      <Text style={emailStyles.muted}>
        If you did not request this, you can safely ignore this email — your
        current password remains unchanged.
      </Text>
    </EmailLayout>
  );
}

export default PasswordReset;
