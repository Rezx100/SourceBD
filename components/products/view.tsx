"use client";

// The phone's Product view (Paper `11 · Product`, gap row 20): a saved product read-only, then Edit
// opens a sheet of the simple fields (name, style, price, MOQ, main material, description). Sizes,
// materials, options and files are not edited on a phone; their rows and "Edit sizes, materials and
// files" open the full editor (`?edit=full`). The save is the editor's own: `POST /api/v1/products
// {upsert}` with the product as it was plus the six fields, under the status it has, so nothing else on
// it changes. Paper's "More" button is not here: Archive, Restore and Delete live on the list's menu.

import { ArrowLeft, CaretRight, CheckCircle, FileText, Hash, ImageSquare, Lock, Note, Package, PencilSimple, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button, ButtonLink, Field, Input, Sheet } from "@/components/kit";
import { ActionBar } from "@/components/kit/phone";
import { fieldBox, fieldEdge } from "@/components/kit/classes";
import { fileNameOf, toPayload, validateProduct, variantMatrix, type ProductErrors, type ProductValues } from "@/components/product-form-model";
import { usd } from "@/components/patterns/words";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { browserFetch, saveProduct } from "./transport";
import { rfqHref, updatedWords, type ProductStatus } from "./words";

export const FULL_EDITOR_LABEL = "Edit sizes, materials and files";
export const fullEditorHref = (id: string) => `/app/products/${encodeURIComponent(id)}?edit=full`;

const SIMPLE = ["name", "product_number", "price_usd", "moq", "main_material", "description"] as const;
export type Simple = Pick<ProductValues, (typeof SIMPLE)[number]>;
const simpleOf = (v: ProductValues): Simple => ({ name: v.name, product_number: v.product_number, price_usd: v.price_usd, moq: v.moq, main_material: v.main_material, description: v.description });

/** The sheet's save: the product as it was plus the six fields, under the status it has, so sizes, materials, options and files go back unchanged. The errors when a field is refused. */
export function detailsPayload(initial: ProductValues, fields: Simple): { payload: ReturnType<typeof toPayload> } | { errors: ProductErrors } {
  const errors = validateProduct(fields);
  return Object.keys(errors).length > 0 ? { errors } : { payload: toPayload({ ...initial, ...fields }, initial.status) };
}

/** The words of the read-only view, from the values: what is set is said, what is not is "Not set". */
export function viewFacts(v: ProductValues): { label: string; value: string | null }[] {
  const price = v.price_usd.trim() === "" ? null : Number(v.price_usd);
  const moq = v.moq.trim() === "" ? null : Number(v.moq);
  return [
    { label: "Style number", value: v.product_number.trim() || null },
    { label: "Customer ref.", value: v.customer_product_number.trim() || null },
    { label: "Target price", value: price !== null && Number.isFinite(price) ? `${usd(price)} per piece` : null },
    { label: "MOQ", value: moq !== null && Number.isFinite(moq) ? `${formatCount(moq)} pieces` : null },
    { label: "Main material", value: v.main_material.trim() || null },
    { label: "Category", value: v.category.trim() || null },
    { label: "Tags", value: v.tags.length ? v.tags.join(", ") : null },
    { label: "Description", value: v.description.trim() || null },
  ];
}

/** "3 combinations", "2 measurements", "None yet": what the sections that are not edited here hold. */
export function viewCounts(v: ProductValues): { label: string; value: string }[] {
  const filled = (r: Record<string, string>) => Object.values(r).some((x) => x.trim());
  const n = (count: number, one: string, many: string) => (count === 0 ? "None yet" : `${formatCount(count)} ${count === 1 ? one : many}`);
  return [
    { label: "Options", value: n(variantMatrix(v.options).total, "combination", "combinations") },
    { label: "Size chart", value: n(v.size_chart.filter(filled).length, "measurement", "measurements") },
    { label: "Materials", value: n(v.bom.filter(filled).length, "material", "materials") },
  ];
}

const textarea = cn(fieldBox, fieldEdge, "block min-h-24 px-2.5 py-1.5 text-md");

/** The pill over the name (`11 · Product`): the status and what it means for an RFQ. */
const VIEW_STATUS: Record<ProductStatus, { icon: typeof CheckCircle; words: string }> = {
  active: { icon: CheckCircle, words: "Active · ready for RFQs" },
  draft: { icon: PencilSimple, words: "Draft · make it active to send an RFQ" },
  archived: { icon: Package, words: "Archived · restore it to use it again" },
};

