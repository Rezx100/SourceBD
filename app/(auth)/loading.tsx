// Auth Suspense fallback: the split page's silhouette (the form column, and the panel from 1280).

import { Skeleton } from "@/components/kit";

export default function AuthLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh bg-surface">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-between px-4 sm:px-10">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-1 flex-col justify-center gap-8 px-4 pb-14 sm:px-10 xl:pl-40">
          <div className="flex w-full max-w-[420px] flex-col gap-8">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex flex-col gap-5">
              <Skeleton className="h-control-lg w-full" />
              <Skeleton className="h-control-lg w-full" />
              <Skeleton className="h-control-lg w-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="hidden w-pane shrink-0 border-l border-line bg-subtle xl:block" />
    </div>
  );
}
