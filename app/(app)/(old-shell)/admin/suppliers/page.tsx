// Admin supplier list (Spec A2). Calls `public.admin_supplier_list` with
// filters driven from URL search params. Admin-only; middleware gates
// `/admin/*` and the RPC re-checks role inside its body.

import Link from "next/link";

import {
  AdminColumn,
  AdminHead,
  AdminSection,
  StatusChip,
  adminFieldClass,
  formatAdminDate,
  humanizeAdminToken,
} from "@/components/admin/data-ui";
import {
  Button,
  ButtonLink,
  Empty,
  Field,
  InlineError,
  Pagination,
  Table,
  TableFrame,
  TableScroll,
  Td,
  Th,
  Tr,
  TypeChip,
  rowLinkClass,
} from "@/components/kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  company_name: string;
  name_display: string | null;
  entity_type: string;
  published: boolean;
  claimed_by: string | null;
  sanctioned_flag: boolean;
  city: string | null;
  district: string | null;
  tier_coverage: number;
  sbi_total: number | null;
  updated_at: string | null;
  has_pending_rescore: boolean;
};

type Doc = { total: number; rows: Row[] };

const PAGE_SIZE = 50;

function asBool(v: string | undefined | null): boolean | null {
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return null;
}

function asInt(v: string | undefined | null): number | null {
  if (v == null || v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const search = (get("q") ?? "").trim();
  const entity = get("entity") ?? "";
  const published = asBool(get("published"));
  const claimed = asBool(get("claimed"));
  const sanctioned = asBool(get("sanctioned"));
  const tierMin = asInt(get("tier_min"));
  const page = Math.max(1, asInt(get("page")) ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_supplier_list", {
    p_search: search || null,
    p_entity_type: entity || null,
    p_published: published,
    p_claimed: claimed,
    p_sanctioned: sanctioned,
    p_tier_min: tierMin,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  if (error || data == null) {
    return (
      <AdminColumn>
        <SupplierHeader />
        <InlineError>
          Could not load suppliers
          {error?.message ? <>: {error.message}</> : null}.
        </InlineError>
      </AdminColumn>
    );
  }

  const doc = data as Doc;
  const totalPages = Math.max(1, Math.ceil(doc.total / PAGE_SIZE));

  // Preserve filters on pagination links.
  const baseQuery = new URLSearchParams();
  if (search) baseQuery.set("q", search);
  if (entity) baseQuery.set("entity", entity);
  if (published !== null) baseQuery.set("published", String(published));
  if (claimed !== null) baseQuery.set("claimed", String(claimed));
  if (sanctioned !== null) baseQuery.set("sanctioned", String(sanctioned));
  if (tierMin !== null) baseQuery.set("tier_min", String(tierMin));
  const pageHref = (n: number) => {
    const q = new URLSearchParams(baseQuery);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/admin/suppliers?${s}` : "/admin/suppliers";
  };

  return (
    <AdminColumn>
      <SupplierHeader total={doc.total} />

      <AdminSection
        title="Find suppliers"
        description="Search the verified index, jump to common work queues, or narrow by publication and evidence status."
        actions={<ButtonLink href="/admin/suppliers/import">Bulk import</ButtonLink>}
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <ButtonLink href="/admin/queue" className="shrink-0">Needs review</ButtonLink>
            <ButtonLink href="/admin/suppliers?published=false&tier_min=1" className="shrink-0">Ready to publish</ButtonLink>
            <ButtonLink href="/admin/suppliers?published=true" className="shrink-0">Visible to buyers</ButtonLink>
            <ButtonLink href="/admin/suppliers?published=false" className="shrink-0">Not visible</ButtonLink>
            <ButtonLink href="/admin/suppliers?sanctioned=true" className="shrink-0">Sanction flagged</ButtonLink>
            <ButtonLink href="/admin/suppliers?claimed=true" className="shrink-0">Claimed</ButtonLink>
          </div>
          <form method="get" action="/admin/suppliers" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Search supplier">
              {(a) => <input {...a} type="text" name="q" defaultValue={search} placeholder="Company name or slug" className={adminFieldClass} />}
            </Field>
            <Field label="Entity type">
              {(a) => (
                <select {...a} name="entity" defaultValue={entity} className={adminFieldClass}>
                  <option value="">Any</option>
                  <option value="factory">Factory</option>
                  <option value="buying_house">Buying house</option>
                  <option value="unknown">Unknown</option>
                </select>
              )}
            </Field>
            <Field label="Buyer visibility">
              {(a) => (
                <select {...a} name="published" defaultValue={published === null ? "" : String(published)} className={adminFieldClass}>
                  <option value="">Any</option>
                  <option value="true">Visible to buyers</option>
                  <option value="false">Not visible</option>
                </select>
              )}
            </Field>
            <Field label="Supplier account">
              {(a) => (
                <select {...a} name="claimed" defaultValue={claimed === null ? "" : String(claimed)} className={adminFieldClass}>
                  <option value="">Any</option>
                  <option value="true">Claimed</option>
                  <option value="false">Unclaimed</option>
                </select>
              )}
            </Field>
            <Field label="Sanctions status">
              {(a) => (
                <select {...a} name="sanctioned" defaultValue={sanctioned === null ? "" : String(sanctioned)} className={adminFieldClass}>
                  <option value="">Any</option>
                  <option value="true">Flagged</option>
                  <option value="false">Clear</option>
                </select>
              )}
            </Field>
            <Field label="Minimum verified evidence sources">
              {(a) => <input {...a} type="number" name="tier_min" min={0} max={20} defaultValue={tierMin ?? ""} className={adminFieldClass} />}
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
              <Button type="submit" kind="primary">Apply</Button>
              <ButtonLink href="/admin/suppliers">Reset</ButtonLink>
            </div>
          </form>
        </div>
      </AdminSection>

      <section aria-label="Suppliers" className="flex flex-col gap-2">
        <p className="text-sm text-ink-3">
          {`Page ${page} of ${totalPages} · ${doc.rows.length} shown · ${doc.total.toLocaleString()} total`}
        </p>
        {doc.rows.length === 0 ? (
          <Empty title="No suppliers match these filters" action={<ButtonLink href="/admin/suppliers">Reset filters</ButtonLink>}>
            Try removing one filter or resetting the search.
          </Empty>
        ) : (
          <TableFrame>
            <TableScroll>
              <Table aria-label="Suppliers">
                <thead>
                  <tr>
                    <Th>Company</Th>
                    <Th>Entity</Th>
                    <Th>Visibility</Th>
                    <Th>Sanctions</Th>
                    <Th>Account</Th>
                    <Th align="right">Evidence</Th>
                    <Th align="right">Internal score</Th>
                    <Th>Score job</Th>
                    <Th align="right">Updated</Th>
                  </tr>
                </thead>
                <tbody>
                  {doc.rows.map((r) => (
                    <Tr key={r.id}>
                      <Td>
                        <Link href={`/admin/suppliers/${r.id}`} className={rowLinkClass}>
                          {r.name_display ?? r.company_name}
                        </Link>
                        <span className="block text-sm text-ink-3">
                          <span className="font-mono">{r.slug}</span>
                          {r.city || r.district ? ` · ${[r.city, r.district].filter(Boolean).join(", ")}` : ""}
                        </span>
                      </Td>
                      <Td>
                        <TypeChip>{humanizeAdminToken(r.entity_type)}</TypeChip>
                      </Td>
                      <Td>{r.published ? <TypeChip>Visible</TypeChip> : <StatusChip tone="caution">Not visible</StatusChip>}</Td>
                      <Td>{r.sanctioned_flag ? <StatusChip tone="danger">Flagged</StatusChip> : <span className="text-ink-3">Clear</span>}</Td>
                      <Td>{r.claimed_by ? <TypeChip>Claimed</TypeChip> : <span className="text-ink-3">Unclaimed</span>}</Td>
                      <Td align="right" className="tabular-nums text-ink">
                        {r.tier_coverage}
                      </Td>
                      <Td align="right" className="tabular-nums text-ink">
                        {r.sbi_total ?? "—"}
                      </Td>
                      <Td>{r.has_pending_rescore ? <StatusChip tone="caution">Queued</StatusChip> : <span className="text-ink-3">—</span>}</Td>
                      <Td align="right" className="whitespace-nowrap tabular-nums">
                        {formatAdminDate(r.updated_at)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
            <Pagination
              noun="suppliers"
              from={offset + 1}
              to={offset + doc.rows.length}
              total={doc.total}
              page={page}
              pages={totalPages}
              prevHref={page > 1 ? pageHref(page - 1) : undefined}
              nextHref={page < totalPages ? pageHref(page + 1) : undefined}
            />
          </TableFrame>
        )}
      </section>
    </AdminColumn>
  );
}

function SupplierHeader({ total }: { total?: number }) {
  return (
    <AdminHead
      title="Suppliers"
      lede={
        total != null
          ? `${total.toLocaleString()} suppliers in scope. Search, triage publication readiness, and open the full operator workspace from any row.`
          : "Search, triage publication readiness, and open the full supplier operator workspace."
      }
      actions={<ButtonLink href="/admin">Admin home</ButtonLink>}
    />
  );
}