/** The bar's 36 round button, 44 to the finger. */
const roundButton = "group flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus";
const roundFace = "flex size-9 items-center justify-center rounded-full bg-sunken text-ink-2 group-active:bg-line";
/** "Edit" beside a section's title: 14 to the eye, 44 to the finger. */
const sectionEdit = "-my-3 -mr-2 flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus active:bg-sunken";

export function ProductView({ initial, updatedAt = null }: { initial: ProductValues; updatedAt?: string | null }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpenState] = useState(false);
  const [f, setF] = useState<Simple>(simpleOf(initial));
  const [errors, setErrors] = useState<ProductErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const images = initial.media.filter((m) => m.kind === "image");
  const techPack = initial.tech_pack_url.trim() || null;

  // Every opening starts from the product as it is now, with no old refusal on it.
  const setOpen = (next: boolean) => {
    if (!next && busy) return;
    if (next) {
      setF(simpleOf(initial));
      setErrors({});
      setError(null);
    }
    setOpenState(next);
  };
  const set = (k: keyof Simple, value: string) => setF((p) => ({ ...p, [k]: value }));

  async function save() {
    if (busy) return;
    const d = detailsPayload(initial, f);
    setErrors("errors" in d ? d.errors : {});
    if ("errors" in d) return;
    setBusy(true);
    setError(null);
    const r = await saveProduct(d.payload, { fetch: browserFetch });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setOpenState(false);
    router.refresh();
  }

  const facts = viewFacts(initial).filter((x) => x.label !== "Style number");
  const counts = Object.fromEntries(viewCounts(initial).map((x) => [x.label, x.value]));
  const editor = fullEditorHref(initial.id!);
  const files: { icon: typeof Note; label: string; value: string; href: string; external?: boolean }[] = [
    { icon: Note, label: "Size chart", value: counts["Size chart"] ?? "None yet", href: `${editor}#size-chart` },
    { icon: Package, label: "Materials", value: counts["Materials"] ?? "None yet", href: `${editor}#materials` },
    techPack ? { icon: FileText, label: "Tech pack", value: fileNameOf(techPack), href: techPack, external: true } : { icon: FileText, label: "Tech pack", value: "None yet", href: `${editor}#tech-pack` },
    { icon: ImageSquare, label: "Images", value: images.length ? `${formatCount(images.length)} ${images.length === 1 ? "image" : "images"}` : "None yet", href: `${editor}#images` },
    { icon: Plus, label: "Colour and size options", value: counts["Options"] ?? "None yet", href: `${editor}#options` },
  ];
  const status = VIEW_STATUS[initial.status] ?? VIEW_STATUS.draft;
  const StatusIcon = status.icon;
  return (
    // `data-detail`: the view draws its own bar, so the phone frame hides its bar and tabs (S-09).
    <div aria-label="Product view" data-detail="" className="flex min-h-0 flex-1 flex-col md:hidden">
      <div className="flex h-14 shrink-0 items-center px-2">
        <Link href="/app/products" aria-label="Back to products" className={roundButton}>
          <span className={roundFace}>
            <ArrowLeft size={17} weight="thin" aria-hidden />
          </span>
        </Link>
      </div>
      <div className="flex flex-col px-5 pb-[120px] pt-1">
        <header className="flex flex-col gap-3 pb-1">
          <span className="flex h-7 items-center gap-1.5 self-start rounded-full bg-sunken pl-2 pr-2.5 text-sm font-medium text-ink-2">
            <StatusIcon size={16} weight="thin" className="shrink-0" aria-hidden />
            {status.words}
          </span>
          <h1 className="text-2xl/[36px] font-medium tracking-tighter text-ink [overflow-wrap:anywhere]">{initial.name || "Product"}</h1>
          <div className="flex flex-col gap-1.5 text-base text-ink-2">
            <p className="flex items-center gap-2">
              <Hash size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
              {initial.product_number.trim() ? <span className="font-mono text-sm/[20px]">{initial.product_number.trim()}</span> : <span className="text-ink-3">No style number</span>}
              {updatedAt ? <span>{`· updated ${updatedWords(updatedAt)}`}</span> : null}
            </p>
            <p className="flex items-center gap-2">
              <Lock size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
              Only you see this product
            </p>
          </div>
        </header>

        <section aria-labelledby={`${id}-basics`} className="flex flex-col">
          <div className="flex items-baseline justify-between pb-3.5 pt-6">
            <h2 id={`${id}-basics`} className="text-lg font-medium tracking-tight text-ink">
              Basics
            </h2>
            <button type="button" onClick={() => setOpen(true)} className={sectionEdit}>
              Edit
            </button>
          </div>
          <dl className="flex flex-col overflow-clip rounded-[10px] border border-line">
            {facts.map((x) => (
              <div key={x.label} className="flex min-h-12 items-center gap-2.5 border-t border-line px-4 py-3 first:border-t-0">
                <dt className="w-[120px] shrink-0 text-base text-ink-2">{x.label}</dt>
                <dd className={cn("flex min-w-0 flex-1 flex-wrap justify-end text-right text-base [overflow-wrap:anywhere]", x.value === null ? "text-ink-3" : "font-medium tabular-nums text-ink")}>{x.value ?? "Not set"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby={`${id}-files`} className="flex flex-col">
          <div className="flex items-baseline justify-between pb-3.5 pt-6">
            <h2 id={`${id}-files`} className="text-lg font-medium tracking-tight text-ink">
              Sizes, materials, files
            </h2>
            <Link href={editor} prefetch={false} aria-label={FULL_EDITOR_LABEL} className={sectionEdit}>
              Edit
            </Link>
          </div>
          <ul className="flex flex-col overflow-clip rounded-[10px] border border-line">
            {files.map(({ icon: G, label, value, href, external }) => (
              <li key={label} className="border-t border-line first:border-t-0">
                <Link
                  href={href}
                  prefetch={false}
                  {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="flex min-h-[52px] items-center gap-3 px-4 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus active:bg-sunken"
                >
                  <span className="flex w-6 shrink-0 justify-center">
                    <G size={20} weight="thin" className="text-ink-2" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-md/[22px] text-ink">{label}</span>
                  <span className="min-w-0 truncate text-sm text-ink-3">{value}</span>
                  <CaretRight size={16} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="pt-4 text-xs text-ink-3">An RFQ from this product sends all of the above to the supplier.</p>
      </div>

      <ActionBar className="fixed inset-x-0 bottom-0 z-raised">
        {initial.status === "active" ? (
          <>
            <button type="button" onClick={() => setOpen(true)} className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus active:bg-sunken">
              <PencilSimple size={22} weight="thin" aria-hidden />
              <span className="sr-only">Edit details</span>
            </button>
            <ButtonLink href={rfqHref(initial.id!)} kind="primary" className="h-12 flex-1 rounded-lg text-md">
              Send RFQ
            </ButtonLink>
          </>
        ) : (
          <Button kind="primary" icon={PencilSimple} onClick={() => setOpen(true)} className="h-12 flex-1 rounded-lg text-md">
            Edit details
          </Button>
        )}
      </ActionBar>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Edit details"
        footer={
          <>
            <Button type="submit" form={`${id}-edit`} kind="primary" size="touch" full loading={busy} loadingLabel="Saving">
              Save changes
            </Button>
            <Button kind="secondary" size="touch" full onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <form
          id={`${id}-edit`}
          aria-label="Edit details"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Name (required)" error={errors.name}>
            {(a) => <Input {...a} name="name" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={200} aria-required size="touch" />}
          </Field>
          <Field label="Style number">{(a) => <Input {...a} name="product_number" value={f.product_number} onChange={(e) => set("product_number", e.target.value)} size="touch" />}</Field>
          <Field label="Target price (US$)" help="Per piece, in US dollars." error={errors.price_usd}>
            {(a) => <Input {...a} name="price_usd" value={f.price_usd} onChange={(e) => set("price_usd", e.target.value)} inputMode="decimal" size="touch" />}
          </Field>
          <Field label="MOQ, in pieces" error={errors.moq}>
            {(a) => <Input {...a} name="moq" value={f.moq} onChange={(e) => set("moq", e.target.value)} inputMode="numeric" size="touch" />}
          </Field>
          <Field label="Main material">{(a) => <Input {...a} name="main_material" value={f.main_material} onChange={(e) => set("main_material", e.target.value)} size="touch" />}</Field>
          <Field label="Description">{(a) => <textarea {...a} name="description" className={textarea} value={f.description} onChange={(e) => set("description", e.target.value)} rows={4} />}</Field>
          <p role="status" aria-live="polite" className={error ? "text-sm text-danger" : "sr-only"}>
            {error ?? ""}
          </p>
        </form>
      </Sheet>
    </div>
  );
}
