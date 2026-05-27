import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Badge — mono numeric / status indicator (count chip, alert pill).
// Forest-tinted "active" variant for sidebar active-state count badges.
const badgeVariants = cva(
  "inline-flex min-w-[18px] items-center justify-center rounded-[4px] border px-1.5 py-[3px] text-center font-mono text-[10px] font-semibold tracking-[0.02em]",
  {
    variants: {
      tone: {
        neutral: "border-hairline bg-white/80 text-ink-tertiary",
        active:
          "border-[rgba(31,77,58,0.18)] bg-brand-forest-tint text-brand-forest",
        alert: "border-[rgba(200,16,46,0.3)] bg-sem-red-soft text-sem-red",
        success: "border-sem-green bg-sem-green-soft text-sem-green",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props} />
  ),
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
