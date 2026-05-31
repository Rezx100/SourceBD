// Public supplier profile — anonymous-safe.
//
// Contacts (`email_primary`, `phones`, `contact_name`, `contact_role`) are
// omitted at the SELECT level. The "Contacts" card renders a server-rendered
// blurred placeholder + sign-in CTA so the gate cannot be bypassed by the
// client. `sbi_scores` is never selected here.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { ClaimCtaButton } from "@/components/claim-cta-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

type PublicSupplier = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  country: string;
  website: string | null;
  source_tags: string[];
  bgmea_verified: boolean;
  bkmea_verified: boolean;
  bgapmea_verified: boolean;
  btma_verified: boolean;
  claimed_by: string | null;
  is_sanctioned: boolean;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("suppliers")
      .select("company_name, city, district, country")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!data) return { title: "Supplier — SourceBD" };
    const row = data as Pick<PublicSupplier, "company_name" | "city" | "district" | "country">;
    const loc = [row.city, row.district, row.country].filter(Boolean).join(", ");
    const title = `${row.company_name} — Bangladesh RMG supplier on SourceBD`;
    const description = loc
      ? `${row.company_name}, ${loc}. Verified registers, certifications, and source receipts on SourceBD.`
      : `${row.company_name}. Verified registers, certifications, and source receipts on SourceBD.`;
    return {
      title,
      description,
      robots: { index: true, follow: true },
      alternates: { canonical: `${SITE_URL}/suppliers/${slug}` },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/suppliers/${slug}`,
        type: "profile",
      },
    };
  } catch {
    return { title: "Supplier — SourceBD" };
  }
}

export default async function SupplierProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select(
      "id, slug, company_name, entity_type, city, district, country, website, source_tags, bgmea_verified, bkmea_verified, bgapmea_verified, btma_verified, claimed_by, is_sanctioned",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) notFound();
  const s = data as PublicSupplier;

  const verifications = [
    s.bgmea_verified && "BGMEA",
    s.bkmea_verified && "BKMEA",
    s.bgapmea_verified && "BGAPMEA",
    s.btma_verified && "BTMA",
  ].filter(Boolean) as string[];

  // M4 — JSON-LD. LocalBusiness when city or district present
  // (postal locality is meaningful), else Organization. Only fields
  // already in the page's SELECT (no contact PII) per spec M4 JC #8.
  const hasLocality = !!(s.city || s.district);
  const ldType = hasLocality ? "LocalBusiness" : "Organization";
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ldType,
    name: s.company_name,
    url: `${SITE_URL}/suppliers/${s.slug}`,
  };
  if (s.website) ld.sameAs = [s.website];
  if (hasLocality || s.country) {
    ld.address = {
      "@type": "PostalAddress",
      ...(s.city ? { addressLocality: s.city } : {}),
      ...(s.district ? { addressRegion: s.district } : {}),
      ...(s.country ? { addressCountry: s.country } : {}),
    };
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <header className="mb-8">
        <Link
          href="/discover"
          className="text-xs uppercase tracking-wide text-ink-tertiary hover:text-ink-primary"
        >
          ← Discover
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tightish text-ink-primary">
          {s.company_name}
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {s.entity_type.replace(/_/g, " ")} ·{" "}
          {[s.city, s.district, s.country].filter(Boolean).join(", ")}
        </p>
        {s.claimed_by === null && !s.is_sanctioned ? (
          <div className="mt-4">
            <ClaimCtaButton slug={s.slug} />
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardMeta>Trust hierarchy</CardMeta>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {s.source_tags.length === 0 ? (
                <span className="text-xs text-ink-tertiary">No tags.</span>
              ) : (
                s.source_tags.map((t) => <Tag key={t}>{t}</Tag>)
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verifications</CardTitle>
            <CardMeta>Membership / trade bodies</CardMeta>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {verifications.length === 0 ? (
                <span className="text-xs text-ink-tertiary">
                  None recorded.
                </span>
              ) : (
                verifications.map((v) => <Tag key={v}>{v}</Tag>)
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardMeta>Sign in to unlock</CardMeta>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="select-none rounded-input bg-surface-l2 px-3 py-2 text-sm text-transparent [text-shadow:0_0_8px_rgba(0,0,0,0.5)]">
                contact@example.com
              </div>
              <div className="select-none rounded-input bg-surface-l2 px-3 py-2 text-sm text-transparent [text-shadow:0_0_8px_rgba(0,0,0,0.5)]">
                +880 ●●●● ●●●● ●●
              </div>
            </div>
            <p className="text-xs text-ink-secondary">
              Contact details are reserved for verified buyers.
            </p>
            <Link href={`/login?next=/suppliers/${s.slug}`}>
              <Button variant="primary">Sign in to view contacts</Button>
            </Link>
          </CardContent>
        </Card>

        {s.website ? (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Website</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={s.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sm text-accent-indigo hover:underline"
              >
                {s.website}
              </a>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
