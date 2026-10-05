"use client";

// The phone's Product view (Paper `· Product view`, gap row 20): a saved product read-only, then Edit
// opens a sheet of the simple fields (name, style, price, MOQ, main material, description). Sizes,
// materials, options and files are not edited on a phone; "Edit sizes, materials and files" opens the
// full editor (`?edit=full`). The save is the editor's own: `POST /api/v1/products {upsert}` with the
// product as it was plus the six fields, under the status it has, so nothing else on it changes.

import { ArrowLeft, PaperPlaneTilt, PencilSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { Button, ButtonLink, Field, Input, Sheet } from "@/components/kit";
import { fieldBox, fieldEdge } from "@/components/kit/classes";
import { fileNameOf, toPayload, validateProduct, variantMatrix, type ProductErrors, type ProductValues } from "@/components/product-form-model";
import { usd } from "@/components/patterns/words";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { editLine } from "./edit";
import { StatusChip } from "./table";
import { browserFetch, saveProduct } from "./transport";
import { rfqHref } from "./words";

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
    { label: "Customer product number", value: v.customer_product_number.trim() || null },
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

  const facts = viewFacts(initial);
  return (
    <div aria-label="Product view" className="flex min-h-0 flex-1 flex-col md:hidden">
      <header className="flex flex-col gap-1 px-4 pb-4 pt-2">
        <Link href="/app/products" prefetch={false} className="-ml-2 flex h-11 w-fit items-center gap-1.5 rounded-sm px-2 text-base font-medium text-ink-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
          <ArrowLeft size={16} aria-hidden />
          Products
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">{initial.name || "Product"}</h1>
          <StatusChip status={initial.status} />
        </div>
        <p className="text-base text-ink-3">{editLine(initial, updatedAt)}</p>
        <div className="flex flex-col gap-2 pt-2">
          {initial.status === "active" ? (
            <ButtonLink href={rfqHref(initial.id!)} kind="secondary" icon={PaperPlaneTilt} className="h-input-touch w-full">
              Send RFQ
            </ButtonLink>
          ) : null}
          <Button kind="primary" icon={PencilSimple} onClick={() => setOpen(true)} className="h-input-touch w-full">
            Edit details
          </Button>
        </div>
      </header>

      <dl className="border-t border-line px-4">
        {facts.map((x) => (
          <Row key={x.label} label={x.label}>
            {x.value ?? <span className="text-ink-3">Not set</span>}
          </Row>
        ))}
        {viewCounts(initial).map((x) => (
          <Row key={x.label} label={x.label}>
            <span className={x.value === "None yet" ? "text-ink-3" : undefined}>{x.value}</span>
          </Row>
        ))}
        <Row label="Images">
          {images.length ? (
            <span className="flex flex-wrap gap-2 pt-1">
              {images.map((m, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- the buyer's own upload on storage, drawn at 64px
                <img key={m.url} src={m.url} alt={`Product image ${i + 1}`} className="size-16 rounded-md border border-line bg-sunken object-cover" />
              ))}
            </span>
          ) : (
            <span className="text-ink-3">None yet</span>
          )}
        </Row>
        <Row label="Tech pack">
          {techPack ? (
            <a href={techPack} target="_blank" rel="noreferrer" className="flex min-h-11 items-center font-medium text-brand underline decoration-1 [overflow-wrap:anywhere]">
              {fileNameOf(techPack)}
            </a>
          ) : (
            <span className="text-ink-3">None yet</span>
          )}
        </Row>
      </dl>

      <div className="px-4 py-4">
        <ButtonLink href={fullEditorHref(initial.id!)} kind="secondary" prefetch={false} className="h-input-touch w-full">
          {FULL_EDITOR_LABEL}
        </ButtonLink>
      </div>

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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-b-0">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="text-md text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
