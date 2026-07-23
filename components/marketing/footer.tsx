// Marketing footer — shared chrome for every (marketing) page.
//
// Light scenic treatment (founder-approved on the homepage): link registers
// on a cool forest-tinted band, then a full-bleed flat-vector illustration
// of the Bangladesh RMG industrial skyline (port cranes, sawtooth garment
// factory rooflines, water tanks, container yard) — every element a shade
// of the brand forest green. An oversized "SourceBD" wordmark sits in the
// illustration's sky; it renders with `mix-blend-mode: darken` so the darker
// skyline layers naturally occlude the letterforms while the flat #F4F7F5
// sky (sampled from the artwork, also the band background) lets them read.
//
// Server component; no interactivity, no animation. Mounted globally by
// app/(marketing)/layout.tsx.

import Link from "next/link";

/** Flat sky color sampled from public/marketing/footer-rmg-skyline.png —
 *  a whisper of brand forest over white, same family as the homepage's
 *  rgba(31,77,58,0.06) washes. */
const SKY = "#F4F7F5";

type FooterLink =
  | { label: string; href: string; soon?: false }
  | { label: string; soon: true };

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Platform",
    links: [
      { label: "Supplier index", href: "/discover" },
      { label: "How we verify", href: "/#how-we-verify" },
      { label: "Data sources", href: "/#sources" },
      { label: "Pricing", href: "/pricing" },
      { label: "Claim your profile", href: "/supplier/claim" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    heading: "Compliance",
    links: [
      { label: "Compliance hub", href: "/compliance" },
      { label: "UK Modern Slavery Act", href: "/compliance/uk-msa" },
      { label: "US UFLPA", href: "/compliance/uflpa" },
      { label: "EU CBAM", href: "/compliance/eu-cbam" },
      { label: "EU EUDR", href: "/compliance/eu-eudr" },
      { label: "EU CSDDD", href: "/compliance/eu-csddd" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Platform status", href: "/status" },
      { label: "About", soon: true },
      { label: "Contact", soon: true },
      { label: "Careers", soon: true },
      { label: "Changelog", soon: true },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Cookies", href: "/legal/cookies" },
      { label: "Data sources", href: "/legal/data-sources" },
      { label: "Trademarks", href: "/legal/trademarks" },
    ],
  },
];

/** Mono micro-label with a forest corner mark — the homepage's column-label
 *  idiom, on light ground. */
function RegisterLabel({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-[5px] shrink-0 rounded-[1px] bg-brand-forest/60"
      />
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">
        {children}
      </span>
    </p>
  );
}

export function MarketingFooter() {
  return (
    <footer
      className="relative overflow-hidden border-t border-neutral-200 text-neutral-900"
      style={{ backgroundColor: SKY }}
    >
      {/* ── Registers: brand + four link columns ── */}
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 pb-12 pt-14 sm:pt-16 md:grid-cols-4 md:gap-x-8 lg:grid-cols-[1.5fr_1fr_1.15fr_1fr_0.85fr] lg:gap-x-10 lg:pb-14 lg:pt-20">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 font-brand text-lg font-medium leading-none tracking-[-0.035em] !text-neutral-950"
            >
              <span className="flex h-8 w-8 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/brand/sourcebd-logo.png"
                  alt=""
                  aria-hidden
                  className="block h-full w-full object-contain"
                />
              </span>
              <span className="inline-flex items-center leading-none">
                SOURCE
                <span className="ml-0.5 font-semibold tracking-[-0.08em]">
                  BD
                </span>
              </span>
            </Link>

            <p className="mt-4 max-w-[300px] text-[13.5px] leading-relaxed text-neutral-600">
              The public-record index of Bangladesh&apos;s ready-made-garment
              sector. Every claim traceable to the authority that issued it.
            </p>

            <p className="mt-6 text-[12px] font-medium leading-relaxed text-neutral-500">
              31 official sources · Refreshed weekly
            </p>
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-500">
              Built for UK · US · EU · CA sourcing teams
            </p>
          </div>

          {/* Link registers */}
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <RegisterLabel>{col.heading}</RegisterLabel>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {"href" in l ? (
                      <Link
                        href={l.href}
                        className="text-[13.5px] leading-snug !text-neutral-600 transition-colors hover:!text-neutral-950"
                      >
                        {l.label}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-[13.5px] leading-snug text-neutral-400">
                        {l.label}
                        <span className="rounded-full border border-neutral-300 px-1.5 py-[2px] font-mono text-[8px] font-medium uppercase leading-none tracking-[0.14em] text-neutral-400">
                          Soon
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Neutrality disclaimer + bottom row — wording unchanged (legal copy).
            Centered in the footer; a whisper register: tiny, tinted toward
            the band's own green-gray, with a hairline white letterpress
            shadow for a little depth without contrast. ── */}
        <div className="border-t border-neutral-900/[0.08] py-5">
          <p
            className="mx-auto max-w-[720px] text-balance text-center text-[10px] leading-[1.7] text-[#9CAFA3] [text-shadow:0_1px_0_rgba(255,255,255,0.85)]"
          >
            SourceBD is a neutral public-record index — not a marketplace,
            broker, or rating agency. Authority logos identify data sources we
            aggregate from; SourceBD is not affiliated with or endorsed by
            BGMEA, BKMEA, BTMA, BGAPMEA, EPB, OEKO-TEX, WRAP, GOTS, RSC, or any
            brands named on this page.
          </p>
          <div className="mt-4 flex flex-col gap-2 text-[12px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 SourceBD. All rights reserved.</span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link
                href="/#how-we-verify"
                className="!text-neutral-500 transition-colors hover:!text-neutral-900"
              >
                Provenance method
              </Link>
              <Link
                href="/status"
                className="!text-neutral-500 transition-colors hover:!text-neutral-900"
              >
                Status
              </Link>
              <Link
                href="/legal/data-sources"
                className="!text-neutral-500 transition-colors hover:!text-neutral-900"
              >
                Source register
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scenic close: watermark in the sky, skyline bleeding off the
          bottom edge. The band background equals the artwork's flat sky, so
          the two read as one continuous surface; a soft fade at the crop's
          top edge removes any residual seam. ── */}
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marketing/footer-rmg-skyline.png"
          alt=""
          aria-hidden
          className="block aspect-[2/1] w-full object-cover object-bottom sm:aspect-[2.4/1] md:aspect-[3/1]"
        />
        {/* Seam guard — melts the crop's top edge into the band. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[18%]"
          style={{
            backgroundImage: `linear-gradient(to bottom, ${SKY}, transparent)`,
          }}
        />
        {/* Oversized wordmark — darker than the sky, lighter than the deep
            skyline layers, so `darken` shows it against sky and lets the
            factories, cranes and trees occlude the letterforms. It straddles
            the band/artwork seam; both share the same flat sky color, so the
            seam is invisible. */}
        <p
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-[0.08em] select-none whitespace-nowrap text-center font-display text-[clamp(60px,14.5vw,212px)] font-extrabold leading-none tracking-[-0.045em] text-[#E1E9E3] [mix-blend-mode:darken]"
        >
          SourceBD
        </p>
      </div>
    </footer>
  );
}
