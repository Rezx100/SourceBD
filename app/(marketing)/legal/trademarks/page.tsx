// Spec M1 — Trademarks notice page. Public, indexable.
// The legal copy is the verbatim text from `context/logos.lock.md` §5
// rule #5 — do not paraphrase. The M1 smoke harness slices the same
// text out of `logos.lock.md` and asserts it appears here.

export const dynamic = "force-static";

export const metadata = {
  title: "Trademarks — SourceBD",
  description:
    "Third-party trademark notice for marks shown on SourceBD supplier profiles.",
  robots: { index: true, follow: true },
  alternates: {
    canonical:
      (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net") +
      "/legal/trademarks",
  },
};

export default function TrademarksPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl font-light tracking-tight text-ink-primary md:text-4xl">
          <span className="proto-wordmark text-3xl md:text-4xl">
            Trademarks
          </span>
        </h1>
      </header>
      <div className="proto-card">
      <p className="text-ink-secondary leading-relaxed">
        All third-party trademarks shown on supplier profiles belong to
        their respective owners and are used solely to identify the source
        of publicly available data. SourceBD is not affiliated with,
        endorsed by, or sponsored by any of these organisations.
      </p>
      </div>
    </main>
  );
}
