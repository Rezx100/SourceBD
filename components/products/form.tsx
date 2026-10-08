"use client";

// The product editor (Paper `10 · Product editor`, `· New product`): create a product, or edit one. A
// header with the name, the status and Send RFQ; the sections in one column with the list of them on
// the left from 768 (Basics, Options, Size chart, Materials, Images, Tech pack); and a bar at the foot
// that says what is still needed, or what changed, and carries the saves. A new product opens only
// Basics and shows the rest as "Add"; a saved one opens every section.
//
// Not here: Paper's HS code (a product holds none; saving one needs a column that does not exist), the
// size chart per size and its grade, units on the materials and "Paste from a spreadsheet". The size
// chart keeps its one base column and the materials their quantity and notes, as stored.
//
// Both saves are `POST /api/v1/products {action:"upsert", product}` → `{id}`; images and the tech pack
// go first to `POST /api/v1/products/media` and the product keeps the URLs (`transport.ts`). The pure
// half is `product-form-model.ts` and `edit.ts`.

import { ArrowLeft, File, Paperclip, PaperPlaneTilt, Plus, Trash, UploadSimple, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ButtonLink, Field, IconButton, Input, Select, Table, TableFrame, Td, Th, Tr } from "@/components/kit";
import { fieldBox, fieldEdge } from "@/components/kit/classes";
import {
  BOM_COLUMNS,
  PRODUCT_CATEGORIES,
  SIZE_COLUMNS,
  VARIANT_CAP,
  emptyBomRow,
  emptySizeRow,
  fileNameOf,
  releasedFiles,
  toPayload,
  validateProduct,
  variantMatrix,
  type MediaKind,
  type ProductErrors,
  type ProductStatus,
  type ProductValues,
} from "@/components/product-form-model";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { FIX_FIELDS, NAME_NEEDED, NEW_CAPTION, NEW_TITLE, OPTIONAL_LINES, SECTIONS, changedLabels, editLine, footButtons, openSections, type Optional } from "./edit";
import { ChipInput, FormSection, RowsTable } from "./form-parts";
import { browserFetch, releaseFile, saveProduct, uploadMedia } from "./transport";
import { StatusChip } from "./table";
import { rfqHref } from "./words";

/** The fields a save refuses on, by their `name`, in the order the form draws them. */
const CHECKED = ["name", "price_usd", "moq"] as const;
/** Radix cannot hold an empty value, so "Not set" is this one. */
const NOT_SET = "none";
const deps = { fetch: browserFetch };

const textarea = cn(fieldBox, fieldEdge, "block min-h-16 px-2.5 py-1.5 text-base");
const touch = "max-md:h-input-touch max-md:text-md";

