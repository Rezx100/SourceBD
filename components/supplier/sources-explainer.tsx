// I-014 — Plain-English explainer for the source-trust hierarchy.
// Replaces the dev-jargon "Tier hierarchy: T1 > T2 > T3 > T4" string with a
// disclosure a non-engineer can parse.
//
// Variants:
//   - `header`  → card-style disclosure (legacy callers).
//   - `footer`  → unstyled card-less disclosure for the page footer.
//   - `inline`  → tiny link with an absolutely-positioned body, so opening
//                 it never pushes header siblings around. Used next to the
//                 ReceiptsRing (debug batch 2026-06-06 I-021).

type Variant = "header" | "footer" | "inline";

export function SourcesExplainer({ variant = "header" }: { variant?: Variant }) {
  const cls =
    variant === "footer"
      ? "sources-explainer footer"
      : variant === "inline"
        ? "sources-explainer inline"
        : "sources-explainer";
  return (
    <details className={cls}>
      <summary>How we trust our sources</summary>
      <div className="sources-explainer-body">
        <p>We rank sources by how official they are.</p>
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
        <p>
          A factory only appears here when at least one source from groups 1, 2
          or 3 confirms it. A brand mention alone is never enough.
        </p>
      </div>
    </details>
  );
}
