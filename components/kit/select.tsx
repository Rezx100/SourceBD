"use client";

// Select (`02 Components · 2`): the closed field is an input with a caret; the open list
// is a menu with the chosen row in brand-tint and a check, and the row under the pointer
// or the arrow keys in sunken. Radix Select under it, so it posts with a form (`name`).

import { CaretDown, Check } from "@phosphor-icons/react";
import { Select as S } from "radix-ui";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fieldBox, selectItemClass } from "./classes";


export function Select({
  options,
  placeholder,
  size = "md",
  invalid,
  className,
  ...root
}: Omit<ComponentProps<typeof S.Root>, "children"> & {
  options: { value: string; label: ReactNode }[];
  placeholder?: string;
  size?: "md" | "touch";
  invalid?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
  className?: string;
}) {
  const { id, "aria-describedby": describedBy, "aria-label": ariaLabel, onValueChange, ...rootProps } = root;
  // Radix paints the chosen row's text into the field only once the page is live, so the
  // server's field was empty. The label is known here: the field shows it from the first paint.
  const [chosen, setChosen] = useState(rootProps.defaultValue);
  const shown = options.find((o) => o.value === (rootProps.value ?? chosen));
  return (
    <S.Root
      {...rootProps}
      onValueChange={(v) => {
        setChosen(v);
        onValueChange?.(v);
      }}
    >
      <S.Trigger
        id={id}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBox,
          "flex items-center justify-between text-left outline-none",
          size === "touch" ? "h-input-touch pl-3 pr-2.5 text-md" : "h-control pl-2.5 pr-2 text-base",
          "data-[state=open]:border-brand data-[state=open]:[box-shadow:inset_0_0_0_1px_theme(colors.brand)] focus:border-brand focus:[box-shadow:inset_0_0_0_1px_theme(colors.brand)]",
          "aria-[invalid=true]:border-danger aria-[invalid=true]:[box-shadow:inset_0_0_0_1px_theme(colors.danger)]",
          className,
        )}
      >
        <S.Value placeholder={placeholder}>{shown?.label}</S.Value>
        <S.Icon asChild>
          <CaretDown size={16} className="shrink-0 text-ink-2" aria-hidden />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={4}
          className="z-toast max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-auto rounded-lg border border-line bg-surface p-1 shadow-menu"
        >
          <S.Viewport>
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className={selectItemClass}
              >
                <S.ItemText>{o.label}</S.ItemText>
                <S.ItemIndicator>
                  <Check size={16} className="text-brand" aria-hidden />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
