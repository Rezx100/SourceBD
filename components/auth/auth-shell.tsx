// Spec M6b — Shared auth split-pane shell.
//
// Server component. Renders the left "brand" panel (dark green with
// the mesh-backdrop + dossier-proof card) plus the right form panel
// frame. Each auth page (login / signup / forgot-password /
// reset-password) supplies its own form via `children` and chooses
// the headline + sub copy via props.
//
// Mounted by `app/(auth)/layout.tsx` so the route group's H2 rate-
// limit class (`auth`, 10/min IP-bucketed) is unchanged. The existing
// Supabase server actions in `app/(auth)/actions.ts` continue to
// drive every form.

import Link from "next/link";

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

import { WordmarkMark } from "@/components/marketing/wordmark-mark";

type ProofRow = {
  label: string;
  tier:
    | "tier1_gov"
    | "tier2_industry"
    | "tier3_cert"
    | "tier4_brand"
    | "tier5_regulatory";
};

const DEFAULT_PROOF: ProofRow[] = [
  { label: "DIFE factory register",  tier: "tier1_gov" },
  { label: "BGMEA membership #3041", tier: "tier2_industry" },
  { label: "OFAC · UFLPA — clear",   tier: "tier5_regulatory" },
];

const TIER_DOT: Record<ProofRow["tier"], string> = {
  tier1_gov:        "var(--mkt-tier-gov)",
  tier2_industry:   "var(--mkt-tier-assoc)",
  tier3_cert:       "var(--mkt-tier-cert)",
  tier4_brand:      "var(--mkt-tier-brand)",
  tier5_regulatory: "var(--mkt-tier-sanction)",
};

export function AuthShell({
  brandHeadline,
  brandHeadlineAccent,
  brandSub,
  brandFooter,
  proofTitle = "Cotton Club (BD) Ltd",
  proofSubtitle = "Knit composite · Gazipur",
  topRight,
  children,
}: {
  brandHeadline: string;
  brandHeadlineAccent: string;
  brandSub: string;
  brandFooter: string;
  proofTitle?: string;
  proofSubtitle?: string;
  topRight: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mkt-auth">
      <section className="mkt-auth-brand" aria-hidden="true">
        <div className="mkt-ab-inner">
          <Link href="/" className="mkt-wordmark" style={{ color: "#fff" }}>
            <WordmarkMark />
            <span className="mkt-wm-text">Source<b style={{ color: "var(--mkt-green-300)" }}>BD</b></span>
          </Link>

          <h2 className="mkt-ab-headline">
            {brandHeadline} <em>{brandHeadlineAccent}</em>
          </h2>
          <p className="mkt-ab-sub">{brandSub}</p>

          <div className="mkt-ab-card" aria-hidden="true">
            <div className="mkt-ab-card-top">
              <span className="mkt-ab-logo">CC</span>
              <div className="mkt-ab-who">
                <b>{proofTitle}</b>
                <span>{proofSubtitle}</span>
              </div>
              <span className="mkt-ab-vbadge">
                <span className="lv" /> Corroborated
              </span>
            </div>
            <div className="mkt-ab-bar">
              <i /><i /><i /><i /><i />
            </div>
            <div className="mkt-ab-rows">
              {DEFAULT_PROOF.map((p) => (
                <div key={p.label} className="mkt-ab-row">
                  <span className="d" style={{ background: TIER_DOT[p.tier] }} />
                  {p.label}
                  <span className="ck">
                    <CheckCircle size={10} weight="bold" />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mkt-ab-foot">
            <span className="lv" />
            {brandFooter}
          </div>
        </div>
      </section>

      <section className="mkt-auth-main">
        <div className="mkt-am-top">{topRight}</div>
        <div className="mkt-am-card">
          <Link href="/" className="mkt-wordmark mkt-am-logo">
            <WordmarkMark />
            <span className="mkt-wm-text">Source<b>BD</b></span>
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
