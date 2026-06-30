"use client";

// SaveButton — Spec B5 client island.
//
// Toggles a supplier's saved state by POSTing / DELETEing /api/v1/saved.
// Optimistic UI per `frontend-design-spec.md` §15.4; rolls back and surfaces
// a transient inline error if the request fails. Server enforces auth +
// ownership — this button is just a UI affordance.
//
// Usage: render anywhere the user has the supplier UUID + initial state.

import { useState, useTransition } from "react";
import { Star } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SaveButtonProps {
  supplierId: string;
  initialSaved: boolean;
  /** Visual variant. `icon` is the compact circle button used in card rows.
   *  `responsive` is a phone-first 44 px labelled pill that collapses to the
   *  compact icon at `sm+` (Spec R4 §3 Buyer Discover). */
  shape?: "icon" | "full" | "responsive" | "profile";
  className?: string;
}

export function SaveButton({
  supplierId,
  initialSaved,
  shape = "full",
  className,
}: SaveButtonProps) {
  const [saved, setSaved] = useState<boolean>(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    // Cards wrap the row in a <Link>; prevent navigation when clicking the
    // star inside that link.
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    setError(null);
    startTransition(async () => {
      try {
        const res = next
          ? await fetch("/api/v1/saved", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ supplier_id: supplierId }),
            })
          : await fetch(`/api/v1/saved?supplier_id=${supplierId}`, {
              method: "DELETE",
            });
        if (!res.ok) {
          setSaved(!next);
          const detail = await res.json().catch(() => null);
          setError(detail?.error ?? `Failed (${res.status})`);
        }
      } catch (e) {
        setSaved(!next);
        setError(e instanceof Error ? e.message : "Network error");
      }
    });
  }

  const label = saved ? "Saved" : "Save";
  const aria = saved ? "Remove from saved" : "Save supplier";

  if (shape === "profile") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={aria}
        title={error ?? aria}
        className={cn(
          "h-11 min-w-[8.5rem] gap-2 rounded-lg border-neutral-200 px-4 text-sm font-semibold shadow-sm",
          saved && "border-sem-amber/40 bg-sem-amber-soft/40 text-sem-amber hover:bg-sem-amber-soft/60",
          className,
        )}
      >
        <Star size={17} weight={saved ? "fill" : "regular"} />
        <span>{label}</span>
      </Button>
    );
  }

  if (shape === "responsive") {
    // Phone: 44 px labelled pill (first-class tap target). sm+: compact icon.
    return (
      <Button
        type="button"
        variant="outline"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={aria}
        title={error ?? aria}
        className={cn(
          "h-11 gap-1.5 px-3.5 sm:h-9 sm:w-9 sm:px-0",
          saved && "text-sem-amber border-sem-amber",
          className,
        )}
      >
        <Star size={16} weight={saved ? "fill" : "regular"} />
        <span className="sm:hidden">{label}</span>
      </Button>
    );
  }

  if (shape === "icon") {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={aria}
        title={error ?? aria}
        className={cn(saved && "text-sem-amber border-sem-amber", className)}
      >
        <Star size={16} weight={saved ? "fill" : "regular"} />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={saved ? "outline" : "default"}
      size="sm"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      title={error ?? aria}
      className={cn(saved && "text-sem-amber border-sem-amber", className)}
    >
      <Star size={14} weight={saved ? "fill" : "regular"} />
      <span className="r9-btn-label">{label}</span>
    </Button>
  );
}
