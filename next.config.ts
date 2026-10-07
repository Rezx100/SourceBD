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
  // Keep a visited /app page for 30s in the client router. Closing a record
  // goes back to the exact search URL the buyer was just on; with the default
  // of 0 that re-ran the whole search on the server before the record could
  // close. Mutations call `router.refresh()`, which clears this cache.
  experimental: { staleTimes: { dynamic: 30 } },
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
