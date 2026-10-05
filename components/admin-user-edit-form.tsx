"use client";

// Admin user edit island (Spec A5). Role <select> + Suspend/Unsuspend
// button. Diff-aware: PATCH carries only changed keys. Suspend reveals
// reason input on first click, commits on second. Unsuspend confirms
// via window.confirm and clears server-side state.

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { adminFieldClass } from "@/components/admin/data-ui";
import { Button, Field, Input } from "@/components/kit";

type RoleVal = "buyer" | "supplier" | "admin";
type PlanVal = "starter" | "growth" | "enterprise";

const PLAN_OPTIONS: readonly PlanVal[] = ["starter", "growth", "enterprise"];

type Props = {
  userId: string;
  initialRole: RoleVal;
  initialSuspended: boolean;
  initialReason: string | null;
  initialPlan: PlanVal;
  isSelf?: boolean;
};

export function AdminUserEditForm({
  userId,
  initialRole,
  initialSuspended,
  initialReason,
  initialPlan,
  isSelf = false,
}: Props) {
  const router = useRouter();
  const [role, setRole] = useState<RoleVal>(initialRole);
  const [plan, setPlan] = useState<PlanVal>(initialPlan);
  const [suspended, setSuspended] = useState<boolean>(initialSuspended);
  const [reason, setReason] = useState<string>(initialReason ?? "");
  const [reasonOpen, setReasonOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const diff = useMemo(() => {
    const out: Record<string, unknown> = {};
    if (role !== initialRole) out.role = role;
    if (plan !== initialPlan) out.plan_tier = plan;
    if (suspended !== initialSuspended) {
      out.is_suspended = suspended;
      if (suspended) out.suspended_reason = reason.trim();
    } else if (
      suspended &&
      reason.trim() !== (initialReason ?? "").trim() &&
      reason.trim().length > 0
    ) {
      out.suspended_reason = reason.trim();
    }
    return out;
  }, [role, plan, suspended, reason, initialRole, initialPlan, initialSuspended, initialReason]);

  const isDirty = Object.keys(diff).length > 0;

  function submit(patch: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ patch }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as
            | { detail?: string; error?: string }
            | null;
          setError(j?.detail ?? j?.error ?? `Failed (${res.status})`);
          return;
        }
        setReasonOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function onSave() {
    if (!isDirty) return;
    // If a suspension flip would happen, require reason via the same
    // reveal flow as the standalone Suspend button (defensive — RPC
    // also enforces this).
    if (diff.is_suspended === true) {
      const r = (diff.suspended_reason as string | undefined) ?? "";
      if (!r || r.trim().length === 0) {
        setReasonOpen(true);
        setError("Reason is required to suspend.");
        return;
      }
    }
    submit(diff);
  }

  function onSuspendClick() {
    if (suspended) {
      // Unsuspend path — single confirm
      const ok = window.confirm(
        "Un-suspend this account? Suspension state and reason will be cleared.",
      );
      if (!ok) return;
      submit({ is_suspended: false });
      setSuspended(false);
      setReason("");
      return;
    }
    if (!reasonOpen) {
      setReasonOpen(true);
      setError(null);
      return;
    }
    if (reason.trim().length === 0) {
      setError("Reason is required.");
      return;
    }
    submit({ is_suspended: true, suspended_reason: reason.trim() });
    setSuspended(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Role" help={isSelf ? "You can't change your own role — ask another admin." : undefined} disabled={pending || isSelf}>
        {(a) => (
          <select
            {...a}
            value={role}
            onChange={(e) => setRole(e.target.value as RoleVal)}
            disabled={pending || isSelf}
            className={adminFieldClass}
          >
            <option value="buyer">buyer</option>
            <option value="supplier">supplier</option>
            <option value="admin">admin</option>
          </select>
        )}
      </Field>

      <Field label="Plan">
        {(a) => (
          <select
            {...a}
            value={plan}
            onChange={(e) => setPlan(e.target.value as PlanVal)}
            disabled={pending}
            className={adminFieldClass}
          >
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-2">Status:</span>
          <span className="text-base text-ink">{suspended ? "Suspended" : "Active"}</span>
          <Button
            kind={suspended ? "primary" : "danger"}
            onClick={onSuspendClick}
            disabled={pending || isSelf}
          >
            {suspended ? "Un-suspend" : reasonOpen ? "Confirm suspend" : "Suspend"}
          </Button>
        </div>
        {isSelf ? <p className="text-xs text-ink-3">You can&apos;t suspend your own account.</p> : null}
        {reasonOpen && !suspended ? (
          <Input
            type="text"
            aria-label="Reason for suspending"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for suspending (required)"
            maxLength={2000}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button kind="primary" onClick={onSave} disabled={pending || !isDirty}>
          {isDirty ? "Save changes" : "No changes"}
        </Button>
        {pending ? <span className="text-sm text-ink-3">Saving…</span> : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
