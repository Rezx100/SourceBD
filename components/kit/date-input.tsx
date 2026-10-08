"use client";

// A day typed in the app's own form, not the browser's date box. Client: it keeps the text as typed
// beside the day it means; the kit's other fields are server-safe and stay in fields.tsx.

import { useState, type ComponentProps } from "react";
import { formatDay, parseDay } from "@/lib/dashboard/facts";
import { Input } from "./fields";

/**
 * A day in the app's own form ("15 Nov 2026"), never the browser's date box, which showed a UK buyer
 * "10/15/2026" (critique of 7 Oct 2026, item 3). `value` is `YYYY-MM-DD` or ""; the text is read
 * day-first as it is typed (`parseDay`) and reprinted in the app's form when the field is left.
 * Text that is not a day stays in the field, marked invalid, with the form to use in its title.
 */
export function DateInput({
  value,
  onChange,
  className,
  ...rest
}: Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange" | "placeholder" | "inputMode"> & { value: string; onChange: (iso: string) => void }) {
  const [text, setText] = useState(() => formatDay(value) ?? "");
  const [shown, setShown] = useState(value);
  // A value set from outside (a saved draft arriving) reprints the field; typing never does.
  if (shown !== value) {
    setShown(value);
    setText(formatDay(value) ?? "");
  }
  const bad = text.trim() !== "" && parseDay(text) === null;
  return (
    <Input
      {...rest}
      type="text"
      inputMode="text"
      autoComplete="off"
      placeholder="15 Nov 2026"
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const iso = t.trim() ? parseDay(t) : "";
        // Known as it is typed, so a send the moment after still carries the day.
        if (iso !== null && iso !== value) {
          setShown(iso);
          onChange(iso);
        }
      }}
      onBlur={() => {
        const iso = parseDay(text);
        if (iso) setText(formatDay(iso) ?? text);
      }}
      aria-invalid={bad ? true : rest["aria-invalid"]}
      title={bad ? "Write the day as 15 Nov 2026" : undefined}
      className={className}
    />
  );
}
