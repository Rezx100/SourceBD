"use client";

import {
  motion,
  useInView,
  type Transition,
  type UseInViewOptions,
} from "motion/react";
import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type HighlightDirection = "ltr" | "rtl" | "ttb" | "btt";

interface TextHighlighterProps {
  children: React.ReactNode;
  className?: string;
  highlightColor?: string;
  transition?: Transition;
  useInViewOptions?: UseInViewOptions;
  triggerType?: "ref" | "inView" | "auto";
  direction?: HighlightDirection;
}

export function TextHighlighter({
  children,
  className,
  highlightColor = "#bfe3cf",
  transition = { type: "spring", duration: 1, delay: 0.2, bounce: 0 },
  useInViewOptions = { once: true, amount: 0.4, margin: "0px 0px -10% 0px" },
  triggerType = "inView",
  direction = "ltr",
}: TextHighlighterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inViewResult = useInView(ref, useInViewOptions);
  const isInView = triggerType === "inView" ? inViewResult : false;
  const [autoStarted, setAutoStarted] = useState(false);

  useEffect(() => {
    if (triggerType === "auto") {
      const t = setTimeout(() => setAutoStarted(true), 100);
      return () => clearTimeout(t);
    }
  }, [triggerType]);

  const shouldAnimate =
    triggerType === "auto" ? autoStarted : triggerType === "inView" ? isInView : true;

  const backgroundSize: Record<HighlightDirection, string> = {
    ltr: "0% 100%",
    rtl: "0% 100%",
    ttb: "100% 0%",
    btt: "100% 0%",
  };
  const backgroundPosition: Record<HighlightDirection, string> = {
    ltr: "0% 0%",
    rtl: "100% 0%",
    ttb: "0% 0%",
    btt: "0% 100%",
  };

  return (
    <motion.span
      ref={ref}
      className={cn(
        "box-decoration-clone rounded-[0.2em] px-0.5",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(${highlightColor}, ${highlightColor})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: backgroundPosition[direction],
      }}
      initial={{ backgroundSize: backgroundSize[direction] }}
      animate={
        shouldAnimate ? { backgroundSize: "100% 100%" } : undefined
      }
      transition={transition}
    >
      {children}
    </motion.span>
  );
}
