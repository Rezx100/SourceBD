// /supplier/documents — placeholder until Spec S2 (Documents) ships.
// Server component. No data fetch. Mirrors the empty-state pattern used
// across other supplier surfaces.

import { FileText } from "@phosphor-icons/react/dist/ssr";

import { ButtonLink, Empty } from "@/components/kit";

export const dynamic = "force-static";

export const metadata = {
  title: "Documents · SourceBD",
};

export default function SupplierDocumentsPlaceholderPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Documents</h1>
        <p className="text-md text-ink-2">
          Upload factory licences, audit reports, insurance, and certification PDFs. Buyers will see verification badges on your profile once a SourceBD reviewer signs off.
        </p>
      </header>

      <Empty
        icon={FileText}
        title="You haven't uploaded any document yet."
        action={
          <ButtonLink href="/supplier/messages" kind="secondary">
            Contact review team
          </ButtonLink>
        }
      >
        Document uploads open soon. In the meantime, our review team can
        accept files over email.
      </Empty>
    </div>
  );
}
