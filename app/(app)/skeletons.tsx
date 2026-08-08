// Shared app-shell skeleton library. These components used to live in
// `app/(app)/loading.tsx`, which doubled as the route-group Suspense
// fallback. REZ-72 removed the group loading files: a `loading.tsx` anywhere
// above the supplier profile page lets Next flush the shell with HTTP 200
// before notFound()/permanentRedirect() can set the status (the soft-200 the
// issue exists to kill). The skeletons themselves are still used by the
// per-segment `loading.tsx` files below `app/(app)/**`, so they live here as
// a plain module now. Server-safe: no client hooks, matching
// `components/ui/skeleton`.

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

function PageHeaderSkeleton({
  titleWidth,
  descriptionWidth = 420,
  actionWidth = 0,
}: {
  titleWidth: number;
  descriptionWidth?: number | string;
  actionWidth?: number;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 inline-flex items-center gap-2">
          <Skeleton w={6} h={6} shape="circle" />
          <Skeleton w={58} h={11} />
        </div>
        <Skeleton w={titleWidth} h={34} />
        {descriptionWidth ? (
          <Skeleton w={descriptionWidth} h={15} className="mt-2.5 max-w-full" />
        ) : null}
      </div>
      {actionWidth > 0 ? (
        <Skeleton w={actionWidth} h={38} shape="pill" className="shrink-0" />
      ) : null}
    </header>
  );
}

function DetailCardSkeleton({ titleWidth, rows }: { titleWidth: number; rows: number }) {
  return (
    <section className="rounded-card border border-hairline bg-surface-l1 shadow-l1">
      <div className="border-b border-hairline px-4 py-4">
        <Skeleton w={titleWidth} h={18} />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton w={90} h={11} />
            <Skeleton w={i % 2 ? 130 : 180} h={13} />
          </div>
        ))}
      </div>
    </section>
  );
}

function BackAndHeaderSkeleton({ titleWidth }: { titleWidth: number }) {
  return (
    <div className="space-y-4">
      <Skeleton w={92} h={18} />
      <PageHeaderSkeleton titleWidth={titleWidth} descriptionWidth="100%" />
    </div>
  );
}

function StatTileSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-card border border-hairline bg-surface-l1 p-5 shadow-[0_1px_2px_rgba(15,15,20,0.05)]">
      <Skeleton w={86} h={12} />
      <Skeleton w={52} h={28} className="mt-2" />
      <Skeleton w="82%" h={11} className="mt-2" />
    </div>
  );
}

function FormCardSkeleton() {
  return (
    <section className="proto-card space-y-5">
      <div className="proto-card-head">
        <Skeleton w={150} h={18} />
        <Skeleton w={90} h={12} />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton w={120 + i * 12} h={11} />
          <Skeleton w="100%" h={38} shape="card" tone="card" />
        </div>
      ))}
      <div className="flex justify-end">
        <Skeleton w={120} h={38} shape="pill" />
      </div>
    </section>
  );
}

function ExpiryBucketSkeleton({ evidence = false }: { evidence?: boolean }) {
  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface-l1 shadow-l1">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-4 sm:px-5">
        <div>
          <Skeleton w={150} h={18} />
          <Skeleton w={330} h={13} className="mt-1" />
        </div>
        <Skeleton w={88} h={24} shape="pill" />
      </div>
      <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(170px,0.9fr)_minmax(140px,0.55fr)] gap-4 border-b border-hairline bg-bg-l0 px-4 py-2 md:grid">
        <Skeleton w={60} h={10} />
        <Skeleton w={80} h={10} />
        <Skeleton w={90} h={10} />
        {evidence ? <Skeleton w={70} h={10} /> : null}
      </div>
      <div className="divide-y divide-hairline">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className={evidence ? "grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.35fr)_minmax(150px,0.85fr)_minmax(130px,0.7fr)_auto] md:items-start md:gap-4" : "grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.35fr)_minmax(170px,0.9fr)_minmax(140px,0.55fr)] md:items-start md:gap-4"}>
            <div>
              <Skeleton w={150} h={15} />
              <Skeleton w={100} h={12} className="mt-1" />
            </div>
            <div>
              <Skeleton w={68} h={24} shape="pill" />
              <Skeleton w={120} h={11} className="mt-2" />
            </div>
            <div>
              <Skeleton w={96} h={14} />
              <Skeleton w={54} h={22} shape="pill" className="mt-1" />
            </div>
            {evidence ? <Skeleton w={116} h={32} shape="pill" /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <Skeleton w={92} h={38} shape="pill" />
        <Skeleton w={105} h={38} shape="pill" />
      </header>
      <div className="flex min-h-[522px] flex-1 flex-col rounded-card border border-hairline bg-surface-l1 shadow-[0_1px_2px_rgba(15,15,20,0.03)]">
        <div className="border-b border-hairline px-5 py-4">
          <div className="flex items-center gap-2">
            <Skeleton w={190} h={20} />
            <Skeleton w={78} h={24} shape="pill" />
          </div>
          <Skeleton w={150} h={12} className="mt-1" />
        </div>
        <div className="flex-1 space-y-4 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={i % 2 ? "ml-auto max-w-[72%]" : "max-w-[72%]"}>
              <Skeleton w="100%" h={54} shape="card" tone="card" />
            </div>
          ))}
        </div>
        <div className="border-t border-hairline p-4">
          <Skeleton w="100%" h={44} shape="pill" />
        </div>
      </div>
    </div>
  );
}

