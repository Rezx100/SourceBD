// Spec H4 — Shared base layout for all transactional emails.
// One wordmark, one footer, no external assets, no CSS files.

import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const colours = {
  bg: "#F5F4EE",
  card: "#FFFFFF",
  ink: "#0D1B2A",
  inkMuted: "#5A6573",
  hairline: "#E5E3DA",
  brand: "#1F4D3A",
};

const fontStack =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function EmailLayout({
  preview,
  heading,
  children,
  footer,
}: {
  preview: string;
  heading: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colours.bg,
          fontFamily: fontStack,
          color: colours.ink,
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            padding: "32px 16px",
          }}
        >
          <Section style={{ paddingBottom: 24 }}>
            <Text
              style={{
                fontSize: 12,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: colours.brand,
                fontWeight: 600,
                margin: 0,
              }}
            >
              SourceBD
            </Text>
          </Section>
          <Section
            style={{
              backgroundColor: colours.card,
              border: `1px solid ${colours.hairline}`,
              borderRadius: 12,
              padding: "28px 28px 24px",
            }}
          >
            <Heading
              as="h1"
              style={{
                fontSize: 22,
                lineHeight: "30px",
                margin: "0 0 16px",
                color: colours.ink,
                fontWeight: 600,
              }}
            >
              {heading}
            </Heading>
            {children}
          </Section>
          <Hr style={{ borderColor: colours.hairline, margin: "28px 0 16px" }} />
          <Section>
            {footer ?? (
              <Text style={{ fontSize: 12, color: colours.inkMuted, margin: 0 }}>
                You are receiving this from SourceBD because of activity on
                your account. Manage notifications in your buyer or supplier
                settings.
              </Text>
            )}
            <Text
              style={{
                fontSize: 12,
                color: colours.inkMuted,
                margin: "8px 0 0",
              }}
            >
              © SourceBD · sourcebd.com
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  paragraph: {
    fontSize: 15,
    lineHeight: "22px",
    color: colours.ink,
    margin: "0 0 12px",
  } as const,
  muted: {
    fontSize: 13,
    lineHeight: "20px",
    color: colours.inkMuted,
    margin: "0 0 12px",
  } as const,
  button: {
    display: "inline-block",
    backgroundColor: colours.brand,
    color: "#FFFFFF",
    textDecoration: "none",
    padding: "10px 18px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
  } as const,
  link: {
    color: colours.brand,
    textDecoration: "underline",
  } as const,
};
