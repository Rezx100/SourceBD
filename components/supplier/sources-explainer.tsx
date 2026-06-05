// I-014 — Plain-English explainer for the source-trust hierarchy.
// Replaces the dev-jargon "Tier hierarchy: T1 > T2 > T3 > T4" string with a
// disclosure a non-engineer can parse. Anchored next to the ReceiptsRing in
// the profile header; also used at the Provenance tab footer.
//
// Native <details>, no Radix dep needed (not installed).

export function SourcesExplainer({ variant = "header" }: { variant?: "header" | "footer" }) {
  const isFooter = variant === "footer";
  return (
    <details className={`sources-explainer${isFooter ? " footer" : ""}`}>
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
