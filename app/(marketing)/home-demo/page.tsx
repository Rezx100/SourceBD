// /home-demo — retired founder-review route.
//
// The approved composition was promoted to the production homepage at
// app/(marketing)/page.tsx (23 Jul 2026). Permanent redirect keeps old
// review links working.

import { permanentRedirect } from "next/navigation";

export default function HomeDemoPage() {
  permanentRedirect("/");
}
