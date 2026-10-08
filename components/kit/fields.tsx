// Inputs (`02 Components · 2`): label above at 13/500, help below at 12, the error
// below with an icon at 13. Native elements throughout (input, checkbox, radio), so a
// form posts and the keyboard works with no script. Phone sizes are `size="touch"`:
// 48 tall at 16px in a field, 44+ rows for a tick, 52x32 for a switch.

import { Check, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fieldBox, fieldEdge, ring } from "./classes";

type Size = "md" | "touch";

/**
 * Label, control, help or error. The control comes in as a function so it gets the ids
 * that tie the label, the help and the error to it:
 * `<Field label="HS code" error={e}>{(a) => <Input {...a} name="hs" />}</Field>`.
 */
export function Field({
  label,
  help,
  error,
  disabled,
  className,
  children,
}: {
  label: string;
  help?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  className?: string;
  children: (a: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}) {
  const id = useId();
  const note = error ? `${id}-error` : help ? `${id}-help` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium", disabled ? "text-disabled" : "text-ink")}>
        {label}
      </label>
      {children({ id, "aria-describedby": note, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-danger">
          <XCircle size={16} weight="fill" className="shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-xs text-ink-3">
          {help}
        </p>
      ) : null}
    </div>
  );
}

/** A text field, 32 tall (48 on a phone). `icon` sits at the start or the end of the field. */
export function Input({
  size = "md",
  icon: Glyph,
  iconSide = "start",
  className,
  ...rest
}: Omit<ComponentProps<"input">, "size"> & { size?: Size; icon?: Icon; iconSide?: "start" | "end" }) {
  const box = cn(
    fieldBox,
    fieldEdge,
    size === "touch" ? "h-input-touch px-3 text-md" : "h-control px-2.5 text-base",
    Glyph && (iconSide === "start" ? (size === "touch" ? "pl-10" : "pl-[34px]") : size === "touch" ? "pr-10" : "pr-[34px]"),
    className,
  );
  if (!Glyph) return <input className={box} {...rest} />;
  return (
    <div className="relative">
      <input className={box} {...rest} />
      <Glyph
        size={size === "touch" ? 20 : 16}
        className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2", iconSide === "start" ? "left-[9px] text-ink-3" : "right-2 text-ink-2", size === "touch" && (iconSide === "start" ? "left-3" : "right-3"))}
        aria-hidden
      />
    </div>
  );
}

const ROW: Record<Size, string> = {
  md: "min-h-6 gap-2 text-base",
  touch: "min-h-12 w-full gap-3 border-b border-line text-md",
};

/**
 * Checkbox: a 16 box with a 24 hit area on desktop; a 20 box in a 48 row on a phone.
 * `mixed` is "some selected" (the header box); the page decides when.
 */
export function Checkbox({
  size = "md",
  mixed = false,
  children,
  className,
  ...rest
}: Omit<ComponentProps<"input">, "size" | "type"> & { size?: Size; mixed?: boolean; children?: ReactNode }) {
  const touch = size === "touch";
  return (
    <label className={cn("inline-flex items-center text-ink has-[:disabled]:text-disabled", ROW[size], !children && "w-auto border-0", className)}>
      <span className={cn("group/box relative inline-flex shrink-0", touch ? "size-5" : "size-4")} data-mixed={mixed || undefined}>
        <input
          type="checkbox"
          aria-checked={mixed ? "mixed" : undefined}
          className={cn(
            "peer absolute inset-0 m-0 size-full cursor-pointer appearance-none border border-line-strong bg-surface",
            touch ? "rounded-sm" : "rounded-[3px]",
            "[&:not(:checked):hover]:border-ink-2 [&:not(:checked):hover]:bg-subtle checked:border-brand-ink checked:bg-brand-ink group-data-[mixed]/box:border-brand-ink group-data-[mixed]/box:bg-brand-ink",
            "disabled:cursor-not-allowed disabled:border-line disabled:bg-sunken aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger",
            ring,
          )}
          {...rest}
        />
        <Check size={touch ? 14 : 12} className="pointer-events-none absolute inset-0 m-auto hidden text-surface peer-checked:block group-data-[mixed]/box:hidden" aria-hidden />
        <span className="pointer-events-none absolute inset-0 m-auto hidden h-0.5 w-2 bg-surface group-data-[mixed]/box:block" aria-hidden />
      </span>
      {children}
    </label>
  );
}

/** Radio: a 16 ring that fills to a 6px dot (20 and 6 on a phone). Group by `name`. */
export function Radio({
  size = "md",
  children,
  className,
  ...rest
}: Omit<ComponentProps<"input">, "size" | "type"> & { size?: Size; children: ReactNode }) {
  const touch = size === "touch";
  return (
    <label className={cn("inline-flex items-center text-ink has-[:disabled]:text-disabled", ROW[size], className)}>
      <input
        type="radio"
        className={cn(
          "m-0 shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface",
          touch ? "size-5 checked:border-[6px]" : "size-4 checked:border-[5px]",
          "checked:border-brand-ink disabled:cursor-not-allowed disabled:border-line disabled:bg-sunken",
          ring,
        )}
        {...rest}
      />
      {children}
    </label>
  );
}

/**
 * Switch, 32x18 on desktop; 52x32 inside a 44+ row on a phone. A checkbox with
 * `role="switch"`, so it posts with a form. Give it a name through `children` or `aria-label`.
 */
export function Switch({
  size = "md",
  children,
  hint,
  className,
  ...rest
}: Omit<ComponentProps<"input">, "size" | "type" | "role"> & { size?: Size; children?: ReactNode; hint?: ReactNode }) {
  const touch = size === "touch";
  const control = (
    <input
      type="checkbox"
      role="switch"
      className={cn(
        "relative m-0 shrink-0 cursor-pointer appearance-none rounded-full bg-line-strong transition-colors duration-fast",
        "before:absolute before:rounded-full before:bg-surface before:transition-transform before:duration-fast before:content-['']",
        touch
          ? "h-8 w-[52px] before:left-[3px] before:top-[3px] before:size-[26px] checked:before:translate-x-5"
          : "h-[18px] w-8 before:left-0.5 before:top-0.5 before:size-3.5 checked:before:translate-x-3.5",
        "checked:bg-brand-ink disabled:cursor-not-allowed disabled:bg-sunken disabled:before:border disabled:before:border-line",
        ring,
        !children && className,
      )}
      {...rest}
    />
  );
  if (!children) return control;
  if (!touch)
    return (
      <label className={cn("inline-flex items-center gap-2 text-base text-ink has-[:disabled]:text-disabled", className)}>
        {control}
        {children}
      </label>
    );
  // A phone row: title and what it covers on the left, the switch on the right, hairlines above and below.
  return (
    <label className={cn("flex min-h-11 items-center justify-between gap-4 border-y border-cert-valid-edge py-2 has-[:disabled]:text-disabled", className)}>
      <span className="flex flex-col gap-0.5">
        <span className="text-md font-medium text-ink">{children}</span>
        {hint ? <span className="text-sm text-ink-3">{hint}</span> : null}
      </span>
      {control}
    </label>
  );
}
