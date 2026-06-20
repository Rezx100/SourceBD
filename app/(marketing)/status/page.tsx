// Phase 7 P2 — Public status page (marketing route group).

import Link from "next/link";

import { BlurFade } from "@/components/ui/blur-fade";
import { PageHeader, Panel } from "@/components/ui/page-kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const metadata = {
  title: "Platform status — SourceBD",
  description:
    "Live freshness signals for the SourceBD verified supplier index — data refresh, compliance mirrors, and sanctions screening.",
  alternates: { canonical: `${SITE_URL}/status` },
};

type StatusDoc = {
  published_suppliers: number;
  last_source_refresh: string | null;
  last_compliance_mirror: string | null;
  last_sanctions_screen: string | null;
  last_etl_success: string | null;
  etl_recent: Array<{
    scraper_code: string;
    finished_at: string | null;
    status: string;
  }>;
  generated_at: string;
};

function fmt(ts: string | null): string {
  if (!ts) return "No timestamp on file";
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function freshnessTone(ts: string | null): "green" | "amber" | "red" {
  if (!ts) return "red";
  const ageMs = Date.now() - new Date(ts).getTime();
  const days = ageMs / (1000 * 60 * 60 * 24);
  if (days <= 7) return "green";
  if (days <= 30) return "amber";
  return "red";
}

const TONE_CLASS = {
  green: "text-sem-green",
  amber: "text-sem-amber",
  red: "text-sem-red",
} as const;

export default async function StatusPage() {
  let doc: StatusDoc | null = null;
  let error: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error: rpcError } = await supabase.rpc("public_status");
    if (rpcError || !data) {
      error = rpcError?.message ?? "Status unavailable";
    } else {
      doc = data as StatusDoc;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Status unavailable";
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <BlurFade delay={0.1}>
        <PageHeader
          kicker="Platform status"
          title="SourceBD live index"
          description="Public freshness signals for the verified supplier database. This page shows when registers, compliance mirrors, and sanctions screening were last refreshed — not internal scores or proprietary opinions."
          animate={false}
        />
      </BlurFade>

      <BlurFade delay={0.2}>
      {error ? (
        <Panel className="mt-8 border-sem-amber/30 bg-sem-amber-soft/30">
          <p className="text-sm text-sem-amber">
            Could not load status signals: {error}
          </p>
          <p className="mt-2 text-sm text-ink-secondary">
            The marketing homepage counter may still be available. If this
            persists, contact{" "}
            <a href="mailto:support@sourcebd.net" className="text-brand-forest underline">
              support@sourcebd.net
            </a>
            .
          </p>
        </Panel>
      ) : doc ? (
        <div className="mt-8 space-y-4">
          <Panel>
            <dl className="m-0 grid gap-4 sm:grid-cols-2">
              <Stat
                label="Published suppliers"
                value={doc.published_suppliers.toLocaleString("en-US")}
                tone="green"
              />
              <Stat
                label="Source register refresh"
                value={fmt(doc.last_source_refresh)}
                tone={freshnessTone(doc.last_source_refresh)}
              />
              <Stat
                label="Compliance document mirror"
                value={fmt(doc.last_compliance_mirror)}
                tone={freshnessTone(doc.last_compliance_mirror)}
              />
              <Stat
                label="Sanctions screening pass"
                value={fmt(doc.last_sanctions_screen)}
                tone={freshnessTone(doc.last_sanctions_screen)}
              />
              <Stat
                label="Last successful ETL run"
                value={fmt(doc.last_etl_success)}
                tone={freshnessTone(doc.last_etl_success)}
              />
            </dl>
            <p className="mt-4 font-mono text-[11px] text-ink-tertiary">
              Generated {fmt(doc.generated_at)}
            </p>
          </Panel>

          {doc.etl_recent.length > 0 ? (
            <Panel padded={false}>
              <div className="border-b border-neutral-200 px-5 py-4">
                <h2 className="font-display text-base font-semibold text-ink-primary">
                  Recent pipeline runs
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-secondary">
                  Latest finished run per scraper (newest first within each job family).
                </p>
              </div>
              <ul className="m-0 divide-y divide-neutral-200 p-0">
                {doc.etl_recent.map((row) => (
                  <li
                    key={row.scraper_code}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <span className="font-mono text-[12px] text-ink-secondary">
                      {row.scraper_code}
                    </span>
                    <span className="text-ink-tertiary">{row.status}</span>
                    <span className="font-mono text-[11px] text-ink-tertiary">
                      {fmt(row.finished_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      ) : null}
      </BlurFade>

      <p className="mt-10 text-center text-sm text-ink-secondary">
        <Link href="/discover" className="text-brand-forest underline-offset-2 hover:underline">
          Browse the public index
        </Link>
        {" · "}
        <Link href="/" className="text-brand-forest underline-offset-2 hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red";
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">
        {label}
      </dt>
      <dd className={`mt-1 font-mono text-[13px] ${TONE_CLASS[tone]}`}>{value}</dd>
    </div>
  );
}
