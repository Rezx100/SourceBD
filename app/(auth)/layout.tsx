// Auth route-group layout. The v4 auth pages draw their own frame (`components/auth/frame.tsx`,
// `state.tsx`) on the root layout's fonts and tokens, so this adds nothing around them.
// H2 `auth` rate limit (10/min IP-bucketed) is enforced upstream by `middleware.ts`.

import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
