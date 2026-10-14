// A demo on a textile stage (M4): as the screenshots sit on the product pages, with the snapshot's caption under
// the stage rather than on the cloth (the demo is given `caption={false}`). Server component; the demo inside is
// the client.

import type { ReactNode } from "react";
import { Stage, type StillName } from "@/components/site/sections/ui";
import { CAPTION } from "@/lib/marketing/demo-snapshot";

export function Staged({ still, eager = false, children, after }: { still: StillName; eager?: boolean; children: ReactNode; /** A line under the caption (the live count on the search page). */ after?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <Stage still={still} eager={eager}>
        {children}
      </Stage>
      <p className="text-sm text-ink-subtle">{CAPTION}</p>
      {after}
    </div>
  );
}
