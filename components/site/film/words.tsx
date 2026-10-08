// A scene's words: the headline at the film's scene size and one short lede. No numbered label above it (founder's
// video, 7 Oct 2026: the numbers go, the text was too heavy); the headline carries the scene. Server component.

import type { ReactNode } from "react";
import { Lede } from "@/components/site/parts";
import { cn } from "@/lib/utils";

/** The scene headline: 64 on a desktop, 32 on a phone, at medium weight (600 read heavy at this size). */
export const SCENE_TYPE = "font-medium tracking-[-0.03em] text-ink [text-wrap:balance] text-film-scene-phone md:text-film-scene";

export function Words({ headline, lede, className }: { headline: ReactNode; lede?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <h2 className={cn(SCENE_TYPE, "max-w-[640px] leading-[1.04]")}>{headline}</h2>
      {lede ? <Lede className="max-w-[520px]">{lede}</Lede> : null}
    </div>
  );
}
