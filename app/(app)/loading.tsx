"use client";

// App-shell Suspense fallback. This can appear before the authenticated shell
// resolves, so it must be route-aware instead of a generic centered card.

import { DiscoverResultCardSkeleton } from "@/components/supplier/profile-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { usePathname } from "next/navigation";

export default function AppLoading() {
  const pathname = usePathname() ?? "/app";
  const content = getContentSkeleton(pathname);

  return (
    <SkeletonRegion className="flex min-h-dvh flex-col bg-bg-l0">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-hairline bg-surface-l1 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Skeleton w={28} h={28} shape="card" />
          <Skeleton w={96} h={18} />
        </div>
        <Skeleton w="100%" h={36} shape="pill" className="mx-auto hidden max-w-md md:block" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton w={32} h={32} shape="circle" />
          <Skeleton w={32} h={32} shape="circle" />
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row md:items-start">
        <aside
          aria-hidden
          className="hidden min-h-[calc(100dvh-3.5rem)] w-[72px] shrink-0 border-r border-hairline bg-surface-l1 px-3 py-4 md:block lg:hidden"
        >
          <div className="flex flex-col items-center gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} w={38} h={38} shape="card" />
            ))}
          </div>
        </aside>

        <aside
          aria-hidden
          className="hidden min-h-[calc(100dvh-3.5rem)] w-64 shrink-0 border-r border-hairline bg-surface-l1 px-4 py-5 lg:block"
        >
          <Skeleton w={150} h={12} />
          <div className="mt-5 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-card px-3 py-2">
                <Skeleton w={18} h={18} shape="circle" />
                <Skeleton w={i === 0 ? 92 : 116} h={13} />
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 px-4 pb-[calc(56px+env(safe-area-inset-bottom,0px)+1rem)] pt-6 md:min-h-[calc(100dvh-3.5rem)] md:px-10 md:pb-12 md:pt-10 lg:px-12">
          {content}
        </main>
      </div>

      <nav
        aria-hidden
        className="fixed inset-x-0 bottom-0 z-40 flex h-[56px] items-center justify-around border-t border-hairline bg-surface-l1 px-3 md:hidden"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} w={34} h={34} shape="card" />
        ))}
      </nav>
    </SkeletonRegion>
  );
}

function getContentSkeleton(pathname: string) {
  if (pathname === "/app" || pathname === "/app/") return <DashboardSkeleton />;
  if (pathname.startsWith("/app/discover")) return <DiscoverSkeleton />;
  if (pathname.startsWith("/app/saved")) return <SavedSkeleton />;
  if (pathname.startsWith("/app/messages/")) return <ThreadSkeleton />;
  if (pathname.startsWith("/app/messages")) return <InboxSkeleton title="Messages" />;
  if (pathname.startsWith("/app/rfqs/new")) return <FormPageSkeleton titleWidth={128} max="max-w-3xl" />;
  if (pathname.startsWith("/app/rfqs/")) return <MasterDetailSkeleton kind="rfq" />;
  if (pathname.startsWith("/app/rfqs")) return <DataListPageSkeleton titleWidth={72} actionWidth={125} />;
  if (pathname.startsWith("/app/orders/new")) return <FormPageSkeleton titleWidth={118} max="max-w-3xl" />;
  if (pathname.startsWith("/app/orders/")) return <MasterDetailSkeleton kind="order" />;
  if (pathname.startsWith("/app/orders")) return <OrdersSkeleton />;
  if (pathname.startsWith("/app/compliance/expiry")) return <ExpirySkeleton />;
  if (pathname.startsWith("/app/compliance/uflpa")) return <UflpaSkeleton />;
  if (pathname.startsWith("/app/compliance/msa")) return <MsaSkeleton />;
  if (pathname.startsWith("/app/compliance")) return <ComplianceHubSkeleton />;
  if (pathname.startsWith("/app/match")) return <SmartMatchSkeleton />;
  if (pathname.startsWith("/app/settings/profile")) return <SettingsFormSkeleton titleWidth={210} />;
  if (pathname.startsWith("/app/settings/notifications")) return <SettingsFormSkeleton titleWidth={185} />;
  if (pathname.startsWith("/app/settings/plan")) return <SettingsPlanSkeleton />;
  if (pathname.startsWith("/app/settings")) return <SettingsHubSkeleton />;
  if (pathname.startsWith("/supplier/messages/")) return <ThreadSkeleton />;
  if (pathname.startsWith("/supplier/messages")) return <InboxSkeleton title="Messages" />;
  if (pathname.startsWith("/supplier/rfqs/")) return <MasterDetailSkeleton kind="rfq" />;
  if (pathname.startsWith("/supplier/rfqs")) return <DataListPageSkeleton titleWidth={72} actionWidth={0} />;
  if (pathname.startsWith("/supplier")) return <SupplierSkeleton />;
  if (pathname.startsWith("/admin/suppliers/")) return <AdminDetailSkeleton />;
  if (pathname.startsWith("/admin")) return <AdminSkeleton />;
  return <DashboardSkeleton />;
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2">
            <Skeleton w={6} h={6} shape="circle" />
            <Skeleton w={52} h={11} />
          </div>
          <Skeleton w={150} h={34} />
          <Skeleton w={245} h={15} className="mt-2.5" />
        </div>
      </header>

      <section aria-hidden className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </section>

      <section aria-hidden className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <Skeleton w={135} h={20} />
          <Skeleton w={58} h={16} />
        </div>
        <ul className="grid grid-cols-1 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i}>
              <DiscoverResultCardSkeleton />
            </li>
          ))}
        </ul>
      </section>

      <section aria-hidden className="flex flex-col gap-3">
        <Skeleton w={128} h={20} />
        <ul className="m-0 list-none divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-l1 p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton w={16} h={16} shape="circle" />
              <div className="min-w-0 flex-1">
                <Skeleton w={i % 2 === 0 ? "72%" : "58%"} h={13} />
              </div>
              <Skeleton w={44} h={11} className="shrink-0" />
            </li>
          ))}
        </ul>
      </section>
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

function DiscoverSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeaderSkeleton titleWidth={180} descriptionWidth={420} />
      <section className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-1.5">
            <Skeleton w={70} h={10} />
            <Skeleton w="100%" h={40} shape="pill" tone="card" />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} w={72 + (i % 3) * 18} h={28} shape="pill" tone="card" />
            ))}
          </div>
        </div>
      </section>
      <div className="flex items-center justify-between gap-3">
        <Skeleton w={140} h={14} />
        <Skeleton w={180} h={36} shape="pill" tone="card" />
      </div>
      <ResultGrid count={6} />
    </div>
  );
}

function SavedSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeaderSkeleton titleWidth={210} descriptionWidth={360} />
      <ResultGrid count={6} />
    </div>
  );
}

function ResultGrid({ count }: { count: number }) {
  return (
    <ul className="grid grid-cols-1 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <DiscoverResultCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

function InboxSkeleton({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeaderSkeleton titleWidth={title === "Messages" ? 150 : 90} descriptionWidth={315} actionWidth={120} />
      <DataListRows rows={6} />
    </div>
  );
}

function DataListPageSkeleton({
  titleWidth,
  actionWidth,
}: {
  titleWidth: number;
  actionWidth: number;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeaderSkeleton titleWidth={titleWidth} descriptionWidth={520} actionWidth={actionWidth} />
      <DataListRows rows={6} />
    </div>
  );
}

function DataListRows({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i}>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton w={18} h={18} shape="circle" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton w={i % 2 === 0 ? 180 : 138} h={14} />
                <Skeleton w={64} h={24} shape="pill" />
              </div>
              <Skeleton w={i % 2 === 0 ? "56%" : "42%"} h={12} className="mt-1" />
            </div>
            <Skeleton w={58} h={11} className="shrink-0" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function OrdersSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeaderSkeleton titleWidth={92} descriptionWidth={450} actionWidth={115} />
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <Skeleton w={64} h={20} />
          <Skeleton w={18} h={11} />
        </div>
        <DataListRows rows={5} />
      </section>
    </div>
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
          <Skeleton w="100%" h={44} shape="pill" tone="card" />
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

export function FormPageSkeleton({ titleWidth, max }: { titleWidth: number; max: string }) {
  return (
    <div className={`mx-auto ${max} space-y-4`}>
      <PageHeaderSkeleton titleWidth={titleWidth} descriptionWidth={0} actionWidth={110} />
      <FormCardSkeleton />
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

function ComplianceHubSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeaderSkeleton titleWidth={180} descriptionWidth="100%" />
      <section className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <article key={i} className="h-full rounded-card border border-hairline bg-surface-l1 p-4 shadow-[0_1px_2px_rgba(15,15,20,0.05)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <Skeleton w={40} h={40} shape="card" />
              <Skeleton w={88} h={24} shape="pill" />
            </div>
            <Skeleton w={120} h={10} className="mt-4" />
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton w={170} h={19} />
                <Skeleton w="88%" h={12} className="mt-2" />
              </div>
              <Skeleton w={54} h={40} className="shrink-0" />
            </div>
          </article>
        ))}
      </section>
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

function BackAndHeaderSkeleton({ titleWidth }: { titleWidth: number }) {
  return (
    <div className="space-y-4">
      <Skeleton w={92} h={18} />
      <PageHeaderSkeleton titleWidth={titleWidth} descriptionWidth="100%" />
    </div>
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

function SmartMatchSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeaderSkeleton titleWidth={300} descriptionWidth="100%" />
      <ol className="flex items-center gap-2 text-[13px]">
        {[44, 82, 98].map((w, i) => (
          <li key={w} className="flex items-center gap-2">
            <Skeleton w={24} h={24} shape="pill" />
            <Skeleton w={w} h={11} />
            {i < 2 ? <Skeleton w={24} h={1} className="mx-1" /> : null}
          </li>
        ))}
      </ol>
      <FormCardSkeleton />
    </div>
  );
}

function SettingsHubSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeaderSkeleton titleWidth={170} descriptionWidth={460} />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <DetailCardSkeleton key={i} titleWidth={150} rows={3} />
        ))}
      </section>
      <DetailCardSkeleton titleWidth={95} rows={1} />
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

function AdminSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeaderSkeleton titleWidth={200} descriptionWidth={360} />
      <section className="grid grid-cols-1 gap-[15px] sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </section>
      <DetailCardSkeleton titleWidth={180} rows={6} />
      <DetailCardSkeleton titleWidth={160} rows={4} />
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
