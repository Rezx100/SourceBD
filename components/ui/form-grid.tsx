// Spec R1 — FormGrid primitive.
//
// Standardises the ~20 forms across the codebase that hand-roll
// `grid grid-cols-1 sm:grid-cols-2/3 gap-4`. Server component, no
// behaviour — just layout. Children are <label> blocks or any field
// wrapper the form chose.

import * as React from "react";
import { cn } from "@/lib/utils";

type Cols = 1 | 2 | 3 | "profile";

type FormGridProps = React.HTMLAttributes<HTMLDivElement> & {
  cols?: Cols;
};

/**
 * Auto-collapses to single column on phones. `cols`:
 *   1        — always one column (use for narrow forms / wizards step bodies)
 *   2        — `xs` 1col → `sm` 2col
 *   3        — `xs` 1col → `sm` 2col → `lg` 3col
 *   profile  — `xs` 1col → `md` 2col (used by S2 supplier-profile editor)
 */
export function FormGrid({
  cols = 2,
  className,
  children,
  ...rest
}: FormGridProps) {
  const colClass =
    cols === 1
      ? "grid-cols-1"
      : cols === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : cols === 3
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          : /* profile */ "grid-cols-1 md:grid-cols-2";

  return (
    <div className={cn("grid gap-3 sm:gap-4", colClass, className)} {...rest}>
      {children}
    </div>
  );
}