export function ProductForm({ initial, updatedAt = null }: { initial: ProductValues; updatedAt?: string | null }) {
  const router = useRouter();
  const isNew = initial.id === null;
  const [v, setV] = useState(initial);
  const [open, setOpen] = useState(() => openSections(initial));
  const [errors, setErrors] = useState<ProductErrors>({});
  const [busy, setBusy] = useState<ProductStatus | null>(null);
  const [uploading, setUploading] = useState<MediaKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const techInput = useRef<HTMLInputElement>(null);
  // Every file this form uploaded, so a save or a discard can remove the ones it did not keep.
  const uploaded = useRef<string[]>([]);

  const set = <K extends keyof ProductValues>(k: K, value: ProductValues[K]) => {
    setV((p) => ({ ...p, [k]: value }));
    // An edited field is no longer marked wrong; the next save checks it again.
    if (k in errors) {
      setErrors((e) => {
        const next = { ...e };
        delete next[k as keyof ProductErrors];
        return next;
      });
    }
  };
  const images = v.media.filter((m) => m.kind === "image");
  const techPack = v.tech_pack_url.trim() || null;
  const matrix = variantMatrix(v.options);
  const changed = changedLabels(initial, v);
  const dirty = changed.length > 0;
  const needsName = !v.name.trim();
  const invalid = Object.keys(errors).length > 0;
  const buttons = footButtons(initial.status, isNew, dirty);
  const working = busy !== null || uploading !== null;

  async function save(status: ProductStatus) {
    if (busy) return;
    const e = validateProduct(v);
    setErrors(e);
    const first = CHECKED.find((k) => e[k]);
    if (first) return void (form.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
    setBusy(status);
    setError(null);
    const r = await saveProduct(toPayload(v, status), deps);
    if (!r.ok || !r.id) {
      setBusy(null);
      return setError(r.message);
    }
    for (const url of releasedFiles(initial, uploaded.current, v)) void releaseFile(url, deps);
    // Busy stays on through the navigation, so a second press cannot save twice.
    router.replace(`/app/products?saved=${encodeURIComponent(r.id)}`);
    router.refresh();
  }

  async function upload(files: FileList | null, kind: MediaKind) {
    if (!files?.length || uploading) return;
    setUploading(kind);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const r = await uploadMedia(file, kind, deps);
        if (!r.ok || !r.url) return setError(r.message);
        const url = r.url;
        uploaded.current.push(url);
        // One tech pack (its own column): a new one replaces the old.
        setV((p) => (kind === "tech_pack" ? { ...p, tech_pack_url: url } : { ...p, media: [...p.media, { url, kind }] }));
      }
    } finally {
      setUploading(null);
      if (imageInput.current) imageInput.current.value = "";
      if (techInput.current) techInput.current.value = "";
    }
  }

  function discard() {
    for (const url of releasedFiles(initial, uploaded.current, initial)) void releaseFile(url, deps);
    uploaded.current = [];
    setV(initial);
    setErrors({});
    setError(null);
  }

  const removeMedia = (url: string) => set("media", v.media.filter((m) => m.url !== url));
  const shut = (s: Optional) => !open[s];
  const opener = (s: Optional) => () => setOpen((o) => ({ ...o, [s]: true }));
  const categories = v.category && !(PRODUCT_CATEGORIES as readonly string[]).includes(v.category) ? [...PRODUCT_CATEGORIES, v.category] : [...PRODUCT_CATEGORIES];

  return (
    <form
      ref={form}
      aria-label="Product"
      // Enter in a field does nothing: saving is the foot's, never an accident.
      onSubmit={(e) => e.preventDefault()}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <header className="flex flex-col gap-1 px-8 pb-5 pt-5 max-md:px-4 max-md:pt-2">
        <Link href="/app/products" prefetch={false} className="-ml-2 flex h-9 w-fit items-center gap-1.5 rounded-sm px-2 text-base font-medium text-ink-2 outline-none hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus max-md:h-11">
          <ArrowLeft size={16} aria-hidden />
          Products
        </Link>
        <div className="flex items-start justify-between gap-4 max-sm:flex-col">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">{isNew ? NEW_TITLE : initial.name || "Product"}</h1>
              {isNew ? null : <StatusChip status={initial.status} />}
            </div>
            <p className="text-base text-ink-3">{isNew ? NEW_CAPTION : editLine(initial, updatedAt)}</p>
          </div>
          {!isNew && initial.status === "active" ? (
            dirty ? (
              <span className="flex items-center gap-3 text-sm text-ink-3">Save changes to send</span>
            ) : (
              <ButtonLink href={rfqHref(initial.id!)} kind="secondary" icon={PaperPlaneTilt} className="max-md:h-input-touch max-md:w-full">
                Send RFQ
              </ButtonLink>
            )
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-8 border-t border-line px-8 pb-8 pt-6 max-md:flex-col max-md:px-4">
        <nav aria-label="Sections" className="sticky top-6 flex h-fit w-[184px] shrink-0 flex-col gap-0.5 max-md:hidden">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="flex h-9 items-center rounded-sm px-2.5 text-base text-ink-2 outline-none hover:bg-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 max-w-[760px] flex-1 flex-col gap-6">
          <FormSection id="basics" title="Basics">
            <Field label="Name (required)" help="Your name for it. RFQs from this product use it." error={errors.name}>
              {(a) => (
                <Input
                  {...a}
                  name="name"
                  value={v.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Men's slim-fit stretch jeans"
                  aria-required
                  maxLength={200}
                  className={touch}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Style number" help="Your own style or article number.">
                {(a) => <Input {...a} value={v.product_number} onChange={(e) => set("product_number", e.target.value)} placeholder="e.g. SS27-DN-014" className={touch} />}
              </Field>
              <Field label="Customer product number" help="Your customer's reference, if they gave one.">
                {(a) => <Input {...a} value={v.customer_product_number} onChange={(e) => set("customer_product_number", e.target.value)} className={touch} />}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Target price (US$)" help="Per piece, in US dollars." error={errors.price_usd}>
                {(a) => <Input {...a} name="price_usd" value={v.price_usd} onChange={(e) => set("price_usd", e.target.value)} inputMode="decimal" placeholder="e.g. 8.50" className={touch} />}
              </Field>
              <Field label="MOQ, in pieces" help="Minimum order quantity." error={errors.moq}>
                {(a) => <Input {...a} name="moq" value={v.moq} onChange={(e) => set("moq", e.target.value)} inputMode="numeric" placeholder="e.g. 1200" className={touch} />}
              </Field>
            </div>
            <Field label="Main material" help="The composition as it goes on the care label.">
              {(a) => <Input {...a} value={v.main_material} onChange={(e) => set("main_material", e.target.value)} placeholder="e.g. 82% Cotton / 17% PA / 1% EL" className={touch} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                {(a) => (
                  <Select
                    id={a.id}
                    aria-describedby={a["aria-describedby"]}
                    value={v.category || NOT_SET}
                    onValueChange={(c) => set("category", c === NOT_SET ? "" : c)}
                    options={[{ value: NOT_SET, label: "Not set" }, ...categories.map((c) => ({ value: c, label: c }))]}
                    className="max-md:h-input-touch"
                  />
                )}
              </Field>
              <Field label="Tags" help="Press Enter or a comma after each tag.">
                {(a) => <ChipInput id={a.id} values={v.tags} onChange={(tags) => set("tags", tags)} placeholder="e.g. SS27, organic" />}
              </Field>
            </div>
            <Field label="Description" help="Fit, fabric feel, wash, trims — whatever a factory needs to quote it.">
              {(a) => <textarea {...a} className={textarea} value={v.description} onChange={(e) => set("description", e.target.value)} rows={4} />}
            </Field>
          </FormSection>

          <FormSection id="options" name="options" title={shut("options") ? OPTIONAL_LINES.options : "Options"} caption="Options and their values; every combination is listed below." shut={shut("options")} onOpen={opener("options")}>
            {v.options.map((o, i) => (
              <div key={i} className="grid items-start gap-3 sm:grid-cols-[12rem_1fr_auto]">
                <Field label="Option">
                  {(a) => <Input {...a} value={o.name} onChange={(e) => set("options", v.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder={i === 0 ? "e.g. Waist" : "e.g. Colour"} className={touch} />}
                </Field>
                <Field label="Values">
                  {(a) => <ChipInput id={a.id} values={o.values} onChange={(values) => set("options", v.options.map((x, j) => (j === i ? { ...x, values } : x)))} placeholder={i === 0 ? "e.g. 28, 30, 32" : "e.g. Mid-wash, Black"} />}
                </Field>
                <IconButton icon={Trash} label={`Remove option ${o.name.trim() || i + 1}`} kind="quiet" size={32} onClick={() => set("options", v.options.filter((_, j) => j !== i))} className="sm:mt-[1.625rem] max-md:size-11" />
              </div>
            ))}
            <div>
              <Button icon={Plus} onClick={() => set("options", [...v.options, { name: "", values: [] }])} className="max-md:h-11">
                Add option
              </Button>
            </div>
            {matrix.total > 0 ? (
              <div className="flex flex-col gap-2">
                <TableFrame>
                  <div className="max-h-80 overflow-auto">
                    <Table aria-label="Every combination">
                      <thead>
                        <tr>
                          <Th align="right" className="w-12">
                            <span className="sr-only">Row</span>
                          </Th>
                          {matrix.columns.map((c, i) => (
                            <Th key={`${c}-${i}`}>{c}</Th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.rows.map((r, k) => (
                          <Tr key={k}>
                            <Td align="right" className="text-ink-3">
                              {k + 1}
                            </Td>
                            {r.map((x, i) => (
                              <Td key={i}>{x}</Td>
                            ))}
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </TableFrame>
                <p className="text-xs text-ink-3">
                  {matrix.total > VARIANT_CAP
                    ? `Showing the first ${formatCount(VARIANT_CAP)} of ${formatCount(matrix.total)} combinations. Fewer values keep an RFQ readable.`
                    : `${formatCount(matrix.total)} ${matrix.total === 1 ? "combination" : "combinations"}`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-3">Add an option and its values to see every combination.</p>
            )}
          </FormSection>

          <FormSection id="size-chart" title={shut("size-chart") ? OPTIONAL_LINES["size-chart"] : "Size chart"} caption="Points of measure, in the unit your spec uses." shut={shut("size-chart")} onOpen={opener("size-chart")}>
            <RowsTable label="Size chart" columns={SIZE_COLUMNS} rows={v.size_chart} onChange={(rows) => set("size_chart", rows)} blank={emptySizeRow} addLabel="Add measurement" />
          </FormSection>

          <FormSection id="materials" title={shut("materials") ? OPTIONAL_LINES.materials : "Materials"} caption="Bill of materials: every fabric and trim that goes into one piece." shut={shut("materials")} onOpen={opener("materials")}>
            <RowsTable label="Bill of materials" columns={BOM_COLUMNS} rows={v.bom} onChange={(rows) => set("bom", rows)} blank={emptyBomRow} addLabel="Add material" />
          </FormSection>

          <FormSection id="images" title={shut("images") ? OPTIONAL_LINES.images : "Images"} caption="The first image shows in your list. Use your own photos or sketches." shut={shut("images")} onOpen={opener("images")}>
            <div className="flex flex-wrap gap-2">
              {images.map((m, i) => (
                <div key={m.url} className="relative size-20 overflow-hidden rounded-md border border-line bg-sunken">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the buyer's own upload on storage, drawn at 80px */}
                  <img src={m.url} alt={`Product image ${i + 1}`} className="size-full object-cover" />
                  <IconButton icon={X} label={`Remove image ${i + 1}`} size={24} onClick={() => removeMedia(m.url)} className="absolute right-1 top-1 max-md:size-8" />
                </div>
              ))}
              <button
                type="button"
                onClick={() => imageInput.current?.click()}
                disabled={uploading !== null}
                aria-busy={uploading === "image" || undefined}
                className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong text-xs font-medium text-ink-2 outline-none hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-disabled"
              >
                <UploadSimple size={20} aria-hidden />
                {uploading === "image" ? "Uploading" : "Add images"}
              </button>
              <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => void upload(e.target.files, "image")} />
            </div>
            <p className="text-xs text-ink-3">JPG, PNG, WebP or GIF, up to 10 MB each.</p>
          </FormSection>

          <FormSection id="tech-pack" title={shut("tech-pack") ? OPTIONAL_LINES["tech-pack"] : "Tech pack"} caption="A PDF or an image, up to 10 MB. Every RFQ from this product attaches it." shut={shut("tech-pack")} onOpen={opener("tech-pack")}>
            {techPack ? (
              <div className="flex min-w-0 items-center gap-3 rounded-md border border-line p-3">
                <File size={24} className="shrink-0 text-ink-2" aria-hidden />
                <a href={techPack} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-base font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] [overflow-wrap:anywhere] max-md:flex max-md:min-h-11 max-md:items-center">
                  {fileNameOf(techPack)}
                </a>
                <Button onClick={() => techInput.current?.click()} disabled={uploading !== null} className="max-md:h-11">
                  Replace
                </Button>
                <Button kind="quiet" onClick={() => set("tech_pack_url", "")} className="max-md:h-11">
                  Remove
                </Button>
              </div>
            ) : (
              <div>
                <Button icon={Paperclip} onClick={() => techInput.current?.click()} loading={uploading === "tech_pack"} loadingLabel="Uploading" disabled={uploading !== null} className="max-md:h-11">
                  Upload tech pack
                </Button>
              </div>
            )}
            <input ref={techInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => void upload(e.target.files, "tech_pack")} />
          </FormSection>
        </div>
      </div>

      {buttons.length > 0 || error || isNew ? (
        <div className="sticky bottom-0 z-raised flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-8 py-3 [box-shadow:0_-4px_12px_rgb(21_24_28_/_0.06)] max-md:bottom-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom))] max-md:flex-col max-md:items-stretch max-md:px-4">
          {error ? (
            <p role="alert" className="w-full text-sm text-danger">
              {error}
            </p>
          ) : null}
          <p role="status" aria-live="polite" className={cn("flex min-w-0 items-center gap-3 text-base", needsName || invalid ? "text-caution" : "text-ink")}>
            {needsName && isNew ? (
              <span className="font-medium">{NAME_NEEDED}</span>
            ) : invalid ? (
              <span className="font-medium">{FIX_FIELDS}</span>
            ) : dirty && !isNew ? (
              <>
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-caution-icon" />
                <span className="font-medium">Unsaved changes</span>
                <span className="min-w-0 text-sm text-ink-3 [overflow-wrap:anywhere]">{changed.join(", ")}</span>
              </>
            ) : (
              <span className="text-sm text-ink-3">Only an active product can be sent in an RFQ. Only you can see your products.</span>
            )}
          </p>
          <div className="flex gap-2 max-md:[&>*]:flex-1">
            {buttons.map((b) => (
              <Button
                key={b.label}
                kind={b.primary ? "primary" : "secondary"}
                loading={b.saves !== null && busy === b.saves}
                loadingLabel="Saving"
                disabled={b.saves !== null && working}
                onClick={() => (b.saves === null ? discard() : void save(b.saves))}
                className="max-md:h-input-touch"
              >
                {b.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
