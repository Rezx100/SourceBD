"use client";

// The buyer's product base (27 Sep 2026, the founder's walkthrough): the list
// at `/app/products` and the start choice at `/app/products/new`. The routes
// read `buyer_product_list()` server-side and hand the rows here, so a test
// renders exactly what a buyer receives. A client module for the row actions
// (archive, restore, delete with an inline confirm) and the saved toast.
//
// Product truth: a product is the buyer's own record — no score, no supplier
// contact value, nothing a supplier sees until it goes out as an RFQ.

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Form from "next/form";
import Link from "next/link";
import { startTransition, useContext, useEffect, useState, type ReactNode } from "react";
import { routeSentence, type ProductStatus } from "@/components/product-form-model";
import { formatCount, formatDay, formatMoney, initials } from "@/lib/dashboard/facts";
import { Badge, Chip, CURRENT_TAB, type BadgeTone } from "./chips";
import { Button, Count, Menu, MenuItem, V2Tag } from "./controls";
import { Icon, type IconName } from "./icons";
import { Cell, DataTable, EmptyState, ErrorNote, HeadCell, PageHeader, rowClass } from "./page";
import { Toast } from "./toast";
import { Caption } from "./type";

/** One row of `buyer_product_list()`. Numbers may arrive as text from a `numeric` column. */
export type ProductRow = {
  id: string;
  name: string;
  product_number: string | null;
  category: string | null;
  status: ProductStatus;
  price_usd: number | string | null;
  moq: number | string | null;
  first_image: string | null;
  updated_at: string;
};

export const PRODUCT_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
] as const;
export type ProductTab = (typeof PRODUCT_TABS)[number]["key"];

export function parseProductTab(v: unknown): ProductTab {
  return PRODUCT_TABS.some((t) => t.key === v) ? (v as ProductTab) : "all";
}

/** The read failed: never the empty state, never "0 products". */
export const PRODUCTS_ERROR_COPY = "Your products could not be read just now. Nothing has been lost — try again in a moment.";
export const PRODUCTS_EMPTY_TITLE = "Your product base";
export const PRODUCTS_EMPTY_BODY = "Keep your products here, then send them to suppliers as RFQs.";

const STATUS: Record<ProductStatus, { tone: BadgeTone; label: string }> = {
  draft: { tone: "type", label: "Draft" },
  active: { tone: "positive", label: "Active" },
  archived: { tone: "type", label: "Archived" },
};

const num = (v: number | string | null): number | null => (v === null || v === "" ? null : Number(v));
const tabHref = (key: ProductTab) => (key === "all" ? "/app/products" : `/app/products?status=${key}`);

function AddProduct() {
  return (
    <Button variant="primary" href="/app/products/new" clientNav>
      <Icon name="plus" /> Add product
    </Button>
  );
}

