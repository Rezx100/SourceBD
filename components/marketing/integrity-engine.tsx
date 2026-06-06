// Spec M6a — Live integrity engine mock-up.
//
// Server component. Three "scanning" source-window cards over a flow
// path into a captured-output card. JC #6: domain strings are
// generic (Tier-1 / Tier-2 / Tier-3 publishers we already mirror);
// the output card is fed by the JC #5 showcase supplier (or a
// synthetic placeholder when no showcase resolved). Pure CSS
// animation; no client island needed.

import {
  Buildings,
  CheckCircle,
  Certificate,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";

import type { ShowcaseSupplier } from "@/lib/marketing/showcase-supplier";

type Window = {
  url: string;
  domain: string;
  label: string;
};

const WINDOWS: Window[] = [
  { url: "https://www.bgmea.com.bd/", domain: "bgmea.com.bd", label: "BGMEA member register" },
  { url: "https://dife.gov.bd/",     domain: "dife.gov.bd",   label: "DIFE factory register" },
  { url: "https://www.oeko-tex.com/",domain: "oeko-tex.com",  label: "OEKO-TEX certificate index" },
];

function locationLine(supplier: ShowcaseSupplier | null): string {
  if (!supplier) return "Gazipur · Bangladesh";
  const parts = [supplier.city, supplier.district].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : "Bangladesh";
}

export function IntegrityEngine({ supplier }: { supplier: ShowcaseSupplier | null }) {
  const companyName = supplier?.company_name ?? "Cotton Club (BD) Ltd";
  const location = locationLine(supplier);
  const sourceCount = supplier?.t13_source_count ?? 4;

  return (
    <div data-mkt-reveal className="mkt-reveal">
      <div className="mkt-engine-sources">
        {WINDOWS.map((w) => (
          <div key={w.domain} className="mkt-swin">
            <div className="mkt-swin-top">
              <div className="d3" aria-hidden="true">
                <i /><i /><i />
              </div>
              <span className="url">
                <b>{w.domain}</b>
              </span>
            </div>
            <div className="mkt-swin-body">
              <div className="mkt-swin-skel" aria-hidden="true">
                <div className="ln" style={{ width: "70%" }} />
                <div className="ln" style={{ width: "92%" }} />
                <div className="ln" style={{ width: "55%" }} />
                <div className="ln" style={{ width: "80%" }} />
                <div className="ln" style={{ width: "44%" }} />
              </div>
              <div className="mkt-swin-scan" aria-hidden="true" />
              <div className="mkt-swin-badge">
                <span className="sp" aria-hidden="true" />
                <span>Capturing</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mkt-engine-flow" aria-hidden="true">
        <svg viewBox="0 0 1000 60" preserveAspectRatio="none">
          <path d="M 70 0 C 70 30, 500 30, 500 60" />
          <path d="M 500 0 L 500 60" />
          <path d="M 930 0 C 930 30, 500 30, 500 60" />
          <path className="flow" d="M 70 0 C 70 30, 500 30, 500 60" />
          <path className="flow" d="M 500 0 L 500 60" />
          <path className="flow" d="M 930 0 C 930 30, 500 30, 500 60" />
        </svg>
      </div>

      <div className="mkt-engine-out">
        <div className="mkt-engine-out-top">
          <span className="mkt-glyph" aria-hidden="true">
            <Buildings size={16} weight="fill" />
          </span>
          <b>{companyName}</b>
          <span className="tag">
            <span className="lv" /> Corroborated
          </span>
        </div>
        <div className="mkt-engine-out-rows">
          <div className="mkt-eo-row">
            <span className="k">Location</span>
            <span className="v">{location}</span>
            <span className="chk"><CheckCircle size={11} weight="bold" /></span>
          </div>
          <div className="mkt-eo-row">
            <span className="k">Tier 1–3 sources</span>
            <span className="v">
              {sourceCount} independent {sourceCount === 1 ? "register" : "registers"}
            </span>
            <span className="chk"><ShieldCheck size={11} weight="bold" /></span>
          </div>
          <div className="mkt-eo-row">
            <span className="k">Sanctions screen</span>
            <span className="v">UFLPA · OFAC · UK OFSI — clear</span>
            <span className="chk"><Certificate size={11} weight="bold" /></span>
          </div>
        </div>
      </div>
    </div>
  );
}
