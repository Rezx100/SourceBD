// Form controls of the dashboard kit: a labelled field, text input, textarea,
// select and switch. Plain elements with the kit's control styling, so a
// client form keeps its own state and handlers and only swaps its markup.
//
// Every control is 32px (`h-control`) with a `line-strong` outline — the 3:1
// control edge `lib/design/tokens.ts` reserves for exactly this — and the
// global focus ring. No `outline-none` anywhere: Tailwind emits it after the
// base `:focus-visible` ring and would leave a keyboard user with nothing.

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const CONTROL =
  "w-full min-w-0 rounded-sm border border-line-strong bg-surface px-2.5 text-base text-ink-strong placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-disabled aria-[invalid=true]:border-danger";

/** Label above, hint or error below. Pass the control's id as `htmlFor`. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-strong">
        {label}
        {required ? <span className="ml-1 text-ink-subtle">(required)</span> : null}
      </label>
      {children}
      {error ? (
        <span id={`${htmlFor}-error`} className="text-xs text-danger-ink">
          {error}
        </span>
      ) : hint ? (
        <span id={`${htmlFor}-hint`} className="text-xs text-ink-subtle">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(CONTROL, "h-control", className)} />;
}

export function TextArea({ className, rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} {...rest} className={cn(CONTROL, "py-2 leading-[1.375rem]", className)} />;
}

export function SelectInput({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(CONTROL, "h-control pr-8", className)}>
      {children}
    </select>
  );
}

/**
 * An on/off switch: a real checkbox with `role="switch"`, so it is one tab
 * stop, toggles on Space and says "on"/"off" to a screen reader.
 */
export function Switch({
  label,
  description,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 py-3", rest.disabled && "cursor-not-allowed", className)}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-medium text-ink-strong">{label}</span>
        {description ? <span className="text-sm text-ink-muted">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          {...rest}
          className="peer h-5 w-9 cursor-[inherit] appearance-none rounded-full border border-line-strong bg-surface-sunken transition-colors duration-fast checked:border-brand checked:bg-brand disabled:opacity-60"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-[3px] top-[3px] size-3.5 rounded-full bg-ink-muted transition-transform duration-fast peer-checked:translate-x-4 peer-checked:bg-brand-on motion-reduce:transition-none"
        />
      </span>
    </label>
  );
}
