import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

// Shared centred chrome for all (auth) pages: login / signup /
// forgot-password / reset-password. Pure F1-primitive consumer — no new
// tokens, no new fonts.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-[80vh] max-w-md items-center px-6 py-16 focus:outline-none">
      <Card className="w-full">{children}</Card>
    </main>
  );
}
