import { Panel } from "@/components/dashboard/results-panel";
import { ResultsColumn, Workbench } from "@/components/dashboard/sheet";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

// The results page while the search runs, drawn with the page's own frame
// (`ResultsColumn`, `Panel`) and the ledger grid's own columns, so what
// arrives replaces its silhouette in place. The founder's walkthrough
// (28 Sep 2026) caught the old one: no filter bar, no toolbar, a narrower
// table than the real one — and, because the skeleton's styles had been left
// in the old design's stylesheet, no bars at all. The layout draws the shell.

/** The ledger grid's columns, wide view: `RESULTS_COLUMNS.wide` in `components/dashboard/results-table.tsx`. */
const GRID = "grid grid-cols-[40px_minmax(0,1fr)_152px_212px_120px_152px_104px] items-center";

export default function BuyerDiscoverLoading() {
  return (
    <Workbench>
      <ResultsColumn>
        <SkeletonRegion label="Loading results" className="flex flex-col gap-4">
          {/* The filter bar: funnel, chips, Add filter, the go disc. */}
          <div className="flex items-center gap-3 rounded-md bg-surface py-2 pl-3.5 pr-2.5 shadow-edge">
            <Skeleton w={16} h={16} />
            <Skeleton w={132} h={28} />
            <Skeleton w={104} h={28} />
            <Skeleton w={72} h={14} />
            <Skeleton w={32} h={32} shape="circle" className="ml-auto" />
          </div>
          <Panel className="overflow-hidden">
            {/* The panel header: select-all, title and count, the controls. */}
            <div className="flex flex-wrap items-center gap-3 border-b border-line-subtle px-4 py-2">
              <Skeleton w={16} h={16} />
              <Skeleton w={220} h={16} />
              <Skeleton w={140} h={12} />
              <span className="ml-auto flex items-center gap-1.5">
                <Skeleton w={150} h={28} />
                <Skeleton w={84} h={28} />
                <Skeleton w={104} h={28} />
                <Skeleton w={100} h={28} />
                <Skeleton w={60} h={28} />
              </span>
            </div>
            <div className="overflow-hidden">
              <div className="min-w-[62rem]">
                <div className={`${GRID} h-9 border-b border-line-subtle`}>
                  <span />
                  <Skeleton w={64} h={10} className="ml-3" />
                  <Skeleton w={120} h={10} className="ml-4" />
                  <Skeleton w={80} h={10} className="ml-4" />
                  <Skeleton w={80} h={10} className="ml-4" />
                  <Skeleton w={56} h={10} className="ml-auto mr-4" />
                  <span />
                </div>
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className={`${GRID} min-h-[52px] border-b border-line-subtle last:border-b-0`}>
                    <Skeleton w={16} h={16} className="ml-3" />
                    <span className="flex items-center gap-3 px-3 py-2">
                      <Skeleton w={40} h={40} />
                      <span className="flex flex-col gap-1.5">
                        <Skeleton w={i % 3 === 0 ? 220 : i % 3 === 1 ? 170 : 250} h={13} />
                        <Skeleton w={110} h={10} />
                      </span>
                    </span>
                    <span className="flex items-center gap-1 px-4">
                      <Skeleton w={12} h={12} />
                      {Array.from({ length: 3 }, (_, k) => (
                        <Skeleton key={k} w={20} h={20} />
                      ))}
                    </span>
                    <span className="flex gap-1 px-4">
                      <Skeleton w={84} h={24} />
                      <Skeleton w={72} h={24} />
                    </span>
                    <Skeleton w={84} h={12} className="ml-4" />
                    <Skeleton w={44} h={12} className="ml-auto mr-4" />
                    <span className="flex justify-end gap-1 pr-3">
                      <Skeleton w={20} h={20} />
                      <Skeleton w={20} h={20} />
                      <Skeleton w={20} h={20} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </SkeletonRegion>
      </ResultsColumn>
    </Workbench>
  );
}
