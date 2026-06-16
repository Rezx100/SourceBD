import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Spec P1: production builds emit a self-contained `.next/standalone` bundle
// so the Dockerfile.web runner stage can ship without node_modules. Also
// gated `*.dev.tsx` so the dev-only responsive QA page is invisible to the
// production routes-manifest (keeps the H8 route-count invariant of 68).
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  pageExtensions: isDev
    ? ["tsx", "ts", "jsx", "js", "dev.tsx"]
    : ["tsx", "ts", "jsx", "js"],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  telemetry: false,
});
