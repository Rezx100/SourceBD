"use client";

// Admin supplier editor island (Spec A2). Submits a PATCH to
// /api/v1/admin/suppliers/<id>; only fields the user actually touched are
// sent, so we can't accidentally clobber a column with a stale value.

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormGrid } from "@/components/ui/form-grid";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";

type Initial = {
  name_display: string;
  description: string;
  entity_type: string;
  published: boolean;
  sanctioned_flag: boolean;
  sanctioned_reason: string;
  notes_admin: string;
};

export function AdminSupplierEditorForm({
  id,
  initial,
}: {
  id: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Initial>(initial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(() => {
    const out: Partial<Initial> = {};
    if (form.name_display.trim() !== initial.name_display.trim())
      out.name_display = form.name_display.trim();
    if (form.description !== initial.description) out.description = form.description;
    if (form.entity_type !== initial.entity_type) out.entity_type = form.entity_type;
    if (form.published !== initial.published) out.published = form.published;
    if (form.sanctioned_flag !== initial.sanctioned_flag)
      out.sanctioned_flag = form.sanctioned_flag;
    if (form.sanctioned_reason !== initial.sanctioned_reason)
      out.sanctioned_reason = form.sanctioned_reason;
    if (form.notes_admin !== initial.notes_admin) out.notes_admin = form.notes_admin;
    return out;
  }, [form, initial]);

  const hasChanges = Object.keys(dirty).length > 0;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasChanges) return;
    setError(null);
    setOk(false);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/suppliers/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ patch: dirty }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as
            | { detail?: string; error?: string }
            | null;
          setError(j?.detail ?? j?.error ?? `Failed (${res.status})`);
          return;
        }
        setOk(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <FormGrid cols="profile">
        <Field label="Buyer-facing company name" hint="Optional override of the register company name shown to buyers (240 characters max).">
          <input
            type="text"
            value={form.name_display}
            maxLength={240}
            onChange={(e) => setForm((f) => ({ ...f, name_display: e.target.value }))}
            className="w-full rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
          />
        </Field>
        <Field label="Supplier type">
          <select
            value={form.entity_type}
            onChange={(e) => setForm((f) => ({ ...f, entity_type: e.target.value }))}
            className="w-full rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
          >
            <option value="factory">Factory</option>
            <option value="buying_house">Buying house</option>
            <option value="unknown">Unknown</option>
          </select>
        </Field>
      </FormGrid>

      <Field label="Buyer-facing description" hint="Short profile blurb shown on profile surfaces (8,000 characters max).">
        <textarea
          rows={4}
          value={form.description}
          maxLength={8000}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="w-full rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
        />
      </Field>

      <FormGrid cols="profile">
        <Field label="Publication status">
          <Toggle
            checked={form.published}
            onChange={(v) => setForm((f) => ({ ...f, published: v }))}
            label={form.published ? "Published" : "Unpublished"}
          />
        </Field>
        <Field label="Sanctions status">
          <Toggle
            checked={form.sanctioned_flag}
            onChange={(v) => setForm((f) => ({ ...f, sanctioned_flag: v }))}
            label={form.sanctioned_flag ? "Sanctioned" : "Clear"}
          />
        </Field>
      </FormGrid>

      <Field label="Sanctions reason" hint="Cited Tier 1–5 source or admin decision note. Required when a supplier is flagged (2,000 characters max).">
        <textarea
          rows={2}
          value={form.sanctioned_reason}
          maxLength={2000}
          onChange={(e) =>
            setForm((f) => ({ ...f, sanctioned_reason: e.target.value }))
          }
          className="w-full rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
        />
      </Field>

      <Field label="Internal admin notes" hint="Internal only. Never shown to buyers or suppliers (8,000 characters max).">
        <textarea
          rows={3}
          value={form.notes_admin}
          maxLength={8000}
          onChange={(e) => setForm((f) => ({ ...f, notes_admin: e.target.value }))}
          className="w-full rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
        />
      </Field>

      <StickyActionBar
        helper={
          hasChanges ? (
            <span className="font-mono text-[11px] text-ink-tertiary">
              patching {Object.keys(dirty).join(", ")}
            </span>
          ) : ok ? (
            <span className="text-[12px] text-sem-green">Saved.</span>
          ) : error ? (
            <span className="text-[12px] text-sem-red">{error}</span>
          ) : undefined
        }
      >
        <Button type="submit" variant="primary" disabled={pending || !hasChanges} className="min-h-[44px]">
          {pending ? "Saving…" : hasChanges ? "Save changes" : "No changes"}
        </Button>
      </StickyActionBar>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
      <span className="text-[11px] text-ink-tertiary">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[11px] text-ink-tertiary">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm " +
        (checked
          ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
          : "border-hairline text-ink-tertiary hover:text-ink-primary")
      }
    >
      <span
        className={
          "inline-block h-2 w-2 rounded-full " +
          (checked ? "bg-accent-indigo" : "bg-ink-tertiary")
        }
      />
      {label}
    </button>
  );
}
