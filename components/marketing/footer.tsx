// Spec M2 — Shared marketing footer.
// Spec H7 — Adds the four statutory legal links (Terms, Privacy,
// Cookies, Data sources) between Compliance and Trademarks. The
// `_h7_smoke.py` check asserts the source-file order is preserved.
// Spec M6a — Multi-column dark layout matching the new homepage
// chrome. Link hrefs and their source-file order are unchanged so
// the H7 smoke continues to pass.

import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer data-marketing-footer className="mkt-ft">
      <div className="mkt-wrap">
        <div className="mkt-ft-top">
          <div className="mkt-ft-brand">
            <Link href="/" className="mkt-wordmark">
              Source<b>BD</b>
            </Link>
            <p>
              The verified record of Bangladesh garment factories. Every
              datum traces to the issuing authority — government,
              association, certification body, or buyer publication.
            </p>
          </div>
          <div className="mkt-ft-cols">
            <div className="mkt-ft-col">
              <h5>Product</h5>
              <Link href="/pricing">Pricing</Link>
              <Link href="/discover">Browse the directory</Link>
            </div>
            <div className="mkt-ft-col">
              <h5>Verification</h5>
              <Link href="/compliance">Compliance</Link>
            </div>
            <div className="mkt-ft-col">
              <h5>Legal</h5>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/cookies">Cookies</Link>
              <Link href="/legal/data-sources">Data sources</Link>
              <Link href="/legal/trademarks">Trademarks</Link>
            </div>
          </div>
        </div>
        <div className="mkt-ft-bottom">
          <span className="copy">© 2026 SourceBD</span>
          <span className="copy">United Kingdom · United States · European Union</span>
        </div>
        <p className="mkt-ft-disclaimer">
          SourceBD is a neutral public-record index — not a marketplace,
          broker, or rating agency. Authority logos identify the data
          sources we aggregate from; SourceBD is not affiliated with or
          endorsed by BGMEA, BKMEA, BTMA, BGAPMEA, EPB, OEKO-TEX, WRAP,
          GOTS, RSC, or any of the brands named on this site. Every
          datum traces to the issuing authority shown on the Provenance
          tab.
        </p>
      </div>
    </footer>
  );
}

