// Compliance pieces of the dashboard kit (Spec B9): the certificate-expiry and
// UFLPA tables, their status marks and the expiry buckets, shared by the hub
// and its three sub-pages. Server components; the RPC shapes are the ones
// `supabase/migrations/0030_compliance_hub.sql` returns.
//
// Badge tones: a UFLPA Entity List hit is a sanction match and takes the
// reserved `sanction` tone — the only place on these pages that uses it.

import Link from "next/link";
import type { ReactNode } from "react";
import { formatCount, formatDay } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "./chips";
import { Button } from "./controls";
import { Icon } from "./icons";
import { Cell, DataTable, HeadCell, rowClass } from "./page";
import { Caption, Code } from "./type";

export type CertRow = {
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  expires_on: string;
  document_url: string | null;
  days_remaining: number;
  supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
    city: string | null;
    district: string | null;
  };
};

export type ExpiryPayload = {
  window_days: number;
  bucket_30: number;
  bucket_60: number;
  bucket_90: number;
  total: number;
  rows: CertRow[];
};

export type UflpaHit = {
  matched_name: string | null;
  list_entry_ref: string | null;
  screened_at: string | null;
  source_url: string | null;
  listed_date: string | null;
  entity_name: string | null;
  aliases: string[] | null;
};

export type UflpaStatus = "hit" | "region_flag" | "clear";

export type UflpaRow = {
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  country: string | null;
  parent_group_name: string | null;
  saved_at: string;
  uflpa_hits: UflpaHit[];
  status: UflpaStatus;
};

export type UflpaPayload = {
  total: number;
  hits: number;
  flags: number;
  clear: number;
  rows: UflpaRow[];
};

const CERT_LABELS: Record<string, string> = {
  wrap: "WRAP",
  oeko_tex: "OEKO-TEX",
  gots: "GOTS",
  sa8000: "SA8000",
  bsci: "BSCI",
  ocs: "OCS",
  grs: "GRS",
  rcs: "RCS",
  sedex: "Sedex",
  higg: "Higg",
  fairtrade: "Fairtrade",
};

