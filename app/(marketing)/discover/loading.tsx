// I-027 — Public-discover skeleton (marketing chrome): the page's own start (label, headline, line, search box)
// and the rows that load under it, drawn from the kit's skeletons.

import { RowSkeleton, Skeleton } from "@/components/kit";
import { wrap } from "@/components/site/parts";
import { cn } from "@/lib/utils";

export default function PublicDiscoverLoading() {
  return (
    <main className="font-sans text-ink">
      <section className="pb-10 pt-20 max-md:pb-6 max-md:pt-10">
        <div className={cn(wrap, "flex flex-col gap-6")}>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-full max-w-[560px]" />
          <Skeleton tone="subtle" className="h-5 w-full max-w-[420px]" />
          <Skeleton className="h-12 w-full max-w-[560px]" />
        </div>
      </section>
      <section className="pb-24 max-md:pb-14">
        <div className={wrap}>
          <RowSkeleton rows={4} />
        </div>
      </section>
    </main>
  );
}