/** `rows: null` → the read failed. `savedId` → the form just saved that product. */
export function ProductList({ rows, tab, savedId = null }: { rows: ProductRow[] | null; tab: ProductTab; savedId?: string | null }) {
  const shown = rows ? rows.filter((r) => tab === "all" || r.status === tab) : [];
  const countOf = (key: ProductTab) => (rows ? rows.filter((r) => key === "all" || r.status === key).length : null);
  const empty = rows !== null && rows.length === 0;

  return (
    <>
      <PageHeader
        title="Products"
        caption={
          rows === null
            ? "Your product count could not be read"
            : `${formatCount(rows.length)} ${rows.length === 1 ? "product" : "products"} · only you can see them`
        }
        // On the empty page the empty state carries the one primary.
        actions={empty ? null : <AddProduct />}
      >
        {rows && rows.length > 0 ? (
          <nav aria-label="Product status" className="flex flex-wrap gap-2">
            {PRODUCT_TABS.map((t) => (
              <Link prefetch={false} key={t.key} href={tabHref(t.key)} aria-current={t.key === tab ? "page" : undefined} className="rounded-sm">
                <Chip tone={t.key === tab ? "on" : "neutral"} className={t.key === tab ? CURRENT_TAB : undefined}>
                  {t.label}
                  <Count className={t.key === tab ? "text-xs text-ink-muted" : "text-xs"}>{countOf(t.key)}</Count>
                </Chip>
              </Link>
            ))}
          </nav>
        ) : null}
      </PageHeader>

      {rows === null ? (
        <ErrorNote>{PRODUCTS_ERROR_COPY}</ErrorNote>
      ) : empty ? (
        <div className="rounded-md bg-surface">
          <EmptyState art="orders" title={PRODUCTS_EMPTY_TITLE} action={<AddProduct />}>
            {PRODUCTS_EMPTY_BODY}
          </EmptyState>
        </div>
      ) : (
        <div className="rounded-md bg-surface">
          {shown.length === 0 ? (
            <EmptyState icon="box" title={`No ${STATUS[tab as ProductStatus].label.toLowerCase()} products`}>
              Products move here as their status changes.
            </EmptyState>
          ) : (
            <DataTable label="Products" minWidth="52rem">
              <thead>
                <tr>
                  <HeadCell>Product</HeadCell>
                  <HeadCell>Category</HeadCell>
                  <HeadCell>Status</HeadCell>
                  <HeadCell align="right">Price</HeadCell>
                  <HeadCell align="right">MOQ</HeadCell>
                  <HeadCell>Updated</HeadCell>
                  <HeadCell className="w-px">
                    <span className="sr-only">Actions</span>
                  </HeadCell>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} data-product={r.id} className={rowClass({ className: "relative" })}>
                    <th scope="row" className="h-11 border-b border-line-subtle px-4 py-1.5 text-left align-middle font-normal">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Thumb src={r.first_image} name={r.name} />
                        <span className="flex min-w-0 flex-col">
                          {/* The whole row opens the product: this link's box is stretched over the row. */}
                          <Link
                            prefetch={false}
                            href={`/app/products/${r.id}`}
                            className="font-medium text-ink-strong [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-[''] hover:underline"
                          >
                            {r.name}
                          </Link>
                          {r.product_number ? <span className="font-mono text-xs text-ink-subtle">{r.product_number}</span> : null}
                        </span>
                      </span>
                    </th>
                    <Cell className="text-ink-muted">{r.category ?? "—"}</Cell>
                    <Cell>
                      <Badge tone={STATUS[r.status]?.tone ?? "type"}>{STATUS[r.status]?.label ?? r.status}</Badge>
                    </Cell>
                    <Cell align="right" className="whitespace-nowrap">
                      {formatMoney(num(r.price_usd), "USD") ?? "—"}
                    </Cell>
                    <Cell align="right">{formatCount(num(r.moq)) ?? "—"}</Cell>
                    <Cell className="whitespace-nowrap text-ink-muted">{formatDay(r.updated_at) ?? "—"}</Cell>
                    <Cell align="right" className="whitespace-nowrap py-1">
                      <RowActions row={r} />
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
      )}
      {savedId ? <SavedToast id={savedId} /> : null}
    </>
  );
}

/** 32px: the product's first image, or its initials on a quiet tile. */
function Thumb({ src, name }: { src: string | null; name: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- the buyer's own upload on storage, drawn at 32px
    <img src={src} alt="" width={32} height={32} className="size-8 shrink-0 rounded-sm bg-surface-sunken object-cover shadow-edge" />
  ) : (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-sunken text-[10px] font-medium text-ink-muted">
      {initials(name)}
    </span>
  );
}

/**
 * Send RFQ, Edit and a menu (Archive or Restore, Delete), shown on hover and
 * on focus within the row; `invisible` rather than `hidden`, so the columns do
 * not move when they appear. Delete asks once, in place.
 */
function RowActions({ row }: { row: ProductRow }) {
  const router = useContext(AppRouterContext);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archived = row.status === "archived";

  async function run(req: () => Promise<Response>, failed: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await req();
      if (!res.ok) {
        setError(routeSentence(await res.json().catch(() => null)) ?? failed);
        return;
      }
      setConfirming(false);
      startTransition(() => router?.refresh());
    } catch {
      setError(`${failed} No connection.`);
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (status: ProductStatus) =>
    run(
      () =>
        fetch("/api/v1/products", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "set_status", id: row.id, status }),
        }),
      archived ? "Could not restore it." : "Could not archive it.",
    );
  const remove = () =>
    run(() => fetch(`/api/v1/products?id=${encodeURIComponent(row.id)}`, { method: "DELETE" }), "Could not delete it.");

  // `relative` alone puts these above the name link stretched over the row: it
  // comes earlier in the row, so these paint after it. A z-index here (the
  // numeric one it had compiled to nothing) would make each row's controls a
  // stacking context, and the next row's controls would paint over this row's
  // More menu.
  if (confirming) {
    return (
      <span className="relative inline-flex items-center gap-1.5">
        <span className="text-xs text-ink-muted">{error ?? "Delete for good?"}</span>
        <Button size="sm" variant="danger" loading={busy} onClick={() => void remove()}>
          <Icon name="trash" /> Delete
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    );
  }
  return (
    <span className="relative inline-flex items-center gap-1">
      {error ? (
        <span role="alert" className="text-xs text-danger-ink">
          {error}
        </span>
      ) : null}
      <span className="invisible inline-flex items-center gap-1 group-hover:visible group-focus-within:visible [@media(hover:none)]:visible">
        <Button size="sm" href={`/app/rfqs/new?product=${encodeURIComponent(row.id)}`} clientNav>
          <Icon name="send" /> Send RFQ
        </Button>
        <Button size="sm" variant="ghost" href={`/app/products/${encodeURIComponent(row.id)}`} clientNav>
          Edit
        </Button>
        <Menu label={`More actions for ${row.name}`} size="sm" summary={<Icon name="dots" />}>
          <MenuItem onClick={() => void setStatus(archived ? "draft" : "archived")}>{archived ? "Restore" : "Archive"}</MenuItem>
          <MenuItem onClick={() => setConfirming(true)}>Delete</MenuItem>
        </Menu>
      </span>
    </span>
  );
}

