// 8 · Inside one record (the founder's videos of 22 Oct 2026: show the whole dashboard, not a modified piece of it, no
// small print under it, and animate it): Aboni Knitwear's record as the app draws it for the admin account, in its
// browser window on a photograph of the buyer's swatch table, the camera drifting in to the record's head and its
// export figures and back (a clip composed in code from a real capture, PROVENANCE.md).

import { cn } from "@/lib/utils";
import { BrowserFrame, Clip } from "./browser";
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
          <BrowserFrame url="sourcebd.net/app/suppliers/aboni-knitwear" className="mx-auto max-w-[1040px]">
            <Clip name="record" says="Aboni Knitwear's record in the app: its name, its facts line and its export figures, US$97.6m over two years, 131 buyers, the EU its biggest market." />
          </BrowserFrame>
        </Stage>
      </div>
    </section>
  );
}
