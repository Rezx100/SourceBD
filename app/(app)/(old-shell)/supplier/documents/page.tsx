// /supplier/documents — placeholder until Spec S2 (Documents) ships.
// Server component. No data fetch. Mirrors the empty-state pattern used
// across other supplier surfaces.

import Link from "next/link";
import { FileText } from "@phosphor-icons/react/dist/ssr";

import { PageHeader } from "@/components/ui/page-kit";

export const dynamic = "force-static";

export const metadata = {
  title: "Documents · SourceBD",
};

export default function SupplierDocumentsPlaceholderPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        kicker="Supplier"
        title="Documents"
        description="Upload factory licences, audit reports, insurance, and certification PDFs. Buyers will see verification badges on your profile once a SourceBD reviewer signs off."
      />

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
