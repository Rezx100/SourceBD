"use client";

// Admin supplier editor island (Spec A2). Submits a PATCH to
// /api/v1/admin/suppliers/<id>; only fields the user actually touched are
// sent, so we can't accidentally clobber a column with a stale value.

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { adminAreaClass, adminFieldClass } from "@/components/admin/data-ui";
import { Button, Field, InlineError, Switch } from "@/components/kit";

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
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {error ? (
        <InlineError>
          <span className="flex flex-col">
            <span className="font-semibold">Changes were not saved.</span>
            <span className="font-normal text-ink-2">{error}</span>
          </span>
        </InlineError>
      ) : ok ? (
        <p role="status" className="rounded-md bg-subtle px-4 py-3 text-base text-ink">
          {ok}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Buyer-facing company name" help="Optional override of the register company name shown to buyers (240 characters max).">
          {(a) => (
            <input
              {...a}
              type="text"
              value={form.name_display}
              maxLength={240}
              onChange={(e) => setForm((f) => ({ ...f, name_display: e.target.value }))}
              className={adminFieldClass}
            />
          )}
        </Field>
        <Field label="Supplier type">
          {(a) => (
            <select
              {...a}
              value={form.entity_type}
              onChange={(e) => setForm((f) => ({ ...f, entity_type: e.target.value }))}
              className={adminFieldClass}
            >
              <option value="factory">Factory</option>
              <option value="buying_house">Buying house</option>
              <option value="unknown">Unknown</option>
            </select>
          )}
        </Field>
      </div>

      <Field label="Buyer-facing description" help="Short profile blurb shown on profile surfaces (8,000 characters max).">
        {(a) => (
          <textarea
            {...a}
            rows={4}
            value={form.description}
            maxLength={8000}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={adminAreaClass}
          />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Publication status</span>
          <Switch checked={form.published} onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}>
            {form.published ? "Published" : "Unpublished"}
          </Switch>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Sanctions status</span>
          <Switch checked={form.sanctioned_flag} onChange={(e) => setForm((f) => ({ ...f, sanctioned_flag: e.target.checked }))}>
            {form.sanctioned_flag ? "Sanctioned" : "Clear"}
          </Switch>
        </div>
      </div>

      <Field label="Sanctions reason" help="Cited Tier 1–5 source or admin decision note. Required when a supplier is flagged (2,000 characters max).">
        {(a) => (
          <textarea
            {...a}
            rows={2}
            value={form.sanctioned_reason}
            maxLength={2000}
            onChange={(e) => setForm((f) => ({ ...f, sanctioned_reason: e.target.value }))}
            className={adminAreaClass}
          />
        )}
      </Field>

      <Field label="Internal admin notes" help="Internal only. Never shown to buyers or suppliers (8,000 characters max).">
        {(a) => (
          <textarea
            {...a}
            rows={3}
            value={form.notes_admin}
            maxLength={8000}
            onChange={(e) => setForm((f) => ({ ...f, notes_admin: e.target.value }))}
            className={adminAreaClass}
          />
        )}
      </Field>

      <div className="sticky bottom-0 z-raised flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface py-3">
        <div className="min-w-0 text-sm">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : ok ? (
            <span className="text-ink-2">{ok}</span>
          ) : hasChanges ? (
            <span className="font-mono text-xs text-ink-3">Unsaved changes: {Object.keys(dirty).join(", ")}</span>
          ) : null}
        </div>
        <Button type="submit" kind="primary" disabled={pending || !hasChanges}>
          {pending ? "Saving…" : hasChanges ? "Save changes" : "No changes"}
        </Button>
      </div>
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
