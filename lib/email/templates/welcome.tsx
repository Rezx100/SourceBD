// Spec H4 — welcome email (fires after signup).

import * as React from "react";
import { Button, Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";

export type WelcomeData = {
  appUrl: string;
  role: "buyer" | "supplier";
};

export const welcomeSubject = (_: WelcomeData) => "Welcome to SourceBD";

export function Welcome({ data }: { data: WelcomeData }) {
  const ctaHref =
    data.role === "supplier" ? `${data.appUrl}/supplier` : `${data.appUrl}/app`;
  const ctaLabel =
    data.role === "supplier" ? "Open the supplier portal" : "Open the dashboard";
  return (
    <EmailLayout
      preview="Your SourceBD account is ready."
      heading="Welcome to SourceBD"
    >
      <Text style={emailStyles.paragraph}>
        Your account is ready. SourceBD gives you verified Bangladesh-RMG
        supplier intelligence sourced from BGMEA, BKMEA, BTMA, BGAPMEA and the
        certification bodies — never crowdsourced.
      </Text>
      <Text style={emailStyles.paragraph}>
        Confirm your email address from the link we just sent separately, then
        sign in to get started.
      </Text>
      <Button href={ctaHref} style={emailStyles.button}>
        {ctaLabel}
      </Button>
    </EmailLayout>
  );
}

export default Welcome;
