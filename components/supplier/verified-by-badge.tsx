import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";

const VERIFIED_TIER_CODES: Record<string, string> = {
  RJSC: "RJSC",
  BIN: "BIN",
  EPB: "EPB",
  BGMEA: "BGMEA",
  BKMEA: "BKMEA",
  BTMA: "BTMA",
  BGAPMEA: "BGAPMEA",
};

type VerifiedPill = { source_code: string };

function collectVerifiedCodes(pills: VerifiedPill[]): string[] {
  const codes: string[] = [];
  for (const p of pills) {
    const label = VERIFIED_TIER_CODES[p.source_code];
    if (label && !codes.includes(label)) codes.push(label);
  }
  return codes;
}

/** Tier 1–2 register sources backing this supplier — wrap-friendly pill row. */
export function VerifiedByBadge({ pills }: { pills: VerifiedPill[] }) {
  const codes = collectVerifiedCodes(pills);
  if (codes.length === 0) return null;

  return (
    <div
      className="verified-by-badge"
      aria-label={`Company verified by ${codes.join(", ")}`}
    >
      <span className="verified-by-badge-label">
        <ShieldCheck size={14} weight="fill" aria-hidden />
        <span>Company verified by</span>
      </span>
      <span className="verified-by-badge-sources">
        {codes.map((code) => (
          <span key={code} className="verified-source-pill">
            {code}
          </span>
        ))}
      </span>
    </div>
  );
}
