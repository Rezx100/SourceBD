import type { ReactNode } from "react";

import { Kicker } from "@/components/marketing/home/kicker";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  kicker: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** `editorial` = page sections; `rail` = Evidence two-column stack (unchanged). */
  measure?: "editorial" | "rail";
  scale?: "standard" | "feature" | "closing";
  tone?: "default" | "inverse";
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

/**
 * Demo-home section heading contract.
 * Matches the platform stack used by safety-remediation and peer sections:
 * kicker → title `mt-3`; title → description opens wider (`mt-5` / `mt-6`).
 */
export function SectionHeader({
  kicker,
  title,
  description,
  measure = "editorial",
  scale = "standard",
  tone = "default",
  className,
  titleClassName,
  descriptionClassName,
}: SectionHeaderProps) {
  const inverse = tone === "inverse";
  const rail = measure === "rail";

  return (
    <header
      className={cn(rail ? "max-w-2xl" : "w-full max-w-[56rem]", className)}
    >
      <Kicker
        className={cn(inverse && "text-white/70 [&>span]:bg-white/70")}
      >
        {kicker}
      </Kicker>
      <h2
        className={cn(
          "mt-3 font-display",
          scale === "standard" && "text-2xl md:text-3xl",
          scale === "feature" && "text-2xl md:text-3xl lg:text-4xl",
          scale === "closing" && "text-3xl md:text-4xl",
          rail
            ? "max-w-[24ch] text-balance font-bold leading-tight tracking-tight"
            : "text-balance font-extrabold leading-[1.05] tracking-[-0.03em]",
          inverse ? "!text-white" : rail ? "text-neutral-900" : "text-[#111]",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "text-base leading-relaxed",
            rail ? "mt-5 max-w-[62ch]" : "mt-6 max-w-[48rem]",
            inverse ? "text-white/85" : "text-neutral-600",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
