import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Button (§21.1): indigo is interaction-only — primary uses --accent-indigo.
// Forest green is reserved for brand surfaces, never interactive primitives.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-pill font-semibold text-[13px] " +
    "border transition-[transform,box-shadow,background-color,color] " +
    "duration-hover ease-smooth active:scale-[0.99] active:duration-press " +
    "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-surface-l1 text-ink-primary border-hairline-strong hover:shadow-l1",
        primary:
          "bg-accent-indigo text-ink-on-accent border-accent-indigo hover:shadow-l1",
        outline:
          "bg-transparent text-ink-primary border-hairline-strong hover:bg-surface-l1 hover:shadow-l1",
        ghost:
          "bg-transparent text-ink-secondary border-transparent hover:bg-brand-forest-tint hover:text-ink-primary",
        danger:
          "bg-white text-sem-red border-sem-red hover:bg-sem-red hover:text-white",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-[12px]",
        lg: "h-10 px-5",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
