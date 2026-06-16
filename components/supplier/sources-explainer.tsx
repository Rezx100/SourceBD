// I-014 — Plain-English explainer for the source-trust hierarchy.
// Variants:
//   - `header`  → card-style disclosure (legacy callers).
//   - `footer`  → unstyled card-less disclosure for the page footer.
//   - `inline`  → compact icon+label pill with an absolutely-positioned
//                 popover. Sits under the ReceiptsRing in the supplier
//                 profile header without ever pushing siblings around
//                 (debug batch 2026-06-06 I-021 + I-023 elegance pass).

import { Info } from "@phosphor-icons/react/dist/ssr";

type Variant = "header" | "footer" | "inline";

const SUMMARY = "How we verify our sources";

export function SourcesExplainer({ variant = "header" }: { variant?: Variant }) {
  const cls =
    variant === "footer"
      ? "sources-explainer footer"
      : variant === "inline"
        ? "sources-explainer inline"
        : "sources-explainer";

  return (
    <details className={cls}>
      <summary aria-label={SUMMARY} title={SUMMARY}>
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
