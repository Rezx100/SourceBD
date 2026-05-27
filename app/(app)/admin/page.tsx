import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";

// Admin overview placeholder. Real dashboards (A1–A6) land in Phase 4.
// Admin is the ONLY surface where the SBI numeric may eventually appear, per
// `frontend-design-spec.md` §2.3 — this placeholder doesn't render one yet.
export default function AdminHome() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Admin
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Overview
        </h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Console</CardTitle>
          <CardMeta>Spec F2 shell</CardMeta>
        </CardHeader>
        <CardContent className="text-ink-secondary">
          Supplier queue, claim verification, sources & ingestion, scoring debug and user
          access ship in Phase-4 specs A1–A6.
        </CardContent>
      </Card>
    </div>
  );
}
