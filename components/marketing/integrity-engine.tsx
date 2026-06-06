// Spec M6a — Live integrity engine mock-up (light).
//
// Server component. Three light "scanning" source-window cards over
// a converging SVG flow path into a captured-output card. JC #6:
// domain strings are generic (Tier-1 / Tier-2 / Tier-3 publishers we
// already mirror); the output card uses the JC #5 showcase supplier
// (or a synthetic placeholder when no showcase resolved). Pure CSS
// animation; no client island needed.

import {
  Buildings,
  CheckCircle,
  MagnifyingGlass,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";

import type { ShowcaseSupplier } from "@/lib/marketing/showcase-supplier";

type EngineWindow = {
  domain: string;
  path: string;
  badge: "captured" | "verifying" | "screening";
  variant?: "pdf" | "search";
};

const WINDOWS: EngineWindow[] = [
  { domain: "inspection.gov.bd", path: "/factory-register",     badge: "captured" },
  { domain: "oeko-tex.com",      path: "/label-check",          badge: "verifying", variant: "pdf" },
  { domain: "sanctionssearch.ofac.treas.gov", path: "/", badge: "screening", variant: "search" },
];

function badgeText(b: EngineWindow["badge"]): string {
  if (b === "captured")  return "Record captured";
  if (b === "verifying") return "Certificate verified";
  return "Screened · clear";
}

function locationLine(supplier: ShowcaseSupplier | null): string {
  if (!supplier) return "Gazipur · Bangladesh";
  const parts = [supplier.city, supplier.district].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : "Bangladesh";
}

export function IntegrityEngine({
  supplier,
}: {
  supplier: ShowcaseSupplier | null;
}) {
  const companyName = supplier?.company_name ?? "Cotton Club (BD) Ltd";
  return (
    <div data-mkt-reveal className="mkt-reveal">
      <div className="mkt-engine-sources">
        {WINDOWS.map((w) => (
          <div key={w.domain} className="mkt-swin">
            <div className="mkt-swin-top">
              <div className="d3" aria-hidden="true"><i /><i /><i /></div>
              <span className="url">
                <b>{w.domain}</b>{w.path}
              </span>
            </div>
            <div className="mkt-swin-body">
              <div className="mkt-swin-grid" aria-hidden="true" />
              <div className="mkt-swin-skel" aria-hidden="true">
                <div className="ln" style={{ width: "30%" }} />
                <div className="ln" style={{ width: "78%" }} />
                <div className="ln" style={{ width: "62%" }} />
                <div className="ln" style={{ width: "84%" }} />
                <div className="ln" style={{ width: "40%" }} />
              </div>
              {w.variant === "pdf" ? (
                <span className="mkt-swin-pdf" aria-hidden="true">PDF</span>
              ) : null}
              {w.variant === "search" ? (
                <span className="mkt-swin-search" aria-hidden="true">
                  <MagnifyingGlass size={13} weight="bold" />
                </span>
              ) : null}
              <div className="mkt-swin-scan" aria-hidden="true" />
              <div className="mkt-swin-badge">
                <span className="ck" aria-hidden="true">
                  <CheckCircle size={9} weight="bold" />
                </span>
                {badgeText(w.badge)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mkt-engine-flow" aria-hidden="true">
        <svg viewBox="0 0 1000 64" preserveAspectRatio="none">
          <path d="M 80 0 C 80 36, 500 36, 500 64" />
          <path d="M 500 0 L 500 64" />
          <path d="M 920 0 C 920 36, 500 36, 500 64" />
          <path className="flow" d="M 80 0 C 80 36, 500 36, 500 64" />
          <path className="flow" d="M 500 0 L 500 64" />
          <path className="flow" d="M 920 0 C 920 36, 500 36, 500 64" />
          <circle cx="80"  cy="0" r="4" className="node" />
          <circle cx="500" cy="0" r="4" className="node" />
          <circle cx="920" cy="0" r="4" className="node" />
          <circle cx="500" cy="64" r="5" className="node" />
        </svg>
      </div>

      <div className="mkt-engine-out">
        <div className="mkt-engine-out-top">
          <span className="mkt-glyph" aria-hidden="true">
            <ShieldCheck size={16} weight="fill" />
          </span>
          <b>Verified profile · {companyName}</b>
          <span className="tag">
            <span className="lv" /> Reconciled
          </span>
        </div>
        <div className="mkt-engine-out-rows">
          <div className="mkt-eo-row">
            <span className="k">Business ID · BIN</span>
            <span className="v">Matched to DIFE record</span>
            <span className="chk"><CheckCircle size={12} weight="bold" /></span>
          </div>
          <div className="mkt-eo-row">
            <span className="k">BGMEA membership</span>
            <span className="v">#3041 · active</span>
            <span className="chk"><CheckCircle size={12} weight="bold" /></span>
          </div>
          <div className="mkt-eo-row">
            <span className="k">OEKO-TEX STD 100</span>
            <span className="v">Cert 24.0.91234 · valid</span>
            <span className="chk"><CheckCircle size={12} weight="bold" /></span>
          </div>
          <div className="mkt-eo-row">
            <span className="k">OFAC / UFLPA</span>
            <span className="v">No match · clear ({locationLine(supplier)})</span>
            <span className="chk"><Buildings size={12} weight="bold" /></span>
          </div>
        </div>
      </div>
    </div>
  );
}
