"use client";

// SettingsAvatarForm — profile-picture upload island (Spec B10, 0059).
//
// Uploads to /api/v1/settings/avatar (multipart) and clears via DELETE.
// Optimistic preview; refreshes the server tree on success so the sidebar
// + topbar pick up the new picture.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash, UploadSimple } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

export function SettingsAvatarForm({
  initialAvatarUrl,
  displayName,
  email,
}: {
  initialAvatarUrl: string | null;
  displayName: string;
  email: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const initials = ((displayName.trim() || email || "??").replace(/@.*/, "") || "??")
    .slice(0, 2)
    .toUpperCase();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    setOk(false);
    if (file.size > MAX_BYTES) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await fetch("/api/v1/settings/avatar", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as
        | { avatar_url?: string | null; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? `Upload failed (${res.status})`);
        return;
      }
      setUrl(data?.avatar_url ?? null);
      setOk(true);
      router.refresh();
    });
  }

  function onRemove() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const res = await fetch("/api/v1/settings/avatar", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `Remove failed (${res.status})`);
        return;
      }
      setUrl(null);
      setOk(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile picture</CardTitle>
        <CardMeta>Shown in the sidebar, top bar, and your activity</CardMeta>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Your profile picture"
              className="size-16 shrink-0 rounded-full border border-hairline object-cover"
            />
          ) : (
            <span
              className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-forest text-[18px] font-bold text-white"
              aria-hidden
            >
              {initials}
            </span>
          )}

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                onChange={onPick}
                className="hidden"
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={pending}
                onClick={() => inputRef.current?.click()}
              >
                <UploadSimple size={15} weight="bold" aria-hidden className="mr-1.5" />
                {pending ? "Working…" : url ? "Change picture" : "Upload picture"}
              </Button>
              {url ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={onRemove}
                  className="text-sem-red hover:bg-sem-red-soft hover:text-sem-red"
                >
                  <Trash size={15} aria-hidden className="mr-1.5" />
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-ink-tertiary">
              PNG, JPEG, WebP, or GIF · up to 5 MB.
            </p>
            <div className="min-h-[18px] text-sm">
              {ok ? <span className="text-sem-green">Saved.</span> : null}
              {error ? <span className="text-sem-red">{error}</span> : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