export function prettyCert(kind: string): string {
  return CERT_LABELS[kind] ?? kind.toUpperCase();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/**
 * How long a certificate has left, in words: "in 11 days", or "today".
 * Caution inside 30 days, a plain fact after that. The RPC never returns an
 * expired one; a negative count (a date read on a later day) says "today"
 * rather than inventing a past it does not know about.
 */
export function expiryBadge(days: number): { tone: "caution" | "quiet"; text: string } {
  const text = days <= 0 ? "today" : `in ${plural(days, "day")}`;
  return { tone: days < 30 ? "caution" : "quiet", text };
}

/**
 * Days left on a certificate, drawn one way wherever it appears: the hub's
 * tables and Home's alerts both print it after the date, in caution ink when
 * the renewal is close. A badge here repeated the sentence beside it.
 */
export function ExpiryBadge({ days }: { days: number }) {
  const { tone, text } = expiryBadge(days);
  return (
    <span className={cn("whitespace-nowrap tabular-nums", tone === "caution" ? "font-medium text-caution-ink" : "text-ink-muted")}>{text}</span>
  );
}

/** The three expiry buckets as inline stats, under the section title. */
export function ExpiryStats({ payload }: { payload: Pick<ExpiryPayload, "bucket_30" | "bucket_60" | "bucket_90"> }) {
  const stats = [
    { n: payload.bucket_30, label: "within 30 days" },
    { n: payload.bucket_60, label: "in 30–60 days" },
    { n: payload.bucket_90, label: "in 60–90 days" },
  ];
  return (
    <ul aria-label="Certificates expiring" className="m-0 flex list-none flex-wrap gap-x-8 gap-y-2 p-0">
      {stats.map((s) => (
        <li key={s.label} className="flex items-baseline gap-1.5">
          <span className={cn("text-xl font-semibold tabular-nums", s.label === "within 30 days" && s.n > 0 ? "text-caution-ink" : "text-ink-strong")}>
            {formatCount(s.n)}
          </span>
          <span className="text-sm text-ink-muted">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

export const UFLPA_STATUS: Record<UflpaStatus, { tone: BadgeTone; text: string }> = {
  hit: { tone: "sanction", text: "Entity List hit" },
  region_flag: { tone: "caution", text: "Region flag" },
  clear: { tone: "positive", text: "Clear" },
};

export function UflpaStatusBadge({ status }: { status: UflpaStatus }) {
  const s = UFLPA_STATUS[status] ?? UFLPA_STATUS.clear;
  return <Badge tone={s.tone}>{s.text}</Badge>;
}

/** The terms `compliance_uflpa_tracker` flags a record for (its `~*` test, case-insensitive). */
const REGION_TERMS = /(xinjiang|uyghur|uighur|xuar)/i;

/**
 * Which field carried a region flag's term, when the row says. The RPC scans
 * the parent group, the address, the city and the district, and returns all
 * but the address: a term found in one of the three is named; otherwise it was
 * the address, which the page cannot show, and the evidence says only "text in
 * the record". Never a snippet the RPC did not return.
 */
export function regionFlagField(r: Pick<UflpaRow, "parent_group_name" | "city" | "district">): string | null {
  if (r.parent_group_name && REGION_TERMS.test(r.parent_group_name)) return "the parent group";
  if (r.city && REGION_TERMS.test(r.city)) return "the city";
  if (r.district && REGION_TERMS.test(r.district)) return "the district";
  return null;
}

/** The way back to the hub from a sub-page, in the header's action slot. */
export function BackToHub() {
  return (
    <Button variant="ghost" href="/app/compliance" clientNav>
      <Icon name="chev-l" />
      Compliance hub
    </Button>
  );
}

function SupplierLink({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <Link
      href={`/app/suppliers/${slug}`}
      prefetch={false}
      className="font-medium text-ink-strong [overflow-wrap:anywhere] hover:text-brand-ink hover:underline"
    >
      {children}
    </Link>
  );
}

/** "1–12 of 12" under a table. */
export function TableFooter({ shown, total }: { shown: number; total: number }) {
  return (
    <div className="px-4 py-2.5">
      <Caption className="tabular-nums">
        {shown === 0 ? "0" : `1–${formatCount(shown)}`} of {formatCount(total)}
      </Caption>
    </div>
  );
}

/** Certificates soonest first (the RPC's order). `compact` drops the number and document columns, for the hub. */
export function ExpiryTable({ rows, compact = false }: { rows: readonly CertRow[]; compact?: boolean }) {
  return (
    <DataTable label="Certificates expiring" minWidth={compact ? "34rem" : "50rem"}>
      <thead>
        <tr>
          <HeadCell>Supplier</HeadCell>
          <HeadCell>Certificate</HeadCell>
          {compact ? null : <HeadCell>Number</HeadCell>}
          <HeadCell>Expires</HeadCell>
          {compact ? null : <HeadCell align="right">Document</HeadCell>}
        </tr>
      </thead>
      <tbody className="[&>tr:last-child>*]:border-b-0">
        {rows.map((r) => {
          const place = [r.supplier.city, r.supplier.district].filter(Boolean).join(", ");
          return (
            <tr key={`${r.supplier.id}-${r.kind}-${r.certificate_no ?? r.expires_on}`} className={rowClass()}>
              <Cell className="py-2">
                <div className="flex min-w-0 flex-col">
                  <SupplierLink slug={r.supplier.slug}>{r.supplier.company_name}</SupplierLink>
                  {compact ? null : <Caption>{place || "Location not listed"}</Caption>}
                </div>
              </Cell>
              <Cell className="py-2">
                <div className="flex flex-col">
                  <span className="font-medium">{prettyCert(r.kind)}</span>
                  {compact ? null : <Caption>Issued by {r.issuer ?? prettyCert(r.kind)}</Caption>}
                </div>
              </Cell>
              {compact ? null : <Cell>{r.certificate_no ? <Code>{r.certificate_no}</Code> : <Caption>Not listed</Caption>}</Cell>}
              <Cell className="whitespace-nowrap">
                <span className="tabular-nums">{formatDay(r.expires_on) ?? r.expires_on}</span>{" "}
                <ExpiryBadge days={r.days_remaining} />
              </Cell>
              {compact ? null : (
                <Cell className="text-right">
                  {r.document_url ? (
                    <a
                      href={r.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-brand-ink hover:underline"
                    >
                      Open document
                      <Icon name="external" small />
                    </a>
                  ) : (
                    <Caption>No document</Caption>
                  )}
                </Cell>
              )}
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

function titleCase(s: string): string {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function UflpaTable({ rows }: { rows: readonly UflpaRow[] }) {
  return (
    <DataTable label="UFLPA tracker" minWidth="56rem">
      <thead>
        <tr>
          <HeadCell>Supplier</HeadCell>
          <HeadCell>Location</HeadCell>
          <HeadCell>Parent group</HeadCell>
          <HeadCell>Status</HeadCell>
          <HeadCell>Evidence</HeadCell>
        </tr>
      </thead>
      <tbody className="[&>tr:last-child>*]:border-b-0">
        {rows.map((r) => {
          const field = r.status === "region_flag" ? regionFlagField(r) : null;
          return (
            <tr key={r.supplier_id} className={rowClass()}>
              <Cell className="py-2">
                <div className="flex min-w-0 flex-col">
                  <SupplierLink slug={r.supplier_slug}>{r.company_name}</SupplierLink>
                  <Caption>{titleCase(r.entity_type)}</Caption>
                </div>
              </Cell>
              <Cell className="text-ink-muted">{[r.city, r.district, r.country].filter(Boolean).join(", ") || "—"}</Cell>
              <Cell className="text-ink-muted [overflow-wrap:anywhere]">{r.parent_group_name ?? "—"}</Cell>
              <Cell>
                <UflpaStatusBadge status={r.status} />
              </Cell>
              <Cell className="py-2">
                {r.uflpa_hits.length === 0 ? (
                  <Caption>
                    {r.status === "region_flag"
                      ? field
                        ? `Xinjiang-linked term in ${field}`
                        : "Xinjiang-linked text in the record"
                      : "No active UFLPA matches"}
                  </Caption>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                    {r.uflpa_hits.map((h, i) => (
                      <li key={`${h.list_entry_ref ?? "x"}-${i}`} className="[overflow-wrap:anywhere]">
                        <span className="font-medium text-ink-strong">{h.matched_name ?? h.entity_name ?? "Match"}</span>
                        {h.list_entry_ref ? <Code className="ml-1 text-ink-subtle">[{h.list_entry_ref}]</Code> : null}
                        {h.source_url ? (
                          <>
                            {" · "}
                            <a href={h.source_url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-ink hover:underline">
                              DHS entry
                            </a>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Cell>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
