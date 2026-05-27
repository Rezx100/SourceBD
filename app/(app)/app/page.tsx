import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";

// Buyer dashboard placeholder. Real content arrives in Spec B5 (saved
// suppliers + recent activity). For F2, surface only that the shell renders.
export default function BuyerHome() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Buyer
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Dashboard
        </h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardMeta>Spec F2 shell</CardMeta>
        </CardHeader>
        <CardContent className="text-ink-secondary">
          Discover, Smart Match, Saved, Messages, RFQ Manager, Orders, Compliance Hub and
          Settings each ship in their own Phase-2 spec. The sidebar reserves their slots.
        </CardContent>
      </Card>
    </div>
  );
}
