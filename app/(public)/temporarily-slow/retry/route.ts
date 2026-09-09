import { NextResponse, type NextRequest } from "next/server";

import { siteOriginFromEnv, urlOnSite } from "@/lib/site-origin";
import { retryPublicProfile } from "../../suppliers/[slug]/retry-profile";

export const dynamic = "force-dynamic";

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin || !URL.canParse(origin)) return false;
  return new URL(origin).origin === siteOriginFromEnv();
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const form = await req.formData();
  const slug = String(form.get("slug") ?? "");
  const result = await retryPublicProfile(slug);
  const dest =
    result === "ok" ? `/suppliers/${slug}` : "/";
  return NextResponse.redirect(urlOnSite(dest), 303);
}
