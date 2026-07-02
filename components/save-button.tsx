"use client";

// SaveButton — Spec B5 client island.
//
// Toggles a supplier's saved state by POSTing / DELETEing /api/v1/saved.
// Optimistic UI per `frontend-design-spec.md` §15.4; rolls back and surfaces
// a transient inline error if the request fails. Server enforces auth +
// ownership — this button is just a UI affordance.
//
// Renders as "Follow" / bell, not "Save" / star (decided 2 Jul, UX audit):
// saving a supplier quietly enrols the buyer in cert/registration change
// alerts for that company (opt-out in Settings), which a star/bookmark
// icon doesn't communicate. The bell is honest about what the action does.
//
// Usage: render anywhere the user has the supplier UUID + initial state.

import { useState, useTransition } from "react";
import { Bell, BellRinging } from "@phosphor-icons/react/dist/ssr";

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

  const label = saved ? "Following" : "Follow";
  const aria = saved
    ? "Unfollow — stop getting cert & registration change alerts"
    : "Follow — get notified of cert & registration changes";

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
          saved && "border-brand-forest/30 bg-brand-forest-soft text-brand-forest hover:bg-brand-forest-soft/70",
          className,
        )}
      >
        {saved ? <BellRinging size={17} weight="fill" /> : <Bell size={17} weight="regular" />}
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
          saved && "text-brand-forest border-brand-forest/30 bg-brand-forest-soft",
          className,
        )}
      >
        {saved ? <BellRinging size={16} weight="fill" /> : <Bell size={16} weight="regular" />}
        <span className="sm:hidden">{label}</span>
      </Button>
    );
  }

  if (shape === "icon") {
    // Compact card-row affordance — thinner outline, softer border, fills
    // with a light neutral wash on hover (decided 2 Jul, UX audit: the
    // stock outline-button treatment read as the weakest, least "custom"
    // element on the finished card).
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={aria}
        title={error ?? aria}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border text-neutral-500 transition-colors duration-hover ease-smooth hover:border-neutral-200 hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-60",
          saved && "border-brand-forest/30 bg-brand-forest-soft text-brand-forest hover:bg-brand-forest-soft/80 hover:text-brand-forest",
          className,
        )}
        style={!saved ? { borderColor: "rgba(15,15,20,0.08)" } : undefined}
      >
        {saved ? (
          <BellRinging size={14.5} weight="fill" />
        ) : (
          <Bell size={14.5} weight="regular" />
        )}
      </button>
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
      className={cn(saved && "text-brand-forest border-brand-forest/30 bg-brand-forest-soft", className)}
    >
      {saved ? <BellRinging size={14} weight="fill" /> : <Bell size={14} weight="regular" />}
      <span className="r9-btn-label">{label}</span>
    </Button>
  );
}
