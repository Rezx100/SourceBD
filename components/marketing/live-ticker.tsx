// Spec M6a — Live ticker marquee.
//
// Server component. Static pre-curated array of short status lines.
// JC #10: numbers cited here must be sanity-verified against the
// live DB before each ship; the `_m6a_smoke.py` script enforces
// that they are within ±10% of the live counts.
//
// The track is duplicated so the CSS marquee animation can loop
// seamlessly (`translateX(0)` → `translateX(-50%)`).

const TICKS = [
  { dot: "var(--mkt-tier-gov)",      text: "BGMEA member register",      meta: "refreshed daily" },
  { dot: "var(--mkt-tier-gov)",      text: "DIFE factory register",      meta: "10,122 records" },
  { dot: "var(--mkt-tier-gov)",      text: "RSC remediation index",      meta: "1,605 factories" },
  { dot: "var(--mkt-tier-cert)",     text: "OEKO-TEX STANDARD 100",      meta: "412 certificates mirrored" },
  { dot: "var(--mkt-tier-cert)",     text: "WRAP audit roll",            meta: "refreshed weekly" },
  { dot: "var(--mkt-tier-cert)",     text: "GOTS certified facilities",  meta: "refreshed weekly" },
  { dot: "var(--mkt-tier-assoc)",    text: "BKMEA member register",      meta: "knitwear cluster" },
  { dot: "var(--mkt-tier-assoc)",    text: "BTMA spinning mills",        meta: "refreshed monthly" },
  { dot: "var(--mkt-tier-assoc)",    text: "BGAPMEA accessories",        meta: "refreshed monthly" },
  { dot: "var(--mkt-tier-brand)",    text: "H&M supplier disclosure",    meta: "factory-named" },
  { dot: "var(--mkt-tier-brand)",    text: "Next supplier list",         meta: "factory-named" },
  { dot: "var(--mkt-tier-brand)",    text: "M&S Plan A factory list",    meta: "factory-named" },
  { dot: "var(--mkt-tier-brand)",    text: "ASOS Fashion-with-Integrity",meta: "factory-named" },
  { dot: "var(--mkt-tier-sanction)", text: "UFLPA Entity List",          meta: "negative screen" },
  { dot: "var(--mkt-tier-sanction)", text: "OFAC SDN",                   meta: "negative screen" },
  { dot: "var(--mkt-tier-sanction)", text: "UK OFSI consolidated list",  meta: "negative screen" },
];

export function LiveTicker() {
  const renderSet = (key: string) => (
    <div key={key} className="mkt-ticker-set" aria-hidden={key === "b"}>
      {TICKS.map((t, i) => (
        <span key={`${key}-${i}`} className="mkt-tick">
          <span className="d" style={{ background: t.dot }} />
          {t.text} <b>· {t.meta}</b>
        </span>
      ))}
    </div>
  );
  return (
    <div className="mkt-ticker" aria-label="Live source register">
      <div className="mkt-ticker-live">
        <span className="lv" /> Live
      </div>
      <div className="mkt-ticker-track">
        {renderSet("a")}
        {renderSet("b")}
      </div>
    </div>
  );
}
