"use client";

// The product form (27 Sep 2026, the founder's product base): create a
// product by hand, or edit one — Basic, Production, Classification, Media,
// Variants, Size chart, BOM and Tech pack as tonal sections in one column, and
// a sticky footer that says what is still needed, saves a draft or submits.
// Drawn by `/app/products/new` and `/app/products/[id]`.
//
// Both saves are `POST /api/v1/products {action:"upsert", product}` → `{id}`;
// images and the tech pack go first to `POST /api/v1/products/media`
// (multipart `{file, kind}` → `{url, kind}`) and the product keeps the URLs.
// The pure half (matrix, validation, payload) is `product-form-model.ts`.

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useContext, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Chip } from "@/components/dashboard/chips";
import { Button } from "@/components/dashboard/controls";
import { Field, SelectInput, TextArea, TextInput } from "@/components/dashboard/fields";
import { Icon } from "@/components/dashboard/icons";
import { Cell, DataTable, ErrorNote, HeadCell, PageSection } from "@/components/dashboard/page";
import { Caption } from "@/components/dashboard/type";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import {
  BOM_COLUMNS,
  PRODUCT_CATEGORIES,
  SIZE_COLUMNS,
  VARIANT_CAP,
  cleanValues,
  emptyBomRow,
  emptySizeRow,
  fileNameOf,
  releasedFiles,
  routeSentence,
  toPayload,
  validateProduct,
  variantMatrix,
  type MediaKind,
  type ProductErrors,
  type ProductValues,
  type RowColumn,
} from "./product-form-model";

/** Stable ids, so a label, an error and a test all find the same control. */
const FIELD_ID = { name: "product-name", price_usd: "product-price", moq: "product-moq" } as const;

type Json = Record<string, unknown> | null;

/** The route's own sentence where it gave one; plain words otherwise. Never a status code. */
function refusal(status: number, json: Json, what: "save" | "upload"): string {
  if (status === 0) return "Could not reach SourceBD — no connection. Your product is still here; try again.";
  if (status === 401 || status === 403) return `Sign in with a buyer account to ${what === "save" ? "save products" : "upload files"}.`;
  if (status === 404) return "This product no longer exists — it may have been deleted in another tab.";
  if (status === 413) return "That file is too large to upload. Files can be 10 MB at most.";
  if (status === 429) return "Too many requests in a minute. Wait a moment and try again.";
  const said = routeSentence(json);
  if (said) return said;
  return what === "save"
    ? "Could not save this product. Nothing was lost; try again in a moment."
    : "Could not upload that file. Try again in a moment.";
}

