// 8 · Inside one record (the founder's video of 22 Oct 2026: show the whole dashboard, not a modified piece of it, and
// no small print under it): Aboni Knitwear's record as the app draws it, read from the top in a recording from the
// admin account, in its browser window on a photograph of the buyer's swatch table.

import { cn } from "@/lib/utils";
import { Screen } from "./browser";
import { H2, Lede, Stage, measure } from "./ui";

export function InsideRecord() {
  return (
    <section aria-labelledby="home-inside" className="py-16 md:py-section">
      <div className={cn(measure, "flex flex-col items-center gap-10 md:gap-14")}>
        <div className="flex flex-col items-center gap-4 text-center">
          <H2 id="home-inside">Inside one record.</H2>
          <Lede className="mx-auto max-w-[600px]">Exports, memberships, certificates, inspections and buyers. Each fact names the register it came from.</Lede>
        </div>
        <Stage still="swatches" className="w-full">
          <Screen name="record" className="mx-auto max-w-[1040px]" />
        </Stage>
      </div>
    </section>
  );
}
