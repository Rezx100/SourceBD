// Spec M2 — Shared marketing footer.
// Spec H7 — The four statutory legal links (Terms, Privacy, Cookies,
// Data sources) sit between Compliance and Trademarks in source-file
// order; `_h7_smoke.py` and `_m6a_smoke.py` both assert that exact
// order.
// Spec M6a — Light multi-column layout matching the bundle screenshot.
//
// Server component. Mounted in `app/(marketing)/layout.tsx`.

import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer data-marketing-footer className="mkt-ft">
      <div className="mkt-wrap">
        <div className="mkt-ft-top">
          <div className="mkt-ft-brand">
            <Link href="/" className="mkt-wordmark">
              <span className="mkt-wm-glyph" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l8 3.5v5c0 4.6-3.2 7.8-8 9-4.8-1.2-8-4.4-8-9v-5L12 3z" />
                  <path d="M9 12l2 2 4-4.5" />
                </svg>
              </span>
              Source<b> BD</b>
            </Link>
            <p>
              A public-record index of Bangladesh&apos;s ready-made-garment
              sector. Built by people who have spent years inside the
              trade — refreshed continuously, with every claim traceable
              to its issuer.
            </p>
          </div>

          <div className="mkt-ft-col">
            <h5>Product</h5>
            <Link href="/pricing">Pricing</Link>
            <Link href="/compliance">Compliance</Link>
            <Link href="/#how-we-verify">How we verify</Link>
            <Link href="/#sources">Data sources</Link>
          </div>

          <div className="mkt-ft-col">
            <h5>Regulations</h5>
            <Link href="/compliance#uk-msa">UK Modern Slavery Act</Link>
            <Link href="/compliance#us-uflpa">US UFLPA</Link>
            <Link href="/compliance#eu-cbam">EU CBAM</Link>
            <Link href="/compliance#eu-eudr">EU EUDR</Link>
            <Link href="/compliance#eu-csddd">EU CSDDD</Link>
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

        <div className="mkt-ft-bottom">
          <div className="meta">
            <Link href="/#how-we-verify">Provenance method</Link>
            <Link href="/status">Status</Link>
          </div>
          <span className="copy">© 2026 SourceBD</span>
        </div>

        <p className="mkt-ft-disclaimer">
          SourceBD is a neutral public-record index — not a marketplace,
          broker, or rating agency. Authority logos identify the data
          sources we aggregate from; SourceBD is not affiliated with or
          endorsed by BGMEA, BKMEA, BTMA, BGAPMEA, EPB, OEKO-TEX, WRAP,
          GOTS, RSC, or any of the brands named on this page. Every
          datum traces to the issuing authority shown on the provenance
          tab. Educational summaries are not legal advice.
        </p>
      </div>
    </footer>
  );
}
