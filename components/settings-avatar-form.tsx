"use client";

// SettingsAvatarForm — profile-picture upload island (Spec B10, 0059).
//
// Uploads to /api/v1/settings/avatar (multipart) and clears via DELETE.
// Optimistic preview; refreshes the server tree on success so the sidebar
// + topbar pick up the new picture.

import { useContext, useId, useRef, useState, useTransition } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { Button } from "@/components/dashboard/controls";
import { PageSection } from "@/components/dashboard/page";
import { FormError } from "@/components/dashboard/settings";
import { Toast } from "@/components/dashboard/toast";
import { useFlash } from "@/components/dashboard/use-flash";

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
  // Not `useRouter()`, which throws outside a mounted app router (the route tests draw this with none).
  const router = useContext(AppRouterContext);
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const [pending, startTransition] = useTransition();

  const initials = ((displayName.trim() || email || "??").replace(/@.*/, "") || "??")
    .slice(0, 2)
    .toUpperCase();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    setFlash(null);
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
      setFlash("Profile picture saved");
      router?.refresh();
    });
  }

  function onRemove() {
    setError(null);
    setFlash(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/settings/avatar", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `Remove failed (${res.status})`);
        return;
      }
      setUrl(null);
      setFlash("Profile picture removed");
      router?.refresh();
    });
  }

  return (
    <PageSection title="Profile picture" caption="Shown in the sidebar, top bar, and your activity">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Your profile picture"
            className="size-16 shrink-0 rounded-full border border-line-subtle object-cover"
          />
        ) : (
          <span
            className="grid size-16 shrink-0 place-items-center rounded-full bg-surface-sunken text-xl font-semibold text-ink-muted"
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
              tabIndex={-1}
              aria-hidden
            />
            <Button
              disabled={pending}
              aria-busy={pending || undefined}
              aria-describedby={hintId}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? "Saving…" : url ? "Change picture" : "Upload picture"}
            </Button>
            {url ? (
              <Button variant="ghost" disabled={pending} onClick={onRemove}>
                Remove
              </Button>
            ) : null}
          </div>
          <p id={hintId} className="m-0 text-xs text-ink-subtle">
            PNG, JPEG, WebP, or GIF · up to 5 MB.
          </p>
          <FormError>{error}</FormError>
        </div>
      </div>
      {flash ? <Toast text={flash} href={null} className="fixed z-[60]" /> : null}
    </PageSection>
  );
}
