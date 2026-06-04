import { notFound } from "next/navigation";
import { getServerRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/tag";
import { Badge } from "@/components/ui/badge";
import { ReceiptsRing, type ReceiptsRingSize } from "@/components/receipts-ring";

export const dynamic = "force-dynamic";

// Dev-only component gallery. Hard-gated:
//   1. NODE_ENV !== 'production' (env gate).
//   2. Caller role === 'admin' (server-side; UI hiding is never security).
// Both checks must pass; otherwise the route returns 404.
export default async function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const role = await getServerRole();
  if (role !== "admin") notFound();

  const ringSizes: ReceiptsRingSize[] = [12, 24, 32, 48, 64];
  const ringCounts = [0, 1, 2, 3, 5, 7];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-12">
      <header>
        <p className="text-[11px] text-ink-tertiary">
          Dev only · Spec F1
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tightish text-ink-primary">
          SourceBD design system
        </h1>
        <p className="mt-2 text-ink-secondary">
          Base components and the Receipts Ring trust glyph. Centre payload is the count
          of distinct Tier 1–3 sources — never the SBI numeric.
        </p>
      </header>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink-primary">Buttons</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink-primary">Tags</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Tag>Buying house</Tag>
          <Tag tone="muted">Unclaimed</Tag>
          <Tag tone="green">Claim verified</Tag>
          <Tag tone="amber">Stale</Tag>
          <Tag tone="red">Sanctions hit</Tag>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink-primary">Badges</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge>10,121</Badge>
          <Badge tone="active">12</Badge>
          <Badge tone="alert">3 new</Badge>
          <Badge tone="success">Clear</Badge>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink-primary">Card</h2>
        <Card className="mt-3 max-w-xl">
          <CardHeader>
            <CardTitle>Registries</CardTitle>
            <CardMeta>Re-checked 4h ago</CardMeta>
          </CardHeader>
          <CardContent className="text-ink-secondary">
            Cards are the primary L1 surface. Inner content uses 16/20 px padding; the
            header uses the mono section-label rhythm locked in §21.2.
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink-primary">Tabs</h2>
        <Tabs defaultValue="overview" className="mt-3 max-w-2xl">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-ink-secondary">
            Overview panel. Tabs follow the §21 spec — indigo underline (interaction
            only), 160ms fade per the motion budget.
          </TabsContent>
          <TabsContent value="compliance" className="text-ink-secondary">
            Compliance panel placeholder.
          </TabsContent>
          <TabsContent value="media" className="text-ink-secondary">
            Media panel placeholder.
          </TabsContent>
          <TabsContent value="contact" className="text-ink-secondary">
            Contact panel — PII gated server-side in B2.
          </TabsContent>
        </Tabs>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink-primary">
          Receipts Ring
        </h2>
        <p className="mt-1 text-ink-secondary">
          Centre payload = count of distinct Tier 1–3 sources, saturated at 5+. Colour
          ladder: 0 dark red · 1 red · 2 amber · 3+ green. Never the SBI numeric, a
          pillar value, or an A/B/C/D grade.
        </p>

        <div className="mt-4 space-y-6">
          {ringCounts.map((n) => (
            <div key={n} className="flex items-center gap-6">
              <span className="w-28 font-mono text-[12px] text-ink-tertiary">
                {n} {n === 1 ? "source" : "sources"}
              </span>
              <div className="flex items-end gap-5">
                {ringSizes.map((size) => (
                  <div key={size} className="flex flex-col items-center gap-1">
                    <ReceiptsRing sources={n} size={size} />
                    <span className="font-mono text-[10px] text-ink-tertiary">
                      {size}px
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
