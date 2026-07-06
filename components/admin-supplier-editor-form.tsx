"use client";

// Admin supplier editor island (Spec A2). Submits a PATCH to
// /api/v1/admin/suppliers/<id>; only fields the user actually touched are
// sent, so we can't accidentally clobber a column with a stale value.

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormGrid } from "@/components/ui/form-grid";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import {
  ADMIN_INPUT_CLASS,
  AdminField,
} from "@/components/admin/admin-ui";

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
  const [baseline, setBaseline] = useState<Initial>(initial);
  const [form, setForm] = useState<Initial>(initial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(() => {
    const out: Partial<Initial> = {};
    if (form.name_display.trim() !== baseline.name_display.trim())
      out.name_display = form.name_display.trim();
    if (form.description !== baseline.description) out.description = form.description;
    if (form.entity_type !== baseline.entity_type) out.entity_type = form.entity_type;
    if (form.published !== baseline.published) out.published = form.published;
    if (form.sanctioned_flag !== baseline.sanctioned_flag)
      out.sanctioned_flag = form.sanctioned_flag;
    if (form.sanctioned_reason !== baseline.sanctioned_reason)
      out.sanctioned_reason = form.sanctioned_reason;
    if (form.notes_admin !== baseline.notes_admin) out.notes_admin = form.notes_admin;
    return out;
  }, [form, baseline]);

  const hasChanges = Object.keys(dirty).length > 0;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasChanges) return;
    setError(null);
    setOk(null);
    const submitted = form;
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
          setError(normalizeAdminError(j?.detail ?? j?.error ?? `Failed (${res.status})`));
          return;
        }
        setBaseline(submitted);
        setOk("Saved. Public supplier pages are refreshing now.");
        router.refresh();
      } catch (err) {
        setError(normalizeAdminError(err instanceof Error ? err.message : String(err)));
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-semibold text-red-900">Changes were not saved.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : ok ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {ok}
        </div>
      ) : null}

      <FormGrid cols="profile">
        <AdminField label="Buyer-facing company name" hint="Optional override of the register company name shown to buyers (240 characters max).">
          <input
            type="text"
            value={form.name_display}
            maxLength={240}
            onChange={(e) => setForm((f) => ({ ...f, name_display: e.target.value }))}
            className={ADMIN_INPUT_CLASS}
          />
        </AdminField>
        <AdminField label="Supplier type">
          <select
            value={form.entity_type}
            onChange={(e) => setForm((f) => ({ ...f, entity_type: e.target.value }))}
            className={ADMIN_INPUT_CLASS}
          >
            <option value="factory">Factory</option>
            <option value="buying_house">Buying house</option>
            <option value="unknown">Unknown</option>
          </select>
        </AdminField>
      </FormGrid>

      <AdminField label="Buyer-facing description" hint="Short profile blurb shown on profile surfaces (8,000 characters max).">
        <textarea
          rows={4}
          value={form.description}
          maxLength={8000}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={ADMIN_INPUT_CLASS}
        />
      </AdminField>

      <FormGrid cols="profile">
        <AdminField label="Publication status">
          <Toggle
            checked={form.published}
            onChange={(v) => setForm((f) => ({ ...f, published: v }))}
            label={form.published ? "Published" : "Unpublished"}
          />
        </AdminField>
        <AdminField label="Sanctions status">
          <Toggle
            checked={form.sanctioned_flag}
            onChange={(v) => setForm((f) => ({ ...f, sanctioned_flag: v }))}
            label={form.sanctioned_flag ? "Sanctioned" : "Clear"}
          />
        </AdminField>
      </FormGrid>

      <AdminField label="Sanctions reason" hint="Cited Tier 1–5 source or admin decision note. Required when a supplier is flagged (2,000 characters max).">
        <textarea
          rows={2}
          value={form.sanctioned_reason}
          maxLength={2000}
          onChange={(e) =>
            setForm((f) => ({ ...f, sanctioned_reason: e.target.value }))
          }
          className={ADMIN_INPUT_CLASS}
        />
      </AdminField>

      <AdminField label="Internal admin notes" hint="Internal only. Never shown to buyers or suppliers (8,000 characters max).">
        <textarea
          rows={3}
          value={form.notes_admin}
          maxLength={8000}
          onChange={(e) => setForm((f) => ({ ...f, notes_admin: e.target.value }))}
          className={ADMIN_INPUT_CLASS}
        />
      </AdminField>

      <StickyActionBar
        helper={
          error ? (
            <span className="text-[13px] text-sem-red">{error}</span>
          ) : ok ? (
            <span className="text-[13px] text-sem-green">{ok}</span>
          ) : hasChanges ? (
            <span className="font-mono text-[12px] text-ink-tertiary">
              Unsaved changes: {Object.keys(dirty).join(", ")}
            </span>
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

function normalizeAdminError(message: string): string {
  if (/needs\s*>=?\s*1 active Tier1-3 source_record/i.test(message)) {
    return "Cannot publish this supplier until it has at least one active Tier 1-3 evidence source.";
  }
  if (/admin only/i.test(message)) {
    return "Your admin session could not be verified. Sign in again with an admin account and retry.";
  }
  return message;
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
        "inline-flex min-h-[44px] items-center gap-2 rounded-pill border px-3 text-sm font-semibold transition-colors " +
        (checked
          ? "border-brand-forest/30 bg-brand-forest-soft text-brand-forest"
          : "border-neutral-200 bg-white text-ink-secondary hover:bg-brand-forest-tint hover:text-ink-primary")
      }
    >
      <span
        className={
          "inline-block h-2 w-2 rounded-full " +
          (checked ? "bg-brand-forest" : "bg-ink-tertiary")
        }
      />
      {label}
    </button>
  );
}
