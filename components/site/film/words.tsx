// A scene's words (handoff-home-film §4): the chapter's small mono label, the headline at the film's scene size
// and the lede, as the opening draws them. Server component.

import type { ReactNode } from "react";
import { Label, Lede } from "@/components/site/parts";
import { cn } from "@/lib/utils";

/** The scene headline: 64 on a desktop, 32 on a phone (handoff §3.2). */
export const SCENE_TYPE = "font-semibold tracking-[-0.025em] text-ink [text-wrap:balance] text-film-scene-phone md:text-film-scene";

export function Words({ label, headline, lede }: { label: ReactNode; headline: ReactNode; lede?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Label>{label}</Label>
      <h2 className={cn(SCENE_TYPE, "max-w-[640px] leading-[1.06]")}>{headline}</h2>
      {lede ? <Lede>{lede}</Lede> : null}
    </div>
  );
}
