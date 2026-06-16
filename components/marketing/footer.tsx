// Marketing footer — static light-mode design. Server component; no
// interactivity, no animation. Forest green (#1f4d3a) appears only on the
// shield glyph in the brand column.

import Link from "next/link";

import { Wordmark } from "@/components/marketing/logo";

const COLUMNS: {
  heading: string;
  links: { label: string; href: string }[];
}[] = [
  {
    heading: "PRODUCT",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Compliance", href: "/compliance" },
      { label: "How we verify", href: "/#how-we-verify" },
      { label: "Data sources", href: "/#sources" },
    ],
  },
  {
    heading: "REGULATIONS",
    links: [
      { label: "UK Modern Slavery Act", href: "/compliance#uk-msa" },
      { label: "US UFLPA", href: "/compliance#us-uflpa" },
      { label: "EU CBAM", href: "/compliance#eu-cbam" },
      { label: "EU CSDDD", href: "/compliance#eu-csddd" },
    ],
  },
  {
    heading: "LEGAL",
    links: [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Cookies", href: "/legal/cookies" },
      { label: "Data sources", href: "/legal/data-sources" },
      { label: "Trademarks", href: "/legal/trademarks" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-16 md:px-12 lg:px-20">
        {/* ── 4-column grid: Brand · Product · Regulations · Legal ── */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Column 1 — Brand */}
          <div>
            <Wordmark
              boxClassName="h-7 w-7"
              glyphClassName="h-4 w-4"
              textClassName="text-base"
            />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-500">
              A public-record index of Bangladesh&apos;s ready-made-garment
              sector. Every claim traceable to the authority that issued it.
            </p>
          </div>

          {/* Columns 2–4 — link groups */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {col.heading}
              </h5>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center">
          <span className="text-xs text-neutral-400">© 2026 SourceBD</span>
          <div className="flex items-center gap-6">
            <Link
              href="/#how-we-verify"
              className="text-xs text-neutral-400 transition-colors hover:text-neutral-600"
            >
              Provenance method
            </Link>
            <Link
              href="/status"
              className="text-xs text-neutral-400 transition-colors hover:text-neutral-600"
            >
              Status
            </Link>
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <p className="mt-6 text-center text-xs leading-relaxed text-neutral-400">
          SourceBD is a neutral public-record index — not a marketplace, broker,
          or rating agency. Authority logos identify data sources we aggregate
          from; SourceBD is not affiliated with or endorsed by BGMEA, BKMEA,
          BTMA, BGAPMEA, EPB, OEKO-TEX, WRAP, GOTS, RSC, or any brands named on
          this page.
        </p>
      </div>
    </footer>
  );
}
