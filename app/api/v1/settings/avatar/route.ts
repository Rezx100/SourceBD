// /api/v1/settings/avatar — profile-picture upload (Spec B10, 0059).
//
// POST   multipart/form-data { file }  → uploads to avatars/<uid>/<ts>.<ext>,
//                                        writes profiles.avatar_url, returns url
// DELETE                               → clears avatar_url + removes objects
//
// Auth + ownership: the upload uses the caller's session client, so storage
// RLS (migration 0059) constrains writes to the caller's own folder. The
// avatar_url write goes through the SECURITY DEFINER `settings_update_avatar`
// RPC. Bucket is public-read so the returned URL renders directly in <img>.

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

export async function POST(req: Request) {
  const gate = await requireAuth();
  if (!gate) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { supabase, userId } = gate;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file exceeds 5 MB" }, { status: 400 });
  }
  const ext = MIME_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "unsupported type; use PNG, JPEG, WebP, or GIF" },
      { status: 400 },
    );
  }

  // Remove any prior avatar objects so the folder holds a single file.
  const { data: existing } = await supabase.storage.from(BUCKET).list(userId);
  if (existing && existing.length > 0) {
    await supabase.storage
      .from(BUCKET)
      .remove(existing.map((o) => `${userId}/${o.name}`));
  }

  const path = `${userId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });
  if (uploadError) {
    return NextResponse.json(
      { error: "upload failed", detail: uploadError.message },
      { status: 400 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: rpcError } = await supabase.rpc("settings_update_avatar", {
    p_avatar_url: publicUrl,
  });
  if (rpcError) {
    return NextResponse.json(
      { error: "settings_update_avatar failed", detail: rpcError.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, avatar_url: publicUrl });
}

export async function DELETE() {
  const gate = await requireAuth();
  if (!gate) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { supabase, userId } = gate;

  const { data: existing } = await supabase.storage.from(BUCKET).list(userId);
  if (existing && existing.length > 0) {
    await supabase.storage
      .from(BUCKET)
      .remove(existing.map((o) => `${userId}/${o.name}`));
  }

  const { error: rpcError } = await supabase.rpc("settings_update_avatar", {
    p_avatar_url: null,
  });
  if (rpcError) {
    return NextResponse.json(
      { error: "settings_update_avatar failed", detail: rpcError.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, avatar_url: null });
}