function SavedToast({ id }: { id: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 5000);
    return () => clearTimeout(t);
  }, []);
  return on ? (
    <Toast text="Product saved" href={null} link={{ href: `/app/products/${encodeURIComponent(id)}`, label: "Open" }} className="fixed z-toast" />
  ) : null;
}

/**
 * The first step of `/app/products/new`: start by hand (chosen) or, when
 * `AI_ENABLED`, from a description. A GET form, so Next is a URL
 * (`?start=manual`) and Back returns here.
 */
export function StartChoice({ ai }: { ai: boolean }) {
  return (
    <Form action="/app/products/new" className="flex w-full max-w-[56rem] flex-col gap-4">
      <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <legend className="mb-3 text-title font-semibold text-ink-strong">How do you want to start?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <StartCard value="manual" icon="pencil" title="Start manually" defaultChecked>
            Enter the name, price, size chart and BOM yourself. Only the name is required.
          </StartCard>
          {ai ? (
            <StartCard value="ai" icon="sparkle" title="Start with AI" tag={<V2Tag />}>
              Describe the product in your own words and check the fields drafted from it.
            </StartCard>
          ) : null}
        </div>
        {ai ? null : <Caption>Drafting a product from a description arrives with V2.</Caption>}
      </fieldset>
      <div>
        <Button type="submit" variant="primary">
          Next <Icon name="arrow-r" />
        </Button>
      </div>
    </Form>
  );
}

function StartCard({
  value,
  icon,
  title,
  tag,
  defaultChecked = false,
  children,
}: {
  value: string;
  icon: IconName;
  title: string;
  tag?: ReactNode;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md bg-surface p-4 shadow-edge transition-colors duration-fast hover:bg-surface-sunken has-[:checked]:bg-brand-tint has-[:checked]:shadow-[inset_0_0_0_1px_rgb(var(--ds-accent))]">
      <input type="radio" name="start" value={value} defaultChecked={defaultChecked} className="mt-1 size-4 shrink-0" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="inline-flex items-center gap-2 text-title font-medium text-ink-strong">
          <Icon name={icon} className="text-ink-muted" />
          {title}
          {tag}
        </span>
        <span className="text-sm text-ink-muted">{children}</span>
      </span>
    </label>
  );
}
