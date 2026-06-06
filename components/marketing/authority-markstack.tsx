// Spec M6a — Authority markstack.
//
// Server component. Renders the "Built on the registers the world's
// buyers already trust" band on the homepage. Avatar-style monogram
// circles for the first 8 authority codes + a "+N" tail, plus a
// stat card with the live count from `lib/marketing/authority-count.ts`.
//
// JC #9: these are source authorities (regulators / associations /
// cert bodies / brands), NOT customer logos — we have no buyer
// customers to publish. The visual is "moat", not social-proof.

const MARKS = [
  { code: "DIFE",  mc: "#5B7CFF" },
  { code: "BG",    mc: "#3FBE86" }, // BGMEA
  { code: "BK",    mc: "#3FBE86" }, // BKMEA
  { code: "OT",    mc: "#26C0CE" }, // OEKO-TEX
  { code: "WR",    mc: "#26C0CE" }, // WRAP
  { code: "H&M",   mc: "#E0A93C" },
  { code: "OFAC",  mc: "#F0766B" },
] as const;

export function AuthorityMarkstack({
  totalSources,
}: {
  totalSources: number;
}) {
  const tailCount = Math.max(0, totalSources - MARKS.length);
  return (
    <section className="mkt-moat">
      <div className="mkt-wrap mkt-moat-inner mkt-reveal" data-mkt-reveal>
        <div className="mkt-moat-copy">
          <span className="mkt-kicker">The most complete record</span>
          <h3>
            Built on the registers the world&apos;s buyers already trust.
          </h3>
        </div>
        <div className="mkt-markstack">
          <div className="mkt-mks">
            {MARKS.map((m) => (
              <span
                key={m.code}
                className="mk"
                style={{ ["--mc" as string]: m.mc }}
                aria-hidden="true"
              >
                {m.code}
              </span>
            ))}
            {tailCount > 0 ? (
              <span
                className="mk"
                style={{ ["--mc" as string]: "#6B6F69" }}
                aria-hidden="true"
              >
                +{tailCount}
              </span>
            ) : null}
          </div>
          <div className="mkt-moat-stat">
            <b>{totalSources}</b>
            <span>official sources reconciled continuously</span>
          </div>
        </div>
      </div>
    </section>
  );
}
