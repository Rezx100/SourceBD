// Admin sanctions verification queue (Spec A4). Calls
// `public.admin_sanctions_queue_list` with status/list filters driven
// from URL search params. Admin-only; middleware gates `/admin/*` and
// the RPC re-checks role inside its body.

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

import { AdminSanctionsDecideButton } from "@/components/admin-sanctions-decide-button";
import {
  Button,
  Chip,
  Empty,
  FactChip,
  Field,
  InlineError,
  Select,
  Table,
  Td,
  Th,
  Tr,
  TypeChip,
} from "@/components/kit";
import {
  HeadLink,
  OutLink,
  QueueColumn,
  QueueFilter,
  QueueHead,
  QueueTable,
  SupplierLink,
  formatAdminDate,
  humanizeAdminToken,
} from "@/components/admin/queue-parts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  queue_id: string;
  queue_created_at: string;
  reviewed_at: string | null;
  admin_action: string | null;
  supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
    sanctioned_flag: boolean;
    sanctioned_reason: string | null;
    sanctions_cleared: boolean;
  };
  hit: {
    list: string | null;
    matched_name: string | null;
    match_score: number | string | null;
    entry_id: string | null;
    entity_name: string | null;
    source_url: string | null;
    listed_date: string | null;
  };
};

type Doc = { total: number; rows: Row[] };

const PAGE_SIZE = 50;

const STATUSES = ["open", "reviewed", "all"] as const;
type Status = (typeof STATUSES)[number];

const SANCTIONS_LISTS = [
  "uflpa",
  "us_wro",
  "ofac_sdn",
  "uk_ofsi",
  "eu_sanctions",
  "ilab_tvpra",
] as const;

function asInt(v: string | string[] | undefined): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (s == null || s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function asStr(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s ?? "";
}

// The kit Select cannot hold an empty value, so its "Any" row posts this word; the page reads it as no filter.
const ANY = "__any";

const LEDE =
  "Review auto-flagged sanctions matches. Confirm records a sanctioned supplier; clear records a false positive.";

export default async function AdminSanctionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusRaw = asStr(sp.status) || "open";
  const status: Status = (STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as Status)
    : "open";
  const list = asStr(sp.list) === ANY ? "" : asStr(sp.list);
  const page = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_sanctions_queue_list", {
    p_status: status,
    p_list: list || null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  if (error || data == null) {
    return (
      <QueueColumn>
        <QueueHead title="Sanctions queue" lede={LEDE} />
        <InlineError>
          Could not load queue
          {error?.message ? <>: {error.message}</> : null}.
        </InlineError>
      </QueueColumn>
    );
  }

  const doc = data as Doc;
  const totalPages = Math.max(1, Math.ceil(doc.total / PAGE_SIZE));

  const baseQuery = new URLSearchParams();
  if (status !== "open") baseQuery.set("status", status);
  if (list) baseQuery.set("list", list);
  const pageHref = (n: number) => {
    const q = new URLSearchParams(baseQuery);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/admin/sanctions?${s}` : "/admin/sanctions";
  };

  return (
    <QueueColumn>
      <QueueHead
        title="Sanctions queue"
        lede={`${LEDE} ${doc.total} total in current filter.`}
        actions={<HeadLink href="/admin/queue?type=sanctions_hit">Review hub</HeadLink>}
      />

      <QueueFilter action="/admin/sanctions">
        <Field label="Status" className="min-w-[200px]">
          {(a) => (
            <Select
              {...a}
              name="status"
              defaultValue={status}
              options={STATUSES.map((s) => ({ value: s, label: humanizeAdminToken(s) }))}
            />
          )}
        </Field>
        <Field label="Sanctions list" className="min-w-[200px]">
          {(a) => (
            <Select
              {...a}
              name="list"
              defaultValue={list || ANY}
              options={[
                { value: ANY, label: "Any" },
                ...SANCTIONS_LISTS.map((k) => ({ value: k, label: humanizeAdminToken(k) })),
              ]}
            />
          )}
        </Field>
        <Button type="submit" kind="primary">
          Apply
        </Button>
      </QueueFilter>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-ink">Sanctions queue</h2>
          <p className="text-sm text-ink-3">{`${doc.total} total · page ${page} / ${totalPages}`}</p>
        </div>
        {doc.rows.length === 0 ? (
          <Empty title="No sanctions hits in this state">Try a different status or sanctions list.</Empty>
        ) : (
          <QueueTable
            noun="sanctions hits"
            total={doc.total}
            page={page}
            pages={totalPages}
            perPage={PAGE_SIZE}
            shown={doc.rows.length}
            pageHref={pageHref}
          >
            <Table>
              <caption className="sr-only">Sanctions queue</caption>
              <thead>
                <tr>
                  <Th>Supplier</Th>
                  <Th>Match</Th>
                  <Th>Source</Th>
                  <Th>Queued</Th>
                  <Th align="right">
                    <span className="sr-only">Action</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {doc.rows.map((r) => {
                  const score = scoreOf(r.hit.match_score);
                  return (
                    <Tr key={r.queue_id} className="align-top">
                      <Td>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <SupplierLink id={r.supplier.id}>{r.supplier.company_name}</SupplierLink>
                          <TypeChip>{humanizeAdminToken(r.supplier.entity_type)}</TypeChip>
                          {r.hit.list ? (
                            <FactChip state="disagree">{humanizeAdminToken(r.hit.list)}</FactChip>
                          ) : null}
                          {r.supplier.sanctioned_flag ? (
                            <FactChip state="disagree">sanctioned</FactChip>
                          ) : r.supplier.sanctions_cleared ? (
                            <Chip icon={CheckCircle}>cleared</Chip>
                          ) : null}
                          {r.admin_action ? <TypeChip>{r.admin_action}</TypeChip> : null}
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-sm text-ink-3">
                          <span className="font-mono">
                            {r.hit.matched_name ?? r.hit.entity_name ?? "—"}
                          </span>
                          {score != null ? ` · score ${score.toFixed(3)}` : ""}
                          {r.hit.listed_date ? ` · listed ${r.hit.listed_date}` : ""}
                          {r.supplier.sanctioned_reason ? (
                            <span className="block text-ink-2">Reason: {r.supplier.sanctioned_reason}</span>
                          ) : null}
                        </span>
                      </Td>
                      <Td>{r.hit.source_url ? <OutLink href={r.hit.source_url} /> : "—"}</Td>
                      <Td>
                        <span className="block text-sm text-ink-3">
                          {formatAdminDate(r.queue_created_at)}
                          {r.reviewed_at ? ` · reviewed ${formatAdminDate(r.reviewed_at)}` : ""}
                        </span>
                      </Td>
                      <Td align="right">
                        {r.reviewed_at == null ? (
                          <AdminSanctionsDecideButton
                            queueId={r.queue_id}
                            label={`${r.supplier.company_name}${r.hit.list ? ` · ${r.hit.list}` : ""}`}
                          />
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </QueueTable>
        )}
      </section>
    </QueueColumn>
  );
}

function scoreOf(raw: number | string | null): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}
