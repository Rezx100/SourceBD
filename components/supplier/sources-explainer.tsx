// I-014 — Plain-English explainer for the source-trust hierarchy.
// Variants:
//   - `header`  → card-style disclosure (legacy callers).
//   - `footer`  → unstyled card-less disclosure for the page footer.
//   - `inline`  → compact icon+label pill with an absolutely-positioned
//                 popover. Sits under the ReceiptsRing in the supplier
//                 profile header without ever pushing siblings around
//                 (debug batch 2026-06-06 I-021 + I-023 elegance pass).
//
// R12 (2026-06-08): popover is fully sticky. Nothing dismisses it except
// the trigger pill itself or the explicit close × button rendered inside
// the body — no click-outside, no Escape, no scroll-away.

"use client";

import { useState } from "react";
import { Info, X } from "@phosphor-icons/react/dist/ssr";

type Variant = "header" | "footer" | "inline";

const SUMMARY = "How we verify our sources";

export function SourcesExplainer({ variant = "header" }: { variant?: Variant }) {
  const [open, setOpen] = useState(false);
  const cls =
    variant === "footer"
      ? "sources-explainer footer"
      : variant === "inline"
        ? "sources-explainer inline"
        : "sources-explainer";

  return (
    <details className={cls} open={open}>
      <summary
        aria-label={SUMMARY}
        title={SUMMARY}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        {variant === "inline" ? (
          <>
            <Info size={13} weight="fill" aria-hidden />
            <span className="sources-explainer-inline-label">Sources</span>
          </>
        ) : (
          <span>{SUMMARY}</span>
        )}
      </summary>
      <div className="sources-explainer-body" role="region" aria-label={SUMMARY}>
        {variant === "inline" ? (
          <button
            type="button"
            className="sources-explainer-close"
            onClick={() => setOpen(false)}
            aria-label="Close sources panel"
          >
            <X size={12} weight="bold" aria-hidden />
          </button>
        ) : null}
        <p className="sources-explainer-title">{SUMMARY}</p>
        <p>
          We rank every source by how official it is. A factory only appears
          here when at least one source from groups 1, 2 or 3 confirms it — a
          brand mention alone is never enough.
        </p>
        <ol>
          <li>
            <strong>Government registries</strong> — RJSC, BIN, EPB. The most
            trusted.
          </li>
          <li>
            <strong>Industry associations</strong> — BGMEA, BKMEA, BTMA,
            BGAPMEA. Verified factory members.
          </li>
          <li>
            <strong>Audit &amp; certification bodies</strong> — RSC, OEKO-TEX,
            WRAP, GOTS, GRS.
          </li>
          <li>
            <strong>Brand-published supplier lists</strong> — useful, but never
            enough on their own.
          </li>
        </ol>
      </div>
    </details>
  );
}
