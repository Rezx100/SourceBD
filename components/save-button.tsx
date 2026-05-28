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
  /** Visual variant. `icon` is the compact circle button used in card rows. */
  shape?: "icon" | "full";
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
      {label}
    </Button>
  );
}
