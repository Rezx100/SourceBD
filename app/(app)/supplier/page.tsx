import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";

// Supplier portal placeholder. The dashboard and editor land in Spec S1–S5.
// Crucially, per the α/β/γ decision (2026-05-20) the supplier-facing
// dashboard NEVER renders the SBI numeric — only receipts (registers, certs,
// RSC documents). This placeholder respects that contract today.
export default function SupplierHome() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Supplier
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Portal
        </h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Claim & profile</CardTitle>
          <CardMeta>Spec F2 shell</CardMeta>
        </CardHeader>
        <CardContent className="text-ink-secondary">
          Claim flow, profile editor, inquiries and RFQ inbox ship in Phase 3. Slots are
          reserved in the sidebar.
        </CardContent>
      </Card>
    </div>
  );
}