export function ProductForm({ initial }: { initial: ProductValues }) {
  // Not `useRouter()`, which throws outside a mounted app router (the render tests have none).
  const router = useContext(AppRouterContext);
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<ProductErrors>({});
  const [busy, setBusy] = useState<"draft" | "active" | null>(null);
  const [uploading, setUploading] = useState<MediaKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const techInput = useRef<HTMLInputElement>(null);
  // Every file this form uploaded, so a save can remove the ones it did not keep.
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
  const needsName = !v.name.trim();
  const invalid = Object.keys(errors).length > 0;

  async function save(status: "draft" | "active") {
    if (busy) return;
    const e = validateProduct(v);
    setErrors(e);
    const first = (Object.keys(FIELD_ID) as (keyof typeof FIELD_ID)[]).find((k) => e[k]);
    if (first) {
      document.getElementById(FIELD_ID[first])?.focus();
      return;
    }
    setBusy(status);
    setError(null);
    let res: Response;
    let json: Json = null;
    try {
      res = await fetch("/api/v1/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "upsert", product: toPayload(v, status) }),
      });
      json = (await res.json().catch(() => null)) as Json;
    } catch {
      setBusy(null);
      setError(refusal(0, null, "save"));
      return;
    }
    const id = typeof json?.id === "string" ? json.id : null;
    if (!res.ok || !id) {
      setBusy(null);
      setError(refusal(res.status, json, "save"));
      return;
    }
    // The files the saved product no longer holds leave storage too; best
    // effort, and `keepalive` so the navigation below does not cancel them.
    for (const url of releasedFiles(initial, uploaded.current, v)) {
      void fetch("/api/v1/products/media", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
        keepalive: true,
      }).catch(() => undefined);
    }
    // Busy stays on through the navigation, so a second press cannot save twice.
    const next = `/app/products?saved=${encodeURIComponent(id)}`;
    if (router) {
      router.replace(next);
      router.refresh();
    } else {
      window.location.assign(next);
    }
  }

  async function upload(files: FileList | null, kind: MediaKind) {
    if (!files?.length || uploading) return;
    setUploading(kind);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        body.append("kind", kind);
        let res: Response;
        let json: Json = null;
        try {
          res = await fetch("/api/v1/products/media", { method: "POST", body });
          json = (await res.json().catch(() => null)) as Json;
        } catch {
          setError(refusal(0, null, "upload"));
          return;
        }
        const url = typeof json?.url === "string" ? json.url : null;
        if (!res.ok || !url) {
          setError(refusal(res.status, json, "upload"));
          return;
        }
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

  const removeMedia = (url: string) => set("media", v.media.filter((m) => m.url !== url));

  const described = (k: keyof ProductErrors) => (errors[k] ? `${FIELD_ID[k]}-error` : undefined);

  return (
    <form
      aria-label="Product"
      // Enter in a field does nothing: saving is the footer's, never an accident.
      onSubmit={(e) => e.preventDefault()}
      noValidate
      className="flex w-full max-w-[56rem] flex-col gap-6"
    >
      <Section title="Basic">
        <Field label="Name" htmlFor={FIELD_ID.name} required error={errors.name} hint="What you call it. An RFQ sent from this product starts with this name.">
          <TextInput
            id={FIELD_ID.name}
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Men's slim-fit stretch jeans"
            aria-required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={described("name")}
            maxLength={200}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product number" htmlFor="product-number" hint="Your own style or article number.">
            <TextInput id="product-number" value={v.product_number} onChange={(e) => set("product_number", e.target.value)} placeholder="e.g. SS27-DN-014" />
          </Field>
          <Field label="Customer product number" htmlFor="product-customer-number" hint="Your customer's reference, if they gave one.">
            <TextInput
              id="product-customer-number"
              value={v.customer_product_number}
              onChange={(e) => set("customer_product_number", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Description" htmlFor="product-description" hint="Fit, fabric feel, wash, trims — whatever a factory needs to quote it.">
          <TextArea id="product-description" value={v.description} onChange={(e) => set("description", e.target.value)} rows={4} />
        </Field>
      </Section>

      <Section title="Production">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price (USD)" htmlFor={FIELD_ID.price_usd} error={errors.price_usd} hint="Your target price per piece, in US dollars.">
            <TextInput
              id={FIELD_ID.price_usd}
              value={v.price_usd}
              onChange={(e) => set("price_usd", e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 8.50"
              aria-invalid={errors.price_usd ? true : undefined}
              aria-describedby={described("price_usd")}
            />
          </Field>
          <Field label="MOQ" htmlFor={FIELD_ID.moq} error={errors.moq} hint="Minimum order quantity, in pieces.">
            <TextInput
              id={FIELD_ID.moq}
              value={v.moq}
              onChange={(e) => set("moq", e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 1200"
              aria-invalid={errors.moq ? true : undefined}
              aria-describedby={described("moq")}
            />
          </Field>
        </div>
        <Field label="Main material" htmlFor="product-material" hint="The composition as it goes on the care label.">
          <TextInput
            id="product-material"
            value={v.main_material}
            onChange={(e) => set("main_material", e.target.value)}
            placeholder="e.g. 82% Cotton / 17% PA / 1% EL"
          />
        </Field>
      </Section>

      <Section title="Classification">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="product-category">
            <SelectInput id="product-category" value={v.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Choose a category</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {/* A category saved before the list changed still shows as itself. */}
              {v.category && !(PRODUCT_CATEGORIES as readonly string[]).includes(v.category) ? <option value={v.category}>{v.category}</option> : null}
            </SelectInput>
          </Field>
          <Field label="Tags" htmlFor="product-tags" hint="Press Enter or a comma after each tag.">
            <ChipInput id="product-tags" values={v.tags} onChange={(tags) => set("tags", tags)} placeholder="e.g. SS27, organic" />
          </Field>
        </div>
      </Section>

      <Section title="Media" caption="The first image is the one your product list shows.">
        <div className="flex flex-wrap gap-2">
          {images.map((m, i) => (
            <div key={m.url} className="relative size-20 overflow-hidden rounded-sm bg-surface-sunken shadow-edge">
              {/* eslint-disable-next-line @next/next/no-img-element -- the buyer's own upload on storage, drawn at 80px */}
              <img src={m.url} alt={`Product image ${i + 1}`} className="size-full object-cover" />
              <Button icon size="sm" aria-label={`Remove image ${i + 1}`} onClick={() => removeMedia(m.url)} className="absolute right-1 top-1">
                <Icon name="x" />
              </Button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={uploading !== null}
            aria-busy={uploading === "image" || undefined}
            className="grid size-20 place-items-center rounded-sm border border-dashed border-line-strong text-xs font-medium text-ink-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-ink-strong disabled:cursor-not-allowed disabled:text-ink-disabled"
          >
            <span className="flex flex-col items-center gap-1">
              <Icon name={uploading === "image" ? "spinner" : "image"} className={uploading === "image" ? "animate-spin motion-reduce:animate-none" : undefined} />
              {uploading === "image" ? "Uploading" : "Add images"}
            </span>
          </button>
          <input
            ref={imageInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => void upload(e.target.files, "image")}
          />
        </div>
        <Caption>JPG, PNG, WebP or GIF, up to 10 MB each.</Caption>
      </Section>

      <Section title="Variants" caption="Options and their values; every combination is listed below.">
        {v.options.map((o, i) => (
          <div key={i} className="grid items-start gap-3 sm:grid-cols-[12rem_1fr_auto]">
            <Field label="Option" htmlFor={`product-option-${i}-name`}>
              <TextInput
                id={`product-option-${i}-name`}
                value={o.name}
                onChange={(e) => set("options", v.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder={i === 0 ? "e.g. Waist" : "e.g. Colour"}
              />
            </Field>
            <Field label="Values" htmlFor={`product-option-${i}-values`}>
              <ChipInput
                id={`product-option-${i}-values`}
                values={o.values}
                onChange={(values) => set("options", v.options.map((x, j) => (j === i ? { ...x, values } : x)))}
                placeholder={i === 0 ? "e.g. 28, 30, 32" : "e.g. Mid-wash, Black"}
              />
            </Field>
            <Button
              icon
              variant="ghost"
              aria-label={`Remove option ${o.name.trim() || i + 1}`}
              onClick={() => set("options", v.options.filter((_, j) => j !== i))}
              className="sm:mt-[1.625rem]"
            >
              <Icon name="trash" />
            </Button>
          </div>
        ))}
        <div>
          <Button size="sm" onClick={() => set("options", [...v.options, { name: "", values: [] }])}>
            <Icon name="plus" /> Add option
          </Button>
        </div>
        {matrix.total > 0 ? (
          <div className="flex flex-col gap-2">
            <DataTable label="Every combination" dense stack={false} minWidth="16rem" className="max-h-80 overflow-y-auto rounded-sm shadow-edge">
              <thead>
                <tr>
                  <HeadCell align="right" className="w-12">
                    <span className="sr-only">Row</span>
                  </HeadCell>
                  {matrix.columns.map((c, i) => (
                    <HeadCell key={`${c}-${i}`}>{c}</HeadCell>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((r, k) => (
                  <tr key={k}>
                    <Cell align="right" className="text-ink-subtle">
                      {k + 1}
                    </Cell>
                    {r.map((x, i) => (
                      <Cell key={i}>{x}</Cell>
                    ))}
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <Caption>
              {matrix.total > VARIANT_CAP
                ? `Showing the first ${formatCount(VARIANT_CAP)} of ${formatCount(matrix.total)} combinations. Fewer values keep an RFQ readable.`
                : `${formatCount(matrix.total)} ${matrix.total === 1 ? "combination" : "combinations"}`}
            </Caption>
          </div>
        ) : (
          <Caption>Add an option and its values to see every combination.</Caption>
        )}
      </Section>

      <Section title="Size chart (POM)" caption="Points of measure, in the unit your spec uses.">
        <RowsTable
          label="Size chart"
          columns={SIZE_COLUMNS}
          rows={v.size_chart}
          onChange={(rows) => set("size_chart", rows)}
          blank={emptySizeRow}
          addLabel="Add measurement"
        />
      </Section>

      <Section title="BOM" caption="Bill of materials: every fabric and trim that goes into one piece.">
        <RowsTable label="Bill of materials" columns={BOM_COLUMNS} rows={v.bom} onChange={(rows) => set("bom", rows)} blank={emptyBomRow} addLabel="Add material" />
      </Section>

      <Section title="Tech pack">
        {techPack ? (
          <div className="flex min-w-0 items-center gap-3 rounded-sm bg-surface-sunken px-3 py-2">
            <Icon name="paperclip" className="text-ink-muted" />
            <a href={techPack} target="_blank" rel="noreferrer" className="link min-w-0 flex-1 text-sm font-medium [overflow-wrap:anywhere]">
              {fileNameOf(techPack)}
            </a>
            <Button size="sm" variant="ghost" onClick={() => set("tech_pack_url", "")}>
              Remove
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => techInput.current?.click()} loading={uploading === "tech_pack"} disabled={uploading !== null}>
            {uploading === "tech_pack" ? null : <Icon name="paperclip" />} {techPack ? "Replace tech pack" : "Upload tech pack"}
          </Button>
          <Caption>A PDF or an image, up to 10 MB.</Caption>
          <input
            ref={techInput}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => void upload(e.target.files, "tech_pack")}
          />
        </div>
      </Section>

      <div className="glass sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-md px-4 py-3 shadow-md">
        {error ? <ErrorNote className="w-full">{error}</ErrorNote> : null}
        <span
          role="status"
          aria-live="polite"
          className={cn("inline-flex min-w-0 flex-1 items-center gap-1 text-xs", needsName || invalid ? "text-caution-ink" : "text-ink-subtle")}
        >
          {needsName ? (
            <>
              <Icon name="warn" small /> Still needed: a name
            </>
          ) : invalid ? (
            <>
              <Icon name="warn" small /> Fix the fields marked above
            </>
          ) : (
            <>Save draft keeps it a draft; Submit makes it active. Only you can see your products.</>
          )}
        </span>
        <Button onClick={() => void save("draft")} loading={busy === "draft"} disabled={busy !== null || uploading !== null}>
          Save draft
        </Button>
        <Button variant="primary" onClick={() => void save("active")} loading={busy === "active"} disabled={busy !== null || uploading !== null}>
          <Icon name="check" /> Submit
        </Button>
      </div>
    </form>
  );
}

/** A tonal section with its body padded: the form's one container. */
function Section({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return (
    <PageSection title={title} caption={caption}>
      <div className="flex flex-col gap-4 p-4 sm:p-5">{children}</div>
    </PageSection>
  );
}

/**
 * Values as chips with a field to add more: Enter or a comma adds, Backspace
 * in the empty field takes the last one back, leaving the field keeps what was
 * typed. Repeats are dropped (`cleanValues`).
 */
function ChipInput({
  id,
  values,
  onChange,
  placeholder,
}: {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return setDraft("");
    onChange(cleanValues([...values, ...draft.split(",")]));
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <div className="flex min-h-control min-w-0 flex-wrap items-center gap-1 rounded-sm border border-line-strong bg-surface px-1 py-[3px]">
      {values.map((t, i) => (
        <Chip key={t} compact className="pr-0.5">
          {t}
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="grid size-4 place-items-center rounded-xs text-ink-subtle transition-colors duration-fast hover:bg-surface-sunken hover:text-ink-strong"
          >
            <Icon name="x" small />
          </button>
        </Chip>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={values.length === 0 ? placeholder : "Add another"}
        className="h-6 min-w-[7rem] flex-1 rounded-xs bg-transparent px-1.5 text-base text-ink-strong placeholder:text-ink-subtle"
      />
    </div>
  );
}

/** An editable table of text rows (the size chart, the BOM): one input per cell, add and remove rows. */
function RowsTable<K extends string>({
  label,
  columns,
  rows,
  onChange,
  blank,
  addLabel,
}: {
  label: string;
  columns: readonly RowColumn<K>[];
  rows: Record<K, string>[];
  onChange: (rows: Record<K, string>[]) => void;
  blank: () => Record<K, string>;
  addLabel: string;
}) {
  const edit = (i: number, k: K, value: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: value } : r)));
  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 ? (
        <DataTable label={label} stack={false} minWidth="40rem" className="rounded-sm shadow-edge">
          <thead>
            <tr>
              {columns.map((c) => (
                <HeadCell key={c.key} className={cn("px-2", c.width)}>
                  {c.label === c.full ? c.label : <abbr title={c.full} className="no-underline">{c.label}</abbr>}
                </HeadCell>
              ))}
              <HeadCell className="w-10 px-2">
                <span className="sr-only">Remove</span>
              </HeadCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className="border-b border-line-subtle px-2 py-1.5 align-middle">
                    <TextInput
                      aria-label={`${c.full}, row ${i + 1}`}
                      value={r[c.key]}
                      onChange={(e) => edit(i, c.key, e.target.value)}
                      placeholder={i === 0 ? c.placeholder : undefined}
                      className="h-8 text-sm"
                    />
                  </td>
                ))}
                <td className="border-b border-line-subtle px-2 py-1.5 text-right align-middle">
                  <Button icon size="sm" variant="ghost" aria-label={`Remove row ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                    <Icon name="trash" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <Caption>Nothing here yet.</Caption>
      )}
      <div>
        <Button size="sm" onClick={() => onChange([...rows, blank()])}>
          <Icon name="plus" /> {addLabel}
        </Button>
      </div>
    </div>
  );
}
