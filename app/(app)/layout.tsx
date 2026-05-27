// Authenticated app shell. Wraps the buyer (`/app`), supplier (`/supplier`)
// and admin (`/admin`) route groups with the shared topbar + sidebar per
// `context/frontend-design-spec.md` §2. Per-role sidebar slot list is
// resolved client-side by `Sidebar` from the path. Auth enforcement lives in
// `middleware.ts` (placeholder in F2; real Supabase session in F3).

import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-l0">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
