// /supplier/documents — placeholder until Spec S2 (Documents) ships.
// Server component. No data fetch. Mirrors the empty-state pattern used
// across other supplier surfaces.

import Link from "next/link";
import { FileText } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-static";

export const metadata = {
  title: "Documents · SourceBD",
};

export default function SupplierDocumentsPlaceholderPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-tertiary">
          Supplier · documents
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Documents
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink-secondary">
          Upload factory licences, audit reports, insurance, and certification
          PDFs. Buyers will see verification badges on your profile once a
          SourceBD reviewer signs off.
        </p>
      </header>

      <section className="rounded-card border border-hairline bg-surface-l1 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-hairline-strong bg-bg-l0 text-ink-tertiary">
          <FileText size={22} weight="regular" aria-hidden />
        </div>
        <p className="mt-4 text-sm font-medium text-ink-primary">
          You haven&apos;t uploaded any document yet.
        </p>
        <p className="mt-2 text-xs text-ink-tertiary">
          Document uploads open soon. In the meantime, our review team can
          accept files over email.
        </p>
        <Link
          href="/supplier/messages"
          className="mt-5 inline-flex items-center gap-2 rounded-input border border-hairline-strong bg-bg-l0 px-3 py-1.5 text-xs font-medium text-ink-primary transition-colors hover:bg-brand-forest-tint"
        >
          Contact review team
        </Link>
      </section>
    </div>
  );
}
