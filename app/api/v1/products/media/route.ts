// /api/v1/products/media — a file for the buyer's product base (migration 0106).
//
// POST   multipart/form-data { file, kind } → uploads to
//          product-media/<uid>/<ts>-<rand>.<ext> and returns { url, kind }
// DELETE { url }                            → removes that file, only when it
//          sits in the caller's own folder
//
// Auth + ownership: 401 without a session. The upload uses the caller's
// session client, so storage RLS (0106) also confines writes and deletes to
// product-media/<their uid>/. The bucket is public-read, so the url renders
// directly in <img>. Saving the url onto a product is a separate
// buyer_product_upsert; this route only moves files.

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "product-media";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, the bucket's own limit
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};
const KINDS = ["image", "video", "model", "tech_pack"];

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (!gate) return bad("unauthorised", 401);
  const { supabase, userId } = gate;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Send the file as multipart/form-data.");
  }

  const kind = form.get("kind");
  if (typeof kind !== "string" || !KINDS.includes(kind)) {
    return bad("Say what the file is: image, video, model or tech_pack.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return bad("Choose a file to upload.");
  if (file.size === 0) return bad("That file is empty.");
  if (file.size > MAX_BYTES) return bad("Files can be 10 MB at most.");
  const ext = MIME_EXT[file.type];
  if (!ext) return bad("Use a PNG, JPEG, WebP or GIF image, or a PDF.");
  if (kind === "image" && ext === "pdf") return bad("An image must be a PNG, JPEG, WebP or GIF.");

  const path = `${userId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) {
    return NextResponse.json({ error: "The file could not be uploaded.", detail: error.message }, { status: 400 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: publicUrl, kind });
}

export async function DELETE(req: Request) {
  const gate = await requireAuth();
  if (!gate) return bad("unauthorised", 401);
  const { supabase, userId } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("invalid JSON");
  }
  const url = body && typeof body === "object" ? (body as { url?: unknown }).url : undefined;
  if (typeof url !== "string") return bad("Say which file to remove.");

  // The bucket's own public prefix, so a url from any other bucket or host is refused.
  const prefix = supabase.storage.from(BUCKET).getPublicUrl("").data.publicUrl;
  if (!url.startsWith(prefix)) return bad("That is not a product file.");
  let path: string;
  try {
    path = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0] ?? "");
  } catch {
    return bad("That is not a product file.");
  }
  const name = path.slice(userId.length + 1);
  if (!path.startsWith(`${userId}/`) || !name || name.includes("/") || name.includes("..")) {
    return bad("That file is not yours.", 403);
  }

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    return NextResponse.json({ error: "The file could not be removed.", detail: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
