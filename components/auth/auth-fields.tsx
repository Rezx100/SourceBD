"use client";

// Shared auth form primitives — light-mode, Magic UI aligned.
//
// These are presentation-only inputs styled with Tailwind per the
// SourceBD Magic UI design system (light mode, forest #1f4d3a as the
// only accent). They do NOT change any submission wiring: every auth
// form still posts to the Supabase server actions in
// `app/(auth)/actions.ts`.

import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";

import { BorderBeam } from "@/components/ui/border-beam";
import { cn } from "@/lib/utils";

const WRAP =
  "flex h-12 items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3.5 shadow-[0_1px_2px_rgba(16,25,20,0.04)] transition-all focus-within:border-[#1f4d3a] focus-within:ring-4 focus-within:ring-[#1f4d3a]/10";
// 18px base on mobile prevents iOS Safari from zooming the viewport on focus;
// scales down to the design size from sm up.
const INPUT =
  "h-full flex-1 bg-transparent text-base text-neutral-900 outline-none placeholder:text-neutral-400 sm:text-[0.95rem]";
const LABEL = "block text-sm font-medium text-neutral-700";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
};

function FieldShell({ id, label, hint, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-neutral-500">{hint}</p> : null}
    </div>
  );
}

type TextFieldProps = ComponentPropsWithoutRef<"input"> & {
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
};

export function TextField({ label, icon, hint, id, className, ...props }: TextFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint}>
      <div className={WRAP}>
        {icon ? <span className="text-neutral-400">{icon}</span> : null}
        <input id={fieldId} className={cn(INPUT, className)} {...props} />
      </div>
    </FieldShell>
  );
}

export function PasswordField({
  label,
  icon,
  hint,
  id,
  className,
  ...props
}: TextFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const [show, setShow] = useState(false);
  return (
    <FieldShell id={fieldId} label={label} hint={hint}>
      <div className={WRAP}>
        {icon ? <span className="text-neutral-400">{icon}</span> : null}
        <input
          id={fieldId}
          type={show ? "text" : "password"}
          className={cn(INPUT, className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="grid size-7 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
        >
          {show ? <EyeSlash size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </FieldShell>
  );
}

type SelectFieldProps = ComponentPropsWithoutRef<"select"> & {
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
};

export function SelectField({
  label,
  icon,
  hint,
  id,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint}>
      <div className={WRAP}>
        {icon ? <span className="text-neutral-400">{icon}</span> : null}
        <select
          id={fieldId}
          className={cn(INPUT, "cursor-pointer appearance-none", className)}
          {...props}
        >
          {children}
        </select>
      </div>
    </FieldShell>
  );
}

export function SubmitButton({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="relative mt-1 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#1f4d3a] text-[0.95rem] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(31,77,58,0.55)] transition-colors hover:bg-[#2d6a4f] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
      {!pending ? (
        <BorderBeam
          size={64}
          duration={7}
          colorFrom="#8CBC9D"
          colorTo="#ffffff"
          borderWidth={1.5}
        />
      ) : null}
    </button>
  );
}

export function SecondaryButton({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-[0.95rem] font-medium text-neutral-800 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function AuthAlert({
  tone,
  children,
}: {
  tone: "error" | "info";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {children}
    </p>
  );
}