export function MasterDetailSkeleton({ kind }: { kind: "rfq" | "order" }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[322px_minmax(0,1fr)]">
      <aside className="hidden overflow-hidden rounded-card border border-hairline bg-surface-l1 lg:block">
        <div className="border-b border-hairline p-4">
          <Skeleton w={kind === "rfq" ? 95 : 110} h={16} />
        </div>
        <div className="divide-y divide-hairline">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton w={i % 2 ? "58%" : "72%"} h={14} />
              <Skeleton w="44%" h={11} className="mt-1.5" />
            </div>
          ))}
        </div>
      </aside>
      <div className="space-y-6">
        <Skeleton w={88} h={18} className="lg:hidden" />
        <header className="space-y-1">
          <Skeleton w={90} h={11} />
          <div className="flex items-center gap-2">
            <Skeleton w={240} h={28} />
            <Skeleton w={70} h={24} shape="pill" />
          </div>
          <Skeleton w={220} h={12} />
        </header>
        <DetailCardSkeleton titleWidth={kind === "rfq" ? 115 : 80} rows={4} />
        <DetailCardSkeleton titleWidth={150} rows={3} />
        <DetailCardSkeleton titleWidth={70} rows={4} />
      </div>
    </div>
  );
}

export function FormPageSkeleton({ titleWidth, max }: { titleWidth: number; max: string }) {
  return (
    <div className={`mx-auto ${max} space-y-4`}>
      <PageHeaderSkeleton titleWidth={titleWidth} descriptionWidth={0} actionWidth={110} />
      <FormCardSkeleton />
    </div>
  );
}

export function ExpirySkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackAndHeaderSkeleton titleWidth={390} />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </section>
      <ExpiryBucketSkeleton evidence />
      <ExpiryBucketSkeleton />
      <ExpiryBucketSkeleton evidence />
    </div>
  );
}

export function UflpaSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackAndHeaderSkeleton titleWidth={320} />
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </section>
      <DetailCardSkeleton titleWidth={170} rows={6} />
    </div>
  );
}

export function MsaSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackAndHeaderSkeleton titleWidth={500} />
      <section className="rounded-card border border-hairline bg-surface-l1 shadow-l1">
        <div className="border-b border-hairline px-4 py-4">
          <Skeleton w={150} h={18} />
          <Skeleton w={260} h={12} className="mt-1" />
        </div>
        <div className="p-4">
          <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatTileSkeleton key={i} />
            ))}
          </section>
          <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <DetailCardSkeleton key={i} titleWidth={95} rows={3} />
            ))}
          </section>
        </div>
      </section>
      <FormCardSkeleton />
    </div>
  );
}

export function SettingsFormSkeleton({ titleWidth }: { titleWidth: number }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackAndHeaderSkeleton titleWidth={titleWidth} />
      {Array.from({ length: 4 }).map((_, i) => (
        <DetailCardSkeleton key={i} titleWidth={140 + (i % 2) * 40} rows={2 + (i % 2)} />
      ))}
    </div>
  );
}

export function SettingsPlanSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackAndHeaderSkeleton titleWidth={80} />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <DetailCardSkeleton key={i} titleWidth={100} rows={4} />
        ))}
      </section>
      <DetailCardSkeleton titleWidth={140} rows={3} />
    </div>
  );
}

export function SupplierSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeaderSkeleton titleWidth={220} descriptionWidth={360} />
      <DetailCardSkeleton titleWidth={180} rows={2} />
      <section className="space-y-3">
        <Skeleton w={150} h={22} />
        <DetailCardSkeleton titleWidth={200} rows={3} />
        <DetailCardSkeleton titleWidth={200} rows={3} />
      </section>
    </div>
  );
}

export function AdminDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackAndHeaderSkeleton titleWidth={260} />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_322px]">
        <div className="space-y-4">
          <DetailCardSkeleton titleWidth={180} rows={5} />
          <DetailCardSkeleton titleWidth={150} rows={5} />
        </div>
        <DetailCardSkeleton titleWidth={120} rows={4} />
      </section>
    </div>
  );
}
