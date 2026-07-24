const DEFAULT_DEV_ORIGIN = "http://localhost:3000";

export class AppOriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppOriginError";
  }
}

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

export function getCanonicalAppOrigin(headers?: Headers | null): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) {
    try {
      return normalizeOrigin(env);
    } catch {
      throw new AppOriginError(
        "NEXT_PUBLIC_APP_URL must be a valid absolute URL",
      );
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new AppOriginError(
      "NEXT_PUBLIC_APP_URL is required in production for auth links",
    );
  }

  if (!headers) return DEFAULT_DEV_ORIGIN;

  const proto = headers.get("x-forwarded-proto") ?? "http";
  const host =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
