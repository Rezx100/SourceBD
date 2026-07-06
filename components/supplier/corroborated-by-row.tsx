"use client";

import { useEffect, useRef, useState } from "react";
import { Fingerprint, X } from "@phosphor-icons/react/dist/ssr";

import { AuthorityChip } from "@/components/supplier/authority-chip";
import { ProfileSourceMark } from "@/components/supplier/profile-ui";
import { sourceFullName } from "@/lib/source-full-names";
import { cn } from "@/lib/utils";

const VISIBLE_CHIP_LIMIT = 4;

function sourceCodeLabel(code: string): string {
  if (code === "OEKO_TEX") return "OEKO-TEX";
  if (code === "BRAND_HM") return "H&M";
  if (code === "BRAND_MS") return "M&S";
  if (code.startsWith("BRAND_")) {
    const raw = code.slice(6).replace(/_/g, " ").trim();
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : code;
  }
  return code.replace(/_/g, "-");
}

function authorityLabel(code: string): string {
  return sourceFullName(code) ?? sourceCodeLabel(code);
}

/** Header "Corroborated by" row — first four named chips, then a "+N more"
 *  popover listing every authority with a 22px logo mark. */
export function CorroboratedByRow({ sourceCodes }: { sourceCodes: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  if (sourceCodes.length === 0) return null;

  const visible = sourceCodes.slice(0, VISIBLE_CHIP_LIMIT);
  const overflow = sourceCodes.length - visible.length;

  return (
    <div
      ref={rootRef}
      className="relative mt-3 flex flex-wrap items-center gap-1.5 border-t border-neutral-100 pt-3"
    >
      <Fingerprint size={17} weight="regular" aria-hidden className="mr-0.5 shrink-0 text-neutral-400" />
      <span className="mr-0.5 text-[12px] text-neutral-500">Corroborated by</span>
      {visible.map((code) => (
        <AuthorityChip key={code} label={sourceCodeLabel(code)} title={authorityLabel(code)} />
      ))}
      {overflow > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="dialog"
            className="inline-flex shrink-0 items-center rounded-full border border-neutral-300 px-2 py-0.5 text-[12px] font-semibold text-brand-forest hover:bg-brand-forest-soft"
          >
            +{overflow} more
          </button>
          {open ? (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] sm:hidden"
                aria-hidden
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-label="All corroborating authorities"
                className={cn(
                  "fixed inset-x-4 top-1/2 z-50 mx-auto max-w-[360px] -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-4 shadow-lg",
                  "sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:mx-0 sm:w-[322px] sm:max-w-none sm:translate-y-0",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[14px] font-semibold text-neutral-900">Corroborating authorities</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
                  >
                    <X size={17} weight="bold" aria-hidden />
                  </button>
                </div>
                <ul className="max-h-[280px] space-y-2 overflow-y-auto">
                  {sourceCodes.map((code) => (
                    <li key={code} className="flex items-center gap-2.5">
                      <ProfileSourceMark tag={code} size="sm" label={authorityLabel(code)} />
                      <span className="min-w-0 text-[15px] font-medium leading-snug text-neutral-800">
                        {authorityLabel(code)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
