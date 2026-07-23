"use client";

// Admin user edit island (Spec A5). Role <select> + Suspend/Unsuspend
// button. Diff-aware: PATCH carries only changed keys. Suspend reveals
// reason input on first click, commits on second. Unsuspend confirms
// via window.confirm and clears server-side state.

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

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
    <div className="space-y-4">
      <label className="flex flex-col gap-1 text-[13px] text-ink-secondary">
        Role
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleVal)}
          disabled={pending || isSelf}
          className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="buyer">buyer</option>
          <option value="supplier">supplier</option>
          <option value="admin">admin</option>
        </select>
        {isSelf ? (
          <span className="text-[12px] text-ink-tertiary">
            You can&apos;t change your own role — ask another admin.
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-[13px] text-ink-secondary">
        Plan
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value as PlanVal)}
          disabled={pending}
          className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
        >
          {PLAN_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-ink-secondary">Status:</span>
          <span className="text-sm">
            {suspended ? "Suspended" : "Active"}
          </span>
          <Button
            type="button"
            variant={suspended ? "primary" : "destructive"}
            size="sm"
            onClick={onSuspendClick}
            disabled={pending || isSelf}
          >
            {suspended
              ? "Un-suspend"
              : reasonOpen
                ? "Confirm suspend"
                : "Suspend"}
          </Button>
        </div>
        {isSelf ? (
          <p className="text-[12px] text-ink-tertiary">
            You can&apos;t suspend your own account.
          </p>
        ) : null}
        {reasonOpen && !suspended ? (
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for suspending (required)"
            maxLength={2000}
            className="w-full rounded-input border border-hairline bg-bg-l0 px-2 py-1 text-xs outline-none focus:border-accent-indigo"
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={pending || !isDirty}
        >
          {isDirty ? "Save changes" : "No changes"}
        </Button>
        {pending ? (
          <span className="text-[12px] text-ink-tertiary">Saving…</span>
        ) : null}
      </div>

      {error ? <p className="text-xs text-sem-red">{error}</p> : null}
    </div>
  );
}
