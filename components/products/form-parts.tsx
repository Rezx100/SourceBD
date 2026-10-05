"use client";

// The product editor's parts (Paper `10 · Product editor`): a titled section that can stand shut
// ("Add when you're ready"), a field of chips (tags, option values), and an editable table of text rows
// (the size chart, the materials) that is a table from 768 and a card per row under it. Client: they
// hold what is being typed.

import { Plus, X } from "@phosphor-icons/react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, IconButton, Input } from "@/components/kit";
import { fieldBox, fieldEdge } from "@/components/kit/classes";
import { cleanValues, type RowColumn } from "@/components/product-form-model";
import { cn } from "@/lib/utils";

/** A section of the form. `shut` shows its name and an Add button instead of its fields. */
export function FormSection({ id, title, name, caption, shut, onOpen, children }: { id: string; title: string; /** What "Add" adds, when the title says more than that. */ name?: string; caption?: ReactNode; shut?: boolean; onOpen?: () => void; children: ReactNode }) {
  return (
    <section id={id} aria-label={title} className="flex scroll-mt-6 flex-col gap-3 border-t border-line pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-md font-semibold text-ink">{title}</h2>
          {caption && !shut ? <p className="text-base text-ink-2">{caption}</p> : null}
        </div>
        {shut ? (
          <Button onClick={onOpen} icon={Plus} aria-label={`Add ${(name ?? title).toLowerCase()}`} className="max-md:h-11">
            Add
          </Button>
        ) : null}
      </div>
      {shut ? null : children}
    </section>
  );
}

/**
 * Values as chips with a field to add more: Enter or a comma adds, Backspace in the empty field takes
 * the last one back, leaving the field keeps what was typed. Repeats are dropped (`cleanValues`).
 */
export function ChipInput({ id, values, onChange, placeholder, label }: { id: string; values: string[]; onChange: (values: string[]) => void; placeholder?: string; label?: string }) {
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
    <div className={cn(fieldBox, "flex min-h-control min-w-0 flex-wrap items-center gap-1 px-1 py-[3px] focus-within:border-brand focus-within:[box-shadow:inset_0_0_0_1px_theme(colors.brand)] max-md:min-h-input-touch")}>
      {values.map((t, i) => (
        <span key={t} className="inline-flex h-6 items-center gap-0.5 rounded-sm border border-line bg-subtle pl-2 pr-0.5 text-sm text-ink">
          {t}
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="grid size-5 place-items-center rounded-sm text-ink-3 outline-none hover:bg-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand max-md:size-8"
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={values.length === 0 ? placeholder : "Add another"}
        className="h-6 min-w-[7rem] flex-1 bg-transparent px-1.5 text-base text-ink outline-none placeholder:text-ink-3 max-md:h-9 max-md:text-md"
      />
    </div>
  );
}

const cell = cn(fieldBox, fieldEdge, "h-8 px-2 text-sm");

/** An editable table of text rows: one input per cell, add and remove rows. A card per row under 768. */
export function RowsTable<K extends string>({ label, columns, rows, onChange, blank, addLabel }: { label: string; columns: readonly RowColumn<K>[]; rows: Record<K, string>[]; onChange: (rows: Record<K, string>[]) => void; blank: () => Record<K, string>; addLabel: string }) {
  const edit = (i: number, k: K, value: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: value } : r)));
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));
  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 ? (
        <>
          <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto rounded-md border border-line outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand max-md:hidden">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-base">
              <thead>
                <tr className="bg-subtle text-xs font-medium text-ink-3">
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className={cn("h-row-head border-b border-line px-2 font-medium", c.width)}>
                      {c.label === c.full ? c.label : <abbr title={c.full} className="no-underline">{c.label}</abbr>}
                    </th>
                  ))}
                  <th scope="col" className="h-row-head w-10 border-b border-line">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="border-b border-line px-1.5 py-1.5 align-middle">
                        <input aria-label={`${c.full}, row ${i + 1}`} value={r[c.key]} onChange={(e) => edit(i, c.key, e.target.value)} placeholder={i === 0 ? c.placeholder : undefined} className={cell} />
                      </td>
                    ))}
                    <td className="border-b border-line px-1 text-center align-middle">
                      <IconButton icon={X} label={`Remove row ${i + 1}`} kind="quiet" size={32} onClick={() => remove(i)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-md border border-line p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-2">
                    {label} · row {i + 1}
                  </span>
                  <IconButton icon={X} label={`Remove row ${i + 1}`} kind="quiet" size={44} onClick={() => remove(i)} />
                </div>
                {columns.map((c) => (
                  <label key={c.key} className="flex flex-col gap-1 text-sm font-medium text-ink">
                    {c.full}
                    <Input value={r[c.key]} onChange={(e) => edit(i, c.key, e.target.value)} placeholder={i === 0 ? c.placeholder : undefined} size="touch" />
                  </label>
                ))}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-ink-3">Nothing here yet.</p>
      )}
      <div>
        <Button icon={Plus} onClick={() => onChange([...rows, blank()])} className="max-md:h-11">
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
