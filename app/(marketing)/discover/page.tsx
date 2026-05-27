// Public Discover index — anonymous-safe.
//
// Spec F3 exit gate: "public Discover loads supplier data with contacts
// blurred." Contact PII (`email_primary`, `phones`, `contact_name`,
// `contact_role`) is *omitted from the SELECT*, not hidden in the DOM —
// server-side blurring per code-standards.md (server enforces auth/ownership,
// CSS is never a security boundary). `sbi_scores` is never selected from
// non-admin surfaces.

import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicSupplier = {
  id: string;
  slug: string;
  company_name: string;
  city: string | null;
  district: string | null;
  entity_type: string;
  source_tags: string[];
};

export default async function DiscoverPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, slug, company_name, city, district, entity_type, source_tags")
    .eq("is_published", true)
    .order("company_name", { ascending: true })
    .limit(24);

  const suppliers: PublicSupplier[] = (data ?? []) as PublicSupplier[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tightish text-ink-primary">Discover</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Verified Bangladesh garment factories & buying houses. Sign in to
          unlock contacts and full intelligence.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-sem-red">Could not load suppliers.</p>
      ) : suppliers.length === 0 ? (
        <p className="text-sm text-ink-secondary">No published suppliers yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <li key={s.id}>
              <Link
                href={`/suppliers/${s.slug}`}
                className="block transition hover:-translate-y-0.5"
              >
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>{s.company_name}</CardTitle>
                    <CardMeta>
                      {[s.city, s.district].filter(Boolean).join(", ") ||
                        "Bangladesh"}
                    </CardMeta>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 text-xs uppercase tracking-wide text-ink-tertiary">
                      {s.entity_type.replace(/_/g, " ")}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.source_tags.slice(0, 4).map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
