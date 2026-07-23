// Brand-disclosure strip (audit gap d6). Counts are live via the same
// discover_suppliers RPC that powers the brand filter on /discover
// (p_brand_codes), so the figures track production data, never a snapshot.
//
// LEGAL WORDING — PENDING SIGN-OFF (frontend-design-spec.md §20 open
// question 4): copy must read as "disclosed on {brand}'s published factory
// list", never "approved by / works with". Text-only, no brand logos on
// marketing surfaces (logos.lock.md). Confirm final wording with legal
// before the beta launch surfaces this section publicly.

import { Kicker } from "@/components/marketing/home/kicker";
import { fetchDiscoverTotal } from "@/components/marketing/home/discover-count";

const BRANDS = [
  { code: "BRAND_HM", name: "H&M" },
  { code: "BRAND_NEXT", name: "Next" },
  { code: "BRAND_MS", name: "M&S" },
  { code: "BRAND_ASOS", name: "ASOS" },
] as const;

export async function BrandDisclosureStrip() {
  const counts = await Promise.all(
    BRANDS.map((b) => fetchDiscoverTotal({ p_brand_codes: [b.code] })),
  );

  const rows = BRANDS.map((b, i) => ({ ...b, count: counts[i] ?? null })).filter(
    (r) => r.count != null && r.count > 0,
  );

  if (rows.length === 0) return null;

  return (
    <section
      aria-label="Brand disclosures"
      className="border-b border-neutral-200 bg-white py-16 md:py-20"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <Kicker>Cross-checked</Kicker>
        <h2 className="mt-3 text-balance font-display text-2xl font-bold leading-tight tracking-tight text-neutral-900 md:text-3xl">
          Matched against published brand factory lists.
        </h2>
        <p className="mt-4 max-w-2xl text-body leading-relaxed text-neutral-600">
          Where a brand publishes its factory list, we match it against the
          index and attach the disclosure to the factory&apos;s profile.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rows.map((row) => (
            <div
              key={row.code}
              className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"
            >
              <p className="font-display text-lg font-bold text-neutral-900">
                {row.name}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-neutral-500">
                <span className="font-semibold tabular-nums text-neutral-700">
                  {row.count!.toLocaleString()}
                </span>{" "}
                factories disclosed on its published list
              </p>
            </div>
          ))}
        </div>

        <p className="mt-5 max-w-2xl text-[12px] leading-relaxed text-neutral-500">
          A disclosure on a brand&apos;s published factory list is reported
          as-is. It is not an endorsement by the brand, and not a SourceBD
          opinion.
        </p>
      </div>
    </section>
  );
}
