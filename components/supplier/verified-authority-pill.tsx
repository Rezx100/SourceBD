"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "@phosphor-icons/react/dist/ssr";

import { ProfileSourceMark } from "@/components/supplier/profile-ui";
import { sourceFullName } from "@/lib/source-full-names";
import type { ProvenanceAuthorityGroup } from "@/lib/format-supplier-profile";
import { profileHeaderChipClass } from "@/lib/profile-tab-styles";
import { cn } from "@/lib/utils";

const HOVER_OPEN_MS = 300;

export function VerifiedAuthorityPill({
  badgeLabel,
  badgeLabelShort,
  authorityCount,
  provenanceRecordCount,
  authorities,
  provenanceTabTriggerId = "tab-trigger-provenance",
}: {
  badgeLabel: string;
  /** Compact phone label (e.g. no date) so the pill never truncates on
   *  narrow screens; falls back to `badgeLabel` when omitted. */
  badgeLabelShort?: string;
  authorityCount: number;
  provenanceRecordCount: number;
  authorities: readonly ProvenanceAuthorityGroup[];
  provenanceTabTriggerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function openPopover() {
    setOpen(true);
  }

  function closePopover() {
    clearHoverTimer();
    setOpen(false);
  }

  function onMouseEnter() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(openPopover, HOVER_OPEN_MS);
  }

  function onMouseLeave() {
    clearHoverTimer();
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      setOpen(false);
    }
  }

  function goToProvenanceTab() {
    document.getElementById(provenanceTabTriggerId)?.click();
    closePopover();
  }

  const popoverTitle = `Verified by ${authorityCount} independent ${
    authorityCount === 1 ? "authority" : "authorities"
  }`;
  const footerLabel = `View all ${provenanceRecordCount} source ${
    provenanceRecordCount === 1 ? "record" : "records"
  } ->`;

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0" onMouseLeave={onMouseLeave}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={onMouseEnter}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          profileHeaderChipClass,
          // The strongest trust signal on the page gets the card's one
          // colour accent: quiet forest tint instead of the neutral chip.
          "cursor-pointer border border-brand-forest/15 bg-brand-forest-soft text-brand-forest hover:border-brand-forest/30 hover:bg-brand-forest/10",
        )}
      >
        <ShieldCheck size={11} weight="duotone" aria-hidden className="shrink-0 text-brand-forest sm:hidden" />
        <ShieldCheck size={14} weight="duotone" aria-hidden className="hidden shrink-0 text-brand-forest sm:block" />
        {badgeLabelShort ? (
          <>
            <span className="truncate sm:hidden">{badgeLabelShort}</span>
            <span className="hidden truncate sm:inline">{badgeLabel}</span>
          </>
        ) : (
          <span className="truncate">{badgeLabel}</span>
        )}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] sm:hidden"
            aria-hidden
            onClick={closePopover}
          />
          <div
            role="dialog"
            aria-label={popoverTitle}
            className={cn(
              "fixed inset-x-4 top-1/2 z-50 mx-auto max-w-[360px] -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-4 shadow-lg",
              "sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:mx-0 sm:w-[322px] sm:max-w-none sm:translate-y-0",
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-[14px] font-semibold leading-snug text-neutral-900">
                {popoverTitle}
              </p>
              <button
                type="button"
                onClick={closePopover}
                aria-label="Close"
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
              >
                <X size={17} weight="bold" aria-hidden />
              </button>
            </div>

            <ul className="max-h-[280px] space-y-2 overflow-y-auto">
              {authorities.map((authority) => {
                const fullName =
                  sourceFullName(authority.sourceCode) ?? authority.displayName;
                return (
                  <li key={authority.sourceCode} className="flex min-h-5 items-center gap-2.5">
                    <ProfileSourceMark
                      tag={authority.sourceCode}
                      label={fullName}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-neutral-800">
                      {fullName}
                    </span>
                    {authority.recordCount > 1 ? (
                      <span className="shrink-0 text-[13px] text-neutral-500">
                        {authority.recordCount} records
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={goToProvenanceTab}
              className="mt-3 w-full text-left text-[14px] font-semibold text-brand-forest hover:underline"
            >
              {footerLabel}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
