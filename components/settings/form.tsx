"use client";

// The pieces the Settings forms share (Paper `10 · Settings · Company details, unsaved changes`):
// the bar that stands at the foot of the page while there is something unsaved (what changed, Discard,
// Save changes), a section's own save button, the toast that says a save happened, and the textarea.

import { useEffect, useState, type ReactNode } from "react";
import { Button, Toast } from "@/components/kit";
import { fieldBox, fieldEdge } from "@/components/kit/classes";
import { cn } from "@/lib/utils";

export const textareaClass = cn(fieldBox, fieldEdge, "block min-h-16 px-2.5 py-1.5 text-base");

/** A sentence to say once and let go (the kit's toast), cleared after four seconds. */
export function useFlash(ms = 4000) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(null), ms);
    return () => clearTimeout(t);
  }, [text, ms]);
  return [text, setText] as const;
}

/** Said and heard: the toast sits clear of the phone's tab bar. */
export function Flash({ text }: { text: string | null }) {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {text ?? ""}
      </p>
      {text ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex justify-center px-4 max-md:bottom-[calc(theme(spacing.tabbar)+1rem+env(safe-area-inset-bottom))]">
          <Toast tone="brand" className="pointer-events-auto">
            {text}
          </Toast>
        </div>
      ) : null}
    </>
  );
}

/** A refusal or a failed save, said beside the fields and announced. */
export function FormNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}

/**
 * The foot of a page whose fields can be changed: absent while nothing differs, then "Unsaved changes"
 * and the names of the fields, Discard and Save changes. Inside the form, so Save is its submit.
 */
export function SaveBar({ changed, saving, onDiscard }: { changed: readonly string[]; saving: boolean; onDiscard: () => void }) {
  if (changed.length === 0 && !saving) return null;
  return (
    <div className="sticky bottom-0 z-raised -mx-8 mt-6 flex items-center justify-between gap-3 border-t border-line bg-surface px-8 py-3 [box-shadow:0_-4px_12px_rgb(21_24_28_/_0.06)] max-md:-mx-4 max-md:bottom-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom))] max-md:flex-col max-md:items-stretch max-md:px-4">
      <p className="flex min-w-0 items-center gap-3 text-base">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-caution-icon" />
        <span className="font-medium text-ink">Unsaved changes</span>
        <span className="min-w-0 text-sm text-ink-3 [overflow-wrap:anywhere]">{changed.join(", ")}</span>
      </p>
      <div className="flex gap-2 max-md:[&>*]:flex-1">
        <Button kind="secondary" onClick={onDiscard} disabled={saving} className="max-md:h-input-touch">
          Discard
        </Button>
        <Button kind="primary" type="submit" loading={saving} loadingLabel="Saving" className="max-md:h-input-touch">
          Save changes
        </Button>
      </div>
    </div>
  );
}

/** A section's own save, for the pages that save one small thing (a name, an address, a password). */
export function SaveRow({ label, saving, loadingLabel = "Saving", disabled }: { label: string; saving: boolean; loadingLabel?: string; disabled?: boolean }) {
  return (
    <div>
      <Button kind="primary" type="submit" loading={saving} loadingLabel={loadingLabel} disabled={disabled} className="max-md:h-input-touch max-md:w-full">
        {label}
      </Button>
    </div>
  );
}
