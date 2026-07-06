import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Tag — neutral pill chip used in header chip rows, registry rows, etc.
const tagVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[13px] font-medium",
  {
    variants: {
      tone: {
        neutral:
          "bg-surface-l1 border-hairline-strong text-ink-secondary",
        muted:
          "bg-transparent border-hairline-strong border-dashed text-ink-tertiary",
        green:
          "bg-sem-green-soft border-sem-green text-sem-green",
        amber:
          "bg-sem-amber-soft border-sem-amber text-sem-amber",
        red:
          "bg-sem-red-soft border-sem-red text-sem-red",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface TagProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof tagVariants> {}

const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  ({ className, tone, ...props }, ref) => (
    <span ref={ref} className={cn(tagVariants({ tone }), className)} {...props} />
  ),
);
Tag.displayName = "Tag";

export { Tag, tagVariants };
