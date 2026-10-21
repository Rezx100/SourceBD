// A still product part on a cloth stage (M4), with the snapshot's caption under the stage rather than on the cloth:
// the records page's locked contact card. A demo sets itself on its stage (`stage` on the demo, which also puts its
// pause button in the caption row). Server component.

import type { ReactNode } from "react";
import { Stage, type StillName } from "@/components/site/sections/ui";
import { CAPTION } from "@/lib/marketing/demo-snapshot";

export function Staged({ still, children }: { still: StillName; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <Stage still={still}>{children}</Stage>
      <p className="text-sm text-ink-subtle">{CAPTION}</p>
    </div>
  );
}
