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
    <footer className="border-t border-hairline bg-surface-l1">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-12 lg:px-12">

        {/* ── 4-column grid: Brand · Product · Regulations · Legal ── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-4 md:gap-x-8">

          {/* Column 1 — Brand (full width on smallest phones) */}
          <div className="col-span-2 md:col-span-1">
            <Wordmark
              boxClassName="h-7 w-7"
              glyphClassName="h-4 w-4"
              textClassName="text-base"
            />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
              A public-record index of Bangladesh&apos;s ready-made-garment
              sector. Every claim traceable to the authority that issued it.
            </p>
          </div>

          {/* Columns 2–4 — link groups */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h5 className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400">
                {col.heading}
              </h5>
              <ul className="mt-3 space-y-2.5">
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
        <div className="mt-10 flex flex-col items-center gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-neutral-400">© 2026 SourceBD</span>
          <div className="flex items-center gap-5">
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
        <p className="mt-5 text-center text-[12px] leading-relaxed text-neutral-400">
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
